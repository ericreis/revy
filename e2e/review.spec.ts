import { test, expect, type Page } from '@playwright/test';
import { makeHarness, type HarnessEnv } from '../tests/helpers/harness.js';
import { runCli, shutdownServer, type CliResult } from './helpers.js';

// One hermetic environment + one launched review for the whole file. Because
// revy reuses a healthy server per state dir, later launches hit the same one.
let harness: HarnessEnv;
let launch: CliResult;

test.beforeAll(async () => {
  harness = makeHarness();
  launch = await runCli('octocat/hello-world#42', harness.env);
});

test.afterAll(async () => {
  await shutdownServer(launch.port);
  harness.cleanup();
});

/** Locate the diff section for a given file path. */
const fileSection = (page: Page, filePath: string) =>
  page.locator('.file', { has: page.locator('.file-path', { hasText: filePath }) });

test('launching revy writes a session and serves it over the loopback server', async () => {
  expect(launch.stdout).toContain('Fetching octocat/hello-world#42');
  const res = await fetch(`http://127.0.0.1:${launch.port}/api/session/${launch.key}`);
  expect(res.ok).toBe(true);
  const session = await res.json();
  expect(session).toMatchObject({
    pr: 'octocat/hello-world#42',
    title: 'Add a friendly greeting helper',
    author: 'octocat',
  });
});

test('the review header shows the PR title, link, branches, author, and stats', async ({ page }) => {
  await page.goto(launch.url);

  await expect(page.locator('.topbar-title')).toHaveText('Add a friendly greeting helper');

  const link = page.locator('.topbar-meta a');
  await expect(link).toHaveText('octocat/hello-world#42');
  await expect(link).toHaveAttribute('href', 'https://github.com/octocat/hello-world/pull/42');

  await expect(page.locator('.topbar-meta')).toContainText('main');
  await expect(page.locator('.topbar-meta')).toContainText('feature/greeting');
  await expect(page.locator('.topbar-meta')).toContainText('@octocat');
  await expect(page.locator('.topbar-meta .add')).toHaveText('+10');
  await expect(page.locator('.topbar-meta .del')).toHaveText('−4');
  await expect(page.locator('.topbar-meta')).toContainText('3 files');
});

test('the file tree lists every changed file with its own line counts', async ({ page }) => {
  await page.goto(launch.url);

  await expect(page.locator('.sidebar-head')).toContainText('3 files');

  const treeFiles = page.locator('.tree-file .tree-name');
  await expect(treeFiles).toHaveText(['greeting.ts', 'package-lock.json', 'README.md']);

  const greeting = page.locator('.tree-file', { hasText: 'greeting.ts' });
  await expect(greeting.locator('.add')).toHaveText('+7');
  await expect(greeting.locator('.del')).toHaveText('−2');
});

test('ordinary files render their diff while generated files auto-collapse', async ({ page }) => {
  await page.goto(launch.url);

  // Generated lockfile starts collapsed; its diff body is not rendered.
  await expect(fileSection(page, 'package-lock.json').locator('.file-head')).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await expect(fileSection(page, 'package-lock.json').locator('.file-body')).toHaveCount(0);

  // Source files start expanded and show their changed lines.
  const greeting = fileSection(page, 'src/greeting.ts');
  await expect(greeting.locator('.file-head')).toHaveAttribute('aria-expanded', 'true');
  await expect(greeting.locator('.file-body')).toContainText('DEFAULT_GREETING');
  await expect(fileSection(page, 'README.md').locator('.file-head')).toHaveAttribute(
    'aria-expanded',
    'true',
  );
});

test('collapse all / expand all toggles every file body', async ({ page }) => {
  await page.goto(launch.url);
  const heads = page.locator('.file-head');

  await page.getByRole('button', { name: 'Collapse all' }).click();
  for (const h of await heads.all()) {
    await expect(h).toHaveAttribute('aria-expanded', 'false');
  }

  await page.getByRole('button', { name: 'Expand all' }).click();
  for (const h of await heads.all()) {
    await expect(h).toHaveAttribute('aria-expanded', 'true');
  }
});

test('clicking a file in the tree expands it and marks it active', async ({ page }) => {
  await page.goto(launch.url);

  // package-lock.json is collapsed initially; clicking its tree entry opens it.
  const treeEntry = page.locator('.tree-file', { hasText: 'package-lock.json' });
  await treeEntry.click();

  await expect(treeEntry).toHaveClass(/active/);
  await expect(fileSection(page, 'package-lock.json').locator('.file-head')).toHaveAttribute(
    'aria-expanded',
    'true',
  );
});

test('relaunching the same PR reuses the running server and session key', async () => {
  const again = await runCli('octocat/hello-world#42', harness.env);
  expect(again.port).toBe(launch.port);
  expect(again.key).toBe(launch.key);
});

test('an unknown session key surfaces a friendly error', async ({ page }) => {
  await page.goto(`http://127.0.0.1:${launch.port}/session/deadbeefdeadbeef`);
  await expect(page.locator('.msg-error')).toContainText('session not found');
});

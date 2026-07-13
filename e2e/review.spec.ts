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

test('source diffs are syntax-highlighted by language', async ({ page }) => {
  await page.goto(launch.url);

  // greeting.ts is TypeScript, so refractor emits Prism token spans.
  const greeting = fileSection(page, 'src/greeting.ts');
  await expect(greeting.locator('.file-body .token.keyword').first()).toBeVisible();
  await expect(greeting.locator('.file-body .token.string').first()).toBeVisible();
});

test('the split toggle switches the diff between unified and side-by-side views', async ({
  page,
}) => {
  await page.goto(launch.url);

  const greeting = fileSection(page, 'src/greeting.ts');
  const diff = greeting.locator('.file-body table.diff');
  const splitButton = page.getByRole('button', { name: 'Split' });

  // Unified by default: the diff table renders in a single column.
  await expect(diff).toHaveClass(/\bdiff-unified\b/);
  await expect(splitButton).toHaveAttribute('aria-pressed', 'false');

  // On: the diff switches to the split (side-by-side) layout, and split-only
  // rows (left/right halves of a change) appear.
  await splitButton.click();
  await expect(diff).toHaveClass(/\bdiff-split\b/);
  await expect(splitButton).toHaveAttribute('aria-pressed', 'true');
  await expect(splitButton).toHaveClass(/\bactive\b/);

  // Off again: back to the unified layout.
  await splitButton.click();
  await expect(diff).toHaveClass(/\bdiff-unified\b/);
  await expect(splitButton).toHaveAttribute('aria-pressed', 'false');
});

test('the split view choice persists across reloads via localStorage', async ({ page }) => {
  await page.goto(launch.url);

  const splitButton = page.getByRole('button', { name: 'Split' });
  await splitButton.click();
  await expect(splitButton).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => localStorage.getItem('revy-view-type'))).toBe('split');

  // A fresh load of the same origin restores the split view from localStorage.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Split' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(fileSection(page, 'src/greeting.ts').locator('.file-body table.diff')).toHaveClass(
    /\bdiff-split\b/,
  );

  // Reset so the persisted preference does not leak into other tests.
  await page.getByRole('button', { name: 'Split' }).click();
});

test('the wrap toggle switches line wrapping on and off', async ({ page }) => {
  await page.goto(launch.url);

  // greeting.ts has a line long enough to overflow the viewport, so wrapping
  // has a visible effect: the file body stops scrolling horizontally.
  const body = fileSection(page, 'src/greeting.ts').locator('.file-body');
  const wrapButton = page.getByRole('button', { name: 'Wrap' });
  const overflows = () => body.evaluate((el) => el.scrollWidth > el.clientWidth);

  // Off by default: the long line overflows and the body scrolls horizontally.
  await expect(body).not.toHaveClass(/\bwrap\b/);
  await expect(wrapButton).toHaveAttribute('aria-pressed', 'false');
  expect(await overflows()).toBe(true);

  // On: the long line wraps, so there is no more horizontal overflow.
  await wrapButton.click();
  await expect(body).toHaveClass(/\bwrap\b/);
  await expect(wrapButton).toHaveAttribute('aria-pressed', 'true');
  expect(await overflows()).toBe(false);

  // Off again: back to scrolling.
  await wrapButton.click();
  await expect(body).not.toHaveClass(/\bwrap\b/);
  expect(await overflows()).toBe(true);
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

test('clicking a gutter line highlights it and shows a + button', async ({ page }) => {
  await page.goto(launch.url);

  // greeting.ts is expanded - find its diff gutters
  const greeting = fileSection(page, 'src/greeting.ts');
  await expect(greeting).toBeVisible();

  // Click the first gutter cell (line number) in the unified diff
  const firstGutter = greeting.locator('.diff-gutter').first();
  await firstGutter.click();

  // The gutter should now have the 'selected' class
  await expect(firstGutter).toHaveClass(/diff-gutter-selected/);

  // The + button should appear near the selected gutter
  const plusBtn = greeting.locator('.gutter-plus');
  await expect(plusBtn).toBeVisible();
});

test('clicking the + button opens a comment composer, submitting adds a thread widget', async ({
  page,
}) => {
  await page.goto(launch.url);

  const greeting = fileSection(page, 'src/greeting.ts');
  await greeting.locator('.diff-gutter').first().click();
  await greeting.locator('.gutter-plus').first().click();

  // The composer textarea should appear
  const textarea = greeting.locator('.thread-textarea');
  await expect(textarea).toBeVisible();

  // Type and submit
  await textarea.fill('Nice work on this function!');
  await greeting.getByRole('button', { name: 'Add review comment' }).click();

  // The thread widget should appear showing our comment
  await expect(greeting.locator('.thread-widget')).toBeVisible();
  await expect(greeting.locator('.thread-text')).toContainText('Nice work on this function!');

  // The draft badge should be visible
  await expect(greeting.locator('.badge-draft')).toBeVisible();
});

test('commenting on a context line anchors to the correct line on both sides', async ({ page }) => {
  await page.goto(launch.url);

  const greeting = fileSection(page, 'src/greeting.ts');

  // The hunk's only unchanged (context) line is the closing brace `}` at old
  // line 3 / new line 6 - the two diverge because 5 lines were added above it.
  // A comment placed here must anchor to new line 6, not old line 3.
  const closingLine = greeting.locator('tr.diff-line').filter({
    has: page.locator('td', { hasText: /^\}$/ }),
  });
  const newSideGutter = closingLine.locator('.diff-gutter').nth(1);
  await newSideGutter.click();
  await expect(newSideGutter).toHaveClass(/diff-gutter-selected/);

  await closingLine.locator('.gutter-plus').click();
  const textarea = greeting.locator('.thread-textarea');
  await expect(textarea).toBeVisible();
  await textarea.fill('Anchor check for the context line');
  await greeting.getByRole('button', { name: 'Add review comment' }).click();
  await expect(greeting.locator('.thread-text', { hasText: 'Anchor check for the context line' })).toBeVisible();

  const res = await fetch(`http://127.0.0.1:${launch.port}/api/session/${launch.key}`);
  const session = await res.json();
  const thread = session.threads.find(
    (t: { messages: { text: string }[] }) =>
      t.messages.some((m) => m.text === 'Anchor check for the context line'),
  );
  expect(thread.anchor).toMatchObject({ path: 'src/greeting.ts', line: 6, side: 'RIGHT' });
});

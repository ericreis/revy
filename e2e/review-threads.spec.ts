import path from 'node:path';
import { test, expect } from '@playwright/test';
import { makeHarness, FIXTURE_PR_DIR, type HarnessEnv } from '../tests/helpers/harness.js';
import { runCli, shutdownServer, type CliResult } from './helpers.js';

// Regression coverage for #24: review threads imported from GitHub via
// fetchReviewThreads must anchor using PullRequestReviewComment.line (the real
// file line), not PullRequestReviewThread.line (a stale diff position). The
// fixture below encodes exactly that mismatch: thread-level line=3 (would
// anchor to `return 'Hello there!';`) vs. comment-level line=5 (the correct
// `return \`Hello, ${name}!\`;` line).
let harness: HarnessEnv;
let launch: CliResult;

test.beforeAll(async () => {
  harness = makeHarness();
  harness.env.REVY_FAKE_GH_REVIEW_THREADS = path.resolve(FIXTURE_PR_DIR, 'review-threads.json');
  launch = await runCli('octocat/hello-world#42', harness.env);
});

test.afterAll(async () => {
  await shutdownServer(launch.port);
  harness.cleanup();
});

test('an imported GitHub review thread anchors to the comment file line, not the stale thread line', async ({
  page,
}) => {
  await page.goto(launch.url);

  const greeting = page.locator('.file', { has: page.locator('.file-path', { hasText: 'src/greeting.ts' }) });
  const widget = greeting.locator('.thread-widget');
  await expect(widget).toBeVisible();
  await expect(widget).toContainText('Should this fall back to a generic greeting instead?');

  // The widget must be rendered as a row directly after the comment's real
  // file line (5: the template-literal return), not after the stale
  // diff-position line (3: the early-return branch).
  const widgetRow = greeting.locator('tr', { has: page.locator('.thread-widget') });
  const precedingLine = widgetRow.locator('xpath=preceding-sibling::tr[contains(@class, "diff-line")][1]');
  await expect(precedingLine).toContainText('return `Hello, ${name}!`;');
  await expect(precedingLine).not.toContainText("return 'Hello there!';");
});

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, it, expect } from 'vitest';
import { fetchPr, fetchReviewThreads } from '../../src/github.js';
import { parsePrArg } from '../../src/pr.js';
import { makeFakeGhBin, FIXTURE_PR_DIR } from '../helpers/harness.js';

// fetchPr shells out to `gh`; we point PATH at a fake gh so this stays hermetic.
const ref = parsePrArg('octocat/hello-world#42');
const originalPath = process.env.PATH;
const binDirs: string[] = [];
const tmpDirs: string[] = [];

afterEach(() => {
  process.env.PATH = originalPath;
  delete process.env.REVY_FAKE_GH_DIR;
  delete process.env.REVY_FAKE_GH_FAIL;
  delete process.env.REVY_FAKE_GH_REVIEW_THREADS;
  while (binDirs.length) fs.rmSync(binDirs.pop()!, { recursive: true, force: true });
  while (tmpDirs.length) fs.rmSync(tmpDirs.pop()!, { recursive: true, force: true });
});

function useFakeGh(fail?: 'auth' | 'notfound'): void {
  const binDir = makeFakeGhBin();
  binDirs.push(binDir);
  process.env.PATH = `${binDir}${path.delimiter}${originalPath ?? ''}`;
  process.env.REVY_FAKE_GH_DIR = FIXTURE_PR_DIR;
  if (fail) process.env.REVY_FAKE_GH_FAIL = fail;
}

describe('fetchPr', () => {
  it('returns parsed metadata and the raw diff on success', async () => {
    useFakeGh();
    const { meta, rawDiff } = await fetchPr(ref);
    expect(meta).toMatchObject({
      number: 42,
      title: 'Add a friendly greeting helper',
      author: { login: 'octocat' },
      baseRefName: 'main',
      changedFiles: 3,
    });
    expect(rawDiff).toContain('diff --git a/src/greeting.ts b/src/greeting.ts');
  });

  it('translates an auth failure into a friendly message', async () => {
    useFakeGh('auth');
    await expect(fetchPr(ref)).rejects.toThrow(/not authenticated/i);
  });

  it('translates a missing PR into a friendly message', async () => {
    useFakeGh('notfound');
    await expect(fetchPr(ref)).rejects.toThrow(/Could not find PR #42/);
  });
});

describe('fetchReviewThreads', () => {
  it('anchors to the comment file line, not the thread diff-position line', async () => {
    useFakeGh();
    process.env.REVY_FAKE_GH_REVIEW_THREADS = path.resolve(FIXTURE_PR_DIR, 'review-threads.json');

    const [thread] = await fetchReviewThreads(ref);

    // The fixture's thread-level `line` (3) is a stale diff position; the
    // comment's `line` (5) is the real file line and must win.
    expect(thread.line).toBe(3);
    expect(thread.fileLine).toBe(5);
  });

  it('falls back to the thread line when no comment reports a line', async () => {
    useFakeGh();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'revy-threads-'));
    tmpDirs.push(dir);
    const file = path.join(dir, 'threads.json');
    fs.writeFileSync(
      file,
      JSON.stringify([
        {
          id: 'RT_2',
          isResolved: false,
          isOutdated: false,
          diffSide: 'RIGHT',
          path: 'src/greeting.ts',
          line: 6,
          originalLine: 6,
          startLine: null,
          originalStartLine: null,
          comments: { nodes: [{ author: null, body: 'hi', createdAt: '2024-01-01T00:00:00Z', line: null, diffSide: null }] },
        },
      ]),
    );
    process.env.REVY_FAKE_GH_REVIEW_THREADS = file;

    const [thread] = await fetchReviewThreads(ref);
    expect(thread.fileLine).toBeNull();
  });
});

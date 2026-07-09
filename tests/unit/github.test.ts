import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, it, expect } from 'vitest';
import { fetchPr } from '../../src/github.js';
import { parsePrArg } from '../../src/pr.js';
import { makeFakeGhBin, FIXTURE_PR_DIR } from '../helpers/harness.js';

// fetchPr shells out to `gh`; we point PATH at a fake gh so this stays hermetic.
const ref = parsePrArg('octocat/hello-world#42');
const originalPath = process.env.PATH;
const binDirs: string[] = [];

afterEach(() => {
  process.env.PATH = originalPath;
  delete process.env.REVY_FAKE_GH_DIR;
  delete process.env.REVY_FAKE_GH_FAIL;
  while (binDirs.length) fs.rmSync(binDirs.pop()!, { recursive: true, force: true });
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

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { toDiffFiles, isLargeOrGenerated, type DiffFile } from '../../web/src/diff.js';
import { FIXTURE_PR_DIR } from '../helpers/harness.js';

const rawDiff = fs.readFileSync(path.join(FIXTURE_PR_DIR, 'diff.patch'), 'utf8');

describe('toDiffFiles', () => {
  it('returns an empty list for an empty diff', () => {
    expect(toDiffFiles('')).toEqual([]);
    expect(toDiffFiles('   \n')).toEqual([]);
  });

  it('parses each file with a stable id, path, and change counts', () => {
    const files = toDiffFiles(rawDiff);
    expect(files.map((f) => f.path)).toEqual([
      'README.md',
      'package-lock.json',
      'src/greeting.ts',
    ]);
    expect(files.map((f) => f.id)).toEqual(['file-0', 'file-1', 'file-2']);

    const greeting = files.find((f) => f.path === 'src/greeting.ts')!;
    expect(greeting.additions).toBe(7);
    expect(greeting.deletions).toBe(2);
  });
});

describe('isLargeOrGenerated', () => {
  const file = (path: string, additions = 1, deletions = 0): DiffFile =>
    ({ id: 'x', path, type: 'modify', file: {} as never, additions, deletions });

  it('flags lockfiles and generated files', () => {
    expect(isLargeOrGenerated(file('package-lock.json'))).toBe(true);
    expect(isLargeOrGenerated(file('web/pnpm-lock.yaml'))).toBe(true);
    expect(isLargeOrGenerated(file('go.sum'))).toBe(true);
    expect(isLargeOrGenerated(file('dist/app.min.js'))).toBe(true);
  });

  it('flags very large diffs (> 300 changed lines)', () => {
    expect(isLargeOrGenerated(file('src/big.ts', 200, 101))).toBe(true);
    expect(isLargeOrGenerated(file('src/big.ts', 150, 150))).toBe(false);
  });

  it('leaves ordinary source files expanded', () => {
    expect(isLargeOrGenerated(file('src/greeting.ts', 7, 2))).toBe(false);
    expect(isLargeOrGenerated(file('README.md', 2, 1))).toBe(false);
  });
});

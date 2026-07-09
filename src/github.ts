import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { PrRef } from './pr.js';

const run = promisify(execFile);

export interface PrMeta {
  number: number;
  title: string;
  author: { login: string } | null;
  headRefName: string;
  baseRefName: string;
  headRefOid: string;
  url: string;
  additions: number;
  deletions: number;
  changedFiles: number;
}

export interface FetchedPr {
  meta: PrMeta;
  rawDiff: string;
}

const META_FIELDS =
  'number,title,author,headRefName,baseRefName,headRefOid,url,additions,deletions,changedFiles';

/**
 * Fetch a PR's metadata and unified diff via the `gh` CLI (uses the user's
 * existing GitHub auth). Throws a friendly error if `gh` is missing/unauthed.
 */
export async function fetchPr(ref: PrRef): Promise<FetchedPr> {
  const repo = `${ref.owner}/${ref.repo}`;
  const num = String(ref.number);
  try {
    const [metaRes, diffRes] = await Promise.all([
      run('gh', ['pr', 'view', num, '--repo', repo, '--json', META_FIELDS]),
      // Plain `gh pr diff` yields a unified `diff --git` patch (what
      // react-diff-view parses). `--patch` would return format-patch/mbox output.
      run('gh', ['pr', 'diff', num, '--repo', repo], {
        maxBuffer: 64 * 1024 * 1024,
      }),
    ]);
    const meta = JSON.parse(metaRes.stdout) as PrMeta;
    return { meta, rawDiff: diffRes.stdout };
  } catch (err: unknown) {
    throw translateGhError(err, repo, num);
  }
}

function translateGhError(err: unknown, repo: string, num: string): Error {
  const e = err as { code?: string; stderr?: string; message?: string };
  if (e.code === 'ENOENT') {
    return new Error(
      'The GitHub CLI (`gh`) was not found. Install it from https://cli.github.com/ and run `gh auth login`.',
    );
  }
  const stderr = (e.stderr || '').trim();
  if (/not logged|authentication|gh auth login/i.test(stderr)) {
    return new Error('GitHub CLI is not authenticated. Run `gh auth login`.');
  }
  if (/no pull requests found|could not resolve|not found/i.test(stderr)) {
    return new Error(`Could not find PR #${num} in ${repo}.`);
  }
  return new Error(stderr || e.message || 'Failed to fetch the PR via `gh`.');
}

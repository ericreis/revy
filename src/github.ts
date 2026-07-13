import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
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

const REVIEW_THREADS_QUERY = `
query($owner: String!, $repo: String!, $pr: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $pr) {
      reviewThreads(first: 100) {
        nodes {
          id
          isResolved
          isOutdated
          diffSide
          path
          line
          originalLine
          startLine
          originalStartLine
          comments(first: 20) {
            nodes {
              author { login }
              body
              createdAt
              line
              diffSide
            }
          }
        }
      }
    }
  }
}`;

export interface FetchedThread {
  id: string;
  isResolved: boolean;
  path: string;
  line: number;
  side: 'LEFT' | 'RIGHT';
  startLine?: number;
  /** File line number from the first comment (PullRequestReviewComment.line). */
  fileLine: number | null;
  comments: { author: string; body: string; createdAt: string }[];
}

/**
 * Fetch existing review threads from GitHub via GraphQL.
 */
export async function fetchReviewThreads(ref: PrRef): Promise<FetchedThread[]> {
  const repo = `${ref.owner}/${ref.repo}`;
  try {
    const { stdout } = await run(
      'gh',
      [
        'api', 'graphql',
        '-f', `owner=${ref.owner}`,
        '-f', `repo=${ref.repo}`,
        '-F', `pr=${ref.number}`,
        '-f', `query=${REVIEW_THREADS_QUERY}`,
      ],
    );
    const data = JSON.parse(stdout) as {
      data: {
        repository: {
          pullRequest: {
            reviewThreads: {
              nodes: Array<{
                id: string;
                isResolved: boolean;
                isOutdated: boolean;
                diffSide: string;
                path: string;
                line: number;
                originalLine: number;
                startLine: number | null;
                originalStartLine: number | null;
                comments: {
                  nodes: Array<{
                    author: { login: string } | null;
                    body: string;
                    createdAt: string;
                    line: number | null;
                    diffSide: string | null;
                  }>;
                };
              }>;
            };
          };
        };
      };
    };
    const nodes = data.data.repository.pullRequest.reviewThreads.nodes;
    return nodes.map((n) => {
      const firstComment = n.comments.nodes[0];
      return {
        id: n.id,
        isResolved: n.isResolved,
        path: n.path,
        line: n.line,
        side: ((firstComment?.diffSide ?? n.diffSide) === 'LEFT' ? 'LEFT' : 'RIGHT') as 'LEFT' | 'RIGHT',
        startLine: n.startLine ?? undefined,
        fileLine: firstComment?.line ?? null,
        comments: n.comments.nodes.map((c) => ({
          author: c.author?.login ?? 'unknown',
          body: c.body,
          createdAt: c.createdAt,
        })),
      };
    });
  } catch (err: unknown) {
    const e = err as { stderr?: string; message?: string };
    const stderr = (e.stderr || '').trim();
    throw new Error(stderr || e.message || 'Failed to fetch review threads via `gh`.');
  }
}

export interface ReviewComment {
  path: string;
  body: string;
  line: number;
  side: 'LEFT' | 'RIGHT';
  startLine?: number;
  startSide?: 'LEFT' | 'RIGHT';
}

/**
 * Submit a batch of draft comments as a single review via `gh api`.
 * Creates and immediately submits the review with all comments inline
 * using a single POST request (avoiding multi-step issues like stale
 * pending reviews and the 404 on the per-review comment endpoint).
 */
export async function submitReview(ref: PrRef, headSha: string, comments: ReviewComment[]): Promise<void> {
  const repo = `${ref.owner}/${ref.repo}`;
  const num = String(ref.number);
  try {
    const body = JSON.stringify({
      event: 'COMMENT',
      body: 'Review via revy',
      commit_id: headSha,
      comments: comments.map((c) => ({
        body: c.body,
        path: c.path,
        line: c.line,
        side: c.side,
        ...(c.startLine !== undefined ? { start_line: c.startLine, start_side: c.startSide ?? c.side } : {}),
      })),
    });

    const tmp = path.join(os.tmpdir(), `revy-review-${Date.now()}.json`);
    await fs.writeFile(tmp, body, 'utf8');
    try {
      await run('gh', ['api', '-X', 'POST', `repos/${repo}/pulls/${num}/reviews`, '--input', tmp]);
    } finally {
      await fs.unlink(tmp).catch(() => {});
    }
  } catch (err: unknown) {
    const e = err as { stderr?: string; message?: string };
    const stderr = (e.stderr || '').trim();
    throw new Error(stderr || e.message || 'Failed to submit review via `gh`.');
  }
}

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

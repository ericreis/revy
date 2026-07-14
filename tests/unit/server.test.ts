import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { afterAll, afterEach, beforeAll, describe, it, expect, vi } from 'vitest';
import { buildApp } from '../../src/server.js';
import { writeSession } from '../../src/session.js';
import { makeStateDir, makeFakeGhBin, FIXTURE_PR_DIR } from '../helpers/harness.js';

let baseUrl: string;
let server: http.Server;
let stateDir: string;

beforeAll(async () => {
  stateDir = makeStateDir();
  process.env.REVY_STATE_DIR = stateDir;
  server = http.createServer(buildApp());
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  delete process.env.REVY_STATE_DIR;
  fs.rmSync(stateDir, { recursive: true, force: true });
});

describe('buildApp routes', () => {
  it('reports health', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.ok).toBe(true);
    expect(await res.json()).toEqual({ ok: true, app: 'revy' });
  });

  it('404s for an unknown session', async () => {
    const res = await fetch(`${baseUrl}/api/session/nope`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'session not found' });
  });

  it('serves a session that has been written to disk', async () => {
    const now = new Date().toISOString();
    await writeSession({
      key: 'servedkey0000000',
      pr: 'octocat/hello-world#42',
      repo: 'octocat/hello-world',
      number: 42,
      title: 'Served session',
      author: 'octocat',
      headSha: 'abc',
      headRef: 'feature',
      baseRef: 'main',
      url: 'https://example.test/pr/42',
      stats: { additions: 10, deletions: 4, changedFiles: 3 },
      rawDiff: '',
      status: 'open',
      reviewOrder: [],
      threads: [],
      pending: [],
      createdAt: now,
      updatedAt: now,
    });
    const res = await fetch(`${baseUrl}/api/session/servedkey0000000`);
    expect(res.ok).toBe(true);
    expect(await res.json()).toMatchObject({ title: 'Served session', number: 42 });
  });

  it('refresh keeps both GitHub threads when they share an anchor line (#36)', async () => {
    // Regression coverage: a local synced thread with no githubThreadId
    // anchors to the same file line as two GitHub threads. Refresh must
    // match one GitHub thread by anchor *and* still add the other instead of
    // dropping it (the anchor key must not be treated as fully consumed).
    const binDir = makeFakeGhBin();
    const savedPath = process.env.PATH;
    const savedGhDir = process.env.REVY_FAKE_GH_DIR;
    const savedThreads = process.env.REVY_FAKE_GH_REVIEW_THREADS;
    process.env.PATH = `${binDir}${path.delimiter}${process.env.PATH ?? ''}`;
    process.env.REVY_FAKE_GH_DIR = FIXTURE_PR_DIR;
    process.env.REVY_FAKE_GH_REVIEW_THREADS = path.resolve(
      FIXTURE_PR_DIR,
      'review-threads-shared-anchor.json',
    );

    try {
      const now = new Date().toISOString();
      await writeSession({
        key: 'sharedanchor00000',
        pr: 'octocat/hello-world#42',
        repo: 'octocat/hello-world',
        number: 42,
        title: 'Shared anchor session',
        author: 'octocat',
        headSha: 'abc',
        headRef: 'feature',
        baseRef: 'main',
        url: 'https://example.test/pr/42',
        stats: { additions: 10, deletions: 4, changedFiles: 3 },
        rawDiff: '',
        status: 'open',
        reviewOrder: [],
        threads: [
          {
            id: 't_01',
            kind: 'comment',
            anchor: { path: 'src/greeting.ts', line: 3, side: 'RIGHT' },
            status: 'synced',
            messages: [{ role: 'user', text: 'First thread on this line', at: now }],
          },
        ],
        pending: [],
        createdAt: now,
        updatedAt: now,
      });

      const res = await fetch(`${baseUrl}/api/session/sharedanchor00000/refresh`, { method: 'POST' });
      expect(res.ok).toBe(true);
      const body = (await res.json()) as { added: number; threads: { githubThreadId?: string | null }[] };

      expect(body.threads).toHaveLength(2);
      const ghIds = body.threads.map((t) => t.githubThreadId).sort();
      expect(ghIds).toEqual(['RT_A', 'RT_B']);
    } finally {
      process.env.PATH = savedPath;
      if (savedGhDir === undefined) delete process.env.REVY_FAKE_GH_DIR;
      else process.env.REVY_FAKE_GH_DIR = savedGhDir;
      if (savedThreads === undefined) delete process.env.REVY_FAKE_GH_REVIEW_THREADS;
      else process.env.REVY_FAKE_GH_REVIEW_THREADS = savedThreads;
      fs.rmSync(binDir, { recursive: true, force: true });
    }
  });

  it('invokes the activity callback on each request', async () => {
    const onActivity = vi.fn();
    const probe = http.createServer(buildApp(onActivity));
    await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve));
    const addr = probe.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    await fetch(`http://127.0.0.1:${port}/health`);
    expect(onActivity).toHaveBeenCalled();
    await new Promise<void>((resolve) => probe.close(() => resolve()));
  });
});

import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { buildApp } from '../../src/server.js';
import { writeSession, readSession } from '../../src/session.js';
import { makeFakeGhBin, makeStateDir, FIXTURE_PR_DIR } from '../helpers/harness.js';

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

/** Build a minimal session object for testing. */
function makeSession(key: string, threads: import('../../src/types.js').Thread[]) {
  return {
    key,
    pr: 'octocat/hello-world#42',
    repo: 'octocat/hello-world',
    number: 42,
    title: 'Test session',
    author: 'octocat',
    headSha: 'abc',
    headRef: 'feature',
    baseRef: 'main',
    url: 'https://example.test/pr/42',
    stats: { additions: 10, deletions: 4, changedFiles: 3 },
    rawDiff: '',
    status: 'open' as const,
    reviewOrder: [] as string[],
    threads,
    pending: [] as unknown[],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeThread(id: string, overrides: Partial<import('../../src/types.js').Thread> = {}): import('../../src/types.js').Thread {
  return {
    id,
    kind: 'comment' as const,
    status: 'synced' as const,
    anchor: { path: 'src/greeting.ts', line: 5, side: 'RIGHT' as const },
    messages: [{ role: 'user' as const, text: 'Test comment', at: new Date().toISOString() }],
    ...overrides,
  };
}

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
    await writeSession(makeSession('servedkey0000000', []));
    const res = await fetch(`${baseUrl}/api/session/servedkey0000000`);
    expect(res.ok).toBe(true);
    expect(await res.json()).toMatchObject({ title: 'Test session', number: 42 });
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

describe('POST /api/session/:key/refresh', () => {
  let origPath: string;
  let origFakeDir: string | undefined;
  let origReviewThreads: string | undefined;
  let binDir: string;
  let key: string;

  beforeAll(() => {
    origPath = process.env.PATH ?? '';
    origFakeDir = process.env.REVY_FAKE_GH_DIR;
    origReviewThreads = process.env.REVY_FAKE_GH_REVIEW_THREADS;
    binDir = makeFakeGhBin();
    process.env.PATH = `${binDir}${path.delimiter}${origPath}`;
    process.env.REVY_FAKE_GH_DIR = FIXTURE_PR_DIR;
  });

  afterAll(() => {
    process.env.PATH = origPath;
    if (origFakeDir) process.env.REVY_FAKE_GH_DIR = origFakeDir;
    else delete process.env.REVY_FAKE_GH_DIR;
    if (origReviewThreads) process.env.REVY_FAKE_GH_REVIEW_THREADS = origReviewThreads;
    else delete process.env.REVY_FAKE_GH_REVIEW_THREADS;
    fs.rmSync(binDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    key = `refresh-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  });

  it('adds new threads from GitHub', async () => {
    await writeSession(makeSession(key, []));
    process.env.REVY_FAKE_GH_REVIEW_THREADS = path.resolve(FIXTURE_PR_DIR, 'review-threads.json');

    const res = await fetch(`${baseUrl}/api/session/${key}/refresh`, { method: 'POST' });
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.added).toBe(1);
    expect(body.threads).toHaveLength(1);
  });

  it('assigns githubThreadId to a synced local thread matching a GitHub thread by anchor', async () => {
    const local = makeThread('t_01', { githubThreadId: undefined, status: 'synced' });
    await writeSession(makeSession(key, [local]));
    process.env.REVY_FAKE_GH_REVIEW_THREADS = path.resolve(FIXTURE_PR_DIR, 'review-threads.json');

    const res = await fetch(`${baseUrl}/api/session/${key}/refresh`, { method: 'POST' });
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.threads).toHaveLength(1);
    expect(body.threads[0].id).toBe('t_01');
    expect(body.threads[0].githubThreadId).toBe('RT_1');
  });

  it('updates messages from GitHub replies', async () => {
    const local = makeThread('t_01', { githubThreadId: 'RT_1', status: 'synced', messages: [{ role: 'user', text: 'Original comment', at: new Date().toISOString() }] });
    await writeSession(makeSession(key, [local]));
    process.env.REVY_FAKE_GH_REVIEW_THREADS = path.resolve(FIXTURE_PR_DIR, 'review-threads-with-replies.json');

    const res = await fetch(`${baseUrl}/api/session/${key}/refresh`, { method: 'POST' });
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.threads).toHaveLength(1);
    expect(body.threads[0].messages.map((m: { text: string }) => m.text)).toEqual(['Original comment', 'Reply from GitHub']);
  });

  it('keeps both threads when two exist on the same anchor', async () => {
    const local1 = makeThread('t_01', { githubThreadId: undefined, status: 'synced' });
    const local2 = makeThread('t_02', { githubThreadId: undefined, status: 'synced' });
    await writeSession(makeSession(key, [local1, local2]));
    process.env.REVY_FAKE_GH_REVIEW_THREADS = path.resolve(FIXTURE_PR_DIR, 'review-threads-multiple-same-line.json');

    const res = await fetch(`${baseUrl}/api/session/${key}/refresh`, { method: 'POST' });
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.threads).toHaveLength(2);
    expect(body.threads.map((t: { id: string }) => t.id).sort()).toEqual(['t_01', 't_02']);
    expect(body.threads.map((t: { githubThreadId: string }) => t.githubThreadId).sort()).toEqual(['RT_1', 'RT_2']);
  });

  it('removes threads deleted on GitHub', async () => {
    const local = makeThread('t_01', { githubThreadId: 'RT_DELETED', status: 'synced' });
    await writeSession(makeSession(key, [local]));
    process.env.REVY_FAKE_GH_REVIEW_THREADS = path.resolve(FIXTURE_PR_DIR, 'review-threads-empty.json');

    const res = await fetch(`${baseUrl}/api/session/${key}/refresh`, { method: 'POST' });
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.threads).toHaveLength(0);
  });

  it('keeps draft threads untouched', async () => {
    const draft = makeThread('t_01', { githubThreadId: undefined, status: 'draft' });
    await writeSession(makeSession(key, [draft]));
    process.env.REVY_FAKE_GH_REVIEW_THREADS = path.resolve(FIXTURE_PR_DIR, 'review-threads-empty.json');

    const res = await fetch(`${baseUrl}/api/session/${key}/refresh`, { method: 'POST' });
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.threads).toHaveLength(1);
    expect(body.threads[0].id).toBe('t_01');
    expect(body.threads[0].status).toBe('draft');
  });

  it('strips stale gh_0X copies from prior refreshes', async () => {
    const t01 = makeThread('t_01', { githubThreadId: 'RT_1', status: 'synced' });
    const ghCopy = makeThread('gh_RT_1', { githubThreadId: 'RT_1', status: 'synced' });
    await writeSession(makeSession(key, [t01, ghCopy]));
    process.env.REVY_FAKE_GH_REVIEW_THREADS = path.resolve(FIXTURE_PR_DIR, 'review-threads.json');

    const res = await fetch(`${baseUrl}/api/session/${key}/refresh`, { method: 'POST' });
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.threads).toHaveLength(1);
    expect(body.threads[0].id).toBe('t_01');
  });

  it('removes synced threads without githubThreadId that have no matching GitHub thread', async () => {
    const local = makeThread('t_01', { githubThreadId: undefined, status: 'synced', anchor: { path: 'src/greeting.ts', line: 99, side: 'RIGHT' } });
    await writeSession(makeSession(key, [local]));
    process.env.REVY_FAKE_GH_REVIEW_THREADS = path.resolve(FIXTURE_PR_DIR, 'review-threads-empty.json');

    const res = await fetch(`${baseUrl}/api/session/${key}/refresh`, { method: 'POST' });
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.threads).toHaveLength(0);
  });

  it('keeps both GitHub threads when they share an anchor line with a single local thread (#36)', async () => {
    await writeSession(makeSession(key, [
      { id: 't_01', kind: 'comment', anchor: { path: 'src/greeting.ts', line: 3, side: 'RIGHT' }, status: 'synced', messages: [{ role: 'user', text: 'First thread on this line', at: new Date().toISOString() }] },
    ]));
    process.env.REVY_FAKE_GH_REVIEW_THREADS = path.resolve(FIXTURE_PR_DIR, 'review-threads-shared-anchor.json');

    const res = await fetch(`${baseUrl}/api/session/${key}/refresh`, { method: 'POST' });
    expect(res.ok).toBe(true);
    const body = await res.json() as { added: number; threads: { githubThreadId?: string | null }[] };
    expect(body.threads).toHaveLength(2);
    const ghIds = body.threads.map((t) => t.githubThreadId).sort();
    expect(ghIds).toEqual(['RT_A', 'RT_B']);
  });
});

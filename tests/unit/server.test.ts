import http from 'node:http';
import fs from 'node:fs';
import { afterAll, afterEach, beforeAll, describe, it, expect, vi } from 'vitest';
import { buildApp } from '../../src/server.js';
import { writeSession } from '../../src/session.js';
import { makeStateDir } from '../helpers/harness.js';

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

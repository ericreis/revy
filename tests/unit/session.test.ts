import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import {
  readSession,
  writeSession,
  sessionFile,
  sessionsDir,
  stateDir,
  type Session,
} from '../../src/session.js';
import { makeStateDir } from '../helpers/harness.js';

function sampleSession(overrides: Partial<Session> = {}): Session {
  const now = new Date().toISOString();
  return {
    key: 'deadbeefdeadbeef',
    pr: 'octocat/hello-world#42',
    repo: 'octocat/hello-world',
    number: 42,
    title: 'Add a friendly greeting helper',
    author: 'octocat',
    headSha: 'abc1234',
    headRef: 'feature/greeting',
    baseRef: 'main',
    url: 'https://github.com/octocat/hello-world/pull/42',
    stats: { additions: 10, deletions: 4, changedFiles: 3 },
    rawDiff: 'diff --git a/x b/x\n',
    status: 'open',
    reviewOrder: [],
    threads: [],
    pending: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

let dir: string;
beforeEach(() => {
  dir = makeStateDir();
  process.env.REVY_STATE_DIR = dir;
});
afterEach(() => {
  delete process.env.REVY_STATE_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('session store', () => {
  it('honours REVY_STATE_DIR for path resolution', () => {
    expect(stateDir()).toBe(dir);
    expect(sessionsDir()).toBe(path.join(dir, 'sessions'));
    expect(sessionFile('k')).toBe(path.join(dir, 'sessions', 'k.json'));
  });

  it('returns null when a session does not exist', async () => {
    expect(await readSession('missing')).toBeNull();
  });

  it('round-trips a session through write then read', async () => {
    const session = sampleSession();
    await writeSession(session);
    expect(fs.existsSync(sessionFile(session.key))).toBe(true);
    const loaded = await readSession(session.key);
    expect(loaded).toEqual(session);
  });

  it('overwrites an existing session on rewrite', async () => {
    await writeSession(sampleSession({ title: 'first' }));
    await writeSession(sampleSession({ title: 'second' }));
    expect((await readSession('deadbeefdeadbeef'))?.title).toBe('second');
  });
});

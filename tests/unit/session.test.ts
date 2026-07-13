import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import {
  readSession,
  writeSession,
  sessionFile,
  sessionsDir,
  stateDir,
  nextThreadId,
  type Session,
  type Thread,
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

function sampleThread(id: string): Thread {
  return {
    id,
    kind: 'comment',
    anchor: { path: 'src/greeting.ts', line: 1, side: 'RIGHT' },
    status: 'draft',
    messages: [],
  };
}

describe('nextThreadId', () => {
  it('starts at t_01 for a session with no threads', () => {
    expect(nextThreadId(sampleSession())).toBe('t_01');
  });

  it('continues from the highest existing thread id instead of a shared counter', () => {
    // A fresh process (e.g. the CLI's `submit` command, or a server restart)
    // must not repeat an id already used by a thread loaded from disk.
    const session = sampleSession({ threads: [sampleThread('t_01'), sampleThread('t_02')] });
    expect(nextThreadId(session)).toBe('t_03');
  });

  it('ignores non-t_ ids (e.g. gh_-prefixed GitHub threads) when computing the next id', () => {
    const session = sampleSession({ threads: [sampleThread('gh_9001'), sampleThread('t_01')] });
    expect(nextThreadId(session)).toBe('t_02');
  });

  it('gives two sessions with different histories independent, non-colliding ids', () => {
    const busy = sampleSession({ key: 'busy', threads: [sampleThread('t_05')] });
    const fresh = sampleSession({ key: 'fresh', threads: [] });
    expect(nextThreadId(busy)).toBe('t_06');
    expect(nextThreadId(fresh)).toBe('t_01');
  });
});

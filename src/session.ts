import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

export interface Thread {
  id: string;
  kind: 'comment' | 'question';
  anchor: { path: string; startLine?: number; line: number; side: 'LEFT' | 'RIGHT' };
  status: 'draft' | 'synced' | 'resolved';
  githubThreadId?: string | null;
  messages: { role: 'user' | 'agent'; text: string; at: string }[];
}

export interface Session {
  key: string;
  pr: string;
  repo: string;
  number: number;
  title: string;
  author: string | null;
  headSha: string;
  headRef: string;
  baseRef: string;
  url: string;
  stats: { additions: number; deletions: number; changedFiles: number };
  rawDiff: string;
  status: 'open' | 'feedback' | 'ended';
  reviewOrder: unknown[];
  threads: Thread[];
  pending: unknown[];
  createdAt: string;
  updatedAt: string;
}

/** Root state dir (override with REVY_STATE_DIR). */
export function stateDir(): string {
  return process.env.REVY_STATE_DIR || path.join(os.homedir(), '.revy');
}

export function sessionsDir(): string {
  return path.join(stateDir(), 'sessions');
}

export function sessionFile(key: string): string {
  return path.join(sessionsDir(), `${key}.json`);
}

export async function readSession(key: string): Promise<Session | null> {
  try {
    const raw = await fs.readFile(sessionFile(key), 'utf8');
    return JSON.parse(raw) as Session;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function writeSession(session: Session): Promise<void> {
  await fs.mkdir(sessionsDir(), { recursive: true });
  await fs.writeFile(sessionFile(session.key), `${JSON.stringify(session, null, 2)}\n`);
}

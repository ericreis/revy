#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import open from 'open';
import { parsePrArg } from './pr.js';
import { fetchPr } from './github.js';
import { readSession, writeSession, stateDir, type Session } from './session.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function isHealthy(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

async function readServerPort(): Promise<number | null> {
  try {
    const raw = await fs.readFile(path.join(stateDir(), 'server.json'), 'utf8');
    const { port } = JSON.parse(raw) as { port: number };
    return typeof port === 'number' ? port : null;
  } catch {
    return null;
  }
}

/** Reuse a running server if healthy, otherwise spawn one detached. */
async function ensureServer(): Promise<number> {
  const existing = await readServerPort();
  if (existing && (await isHealthy(existing))) return existing;

  const entry = path.resolve(dirname, 'serverEntry.js');
  const child = spawn(process.execPath, [entry], { detached: true, stdio: 'ignore' });
  child.unref();

  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    await sleep(200);
    const port = await readServerPort();
    if (port && (await isHealthy(port))) return port;
  }
  throw new Error('The revy server did not start in time.');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const noOpen = args.includes('--no-open') || process.env.REVY_NO_OPEN === '1';
  const positional = args.filter((a) => !a.startsWith('-'));
  const arg = positional[0];
  if (!arg || args.includes('-h') || args.includes('--help')) {
    process.stdout.write('Usage: revy <owner/repo#number | pr-url> [--no-open]\n');
    process.exit(arg ? 0 : 1);
  }

  const ref = parsePrArg(arg);
  process.stdout.write(`Fetching ${ref.slug} ...\n`);
  const { meta, rawDiff } = await fetchPr(ref);

  const existing = await readSession(ref.key);
  const now = new Date().toISOString();
  const session: Session = {
    key: ref.key,
    pr: ref.slug,
    repo: `${ref.owner}/${ref.repo}`,
    number: ref.number,
    title: meta.title,
    author: meta.author?.login ?? null,
    headSha: meta.headRefOid,
    headRef: meta.headRefName,
    baseRef: meta.baseRefName,
    url: meta.url,
    stats: {
      additions: meta.additions,
      deletions: meta.deletions,
      changedFiles: meta.changedFiles,
    },
    rawDiff,
    status: 'open',
    // Preserve local review state across relaunches of the same PR.
    reviewOrder: existing?.reviewOrder ?? [],
    threads: existing?.threads ?? [],
    pending: existing?.pending ?? [],
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await writeSession(session);

  const port = await ensureServer();
  const url = `http://127.0.0.1:${port}/session/${ref.key}`;
  if (noOpen) {
    process.stdout.write(`Review ready at ${url}\n`);
  } else {
    process.stdout.write(`Opening ${url}\n`);
    await open(url);
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`revy: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});

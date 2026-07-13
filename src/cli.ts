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

async function cmdSubmit(): Promise<void> {
  const args = process.argv.slice(2).filter((a) => a !== 'submit');
  const key = args[0];
  if (!key) {
    process.stderr.write('Usage: revy submit <session-key>\n');
    process.exit(1);
  }
  const session = await readSession(key);
  if (!session) {
    process.stderr.write(`Session "${key}" not found.\n`);
    process.exit(1);
  }

  const draftComments = session.threads.filter(
    (t) => t.kind === 'comment' && t.status === 'draft',
  );
  if (draftComments.length === 0) {
    process.stdout.write('No draft comments to submit.\n');
    return;
  }

  const { submitReview, fetchReviewThreads } = await import('./github.js');
  const ref = { owner: '', repo: '', number: 0, slug: session.pr, key: session.key };
  const parts = session.pr.split(/[\/#]/);
  ref.owner = parts[0];
  ref.repo = parts[1];
  ref.number = Number(parts[2]);

  process.stdout.write(`Submitting ${draftComments.length} comment(s) to ${session.pr} ...\n`);

  const comments = draftComments.map((t) => ({
    path: t.anchor.path,
    body: t.messages.map((m) => m.text).join('\n\n'),
    line: t.anchor.line,
    side: t.anchor.side,
    startLine: t.anchor.startLine,
    startSide: t.anchor.startLine ? t.anchor.side : undefined,
  }));

  await submitReview(ref, session.headSha, comments);

  // Mark submitted threads as synced
  for (const t of draftComments) {
    const { updateThread } = await import('./session.js');
    updateThread(session, t.id, { status: 'synced' });
  }
  const { writeSession } = await import('./session.js');
  await writeSession(session);

  process.stdout.write('Review submitted to GitHub.\n');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const subcommand = args[0];

  if (subcommand === 'submit') {
    await cmdSubmit();
    return;
  }

  // Legacy: `revy <pr>` - open a PR for review
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

  // Fetch existing GitHub review threads and merge them in
  let ghThreads: import('./session.js').Thread[] = [];
  try {
    const { fetchReviewThreads } = await import('./github.js');
    const fetched = await fetchReviewThreads(ref);
    ghThreads = fetched.map((ft) => ({
      id: `gh_${ft.id}`,
      kind: 'comment' as const,
      anchor: {
        path: ft.path,
        line: ft.line,
        side: ft.side,
        startLine: ft.startLine,
      },
      status: ft.isResolved ? ('resolved' as const) : ('synced' as const),
      githubThreadId: ft.id,
      messages: ft.comments.map((c) => ({
        role: 'user' as const,
        text: c.body,
        at: c.createdAt,
      })),
    }));
  } catch (_err) {
    // Non-fatal: GitHub threads are best-effort
  }

  // Merge: keep existing local threads, add any GH threads we don't already have
  const existingGhIds = new Set(
    (existing?.threads ?? []).filter((t) => t.githubThreadId).map((t) => t.githubThreadId),
  );
  const mergedThreads = [
    ...(existing?.threads ?? []),
    ...ghThreads.filter((t) => !existingGhIds.has(t.githubThreadId)),
  ];

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
    reviewOrder: existing?.reviewOrder ?? [],
    threads: mergedThreads,
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

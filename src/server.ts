import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { readSession, writeSession, addThread, nextThreadId, updateThread } from './session.js';
import type { Thread, Session } from './session.js';
import { parsePrArg } from './pr.js';
import { submitReview, fetchReviewThreads } from './github.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
// dist/serverEntry.js -> ../web/dist ; src/server.ts (via tsx) -> ../web/dist
const WEB_DIST = path.resolve(dirname, '..', 'web', 'dist');

export function buildApp(onActivity?: () => void): express.Express {
  const app = express();

  app.use(express.json());

  app.use((_req, _res, next) => {
    onActivity?.();
    next();
  });

  app.get('/health', (_req, res) => {
    res.json({ ok: true, app: 'revy' });
  });

  app.get('/api/session/:key', async (req, res, next) => {
    try {
      const session = await readSession(req.params.key);
      if (!session) {
        res.status(404).json({ error: 'session not found' });
        return;
      }
      res.json(session);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/session/:key/refresh', async (req, res, next) => {
    try {
      const session = await readSession(req.params.key);
      if (!session) {
        res.status(404).json({ error: 'session not found' });
        return;
      }

      const ref = parsePrArg(session.pr);
      const fetched = await fetchReviewThreads(ref);
      const ghThreads: Thread[] = fetched.map((ft) => ({
        id: `gh_${ft.id}`,
        kind: 'comment' as const,
        anchor: {
          path: ft.path,
          line: ft.fileLine ?? ft.line,
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

      const ghIds = new Set(ghThreads.map((t) => t.githubThreadId));
      const ghAnchors = new Map<string, Thread>();
      for (const t of ghThreads) {
        const key = `${t.anchor.path}:${t.anchor.line}:${t.anchor.side}`;
        if (!ghAnchors.has(key)) ghAnchors.set(key, t);
      }

      // Remove stale threads: those with a githubThreadId no longer on GitHub,
      // or synced threads whose anchor has no match on GitHub.
      const staleIds = new Set(
        session.threads.filter((t) => {
          if (t.githubThreadId && !ghIds.has(t.githubThreadId)) return true;
          if (!t.githubThreadId && t.status === 'synced') {
            const key = `${t.anchor.path}:${t.anchor.line}:${t.anchor.side}`;
            if (!ghAnchors.has(key)) return true;
          }
          return false;
        }).map((t) => t.id),
      );
      if (staleIds.size > 0) {
        session.threads = session.threads.filter((t) => !staleIds.has(t.id));
      }

      // Assign githubThreadId to existing synced threads that match a GitHub thread by anchor,
      // and remove the matching ghThread entry so we don't create a duplicate.
      for (const st of session.threads) {
        if (st.githubThreadId || st.status !== 'synced') continue;
        const key = `${st.anchor.path}:${st.anchor.line}:${st.anchor.side}`;
        const match = ghAnchors.get(key);
        if (match) {
          st.githubThreadId = match.githubThreadId;
          ghAnchors.delete(key);
        }
      }

      // Add remaining unmatched GitHub threads as new entries.
      let added = 0;
      for (const t of ghAnchors.values()) {
        addThread(session, t);
        added++;
      }
      await writeSession(session);

      res.json({ added, threads: session.threads });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Failed to refresh review threads',
      });
    }
  });

  app.post('/api/session/:key/comments', async (req, res, next) => {
    try {
      const session = await readSession(req.params.key);
      if (!session) {
        res.status(404).json({ error: 'session not found' });
        return;
      }
      const { anchor, text } = req.body as { anchor: Thread['anchor']; text: string };
      if (!anchor || !text) {
        res.status(400).json({ error: 'Missing anchor or text' });
        return;
      }
      const thread: Thread = {
        id: nextThreadId(session),
        kind: 'comment',
        anchor,
        status: 'draft',
        messages: [{ role: 'user', text, at: new Date().toISOString() }],
      };
      addThread(session, thread);
      await writeSession(session);
      res.status(201).json(thread);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/session/:key/submit', async (req, res, next) => {
    try {
      const session = await readSession(req.params.key);
      if (!session) {
        res.status(404).json({ error: 'session not found' });
        return;
      }

      const draftComments = session.threads.filter(
        (t) => t.kind === 'comment' && t.status === 'draft',
      );
      if (draftComments.length === 0) {
        res.status(400).json({ error: 'No draft comments to submit' });
        return;
      }

      try {
        const ref = parsePrArg(session.pr);
        const comments = draftComments.map((t) => ({
          path: t.anchor.path,
          body: t.messages.map((m) => m.text).join('\n\n'),
          line: t.anchor.line,
          side: t.anchor.side,
          startLine: t.anchor.startLine,
          startSide: t.anchor.startLine ? t.anchor.side : undefined,
        }));

        await submitReview(ref, session.headSha, comments);

        for (const t of draftComments) {
          updateThread(session, t.id, { status: 'synced' });
        }
        await writeSession(session);

        res.json({ submitted: draftComments.length });
      } catch (submitErr) {
        res.status(502).json({
          error: submitErr instanceof Error ? submitErr.message : 'Failed to submit review',
        });
      }
    } catch (err) {
      next(err);
    }
  });

  // Static frontend assets.
  app.use(express.static(WEB_DIST));

  // SPA route: the review surface for a given PR session. Serve via the `root`
  // option so `send` only dotfile-checks the relative path; otherwise an
  // absolute WEB_DIST under a hidden directory (e.g. ~/.revy) 404s.
  app.get('/session/:key', (_req, res) => {
    res.sendFile('index.html', { root: WEB_DIST });
  });

  app.get('/', (_req, res) => {
    res.type('text').send('revy is running. Open a PR with `revy <owner/repo#number>`.');
  });

  return app;
}

export interface RunningServer {
  port: number;
  shutdown: (reason?: string) => void;
}

/**
 * Start the local loopback server on a free port. Auto-shuts down after
 * `idleMs` with no HTTP activity (set 0 to disable).
 */
export async function startServer({ idleMs = 30 * 60 * 1000 } = {}): Promise<RunningServer> {
  let idleTimer: NodeJS.Timeout | undefined;
  let shuttingDown = false;

  function shutdown(): void {
    if (shuttingDown) return;
    shuttingDown = true;
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1000).unref();
  }

  function bumpIdle(): void {
    if (idleMs <= 0) return;
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(shutdown, idleMs);
    idleTimer.unref();
  }

  const app = buildApp(bumpIdle);
  app.post('/shutdown', (_req, res) => {
    res.json({ status: 'shutting-down' });
    setImmediate(shutdown);
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  bumpIdle();

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return { port, shutdown };
}

import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { readSession, writeSession, addThread, nextThreadId } from './session.js';
import type { Thread } from './session.js';

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
        id: nextThreadId(),
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

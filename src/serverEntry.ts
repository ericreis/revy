import fs from 'node:fs/promises';
import path from 'node:path';
import { stateDir } from './session.js';
import { startServer } from './server.js';

// Detached server bootstrap: pick a free port, record it, then stay alive.
const idleMs = Number(process.env.REVY_IDLE_MS ?? 30 * 60 * 1000);
const { port } = await startServer({ idleMs });

await fs.mkdir(stateDir(), { recursive: true });
await fs.writeFile(
  path.join(stateDir(), 'server.json'),
  `${JSON.stringify({ port, pid: process.pid, startedAt: new Date().toISOString() }, null, 2)}\n`,
);

process.stdout.write(`revy server listening on http://127.0.0.1:${port}\n`);

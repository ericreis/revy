import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export interface CliResult {
  stdout: string;
  stderr: string;
  /** The `http://127.0.0.1:<port>/session/<key>` review URL revy printed. */
  url: string;
  port: number;
  key: string;
}

/**
 * Run the real, built revy CLI exactly as a user would (`revy <pr> --no-open`),
 * then parse the review URL it prints. The caller supplies a hermetic env
 * (fake `gh` on PATH + isolated state dir) via makeHarness().
 */
export function runCli(slug: string, env: NodeJS.ProcessEnv): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['dist/cli.js', slug, '--no-open'], {
      cwd: REPO_ROOT,
      // Keep the spawned server alive for the whole test run (no idle shutdown).
      env: { ...process.env, ...env, REVY_IDLE_MS: '0' },
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`revy CLI exited with ${code}\nstdout: ${stdout}\nstderr: ${stderr}`));
        return;
      }
      const m = stdout.match(/(http:\/\/127\.0\.0\.1:(\d+)\/session\/([0-9a-f]+))/);
      if (!m) {
        reject(new Error(`could not find a review URL in CLI output:\n${stdout}`));
        return;
      }
      resolve({ stdout, stderr, url: m[1], port: Number(m[2]), key: m[3] });
    });
  });
}

/** Ask the detached revy server to shut itself down (best effort). */
export async function shutdownServer(port: number): Promise<void> {
  try {
    await fetch(`http://127.0.0.1:${port}/shutdown`, { method: 'POST' });
  } catch {
    // The server may already be gone; nothing to do.
  }
}

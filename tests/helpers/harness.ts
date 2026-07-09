import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path to the fixture PR (meta.json + diff.patch). */
export const FIXTURE_PR_DIR = path.resolve(here, '..', 'fixtures', 'pr');

const FAKE_GH = path.join(here, 'fake-gh.mjs');

/**
 * Create a throwaway directory that holds an executable `gh` shim. Prepending
 * its path to PATH makes revy call our fake instead of the real GitHub CLI, so
 * tests stay hermetic (no network, no auth).
 */
export function makeFakeGhBin(): string {
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), 'revy-gh-'));
  const shim = path.join(binDir, 'gh');
  fs.writeFileSync(shim, `#!/bin/sh\nexec "${process.execPath}" "${FAKE_GH}" "$@"\n`);
  fs.chmodSync(shim, 0o755);
  return binDir;
}

/** A fresh REVY_STATE_DIR so sessions/servers never collide between tests. */
export function makeStateDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'revy-state-'));
}

export interface HarnessEnv {
  /** Extra env to merge into a spawned process (or process.env for in-proc). */
  env: NodeJS.ProcessEnv;
  stateDir: string;
  binDir: string;
  cleanup: () => void;
}

/**
 * Build a hermetic environment: fake `gh` on PATH pointed at the fixture PR,
 * plus an isolated state dir. `fail` triggers a `gh` failure mode.
 */
export function makeHarness(opts: { fixtureDir?: string; fail?: 'auth' | 'notfound' } = {}): HarnessEnv {
  const binDir = makeFakeGhBin();
  const stateDir = makeStateDir();
  const env: NodeJS.ProcessEnv = {
    PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ''}`,
    REVY_STATE_DIR: stateDir,
    REVY_FAKE_GH_DIR: opts.fixtureDir ?? FIXTURE_PR_DIR,
  };
  if (opts.fail) env.REVY_FAKE_GH_FAIL = opts.fail;
  return {
    env,
    stateDir,
    binDir,
    cleanup: () => {
      fs.rmSync(binDir, { recursive: true, force: true });
      fs.rmSync(stateDir, { recursive: true, force: true });
    },
  };
}

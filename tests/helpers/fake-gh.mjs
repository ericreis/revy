#!/usr/bin/env node
// A stand-in for the `gh` CLI used by tests, so revy never hits the network.
//
// Behaviour is driven entirely by env vars set by the test harness:
//   REVY_FAKE_GH_DIR   directory holding `meta.json` (for `gh pr view`) and
//                      `diff.patch` (for `gh pr diff`).
//   REVY_FAKE_GH_FAIL  optional failure mode: "auth" | "notfound" - makes the
//                      fake exit non-zero with the same stderr shape as real gh,
//                      so error translation can be exercised.
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const fail = process.env.REVY_FAKE_GH_FAIL;

if (fail === 'auth') {
  process.stderr.write('gh auth login: not logged into any GitHub hosts\n');
  process.exit(1);
}
if (fail === 'notfound') {
  process.stderr.write('no pull requests found for the given arguments\n');
  process.exit(1);
}

const dir = process.env.REVY_FAKE_GH_DIR;
if (!dir) {
  process.stderr.write('fake-gh: REVY_FAKE_GH_DIR is not set\n');
  process.exit(1);
}

const [sub, action] = args;
if (sub === 'pr' && action === 'view') {
  process.stdout.write(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
} else if (sub === 'pr' && action === 'diff') {
  process.stdout.write(fs.readFileSync(path.join(dir, 'diff.patch'), 'utf8'));
} else {
  process.stderr.write(`fake-gh: unhandled invocation: gh ${args.join(' ')}\n`);
  process.exit(2);
}

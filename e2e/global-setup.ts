import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// The E2E tests exercise the *built* CLI and server, so make sure the bundle
// and the frontend assets are current before any test runs.
export default function globalSetup(): void {
  execSync('npm run build', { cwd: REPO_ROOT, stdio: 'inherit' });
}

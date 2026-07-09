import { describe, it, expect } from 'vitest';
import { parseDiff } from 'react-diff-view';
import { languageForPath, tokenizeHunks, MAX_HIGHLIGHT_LINES } from '../../web/src/highlight.js';

describe('languageForPath', () => {
  it('resolves common source extensions to a registered language', () => {
    // These fall through to refractor's own name/alias resolution; we only
    // require that each yields a language refractor can actually highlight.
    for (const path of [
      'src/greeting.ts',
      'web/src/App.tsx',
      'scripts/build.js',
      'main.py',
      'pkg/server.go',
      'styles/app.scss',
      'config.yaml',
    ]) {
      expect(languageForPath(path), path).toBeDefined();
    }
  });

  it('applies overrides for extensions refractor does not know by itself', () => {
    expect(languageForPath('lib.rs')).toBe('rust');
    expect(languageForPath('index.mjs')).toBe('javascript');
    expect(languageForPath('util.hpp')).toBe('cpp');
    expect(languageForPath('app/Page.vue')).toBe('markup');
    expect(languageForPath('infra/main.tf')).toBe('hcl');
  });

  it('recognizes well-known extensionless filenames', () => {
    // Resolved by refractor's own aliases (no map entry needed).
    expect(languageForPath('Dockerfile')).toBeDefined();
    expect(languageForPath('build/Makefile')).toBe('makefile');
    expect(languageForPath('.gitignore')).toBeDefined();
    // Genuine gaps refractor doesn't know - covered by FILENAME_LANGUAGE.
    expect(languageForPath('GNUmakefile')).toBe('makefile');
    expect(languageForPath('.dockerignore')).toBe('ignore');
  });

  it('is case-insensitive and uses the basename, not the directory', () => {
    expect(languageForPath('SRC/Lib.RS')).toBe('rust');
    expect(languageForPath('rs/src/thing.vue')).toBe('markup');
    expect(languageForPath('build/GNUMAKEFILE')).toBe('makefile');
  });

  it('returns undefined for unknown or absent extensions', () => {
    expect(languageForPath('data.unknownext')).toBeUndefined();
    expect(languageForPath('LICENSE')).toBeUndefined();
    expect(languageForPath('bin/tool')).toBeUndefined();
  });
});

const TS_DIFF = `diff --git a/src/greeting.ts b/src/greeting.ts
index 5555555..6666666 100644
--- a/src/greeting.ts
+++ b/src/greeting.ts
@@ -1,2 +1,3 @@
-export function greet(name) {
+export function greet(name: string): string {
   return 'Hi ' + name;
+}
`;

const hunks = () => parseDiff(TS_DIFF)[0].hunks;

/** Flatten a token tree to the set of Prism class names it carries. */
function tokenClasses(tokens: unknown): Set<string> {
  const classes = new Set<string>();
  const walk = (node: any) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === 'object') {
      for (const cls of node.properties?.className ?? []) classes.add(String(cls));
      if (node.children) walk(node.children);
      if (node.old || node.new) walk([node.old, node.new]);
    }
  };
  walk(tokens);
  return classes;
}

describe('tokenizeHunks', () => {
  it('produces syntax tokens for a recognized language', () => {
    const tokens = tokenizeHunks(hunks(), languageForPath('src/greeting.ts'));
    expect(tokens).toBeDefined();
    const classes = tokenClasses(tokens);
    expect(classes.has('keyword')).toBe(true);
    expect(classes.has('string')).toBe(true);
  });

  it('returns undefined when the language is unknown (plain rendering)', () => {
    expect(tokenizeHunks(hunks(), undefined)).toBeUndefined();
  });

  it('skips highlighting for diffs larger than the line cap', () => {
    const huge = hunks().map((h) => ({
      ...h,
      changes: Array.from({ length: MAX_HIGHLIGHT_LINES + 1 }, () => h.changes[0]),
    }));
    expect(tokenizeHunks(huge, 'typescript')).toBeUndefined();
  });
});

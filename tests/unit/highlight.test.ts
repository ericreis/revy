import { describe, it, expect } from 'vitest';
import { parseDiff } from 'react-diff-view';
import { languageForPath, tokenizeHunks, MAX_HIGHLIGHT_LINES } from '../../web/src/highlight.js';

describe('languageForPath', () => {
  it('resolves the extensions and filenames revy cares about to a registered language', () => {
    // languageForPath returns a value only when refractor has a grammar for it,
    // so `toBeDefined` proves each path is highlightable - both the extensions
    // refractor knows natively and the ones we teach it via refractor.alias().
    const paths = [
      // recognized by refractor directly
      'src/greeting.ts', 'web/src/App.tsx', 'scripts/build.js', 'main.py',
      'pkg/server.go', 'styles/app.scss', 'config.yaml', 'README.md',
      // resolved via the aliases we register for refractor's gaps
      'lib.rs', 'index.mjs', 'util.hpp', 'core.cc', 'app/Page.vue',
      'infra/main.tf', 'schema.proto', 'lib.exs', 'plot.jl', 'run.zsh',
      // extensionless names and dotfiles
      'Dockerfile', 'build/Makefile', 'GNUmakefile', '.gitignore', '.dockerignore',
    ];
    for (const path of paths) {
      expect(languageForPath(path), path).toBeDefined();
    }
  });

  it('is case-insensitive and resolves from the basename, not the directory', () => {
    expect(languageForPath('SRC/Lib.RS')).toBe(languageForPath('lib.rs'));
    expect(languageForPath('rs/dir/Page.VUE')).toBe(languageForPath('page.vue'));
    expect(languageForPath('a/b/GNUMAKEFILE')).toBe(languageForPath('gnumakefile'));
  });

  it('returns undefined for unknown or absent extensions', () => {
    expect(languageForPath('data.unknownext')).toBeUndefined();
    expect(languageForPath('LICENSE')).toBeUndefined();
    expect(languageForPath('bin/tool')).toBeUndefined();
    // .gitattributes is not gitignore syntax, so we intentionally leave it plain.
    expect(languageForPath('.gitattributes')).toBeUndefined();
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

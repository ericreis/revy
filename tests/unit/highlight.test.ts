import { describe, it, expect } from 'vitest';
import { parseDiff } from 'react-diff-view';
import { tokenizeHunks, MAX_HIGHLIGHT_LINES } from '../../web/src/highlight.js';

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
  it('highlights a file whose extension maps to a language, with real Prism tokens', () => {
    const tokens = tokenizeHunks(hunks(), 'src/greeting.ts');
    expect(tokens).toBeDefined();
    const classes = tokenClasses(tokens);
    expect(classes.has('keyword')).toBe(true);
    expect(classes.has('string')).toBe(true);
  });

  it('highlights extensions and filenames refractor knows or that we alias', () => {
    // A non-undefined result means refractor resolved the extension to a
    // grammar - both its built-ins and the aliases registered in highlight.ts.
    const paths = [
      // recognized by refractor directly
      'web/src/App.tsx', 'scripts/build.js', 'main.py', 'pkg/server.go',
      'styles/app.scss', 'config.yaml', 'README.md',
      // resolved via the aliases we register for refractor's gaps
      'lib.rs', 'index.mjs', 'util.hpp', 'core.cc', 'app/Page.vue',
      'infra/main.tf', 'schema.proto', 'lib.exs', 'plot.jl', 'run.zsh',
      // extensionless names and dotfiles
      'Dockerfile', 'build/Makefile', 'GNUmakefile', '.gitignore', '.dockerignore',
    ];
    for (const path of paths) {
      expect(tokenizeHunks(hunks(), path), path).toBeDefined();
    }
  });

  it('is case-insensitive and resolves from the basename, not the directory', () => {
    expect(tokenizeHunks(hunks(), 'SRC/Lib.RS')).toBeDefined();
    expect(tokenizeHunks(hunks(), 'rs/dir/Page.VUE')).toBeDefined();
    expect(tokenizeHunks(hunks(), 'a/b/GNUMAKEFILE')).toBeDefined();
  });

  it('returns undefined (plain) for unknown or absent extensions', () => {
    expect(tokenizeHunks(hunks(), 'notes.unknownext')).toBeUndefined();
    expect(tokenizeHunks(hunks(), 'LICENSE')).toBeUndefined();
    expect(tokenizeHunks(hunks(), 'bin/tool')).toBeUndefined();
    // .gitattributes is not gitignore syntax, so we intentionally leave it plain.
    expect(tokenizeHunks(hunks(), '.gitattributes')).toBeUndefined();
  });

  it('skips highlighting for diffs larger than the line cap', () => {
    const huge = hunks().map((h) => ({
      ...h,
      changes: Array.from({ length: MAX_HIGHLIGHT_LINES + 1 }, () => h.changes[0]),
    }));
    expect(tokenizeHunks(huge, 'a.ts')).toBeUndefined();
  });
});

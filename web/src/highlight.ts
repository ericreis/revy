import refractor from 'refractor';
import { tokenize, type HunkData, type HunkTokens } from 'react-diff-view';

/**
 * Teach refractor the file extensions (and a couple of extensionless names) it
 * doesn't recognize out of the box, registering each as an alias of a grammar
 * it already ships. refractor already knows most extensions through its own
 * names and aliases (`ts`, `js`, `py`, `go`, `css`, `html`, `md`, ...); these
 * are just the gaps, so `languageForPath` can then resolve everything with a
 * single `refractor.registered` lookup. Keys are lowercase, without a dot.
 */
refractor.alias({
  typescript: ['mts', 'cts'],
  javascript: ['mjs', 'cjs'],
  json: ['jsonc'],
  python: ['pyi'],
  rust: ['rs'],
  c: ['h'],
  cpp: ['cc', 'cxx', 'hpp', 'hh'],
  objectivec: ['m', 'mm'],
  fsharp: ['fs'],
  perl: ['pl', 'pm'],
  elixir: ['ex', 'exs'],
  erlang: ['erl'],
  clojure: ['clj', 'cljs'],
  ocaml: ['ml'],
  julia: ['jl'],
  bash: ['sh', 'zsh', 'fish'],
  powershell: ['ps1'],
  batch: ['bat'],
  stylus: ['styl'],
  markup: ['htm', 'xhtml', 'vue', 'svelte'],
  markdown: ['mdx'],
  ini: ['cfg'],
  graphql: ['gql'],
  protobuf: ['proto'],
  hcl: ['tf', 'tfvars'],
  diff: ['patch'],
  makefile: ['gnumakefile'],
  ignore: ['dockerignore'], // .dockerignore uses gitignore-style syntax
});

/**
 * Skip syntax highlighting once a file's diff is this many changed lines: the
 * tokenizer walks every line, so very large files would block the main thread.
 * See issue #7's note about moving tokenization to a web worker for these.
 */
export const MAX_HIGHLIGHT_LINES = 3000;

/** The refractor/Prism language for a file path, if one is registered. */
export function languageForPath(path: string): string | undefined {
  const filename = path.slice(path.lastIndexOf('/') + 1).toLowerCase();
  const dot = filename.lastIndexOf('.');
  // For dotfiles like `.gitignore` this yields `gitignore`, which refractor
  // knows; for `Dockerfile`/`Makefile` the bare name is itself the language.
  const ext = dot >= 0 ? filename.slice(dot + 1) : filename;
  return refractor.registered(ext) ? ext : undefined;
}

/**
 * Syntax-highlight a file's hunks into tokens for `<Diff tokens>`. Returns
 * `undefined` (plain, un-highlighted rendering) when the language is unknown,
 * the diff is too large, or highlighting fails for any reason.
 */
export function tokenizeHunks(hunks: HunkData[], language: string | undefined): HunkTokens | undefined {
  if (!language) return undefined;

  const lineCount = hunks.reduce((total, hunk) => total + hunk.changes.length, 0);
  if (lineCount > MAX_HIGHLIGHT_LINES) return undefined;

  try {
    return tokenize(hunks, { highlight: true, refractor, language });
  } catch {
    return undefined;
  }
}

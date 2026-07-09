import refractor from 'refractor';
import { tokenize, type HunkData, type HunkTokens } from 'react-diff-view';

/**
 * File extensions whose refractor/Prism language can't be resolved from the
 * extension alone. refractor already recognizes most extensions through its
 * language names and aliases (`ts`, `js`, `py`, `go`, `css`, `html`, `md`, ...),
 * so `languageForPath` only needs overrides for the exceptions:
 *   - extensions refractor doesn't know (`mjs`, `rs`, `cc`, `hpp`, `vue`, ...),
 *   - and remappings to a different grammar (`htm`/`svelte` -> `markup`).
 * Everything else falls through to refractor's own resolution, which keeps this
 * list small and automatically covers languages as refractor adds them.
 * Extensions are lowercase, without the leading dot.
 */
const EXTENSION_OVERRIDES: Record<string, string> = {
  mts: 'typescript',
  cts: 'typescript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsonc: 'json',
  pyi: 'python',
  rs: 'rust',
  h: 'c',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  hh: 'cpp',
  m: 'objectivec',
  mm: 'objectivec',
  fs: 'fsharp',
  pl: 'perl',
  pm: 'perl',
  ex: 'elixir',
  exs: 'elixir',
  erl: 'erlang',
  clj: 'clojure',
  cljs: 'clojure',
  ml: 'ocaml',
  jl: 'julia',
  sh: 'bash',
  zsh: 'bash',
  fish: 'bash',
  ps1: 'powershell',
  bat: 'batch',
  styl: 'stylus',
  htm: 'markup',
  xhtml: 'markup',
  vue: 'markup',
  svelte: 'markup',
  mdx: 'markdown',
  cfg: 'ini',
  gql: 'graphql',
  proto: 'protobuf',
  tf: 'hcl',
  tfvars: 'hcl',
  patch: 'diff',
};

/**
 * Extensionless filenames refractor can't resolve on its own. Common ones
 * (`Dockerfile`, `Makefile`, `.gitignore`, `.npmignore`) already match a
 * refractor language name or alias and are handled by the fallback in
 * `languageForPath`, so only the genuine gaps live here.
 */
const FILENAME_LANGUAGE: Record<string, string> = {
  gnumakefile: 'makefile',
  '.dockerignore': 'ignore', // gitignore-style syntax, same grammar
};

/**
 * Skip syntax highlighting once a file's diff is this many changed lines: the
 * tokenizer walks every line, so very large files would block the main thread.
 * See issue #7's note about moving tokenization to a web worker for these.
 */
export const MAX_HIGHLIGHT_LINES = 3000;

/** The refractor/Prism language for a file path, if one is registered. */
export function languageForPath(path: string): string | undefined {
  const filename = path.slice(path.lastIndexOf('/') + 1).toLowerCase();

  // An explicit override wins; otherwise let refractor resolve the extension
  // (or the bare filename) through its own language names and aliases.
  const dot = filename.lastIndexOf('.');
  const ext = dot >= 0 ? filename.slice(dot + 1) : filename;
  const language = FILENAME_LANGUAGE[filename] ?? EXTENSION_OVERRIDES[ext] ?? ext;

  return refractor.registered(language) ? language : undefined;
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

import refractor from 'refractor';
import { tokenize, type HunkData, type HunkTokens } from 'react-diff-view';

/**
 * Map a file extension (or bare filename) to a refractor/Prism language.
 * Extensions are lowercase, without the leading dot. Entries whose grammar is
 * not registered in the bundled refractor are simply skipped at lookup time.
 */
const EXTENSION_LANGUAGE: Record<string, string> = {
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'jsx',
  json: 'json',
  jsonc: 'json',
  json5: 'json5',
  py: 'python',
  pyi: 'python',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  java: 'java',
  kt: 'kotlin',
  kts: 'kotlin',
  swift: 'swift',
  scala: 'scala',
  groovy: 'groovy',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  hh: 'cpp',
  m: 'objectivec',
  mm: 'objectivec',
  cs: 'csharp',
  fs: 'fsharp',
  php: 'php',
  pl: 'perl',
  pm: 'perl',
  lua: 'lua',
  r: 'r',
  dart: 'dart',
  ex: 'elixir',
  exs: 'elixir',
  erl: 'erlang',
  clj: 'clojure',
  cljs: 'clojure',
  hs: 'haskell',
  ml: 'ocaml',
  jl: 'julia',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  fish: 'bash',
  ps1: 'powershell',
  bat: 'batch',
  css: 'css',
  scss: 'scss',
  sass: 'sass',
  less: 'less',
  styl: 'stylus',
  html: 'markup',
  htm: 'markup',
  xml: 'markup',
  xhtml: 'markup',
  svg: 'markup',
  vue: 'markup',
  svelte: 'markup',
  md: 'markdown',
  markdown: 'markdown',
  mdx: 'markdown',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'toml',
  ini: 'ini',
  cfg: 'ini',
  properties: 'properties',
  sql: 'sql',
  graphql: 'graphql',
  gql: 'graphql',
  proto: 'protobuf',
  tf: 'hcl',
  tfvars: 'hcl',
  hcl: 'hcl',
  dockerfile: 'docker',
  diff: 'diff',
  patch: 'diff',
  vim: 'vim',
  nix: 'nix',
  zig: 'zig',
};

/** Filenames that imply a language regardless of (missing) extension. */
const FILENAME_LANGUAGE: Record<string, string> = {
  dockerfile: 'docker',
  makefile: 'makefile',
  gnumakefile: 'makefile',
  '.gitignore': 'ignore',
  '.gitattributes': 'ignore',
  '.dockerignore': 'ignore',
  '.npmignore': 'ignore',
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
  if (filename in FILENAME_LANGUAGE) return FILENAME_LANGUAGE[filename];

  const dot = filename.lastIndexOf('.');
  const ext = dot >= 0 ? filename.slice(dot + 1) : filename;
  const language = EXTENSION_LANGUAGE[ext];
  return language && refractor.registered(language) ? language : undefined;
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

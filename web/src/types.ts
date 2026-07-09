export interface Session {
  pr: string;
  title: string;
  author: string | null;
  repo: string;
  number: number;
  url: string;
  baseRef: string;
  headRef: string;
  stats?: { additions: number; deletions: number; changedFiles: number };
  rawDiff: string;
}

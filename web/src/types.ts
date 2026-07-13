export interface Anchor {
  path: string;
  startLine?: number;
  line: number;
  side: 'LEFT' | 'RIGHT';
  changeKey?: string;
}

export interface Message {
  role: 'user' | 'agent';
  text: string;
  at: string;
}

export interface Thread {
  id: string;
  kind: 'comment' | 'question';
  anchor: Anchor;
  status: 'draft' | 'synced' | 'resolved';
  githubThreadId?: string | null;
  messages: Message[];
}

export interface Session {
  key: string;
  pr: string;
  title: string;
  author: string | null;
  repo: string;
  number: number;
  url: string;
  baseRef: string;
  headRef: string;
  headSha: string;
  stats?: { additions: number; deletions: number; changedFiles: number };
  rawDiff: string;
  threads: Thread[];
  pending: unknown[];
  reviewOrder: unknown[];
}

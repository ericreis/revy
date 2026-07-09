import { useEffect, useState } from 'react';
import DiffView from './DiffView';

interface Session {
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

type State =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ready'; session: Session };

export default function App() {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    const match = location.pathname.match(/\/session\/([^/]+)/);
    if (!match) {
      setState({ status: 'error', error: 'No session key in the URL.' });
      return;
    }
    fetch(`/api/session/${match[1]}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`session not found (${res.status})`);
        return (await res.json()) as Session;
      })
      .then((session) => setState({ status: 'ready', session }))
      .catch((err: unknown) =>
        setState({ status: 'error', error: err instanceof Error ? err.message : String(err) }),
      );
  }, []);

  if (state.status === 'loading') return <div className="msg">Loading review…</div>;
  if (state.status === 'error') return <div className="msg msg-error">Error: {state.error}</div>;

  const s = state.session;
  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-title">{s.title}</div>
        <div className="topbar-meta">
          <a href={s.url} target="_blank" rel="noreferrer">
            {s.pr}
          </a>
          <span className="dot">·</span>
          <span className="branch">{s.baseRef}</span> ← <span className="branch">{s.headRef}</span>
          {s.author && (
            <>
              <span className="dot">·</span>@{s.author}
            </>
          )}
          {s.stats && (
            <>
              <span className="dot">·</span>
              <span className="add">+{s.stats.additions}</span>{' '}
              <span className="del">−{s.stats.deletions}</span>
              <span className="dot">·</span>
              {s.stats.changedFiles} file{s.stats.changedFiles === 1 ? '' : 's'}
            </>
          )}
        </div>
      </header>
      <main className="content">
        <DiffView rawDiff={s.rawDiff} />
      </main>
    </div>
  );
}

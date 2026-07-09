import { useEffect, useState } from 'react';
import Review, { type Session } from './Review';

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
  return <Review session={state.session} />;
}

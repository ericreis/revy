import type { Session } from './types';

export default function ReviewHeader({
  session,
  draftCount,
  submitting,
  onSubmit,
}: {
  session: Session;
  draftCount: number;
  submitting: boolean;
  onSubmit: () => void;
}) {
  return (
    <header className="topbar">
      <div className="topbar-row">
        <div className="topbar-title">{session.title}</div>
        <div className="topbar-actions">
          {draftCount > 0 && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={submitting}
              onClick={onSubmit}
            >
              {submitting ? 'Submitting…' : `Submit review (${draftCount})`}
            </button>
          )}
        </div>
      </div>
      <div className="topbar-meta">
        <a href={session.url} target="_blank" rel="noreferrer">
          {session.pr}
        </a>
        <span className="dot">·</span>
        <span className="branch">{session.baseRef}</span> ←{' '}
        <span className="branch">{session.headRef}</span>
        {session.author && (
          <>
            <span className="dot">·</span>@{session.author}
          </>
        )}
        {session.stats && (
          <>
            <span className="dot">·</span>
            <span className="add">+{session.stats.additions}</span>{' '}
            <span className="del">−{session.stats.deletions}</span>
            <span className="dot">·</span>
            {session.stats.changedFiles} file{session.stats.changedFiles === 1 ? '' : 's'}
          </>
        )}
      </div>
    </header>
  );
}

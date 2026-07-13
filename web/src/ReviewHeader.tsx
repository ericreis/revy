import type { Session } from './types';

export default function ReviewHeader({
  session,
  draftCount,
  submitting,
  countdown,
  manualCooldown,
  refreshing,
  onRefresh,
  onSubmit,
}: {
  session: Session;
  draftCount: number;
  submitting: boolean;
  countdown: number;
  manualCooldown: number;
  refreshing: boolean;
  onRefresh: () => void;
  onSubmit: () => void;
}) {
  const cooldownActive = manualCooldown > 0;
  const btnDisabled = cooldownActive || refreshing;

  return (
    <header className="topbar">
      <div className="topbar-row">
        <div className="topbar-title">{session.title}</div>
        <div className="topbar-actions">
          <button
            type="button"
            className="btn btn-sm btn-refresh"
            disabled={btnDisabled}
            onClick={onRefresh}
            title={
              refreshing ? 'Refreshing…' :
              cooldownActive ? `Wait ${manualCooldown}s before refreshing again` :
              'Refresh review threads from GitHub'
            }
          >
            <span className={`refresh-icon${refreshing ? ' spinning' : ''}`}>⟳</span>
            {refreshing ? '…' : cooldownActive ? `${manualCooldown}s` : ''}
          </button>
          <span className="countdown-hint">
            {refreshing ? 'refreshing' : `auto in ${countdown}s`}
          </span>
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

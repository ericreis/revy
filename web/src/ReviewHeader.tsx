import type { Session } from './types';

export default function ReviewHeader({ session }: { session: Session }) {
  return (
    <header className="topbar">
      <div className="topbar-title">{session.title}</div>
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

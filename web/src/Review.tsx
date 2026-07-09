import { useMemo, useState } from 'react';
import DiffView from './DiffView';
import FileTree from './FileTree';
import { toDiffFiles, isLargeOrGenerated, type DiffFile } from './diff';

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

export default function Review({ session }: { session: Session }) {
  const files = useMemo(() => toDiffFiles(session.rawDiff), [session.rawDiff]);
  // Large / generated files start collapsed so the page stays navigable.
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set(files.filter(isLargeOrGenerated).map((f) => f.id)),
  );
  const [activeId, setActiveId] = useState<string | undefined>(files[0]?.id);

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const expandAll = () => setCollapsed(new Set());
  const collapseAll = () => setCollapsed(new Set(files.map((f) => f.id)));

  const jump = (f: DiffFile) => {
    setActiveId(f.id);
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.delete(f.id);
      return next;
    });
    requestAnimationFrame(() =>
      document.getElementById(f.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  };

  return (
    <div className="app">
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
      <div className="layout">
        <aside className="sidebar">
          <div className="sidebar-head">
            <span>
              {files.length} file{files.length === 1 ? '' : 's'}
            </span>
            <div className="sidebar-actions">
              <button type="button" onClick={expandAll}>
                Expand all
              </button>
              <button type="button" onClick={collapseAll}>
                Collapse all
              </button>
            </div>
          </div>
          <FileTree files={files} activeId={activeId} onSelect={jump} />
        </aside>
        <main className="content">
          <DiffView files={files} collapsed={collapsed} onToggle={toggle} />
        </main>
      </div>
    </div>
  );
}

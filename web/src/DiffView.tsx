import { Diff, Hunk } from 'react-diff-view';
import 'react-diff-view/style/index.css';
import type { DiffFile } from './diff';

export default function DiffView({
  files,
  collapsed,
  onToggle,
}: {
  files: DiffFile[];
  collapsed: Set<string>;
  onToggle: (id: string) => void;
}) {
  if (files.length === 0) {
    return <div className="msg">No changes to display.</div>;
  }

  return (
    <div className="files">
      {files.map((f) => {
        const isCollapsed = collapsed.has(f.id);
        return (
          <section className="file" id={f.id} key={f.id}>
            <button
              type="button"
              className="file-head"
              aria-expanded={!isCollapsed}
              onClick={() => onToggle(f.id)}
            >
              <span className={`chevron${isCollapsed ? ' collapsed' : ''}`} aria-hidden>
                ▾
              </span>
              <span className={`file-badge file-badge-${f.type}`}>{f.type}</span>
              <span className="file-path">{f.path}</span>
              <span className="file-counts">
                <span className="add">+{f.additions}</span> <span className="del">−{f.deletions}</span>
              </span>
            </button>
            {!isCollapsed && (
              <div className="file-body">
                <Diff viewType="unified" diffType={f.file.type} hunks={f.file.hunks}>
                  {(hunks) => hunks.map((hunk) => <Hunk key={hunk.content} hunk={hunk} />)}
                </Diff>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

import { Diff, Hunk } from 'react-diff-view';
import 'react-diff-view/style/index.css';
import type { DiffFile } from './diff';

/** A single changed file: collapsible header + its unified diff. */
export default function FileView({
  file,
  collapsed,
  onToggle,
}: {
  file: DiffFile;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <section className="file" id={file.id}>
      <button type="button" className="file-head" aria-expanded={!collapsed} onClick={onToggle}>
        <span className={`chevron${collapsed ? ' collapsed' : ''}`} aria-hidden>
          ▾
        </span>
        <span className={`file-badge file-badge-${file.type}`}>{file.type}</span>
        <span className="file-path">{file.path}</span>
        <span className="file-counts">
          <span className="add">+{file.additions}</span> <span className="del">−{file.deletions}</span>
        </span>
      </button>
      {!collapsed && (
        <div className="file-body">
          <Diff viewType="unified" diffType={file.file.type} hunks={file.file.hunks}>
            {(hunks) => hunks.map((hunk) => <Hunk key={hunk.content} hunk={hunk} />)}
          </Diff>
        </div>
      )}
    </section>
  );
}

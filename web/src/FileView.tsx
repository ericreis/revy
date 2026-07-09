import { useMemo } from 'react';
import { Diff, Hunk } from 'react-diff-view';
import 'react-diff-view/style/index.css';
import type { DiffFile } from './diff';
import type { ViewType } from './useReview';
import { tokenizeHunks } from './highlight';

/** A single changed file: collapsible header + its diff (unified or split). */
export default function FileView({
  file,
  collapsed,
  wrap,
  viewType,
  onToggle,
}: {
  file: DiffFile;
  collapsed: boolean;
  wrap: boolean;
  viewType: ViewType;
  onToggle: () => void;
}) {
  // Highlight lazily: only expanded files reach the tokenizer, and the result
  // is memoized so toggling wrap or collapse never re-tokenizes.
  const tokens = useMemo(
    () => (collapsed ? undefined : tokenizeHunks(file.file.hunks, file.path)),
    [collapsed, file.file.hunks, file.path],
  );

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
        <div className={`file-body${wrap ? ' wrap' : ''}`}>
          <Diff viewType={viewType} diffType={file.file.type} hunks={file.file.hunks} tokens={tokens}>
            {(hunks) => hunks.map((hunk) => <Hunk key={hunk.content} hunk={hunk} />)}
          </Diff>
        </div>
      )}
    </section>
  );
}

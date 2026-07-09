import FileTree from './FileTree';
import type { DiffFile } from './diff';
import type { ViewType } from './useReview';

export default function Sidebar({
  files,
  activeId,
  wrap,
  viewType,
  onSelect,
  onExpandAll,
  onCollapseAll,
  onToggleWrap,
  onToggleViewType,
}: {
  files: DiffFile[];
  activeId: string | undefined;
  wrap: boolean;
  viewType: ViewType;
  onSelect: (f: DiffFile) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onToggleWrap: () => void;
  onToggleViewType: () => void;
}) {
  const isSplit = viewType === 'split';
  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <span>
          {files.length} file{files.length === 1 ? '' : 's'}
        </span>
        <div className="sidebar-actions">
          <button type="button" className={isSplit ? 'active' : ''} aria-pressed={isSplit} onClick={onToggleViewType}>
            Split
          </button>
          <button type="button" className={wrap ? 'active' : ''} aria-pressed={wrap} onClick={onToggleWrap}>
            Wrap
          </button>
          <button type="button" onClick={onExpandAll}>
            Expand all
          </button>
          <button type="button" onClick={onCollapseAll}>
            Collapse all
          </button>
        </div>
      </div>
      <FileTree files={files} activeId={activeId} onSelect={onSelect} />
    </aside>
  );
}

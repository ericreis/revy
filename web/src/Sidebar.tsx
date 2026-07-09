import FileTree from './FileTree';
import type { DiffFile } from './diff';

export default function Sidebar({
  files,
  activeId,
  wrap,
  onSelect,
  onExpandAll,
  onCollapseAll,
  onToggleWrap,
}: {
  files: DiffFile[];
  activeId: string | undefined;
  wrap: boolean;
  onSelect: (f: DiffFile) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onToggleWrap: () => void;
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <span>
          {files.length} file{files.length === 1 ? '' : 's'}
        </span>
        <div className="sidebar-actions">
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

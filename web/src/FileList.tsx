import FileView from './FileView';
import type { DiffFile } from './diff';
import type { ViewType } from './useReview';

export default function FileList({
  files,
  collapsed,
  wrap,
  viewType,
  onToggle,
}: {
  files: DiffFile[];
  collapsed: Set<string>;
  wrap: boolean;
  viewType: ViewType;
  onToggle: (id: string) => void;
}) {
  if (files.length === 0) {
    return <div className="msg">No changes to display.</div>;
  }
  return (
    <div className="files">
      {files.map((f) => (
        <FileView
          key={f.id}
          file={f}
          collapsed={collapsed.has(f.id)}
          wrap={wrap}
          viewType={viewType}
          onToggle={() => onToggle(f.id)}
        />
      ))}
    </div>
  );
}

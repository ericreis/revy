import FileView from './FileView';
import type { DiffFile } from './diff';

export default function FileList({
  files,
  collapsed,
  wrap,
  onToggle,
}: {
  files: DiffFile[];
  collapsed: Set<string>;
  wrap: boolean;
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
          onToggle={() => onToggle(f.id)}
        />
      ))}
    </div>
  );
}

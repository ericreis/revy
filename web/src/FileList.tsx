import FileView from './FileView';
import type { DiffFile } from './diff';

export default function FileList({
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
      {files.map((f) => (
        <FileView key={f.id} file={f} collapsed={collapsed.has(f.id)} onToggle={() => onToggle(f.id)} />
      ))}
    </div>
  );
}

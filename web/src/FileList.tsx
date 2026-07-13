import FileView from './FileView';
import type { DiffFile } from './diff';
import type { ReviewState } from './useReview';

export default function FileList({
  files,
  collapsed,
  wrap,
  viewType,
  onToggle,
  selectedChanges,
  selAnchor,
  threads,
  composing,
  composerText,
  onComposerChange,
  onGutterClick,
  onOpenComposer,
  onCloseComposer,
  onAddComment,
}: {
  files: DiffFile[];
  collapsed: Set<string>;
  wrap: boolean;
  viewType: ReviewState['viewType'];
  onToggle: (id: string) => void;
  selectedChanges: ReviewState['selection'];
  selAnchor: ReviewState['selAnchor'];
  threads: ReviewState['threads'];
  composing: string | null;
  composerText: string;
  onComposerChange: (t: string) => void;
  onGutterClick: (changeKey: string, changeType: string, filePath: string, shiftKey: boolean) => void;
  onOpenComposer: (changeKey: string) => void;
  onCloseComposer: () => void;
  onAddComment: (anchor: NonNullable<ReviewState['selAnchor']>, text: string) => Promise<void>;
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
          selectedChanges={selectedChanges}
          selAnchor={selAnchor}
          threads={threads}
          composing={composing}
          composerText={composerText}
          onComposerChange={onComposerChange}
          onGutterClick={onGutterClick}
          onOpenComposer={onOpenComposer}
          onCloseComposer={onCloseComposer}
          onAddComment={onAddComment}
        />
      ))}
    </div>
  );
}

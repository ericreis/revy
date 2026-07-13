import { useMemo } from 'react';
import { Diff, Hunk, getChangeKey } from 'react-diff-view';
import type { Anchor } from './types';
import 'react-diff-view/style/index.css';
import type { DiffFile } from './diff';
import type { ReviewState, ViewType } from './useReview';
import { tokenizeHunks } from './highlight';
import ThreadWidget from './ThreadWidget';

/** A single changed file: collapsible header + its diff (unified or split). */
/** Find a change key for a thread anchor by searching the file's hunks. */
function findChangeKey(anchor: Anchor, hunks: { changes: unknown[] }[]): string | null {
  for (const hunk of hunks) {
    for (const change of hunk.changes) {
      const c = change as { type: string; lineNumber?: number; oldLineNumber?: number; newLineNumber?: number };
      const ck = getChangeKey(change as Parameters<typeof getChangeKey>[0]);
      const changeSide: 'LEFT' | 'RIGHT' =
        c.type === 'delete' ? 'LEFT' :
        c.type === 'insert' ? 'RIGHT' :
        anchor.side;
      if (changeSide !== anchor.side) continue;
      const changeLine =
        c.type === 'delete'  ? c.lineNumber :
        c.type === 'insert'  ? c.lineNumber :
        c.type === 'normal'  ? (anchor.side === 'RIGHT' ? c.newLineNumber : c.oldLineNumber) :
        undefined;
      if (changeLine != null && changeLine === anchor.line) return ck;
    }
  }
  return null;
}

export default function FileView({
  file,
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
  file: DiffFile;
  collapsed: boolean;
  wrap: boolean;
  viewType: ViewType;
  onToggle: () => void;
  selectedChanges: Set<string>;
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
  const tokens = useMemo(
    () => (collapsed ? undefined : tokenizeHunks(file.file.hunks, file.path)),
    [collapsed, file.file.hunks, file.path],
  );

  // Build widgets from threads + composer
  const widgets = useMemo(() => {
    const w: Record<string, React.ReactNode> = {};

    // Composer widget: show at the change key where composer is open
    if (composing && !collapsed) {
      w[composing] = (
        <ThreadWidget
          composing={true}
          composerText={composerText}
          onComposerChange={onComposerChange}
          onSubmit={() => {
            if (selAnchor) {
              onAddComment(selAnchor, composerText);
            }
          }}
          onCancel={onCloseComposer}
        />
      );
    }

    // Thread widgets: one per thread anchored to this file
    if (!collapsed) {
      for (const t of threads) {
        if (t.anchor.path !== file.path) continue;
        const ck = t.anchor.changeKey ?? findChangeKey(t.anchor, file.file.hunks);
        if (!ck) continue;
        if (!w[ck]) {
          w[ck] = (
            <ThreadWidget
              thread={t}
              composing={false}
              composerText=""
              onComposerChange={() => {}}
              onSubmit={() => {}}
              onCancel={() => {}}
            />
          );
        }
      }
    }

    return w;
  }, [composing, composerText, collapsed, threads, file.path, selAnchor, onComposerChange, onCloseComposer, onAddComment]);

  // Determine which change keys belong to this file
  const allChangeKeys = useMemo(
    () => file.file.hunks.flatMap((h) => h.changes.map(getChangeKey)),
    [file.file.hunks],
  );

  // selectedChanges filtered to this file
  const fileSelected = useMemo(
    () => allChangeKeys.filter((k) => selectedChanges.has(`${file.path}::${k}`)),
    [allChangeKeys, selectedChanges, file.path],
  );

  const handleGutterClick = (
    args: { side?: 'old' | 'new'; change: { type: string } | null },
    e: React.MouseEvent<HTMLElement>,
  ) => {
    if (!args.change) return;
    const el = e.currentTarget as HTMLElement | null;
    const ck = el?.getAttribute('data-change-key');
    if (!ck) return;
    onGutterClick(ck, args.change.type, file.path, e.shiftKey);
  };

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
          <Diff
            viewType={viewType}
            diffType={file.file.type}
            hunks={file.file.hunks}
            tokens={tokens}
            widgets={widgets}
            selectedChanges={fileSelected}
            gutterEvents={{ onClick: handleGutterClick }}
            renderGutter={(options) => {
              const ck = getChangeKey(options.change);
              const isSelected = ck && fileSelected.includes(ck);
              const defaultContent = options.renderDefault();
              // Show the + button only on the side that matches the change type:
              //   insert → RIGHT (new), delete → LEFT (old), normal → RIGHT (new)
              const showPlus = isSelected && (
                options.change.type === 'delete'
                  ? options.side === 'old'
                  : options.side === 'new'
              );
              if (showPlus) {
                return options.wrapInAnchor(
                  <span className="gutter-content">
                    {defaultContent}
                    <button
                      type="button"
                      className="gutter-plus"
                      onClick={(e) => { e.stopPropagation(); onOpenComposer(ck!); }}
                      title="Add review comment"
                    >
                      +
                    </button>
                  </span>
                );
              }
              return options.wrapInAnchor(defaultContent);
            }}
          >
            {(hunks) => hunks.map((hunk) => <Hunk key={hunk.content} hunk={hunk} />)}
          </Diff>
        </div>
      )}
    </section>
  );
}

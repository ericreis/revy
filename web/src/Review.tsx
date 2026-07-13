import ReviewHeader from './ReviewHeader';
import Sidebar from './Sidebar';
import FileList from './FileList';
import { useReview } from './useReview';
import type { Session } from './types';

export default function Review({ session }: { session: Session }) {
  const {
    files, collapsed, activeId, wrap, viewType, toggle, expandAll, collapseAll, toggleWrap, toggleViewType, jump,
    selection, selAnchor, handleGutterClick, clearSelection,
    threads, composing, composerText, setComposerText, openComposer, closeComposer, addComment,
  } = useReview(session);

  return (
    <div className="app">
      <ReviewHeader session={session} />
      <div className="layout">
        <Sidebar
          files={files}
          activeId={activeId}
          wrap={wrap}
          viewType={viewType}
          onSelect={jump}
          onExpandAll={expandAll}
          onCollapseAll={collapseAll}
          onToggleWrap={toggleWrap}
          onToggleViewType={toggleViewType}
        />
        <main className="content">
          <FileList
            files={files}
            collapsed={collapsed}
            wrap={wrap}
            viewType={viewType}
            onToggle={toggle}
            selectedChanges={selection}
            selAnchor={selAnchor}
            threads={threads}
            composing={composing}
            composerText={composerText}
            onComposerChange={setComposerText}
            onGutterClick={handleGutterClick}
            onOpenComposer={openComposer}
            onCloseComposer={closeComposer}
            onAddComment={addComment}
          />
        </main>
      </div>
    </div>
  );
}

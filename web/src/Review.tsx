import { useState, useMemo } from 'react';
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
    countdown, manualCooldown, refreshing, handleRefresh,
  } = useReview(session);

  const [submitting, setSubmitting] = useState(false);
  const draftCount = useMemo(() => threads.filter((t) => t.kind === 'comment' && t.status === 'draft').length, [threads]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/session/${session.key}/submit`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Submit failed' }));
        alert(`Submit failed: ${err.error}`);
      } else {
        // Reload the page to show updated thread statuses
        window.location.reload();
      }
    } catch {
      alert('Submit failed: network error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app">
      <ReviewHeader session={session} draftCount={draftCount} submitting={submitting} countdown={countdown} manualCooldown={manualCooldown} refreshing={refreshing} onRefresh={handleRefresh} onSubmit={handleSubmit} />
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

import ReviewHeader from './ReviewHeader';
import Sidebar from './Sidebar';
import FileList from './FileList';
import { useReview } from './useReview';
import type { Session } from './types';

export default function Review({ session }: { session: Session }) {
  const { files, collapsed, activeId, wrap, toggle, expandAll, collapseAll, toggleWrap, jump } =
    useReview(session);

  return (
    <div className="app">
      <ReviewHeader session={session} />
      <div className="layout">
        <Sidebar
          files={files}
          activeId={activeId}
          wrap={wrap}
          onSelect={jump}
          onExpandAll={expandAll}
          onCollapseAll={collapseAll}
          onToggleWrap={toggleWrap}
        />
        <main className="content">
          <FileList files={files} collapsed={collapsed} wrap={wrap} onToggle={toggle} />
        </main>
      </div>
    </div>
  );
}

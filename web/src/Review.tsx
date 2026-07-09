import ReviewHeader from './ReviewHeader';
import Sidebar from './Sidebar';
import FileList from './FileList';
import { useReview } from './useReview';
import type { Session } from './types';

export default function Review({ session }: { session: Session }) {
  const { files, collapsed, activeId, toggle, expandAll, collapseAll, jump } = useReview(session);

  return (
    <div className="app">
      <ReviewHeader session={session} />
      <div className="layout">
        <Sidebar
          files={files}
          activeId={activeId}
          onSelect={jump}
          onExpandAll={expandAll}
          onCollapseAll={collapseAll}
        />
        <main className="content">
          <FileList files={files} collapsed={collapsed} onToggle={toggle} />
        </main>
      </div>
    </div>
  );
}

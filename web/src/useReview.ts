import { useMemo, useState } from 'react';
import { toDiffFiles, isLargeOrGenerated, type DiffFile } from './diff';
import type { Session } from './types';

export interface ReviewState {
  files: DiffFile[];
  collapsed: Set<string>;
  activeId: string | undefined;
  wrap: boolean;
  toggle: (id: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  toggleWrap: () => void;
  jump: (f: DiffFile) => void;
}

/** Owns the review's interaction state so the components stay presentational. */
export function useReview(session: Session): ReviewState {
  const files = useMemo(() => toDiffFiles(session.rawDiff), [session.rawDiff]);
  // Large / generated files start collapsed so the page stays navigable.
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set(files.filter(isLargeOrGenerated).map((f) => f.id)),
  );
  const [activeId, setActiveId] = useState<string | undefined>(files[0]?.id);
  // Long lines scroll horizontally by default (GitHub-like); wrap is opt-in.
  const [wrap, setWrap] = useState(false);

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const expandAll = () => setCollapsed(new Set());
  const collapseAll = () => setCollapsed(new Set(files.map((f) => f.id)));
  const toggleWrap = () => setWrap((prev) => !prev);

  const jump = (f: DiffFile) => {
    setActiveId(f.id);
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.delete(f.id);
      return next;
    });
    requestAnimationFrame(() =>
      document.getElementById(f.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  };

  return { files, collapsed, activeId, wrap, toggle, expandAll, collapseAll, toggleWrap, jump };
}

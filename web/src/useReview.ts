import { useMemo, useState } from 'react';
import { toDiffFiles, isLargeOrGenerated, type DiffFile } from './diff';
import type { Session } from './types';

export type ViewType = 'unified' | 'split';

function loadViewType(): ViewType {
  try {
    const v = localStorage.getItem('revy-view-type');
    if (v === 'unified' || v === 'split') return v;
  } catch {}
  return 'unified';
}

function saveViewType(v: ViewType) {
  try { localStorage.setItem('revy-view-type', v); } catch {}
}

export interface ReviewState {
  files: DiffFile[];
  collapsed: Set<string>;
  activeId: string | undefined;
  wrap: boolean;
  viewType: ViewType;
  toggle: (id: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  toggleWrap: () => void;
  toggleViewType: () => void;
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
  const [viewType, setViewType] = useState<ViewType>(loadViewType);

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
  const toggleViewType = () =>
    setViewType((prev) => {
      const next = prev === 'unified' ? 'split' : 'unified';
      saveViewType(next);
      return next;
    });

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

  return { files, collapsed, activeId, wrap, viewType, toggle, expandAll, collapseAll, toggleWrap, toggleViewType, jump };
}

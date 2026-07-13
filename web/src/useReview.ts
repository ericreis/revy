import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { getChangeKey, type ChangeData } from 'react-diff-view';
import { toDiffFiles, isLargeOrGenerated, type DiffFile } from './diff';
import type { Session, Thread, Anchor } from './types';

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

export function getSelectedChangeKeys(
  startKey: string,
  endKey: string,
  changeKeys: string[],
): Set<string> {
  const si = changeKeys.indexOf(startKey);
  const ei = changeKeys.indexOf(endKey);
  if (si === -1 && ei === -1) return new Set([startKey]);
  const from = Math.min(si >= 0 ? si : 0, ei >= 0 ? ei : 0);
  const to = Math.max(si >= 0 ? si : 0, ei >= 0 ? ei : 0);
  const keys = new Set<string>();
  for (let i = from; i <= to; i++) keys.add(changeKeys[i]);
  return keys;
}

export function changeToAnchor(change: ChangeData, path: string): Anchor {
  const changeKey = getChangeKey(change);
  const side: 'LEFT' | 'RIGHT' = change.type === 'delete' ? 'LEFT' : 'RIGHT';
  const line = change.type === 'normal'
    ? (side === 'RIGHT' ? change.newLineNumber : change.oldLineNumber)
    : change.lineNumber;
  return { path, line, side, changeKey };
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
  selection: Set<string>;
  selAnchor: Anchor | null;
  selFilePath: string | null;
  handleGutterClick: (changeKey: string, changeType: string, filePath: string, shiftKey: boolean) => void;
  clearSelection: () => void;
  threads: Thread[];
  composing: string | null;
  composerText: string;
  setComposerText: (t: string) => void;
  openComposer: (changeKey: string) => void;
  closeComposer: () => void;
  addComment: (anchor: Anchor, text: string) => Promise<void>;
  countdown: number;
  manualCooldown: number;
  refreshing: boolean;
  handleRefresh: () => void;
}

/** Owns the review's interaction state so the components stay presentational. */
export function useReview(session: Session): ReviewState {
  const files = useMemo(() => toDiffFiles(session.rawDiff), [session.rawDiff]);
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set(files.filter(isLargeOrGenerated).map((f) => f.id)),
  );
  const [activeId, setActiveId] = useState<string | undefined>(files[0]?.id);
  const [wrap, setWrap] = useState(false);
  const [viewType, setViewType] = useState<ViewType>(loadViewType);

  const [selStart, setSelStart] = useState<string | null>(null);
  const [selEnd, setSelEnd] = useState<string | null>(null);
  const [selFilePath, setSelFilePath] = useState<string | null>(null);
  const [threads, setThreads] = useState<Thread[]>(() => session.threads ?? []);
  const [composing, setComposing] = useState<string | null>(null);
  const [composerText, setComposerText] = useState('');
  const [nextId, setNextId] = useState(threads.length + 1);
  const [countdown, setCountdown] = useState(10);
  const [manualCooldown, setManualCooldown] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);

  // Countdown tick + manual cooldown decay
  useEffect(() => {
    const id = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 10 : prev - 1));
      setManualCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const doRefresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    setCountdown(10);
    try {
      const res = await fetch(`/api/session/${session.key}/refresh`, { method: 'POST' });
      if (res.ok) {
        const data = (await res.json()) as { added: number; threads: Thread[] };
        if (data.added > 0) {
          setThreads(data.threads);
        }
      }
    } catch {
      // silently retry on next tick
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, [session.key]);

  // Auto-refresh every 10s
  useEffect(() => {
    const id = setInterval(doRefresh, 10_000);
    return () => clearInterval(id);
  }, [doRefresh]);

  const handleRefresh = useCallback(() => {
    if (manualCooldown > 0 || refreshingRef.current) return;
    setManualCooldown(5);
    doRefresh();
  }, [manualCooldown, doRefresh]);

  // Compute the selection set from selStart/selEnd
  const selection = useMemo(() => {
    if (!selStart || !selFilePath) return new Set<string>();
    if (!selEnd || selStart === selEnd) return new Set([`${selFilePath}::${selStart}`]);
    const fileKeys = files
      .filter((f) => f.path === selFilePath)
      .flatMap((f) => f.file.hunks.flatMap((h) => h.changes.map((c) => getChangeKey(c))))
      .filter(Boolean);
    const range = getSelectedChangeKeys(selStart, selEnd, fileKeys);
    return new Set([...range].map((k) => `${selFilePath}::${k}`));
  }, [selStart, selEnd, selFilePath, files]);

  // Compute anchor from the last clicked change
  const selAnchor = useMemo(() => {
    const key = selEnd ?? selStart;
    if (!key || !selFilePath) return null;
    const change = files
      .filter((f) => f.path === selFilePath)
      .flatMap((f) => f.file.hunks.flatMap((h) => h.changes))
      .find((c) => getChangeKey(c) === key);
    if (!change) return null;
    return changeToAnchor(change, selFilePath);
  }, [selEnd, selStart, selFilePath, files]);

  const handleGutterClick = useCallback((changeKey: string, _changeType: string, filePath: string, shiftKey: boolean) => {
    setSelEnd(changeKey);
    setSelFilePath(filePath);
    if (!shiftKey || selFilePath !== filePath || selStart === null) {
      setSelStart(changeKey);
    }
  }, [selFilePath, selStart]);

  const clearSelection = useCallback(() => {
    setSelStart(null);
    setSelEnd(null);
    setSelFilePath(null);
  }, []);

  const openComposer = useCallback((changeKey: string) => {
    setComposing(changeKey);
    setComposerText('');
  }, []);

  const closeComposer = useCallback(() => {
    setComposing(null);
    setComposerText('');
  }, []);

  const addComment = useCallback(async (anchor: Anchor, text: string) => {
    const newThread: Thread = {
      id: `t_${nextId}`,
      kind: 'comment',
      anchor,
      status: 'draft',
      messages: [{ role: 'user', text, at: new Date().toISOString() }],
    };
    setNextId((n) => n + 1);
    setThreads((prev) => [...prev, newThread]);
    setComposing(null);
    setComposerText('');
    setSelStart(null);
    setSelEnd(null);

    try {
      const res = await fetch(`/api/session/${session.key}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anchor, text }),
      });
      if (res.ok) {
        const saved = (await res.json()) as Thread;
        setThreads((prev) => prev.map((t) => (t.id === newThread.id ? saved : t)));
      }
    } catch {
      // Keep local draft even if API call fails
    }
  }, [session.key, nextId]);

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

  return {
    files, collapsed, activeId, wrap, viewType,
    toggle, expandAll, collapseAll, toggleWrap, toggleViewType, jump,
    selection, selAnchor, selFilePath,
    handleGutterClick, clearSelection,
    threads, composing, composerText, setComposerText, openComposer, closeComposer, addComment,
    countdown, manualCooldown, refreshing, handleRefresh,
  };
}

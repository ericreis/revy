import { parseDiff, type FileData } from 'react-diff-view';

export interface DiffFile {
  id: string;
  path: string;
  type: FileData['type'];
  file: FileData;
  additions: number;
  deletions: number;
}

/** Parse a unified diff into per-file entries with stable ids and line counts. */
export function toDiffFiles(rawDiff: string): DiffFile[] {
  const parsed = rawDiff.trim() ? parseDiff(rawDiff) : [];
  return parsed.map((file, index) => {
    let additions = 0;
    let deletions = 0;
    for (const hunk of file.hunks) {
      for (const change of hunk.changes) {
        if (change.type === 'insert') additions++;
        else if (change.type === 'delete') deletions++;
      }
    }
    const path =
      file.newPath && file.newPath !== '/dev/null' ? file.newPath : file.oldPath;
    return { id: `file-${index}`, path, type: file.type, file, additions, deletions };
  });
}

const GENERATED = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|composer\.lock|Cargo\.lock|go\.sum)$/;

/** Files worth collapsing by default (lockfiles, minified, or very large). */
export function isLargeOrGenerated(f: DiffFile): boolean {
  if (GENERATED.test(f.path)) return true;
  if (/\.min\.(js|css)$/.test(f.path)) return true;
  return f.additions + f.deletions > 300;
}

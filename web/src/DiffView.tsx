import { parseDiff, Diff, Hunk, type FileData } from 'react-diff-view';
import 'react-diff-view/style/index.css';

export default function DiffView({ rawDiff }: { rawDiff: string }) {
  const files: FileData[] = rawDiff.trim() ? parseDiff(rawDiff) : [];

  if (files.length === 0) {
    return <div className="msg">No changes to display.</div>;
  }

  return (
    <div className="files">
      {files.map((file, i) => {
        const { oldRevision, newRevision, type, hunks, oldPath, newPath } = file;
        const displayPath =
          newPath && newPath !== '/dev/null' ? newPath : oldPath;
        return (
          <section className="file" key={`${oldRevision}-${newRevision}-${i}`}>
            <div className="file-head">
              <span className={`file-badge file-badge-${type}`}>{type}</span>
              <span className="file-path">{displayPath}</span>
            </div>
            <Diff viewType="unified" diffType={type} hunks={hunks}>
              {(hunks) => hunks.map((hunk) => <Hunk key={hunk.content} hunk={hunk} />)}
            </Diff>
          </section>
        );
      })}
    </div>
  );
}

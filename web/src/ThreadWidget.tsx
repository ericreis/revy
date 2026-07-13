import type { Thread, Anchor } from './types';

export default function ThreadWidget({
  thread,
  composing,
  composerText,
  onComposerChange,
  onSubmit,
  onCancel,
}: {
  thread?: Thread;
  composing: boolean;
  composerText: string;
  onComposerChange: (t: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  if (composing) {
    return (
      <div className="thread-widget thread-composer">
        <div className="thread-composer-body">
          <textarea
            className="thread-textarea"
            rows={3}
            placeholder="Leave a review comment…"
            value={composerText}
            onChange={(e) => onComposerChange(e.target.value)}
            autoFocus
          />
          <div className="thread-composer-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={onSubmit} disabled={!composerText.trim()}>
              Add review comment
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!thread) return null;

  return (
    <div className="thread-widget">
      {thread.messages.map((msg, i) => (
        <div key={i} className="thread-message">
          <div className="thread-avatar">
            <div className="thread-avatar-inner">{msg.role === 'agent' ? 'AI' : 'U'}</div>
          </div>
          <div className="thread-body">
            <div className="thread-meta">
              <span className="thread-author">
                {msg.role === 'user' ? 'You' : 'Agent'}
              </span>
              {msg.role === 'agent' && <span className="thread-badge-agent">agent</span>}
              <span className="thread-time">
                {new Date(msg.at).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <div className="thread-text">{msg.text}</div>
          </div>
        </div>
      ))}
      {thread.status === 'draft' && (
        <div className="thread-status">
          <span className="badge-draft">draft</span>
          <span className="badge-hint">will sync on submit</span>
        </div>
      )}
      {thread.status === 'synced' && (
        <div className="thread-status">
          <span className="badge-synced">synced</span>
        </div>
      )}
    </div>
  );
}

import { FREE_SAVED_LIMIT } from '../account';

/** Save this pattern to the account, or say it's saved or that the free limit is reached. */
export function SaveControl({ state, disabled, onSave, onAccount }: { state: 'can' | 'saved' | 'full'; disabled?: boolean; onSave: () => void; onAccount: () => void }) {
  if (state === 'saved')
    return (
      <p className="msg small" role="status">
        Saved to{' '}
        <button type="button" className="link inline-link" onClick={onAccount}>
          your patterns
        </button>
        .
      </p>
    );
  if (state === 'full')
    return (
      <p className="muted small">
        You've saved {FREE_SAVED_LIMIT} patterns, the most you can keep for now.{' '}
        <button type="button" className="link inline-link" onClick={onAccount}>
          Make room
        </button>
      </p>
    );
  return (
    <button type="button" className="secondary" disabled={disabled} onClick={onSave}>
      Save pattern
    </button>
  );
}

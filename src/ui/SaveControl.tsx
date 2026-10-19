import { createContext, useContext } from 'react';
import { FREE_SAVED_LIMIT } from '../account';

/** How many patterns are kept and how many can be, so the button can say where a pattern goes. */
export const KeptCount = createContext<{ kept: number; limit: number } | undefined>(undefined);

/** Keep this pattern in the account, or say it's kept or that the free limit is reached. */
export function SaveControl({ state, disabled, onSave, onAccount }: { state: 'can' | 'saved' | 'full'; disabled?: boolean; onSave: () => void; onAccount: () => void }) {
  const count = useContext(KeptCount);
  if (state === 'saved')
    return (
      <p className="msg small" role="status">
        Kept in{' '}
        <button type="button" className="link inline-link" onClick={onAccount}>
          your patterns
        </button>
        .
      </p>
    );
  if (state === 'full')
    return (
      <p className="muted small">
        You've kept {count?.limit ?? FREE_SAVED_LIMIT} patterns, the most you can keep for now.{' '}
        <button type="button" className="link inline-link" onClick={onAccount}>
          Make room
        </button>
      </p>
    );
  return (
    <>
      <button type="button" className="secondary" disabled={disabled} onClick={onSave}>
        Keep in my patterns
      </button>
      {count && (
        <p className="muted small keep-note">
          Kept patterns live under your account. {count.kept} of {count.limit} kept{count.limit === FREE_SAVED_LIMIT ? ' on the free plan' : ''}.
        </p>
      )}
    </>
  );
}

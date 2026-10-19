import type { Mode } from '../mode';

/** The one quiet link where the simple view tucks its tools away, saying what they are, and the way back to it. */
export function ModeLink({ mode, onMode, what = 'seam allowances, lining, ease and more' }: { mode: Mode; onMode?: (m: Mode) => void; what?: string }) {
  if (!onMode) return null;
  return mode === 'simple' ? (
    <p className="muted small mode-link">
      <button type="button" className="link inline-link" onClick={() => onMode('all')}>
        Show all tools
      </button>{' '}
      {what}
    </p>
  ) : (
    <p className="muted small">
      <button type="button" className="link inline-link" onClick={() => onMode('simple')}>
        Show fewer tools
      </button>
    </p>
  );
}

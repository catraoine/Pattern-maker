import type { Mode } from '../mode';

/** The one quiet link where the simple view tucks its tools away, saying what they are, and the way back to it. On Style;
 *  Print's tools are its More for this pattern fold (Cat, Nov 28). */
export function ModeLink({ mode, onMode, what = 'seam allowances, lining, ease and more' }: { mode: Mode; onMode?: (m: Mode) => void; what?: string }) {
  if (!onMode) return null;
  // Always the one quiet caps link (look and feel review, 2026-10-24).
  const cls = 'later go';
  return mode === 'simple' ? (
    <p className="muted small mode-link">
      <button type="button" className={cls} onClick={() => onMode('all')}>
        Show all tools
      </button>{' '}
      {what}
    </p>
  ) : (
    <p className="muted small">
      <button type="button" className={cls} onClick={() => onMode('simple')}>
        Show fewer tools
      </button>
    </p>
  );
}

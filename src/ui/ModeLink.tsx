import type { Mode } from '../mode';

/** The one quiet link where the simple view tucks its tools away, saying what they are, and the way back to it.
 * `quiet` drops the underline, on a page that already has its own link (Print, Cat's L1d, 2026-10-21). */
export function ModeLink({ mode, onMode, what = 'seam allowances, lining, ease and more', quiet }: { mode: Mode; onMode?: (m: Mode) => void; what?: string; quiet?: boolean }) {
  if (!onMode) return null;
  const cls = quiet ? 'later' : 'link inline-link';
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

import type { Mode } from '../mode';

/** The one quiet link where the simple view tucks its tools away, and the way back to it. */
export function ModeLink({ mode, onMode }: { mode: Mode; onMode?: (m: Mode) => void }) {
  if (!onMode) return null;
  return mode === 'simple' ? (
    <p className="muted small">
      More tools are tucked away while you find your feet.{' '}
      <button type="button" className="link inline-link" onClick={() => onMode('all')}>
        Show all tools
      </button>
    </p>
  ) : (
    <p className="muted small">
      <button type="button" className="link inline-link" onClick={() => onMode('simple')}>
        Show fewer tools
      </button>
    </p>
  );
}

// A tape measure across the top of the measuring pages (Cat's pick U3 Real Tape, 2026-10-17): it unrolls
// across the welcome's form when Begin is tapped and stays as the top edge of every measuring page. Skip sits
// at its end on the pages where you can skip measuring and try the app with example measurements; once some
// are taken it says it fills in only the rest.

const MARKS = Array.from({ length: 16 }, (_, i) => i + 41);

/** `rest`: some measurements are already taken, so Skip says it fills in only the ones still to come. */
export function TapeBand({ onSkip, rest, className = '' }: { onSkip?: () => void; rest?: boolean; className?: string }) {
  return (
    <div className={`tape-band ${className}`.trim()}>
      <div className="tape-marks" aria-hidden="true">
        {MARKS.map((n) => (
          <span key={n}>{n}</span>
        ))}
      </div>
      {onSkip && (
        <button type="button" className={rest ? 'tape-skip rest' : 'tape-skip'} aria-label={rest ? 'Use example measurements for the rest' : 'Skip measuring and try an example'} onClick={onSkip}>
          {rest ? 'Example for the rest ›' : 'Skip ›'}
        </button>
      )}
    </div>
  );
}

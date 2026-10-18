import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { SKILL_WORDS, type Skill } from '../explain';

/**
 * A choice's little line drawing that can move (Cat's E3 Moving Drawings): a second copy sits over it, and
 * where it is shown a brighter pen runs round its outline. Each path's own length goes in --len, so the pen is
 * the same share of every line and goes round it once a loop.
 */
export function Drawing({ pic, className = '', onClick }: { pic: ReactNode; className?: string; onClick?: (e: React.MouseEvent<SVGSVGElement>) => void }) {
  const base = useRef<SVGGElement>(null);
  const trace = useRef<SVGGElement>(null);
  // Measured on the copy that always shows: the pen's copy is hidden until its chip is picked, and a hidden
  // path measures 0.
  useLayoutEffect(() => {
    const lens = [...(base.current?.querySelectorAll('path') ?? [])].map((p) => p.getTotalLength?.() || 100);
    trace.current?.querySelectorAll('path').forEach((p, i) => p.style.setProperty('--len', String(lens[i] ?? 100)));
  }, [pic]);
  return (
    <svg className={`pic ${className}`} viewBox="0 0 40 48" aria-hidden="true" focusable="false" onClick={onClick}>
      <g className="pic-base" ref={base}>
        {pic}
      </g>
      <g className="pic-trace" ref={trace}>
        {pic}
      </g>
    </svg>
  );
}

/** A picked choice's drawing at full size, moving, with its name and line. Closes on a tap anywhere or Escape. */
export function BigDrawing({ pic, name, line, onClose, className = '' }: { pic: ReactNode; name: string; line?: readonly [string, Skill?]; onClose: () => void; className?: string }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);
  return createPortal(
    <div className="big-drawing" role="dialog" aria-modal="true" aria-label={name} onClick={(e) => {
        // A portal still bubbles to the chip it opened from: keep the tap here.
        e.stopPropagation();
        onClose();
      }}>
      <Drawing pic={pic} className={className} />
      <p className="big-drawing-name">{name}</p>
      {line && (
        <p className="big-drawing-line">
          {line[0]}
          {line[1] && <span className={`skill-tag ${line[1]}`}>{SKILL_WORDS[line[1]]}</span>}
        </p>
      )}
      <button type="button" className="ghost" ref={close} onClick={onClose}>
        Close
      </button>
    </div>,
    document.body,
  );
}

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * A quiet drop-down (Cat applied, 2026-10-24): the current choice in tracked capitals with a champagne underline and
 * a chevron; tap for the list, the picked one marked with a short line. Used where a choice is only a word (the
 * garment on the Style title, the paper and the fabric width on Print), so a row of buttons becomes one line.
 */
export function DropMenu({ name, label, value, items, onPick, className }: { name: string; label?: string; value: ReactNode; items: { id: string; text: ReactNode; on?: boolean; note?: string }[]; onPick: (id: string) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const escape = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return (
    <div className={className ? `drop ${className}` : 'drop'} ref={root} role="group" aria-label={name}>
      {label && <span className="drop-label">{label}</span>}
      <button type="button" className="drop-button" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(!open)}>
        <span>{value}</span>
        <svg width="12" height="8" viewBox="0 0 12 8" aria-hidden="true">
          <path d={open ? 'M1 7l5-5 5 5' : 'M1 1l5 5 5-5'} fill="none" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </button>
      {open && (
        <div className="drop-list" role="menu" aria-label={name}>
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              role="menuitemradio"
              aria-checked={!!it.on}
              className={it.on ? 'on' : ''}
              onClick={() => {
                setOpen(false);
                onPick(it.id);
              }}
            >
              {it.text}
              {it.note && <span className="drop-note">{it.note}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

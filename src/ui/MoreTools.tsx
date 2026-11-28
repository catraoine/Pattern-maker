import type { ReactNode } from 'react';

// Print's extra tools in one fold, "More for this pattern" (Cat picked A, Nov 28). They used to drop across the page
// at once behind Show all tools: a dressmaker's pack, a size run and a technical flat, each a card of its own.

/** The fold. Open is the all-tools view and closed the simple one, as Show all tools was, so the choice still carries
 *  to Style and Cut it and is kept with the account. */
export function MoreTools({ open, onToggle, children }: { open: boolean; onToggle: (open: boolean) => void; children: ReactNode }) {
  return (
    <details className="small fold-link more-tools" open={open} onToggle={(e) => onToggle((e.currentTarget as HTMLDetailsElement).open)}>
      <summary>More for this pattern</summary>
      <div className="tool-rows">{children}</div>
    </details>
  );
}

/** One tool: a ruled row with its name and one line on what it does, opening the tool under it. */
export function ToolRow({ name, what, children }: { name: string; what: string; children: ReactNode }) {
  return (
    <details className="tool-row">
      <summary>
        <span className="tool-name">{name}</span>
        <span className="tool-what">{what}</span>
      </summary>
      <div className="tool-body">{children}</div>
    </details>
  );
}

/** A tool that is only on or off, such as the pages to draft it by hand: the row is the tick box. */
export function ToolTick({ name, what, checked, onChange }: { name: string; what: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="check tool-row tool-tick">
      <span>
        <span className="tool-name">{name}</span>
        <span className="tool-what">{what}</span>
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

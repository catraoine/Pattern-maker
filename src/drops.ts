// Numbered drops: a limited house piece each season, open for a short window, each copy drafted to its
// buyer and numbered in the title block of every pattern piece. Premium members get in a day early. Guest
// designers come later (Cat, 2026-10-29), so a drop can still carry one. Until a piece and a date are set,
// the next drop is announced without a date and the collection shows a sign-up for its alert.
import type { HouseLook } from './collection';
import type { PatternChoices } from './garments';
import type { Garment } from './measurements';

export interface Drop {
  number: number;
  /** How many numbered copies are sold. */
  editions: number;
  /** The look, once a designer has signed. */
  name?: string;
  designer?: string;
  city?: string;
  line?: string;
  fabric?: string;
  garment?: Garment;
  choices?: PatternChoices;
  /** The window, as ISO times, once it is set. */
  opensAt?: string;
  closesAt?: string;
}

export const NEXT_DROP: Drop = { number: 1, editions: 600 };

type DropState =
  | { kind: 'announced' } // no date yet
  | { kind: 'opens'; in: number } // ms until it opens
  | { kind: 'live'; left: number } // ms until it closes
  | { kind: 'closed' };

export function dropState(d: Drop, now: Date): DropState {
  if (!d.opensAt || !d.closesAt || !d.choices) return { kind: 'announced' };
  const t = now.getTime();
  const open = Date.parse(d.opensAt);
  const close = Date.parse(d.closesAt);
  if (t < open) return { kind: 'opens', in: open - t };
  if (t < close) return { kind: 'live', left: close - t };
  return { kind: 'closed' };
}

const two = (n: number) => String(n).padStart(2, '0');

/** Time left as hours, minutes and seconds, the way a drop clock reads: 47:12:08. */
export function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${two(Math.floor(s / 3600))}:${two(Math.floor(s / 60) % 60)}:${two(s % 60)}`;
}

export const dropNo = (d: Drop) => `Drop ${two(d.number)}`;

/** The copy's number, as printed on the pattern: No. 0127/600. */
export const editionLabel = (d: Drop, no: number) => `No. ${String(no).padStart(4, '0')}/${d.editions}`;

/** The line for the pattern's title block and piece labels. */
export const editionLine = (d: Drop, no: number) => `${dropNo(d)} · ${editionLabel(d, no)}`;

/** The drop as a look, so it is drawn and made like one of the house's. */
export function dropLook(d: Drop): HouseLook | undefined {
  if (!d.choices || !d.garment || !d.name) return undefined;
  return { id: `drop-${d.number}`, number: d.number, name: d.name, line: d.line ?? '', fabric: d.fabric ?? '', garment: d.garment, choices: d.choices };
}

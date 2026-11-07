// The ratio check (Cat, Nov 7): before a pattern drafted from a photo is shown, its proportions on the wearer are
// compared with the photo's, each as a ratio to her own body, so a cut that comes out narrower, shorter or tighter
// than the photo is caught rather than shown.
import type { OuterDraft } from '../engine/outerwear';
import { DROP } from '../engine/sleeveCut';
import type { OuterChoices } from '../garments';
import type { PhotoBody } from './garments';
import type { PhotoReading } from './types';

interface RatioRow {
  /** What is compared, in plain words: "Room at the bust". */
  what: string;
  /** The photo's ratio and the pattern's, to the wearer's own body. */
  photo: number;
  pattern: number;
  ok: boolean;
}

const r2 = (v: number) => Math.round(v * 100) / 100;
/** How far apart the two may be, as a share of the photo's: the photo's own reading is no closer than this. */
const TOLERANCE = 0.08;

/** A jacket or coat's proportions against the photo's: the room at the bust, the hem on the body, the shoulder line. */
export function outerRatios(r: PhotoReading, c: OuterChoices, d: OuterDraft, body: PhotoBody): RatioRow[] {
  const m = r.measures;
  if (!m) return [];
  const rows: RatioRow[] = [];
  const row = (what: string, photo: number, pattern: number, tol = TOLERANCE) => rows.push({ what, photo: r2(photo), pattern: r2(pattern), ok: Math.abs(pattern - photo) <= tol * Math.max(0.1, Math.abs(photo)) });
  if (m.bustRoom != null && body.full_bust) row('Room at the bust (times her bust)', m.bustRoom, d.finishedBust / body.full_bust);
  if (m.outerHemAt != null && body.waist_to_floor) row('Hem (share of waist to floor)', m.outerHemAt, d.drop / body.waist_to_floor, 0.12);
  if (m.shoulderOutCm != null) row('Shoulder past hers (cm)', m.shoulderOutCm, (c.shoulderCm ?? 0) + (c.fit === 'oversized' && c.sleeve !== 'raglan' && c.sleeve !== 'none' ? DROP.out : 0), 0.25);
  if (m.buttons != null && c.front !== 'zip') row('Buttons', m.buttons, d.buttons.at.length, 0);
  return rows;
}

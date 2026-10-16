// Viewing a piece at true size on a screen. Screens don't know their own size, so the person calibrates
// once against a bank card (ISO/IEC 7810 ID-1, 85.60 × 53.98 mm), which everyone has to hand.
import { P, len, sub } from './geometry';
import { Run, distanceTo, runsOf } from './compare';
import type { Piece } from './piece';

export const CARD_MM = { w: 85.6, h: 53.98 };

export interface Calibration {
  /** CSS pixels to the millimetre on this screen. */
  pxPerMm: number;
  /** The screen it was made on, so a different screen (or a changed zoom) asks again. */
  screen: string;
}

const KEY = 'pattern-maker:true-scale';

/** A short fingerprint of the screen: its size in CSS pixels and its pixel ratio. */
export function screenKey(w: number, h: number, ratio: number): string {
  return `${Math.min(w, h)}x${Math.max(w, h)}@${Math.round(ratio * 100) / 100}`;
}

/** The pixels per millimetre for a card drawn `cardPx` CSS pixels wide that matches a real card. */
export const pxPerMmOf = (cardPx: number) => cardPx / CARD_MM.w;

/** The saved calibration for this screen, if there is one. Storage can be missing or blocked. */
export function loadCalibration(screen: string): Calibration | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return undefined;
    const c = JSON.parse(raw) as Calibration;
    return c.screen === screen && c.pxPerMm > 1 && c.pxPerMm < 40 ? c : undefined;
  } catch {
    return undefined;
  }
}

export function saveCalibration(c: Calibration): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    // Without storage it is asked for again next time; the view still works now.
  }
}

/** The straight distance between two points, in cm, to the millimetre. */
export const distanceCm = (a: P, b: P) => Math.round(len(sub(b, a)) * 10) / 10;

/** The nearest point of the outline within `tol` cm, so a tap lands on a corner or a notch. */
export function snap(q: P, pts: P[], tol: number): P {
  let best = q;
  let d = tol;
  for (const x of pts) {
    const dx = len(sub(x, q));
    if (dx < d) {
      d = dx;
      best = x;
    }
  }
  return best;
}

/** The edge of the piece's stitching line nearest to a tap, if one is within `tol` cm. */
export function edgeAt(pc: Piece, q: P, tol: number): Run | undefined {
  let best: Run | undefined;
  let d = tol;
  for (const r of runsOf(pc.outline)) {
    const dr = distanceTo(q, r.pts);
    if (dr < d) {
      d = dr;
      best = r;
    }
  }
  return best;
}

import { FADE_FROM, paintFigure } from './ContourForm';

/** The How it works film's opening, O1 Gentle Glide (Cat, 2026-11-08: the old one sat still while the film loaded,
 *  then jumped forward and turned, "creepy"; she wants it "sexy and seductive"). From the tap, the welcome's form
 *  glides in, 1.35 times over 5 s, softly in and out, while it turns from a standstill, easing up to 8 degrees a
 *  second over 1.5 s. One move, starting at once. The film's welcome take is drawn from this (record-tour-shots.mjs,
 *  TOUR_WELCOME=1), and the player draws the same frames itself until the film is ready (TourPlayer), so nothing
 *  waits on the film loading. */
export const OPENING = { push: 0.35, pushS: 5, turnDeg: 8, rampS: 1.5, wordsS: 0.4 };

const sine = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, x)));

/** How far the push has come (0 to 1), the zoom, and the turn (radians), t seconds after the tap. */
export function openingAt(t: number) {
  const p = sine(t / OPENING.pushS);
  const rate = (OPENING.turnDeg * Math.PI) / 180;
  const r = OPENING.rampS;
  const tt = Math.max(0, t);
  return { p, z: 1 + OPENING.push * p, turn: rate * (tt < r ? (tt * tt) / (2 * r) : tt - r / 2) };
}

export type FormRect = { x: number; y: number; w: number; h: number };

/** The opening's form at t, on g, in the pixels of a page vw x vh whose welcome form canvas is r (g's transform takes
 *  those pixels to wherever it is drawn): black behind it within the form's canvas, its hem fading into the black. */
export function paintOpening(g: CanvasRenderingContext2D, r: FormRect, vw: number, vh: number, t: number) {
  const { p, z, turn } = openingAt(t);
  const cx0 = r.x + r.w / 2, cy0 = r.y + r.h / 2;
  const cx = cx0 + (vw / 2 - cx0) * p, cy = cy0 + (vh / 2 - cy0) * p;
  g.save();
  g.transform(z, 0, 0, z, cx - (z * r.w) / 2, cy - (z * r.h) / 2);
  g.beginPath();
  g.rect(0, 0, r.w, r.h);
  g.clip();
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#000000';
  g.fillRect(0, 0, r.w, r.h);
  const S = Math.min(r.w * 0.82, r.h * 0.46), wy = r.h * 0.5;
  g.strokeStyle = '#d9c49b';
  paintFigure(g, S, r.w / 2, (y) => wy + (y - 0.1) * S, Math.max(0.7, S / 252) * 1.2, 0, false, turn);
  g.globalAlpha = 1;
  const fade = g.createLinearGradient(0, r.h * FADE_FROM, 0, r.h);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = fade;
  g.fillRect(0, r.h * FADE_FROM, r.w, r.h * (1 - FADE_FROM) + 1);
  g.restore();
}

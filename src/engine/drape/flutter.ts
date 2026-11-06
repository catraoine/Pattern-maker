// A flutter sleeve's start on the arm, for the drape (garment.ts): kept in its own file, as new garment logic is.
import type { P } from '../geometry';
import type { Piece } from '../piece';
import { knob } from './knob';

const TAU = Math.PI * 2;

/** A flutter sleeve laid round the arm. It is slashed from hem to crown and fanned, so its hem is about twice the arm
 *  round: wrapped by its flat x, as a plain sleeve is, the fan's crown took only part of the turn round the arm, and the
 *  sim settled the rest into a smooth cone standing off the arm, read as a plain short sleeve (the SS27 renders,
 *  2026-11-04). Each point is placed by where it lies between the crown and the hem instead: its turn round the arm
 *  read along each, by share of their length, so the hem's fullness is spread all round, and set in even flutes that
 *  take up the hem's extra length, as a flutter falls. Undefined for any other sleeve. */
export function flutterPlace(top: Piece, under: Piece | undefined, rag: boolean, capH: number, r0: number): ((q: P) => { th: number; along: number; rr: number }) | undefined {
  if (!top.meta.flutter || under || rag || knob('__noFlutter')) return undefined;
  const { pts, tags } = top.outline.taggedPoints(16);
  const runOf = (tag: string) => {
    // (In outline order, a run that wraps past the outline's start joined back into one.)
    const runs: P[][] = [];
    let cur: P[] = [];
    pts.forEach((q, i) => {
      if (tags[i] === tag || tags[(i + pts.length - 1) % pts.length] === tag) cur.push(q);
      else if (cur.length) {
        runs.push(cur);
        cur = [];
      }
    });
    if (cur.length) runs.push(cur);
    if (runs.length > 1 && (tags[0] === tag || tags[pts.length - 1] === tag)) runs[0] = [...runs.pop()!, ...runs[0]];
    return runs.sort((a, b) => b.length - a.length);
  };
  const ah = runOf('armhole');
  const hm = runOf('hem')[0];
  if (!ah.length || !hm || hm.length < 2) return undefined;
  // The crown from one underarm to the other: the outline runs crown to front underarm, then round the hem, then from the
  // back underarm to the crown, so the back half comes first.
  let crown = ah.length > 1 ? [...ah[0], ...ah[1]] : ah[0];
  if (ah.length > 1 && Math.hypot(ah[0][0].x - ah[1][ah[1].length - 1].x, ah[0][0].y - ah[1][ah[1].length - 1].y) < 1e-3) crown = [...ah[1], ...ah[0].slice(1)];
  // Both runs the same way round, by x as the plain sleeve's turn goes (the turn grows with x), the hem's ends meeting
  // the crown's at the underseams.
  if (crown[0].x > crown[crown.length - 1].x) crown = [...crown].reverse();
  let hem = hm;
  const d0 = Math.hypot(hem[0].x - crown[0].x, hem[0].y - crown[0].y) + Math.hypot(hem[hem.length - 1].x - crown[crown.length - 1].x, hem[hem.length - 1].y - crown[crown.length - 1].y);
  const d1 = Math.hypot(hem[hem.length - 1].x - crown[0].x, hem[hem.length - 1].y - crown[0].y) + Math.hypot(hem[0].x - crown[crown.length - 1].x, hem[0].y - crown[crown.length - 1].y);
  if (d1 < d0) hem = [...hem].reverse();
  const cum = (run: P[]) => run.reduce<number[]>((s, q, i) => [...s, i ? s[i - 1] + Math.hypot(q.x - run[i - 1].x, q.y - run[i - 1].y) : 0], []);
  const cs = cum(crown);
  const hs = cum(hem);
  const cLen = cs[cs.length - 1] || 1;
  const hLen = hs[hs.length - 1] || 1;
  const near = (run: P[], s: number[], q: P) => {
    let best = { d: Infinity, f: 0 };
    for (let k = 0; k + 1 < run.length; k++) {
      const [u, v] = [run[k], run[k + 1]];
      const L2 = (v.x - u.x) ** 2 + (v.y - u.y) ** 2 || 1e-9;
      const t = Math.max(0, Math.min(1, ((q.x - u.x) * (v.x - u.x) + (q.y - u.y) * (v.y - u.y)) / L2));
      const d = Math.hypot(q.x - u.x - (v.x - u.x) * t, q.y - u.y - (v.y - u.y) * t);
      if (d < best.d) best = { d, f: (s[k] + (s[k + 1] - s[k]) * t) / s[s.length - 1] };
    }
    return best;
  };
  // The crown's top: its highest point, where the turn starts (on top of the arm).
  const iTop = crown.reduce((b, q, i) => (q.y < crown[b].y ? i : b), 0);
  const fTop = cs[iTop] / cLen;
  const n = knob('__flutterN') ?? 7;
  const kf = 1 + (n * n) / 2;
  return (q: P) => {
    const c = near(crown, cs, q);
    const h = near(hem, hs, q);
    const w = c.d / (c.d + h.d || 1);
    // (The hem's share measured from the same top, so the fan's middle hangs below the crown's.)
    const f = c.f * (1 - w) + (h.f - 0.5 + fTop) * w;
    const th = TAU * (f - fTop);
    // Down the arm: the cap's own drop from the crown's top to the underarm, then as far again as it lies below the crown.
    const u = Math.min(1, Math.abs(c.f - fTop) / Math.max(fTop, 1 - fTop, 1e-6));
    const along = -capH * 0.6 + capH * u * u + c.d;
    const b = r0 + 1.5 + 1.5 * w;
    const need = (cLen * (1 - w) + hLen * w) / TAU;
    const A = need > b ? (-2 * b + Math.sqrt(4 * b * b - 4 * kf * (b * b - need * need))) / (2 * kf) : 0;
    return { th, along, rr: b + A * (1 + Math.cos(n * th)) };
  };
}

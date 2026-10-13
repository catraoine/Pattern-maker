// Fitted bodice block (front and back, to the waist), drafted flat from measurements (Aldrich-style).
// Ported from the Python prototype in the drafting thread (pattern/bodice.py).
//
// Driven by the person's own lengths rather than a size table:
// - back: nape, back length, shoulder width and slope, across back, armhole depth;
// - front: shoulder to waist over the bust, bust depth and apex separation place the bust point,
//   and the extra front length over the bust becomes a side bust dart;
// - waist suppression is shared between the side seams and one waist dart per piece.
import { P, Path, add, len, lerp, mul, p, sub, taggedLength, unit } from './geometry';
import { Piece } from './piece';

export interface BodiceMeasurements {
  full_bust: number;
  high_bust?: number;
  waist: number;
  neck: number;
  shoulder_width: number;
  shoulder_length: number;
  across_back: number;
  across_front: number;
  nape_to_waist: number;
  front_hps_to_waist: number;
  bust_depth: number;
  apex_separation: number;
  armscye?: number;
}

export type BodiceFit = 'fitted' | 'regular' | 'relaxed';

export interface BodiceStyle {
  fit: BodiceFit;
  seamAllowance: number;
  neckArmholeAllowance: number;
}

// Ease in cm from styling/styling-options.json (top/blouse fit options). Oversized has no darts,
// so it needs its own block rather than this one.
export const BODICE_FIT_EASE: Record<BodiceFit, { bust: number; waist: number }> = {
  fitted: { bust: 5, waist: 3 },
  regular: { bust: 9, waist: 6 },
  relaxed: { bust: 14, waist: 12 },
};

export const DEFAULT_BODICE_STYLE: BodiceStyle = {
  fit: 'fitted',
  seamAllowance: 1.5,
  neckArmholeAllowance: 1,
};

export interface BodiceDraft {
  pieces: Piece[];
  bustDart: number;
  waistDarts: { front: number; back: number };
  sideSuppression: number;
  armholeDepth: number;
  armhole: number;
  armholeTarget?: number;
  shoulder: { front: number; back: number };
  sideSeam: { frontLessDart: number; back: number };
  finishedBust: number;
  finishedWaist: number;
  neck: number;
  warnings: string[];
}

const r = (v: number, dp = 2) => Math.round(v * 10 ** dp) / 10 ** dp;

/** Unit vector at right angles to u, turned toward the body (down and toward centre). */
const perp = (u: P): P => p(-u.y, u.x);

/** Draft the block, choosing the armhole depth that makes the armhole the person's armhole
 * measurement plus ease (falls back to a size-table depth without it). */
export function draftBodice(m: BodiceMeasurements, style: Partial<BodiceStyle> = {}): BodiceDraft {
  const s = { ...DEFAULT_BODICE_STYLE, ...style };
  const ease = BODICE_FIT_EASE[s.fit];
  const hb = m.high_bust ?? m.full_bust - 4;
  const table = 21 + (hb - 82) * 0.1 + ease.bust / 10;
  if (!m.armscye) return draft(m, s, table);

  const target = m.armscye + 4 + 0.3 * ease.bust;
  let lo = table - 4;
  let hi = table + 3;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (draft(m, s, mid).armhole < target) lo = mid;
    else hi = mid;
  }
  const result = draft(m, s, (lo + hi) / 2);
  if (Math.abs(result.armhole - target) > 1) {
    result.warnings.push(`armhole ${result.armhole} cm could not reach ${target.toFixed(1)} cm within a sensible depth`);
  }
  result.armholeTarget = r(target, 1);
  return result;
}

function draft(m: BodiceMeasurements, s: BodiceStyle, scye: number): BodiceDraft {
  const { full_bust: B, waist: W, neck: N, shoulder_length: SL, shoulder_width: SW } = m;
  const { across_back: AB, across_front: AF, nape_to_waist: NW, bust_depth: BD, apex_separation: AS } = m;
  let FL = m.front_hps_to_waist;
  const HB = m.high_bust ?? B - 4;
  const { bust: be, waist: we } = BODICE_FIT_EASE[s.fit];
  const warnings: string[] = [];

  // Bust projection (full minus high bust) goes to the front piece.
  const shift = Math.min(4, Math.max(0.5, (B - HB) / 4));
  const backW = (B + be) / 4 - shift;
  const frontW = (B + be) / 4 + shift;
  const backWq = (W + we) / 4 - 0.5; // same front/back waist split as the skirt, so a dress waist matches
  const frontWq = (W + we) / 4 + 0.5;

  // ---- back ---------------------------------------------------------------
  const nw = N / 5 - 0.2; // back neck width
  const hpsB = p(nw, -2);
  let run = SW / 2 - nw;
  const blen = SL + 1; // 1 cm eased into the front shoulder
  let drop = blen > run ? Math.sqrt(blen ** 2 - run ** 2) : 0;
  if (!(drop >= 2.5 && drop <= 7)) {
    warnings.push('shoulder slope out of range, used a standard 4.5 cm drop');
    drop = 4.5;
    run = Math.sqrt(blen ** 2 - drop ** 2);
  }
  const spB = p(nw + run, hpsB.y + drop);
  const uB = unit(sub(spB, hpsB));

  const abPt = p(AB / 2, scye / 2 + 1);
  const sideB = p(backW, scye);
  const wb = NW;

  const suppB = backW - backWq;
  const suppF = frontW - frontWq;
  const low = Math.min(suppB, suppF);
  const sideSupp = low > 0 ? Math.min(2.5, 0.4 * low) : low;
  const dartB = Math.max(0, suppB - sideSupp);
  const dartF = Math.max(0, suppF - sideSupp);
  const swB = p(backW - sideSupp, wb);

  const back = new Path(p(0, 0))
    .curve(p(nw * 0.6, 0), add(hpsB, perp(uB)), hpsB, 'neck')
    .line(spB, 'shoulder')
    .curve(add(spB, mul(perp(uB), 2.5)), sub(abPt, p(0, 3)), abPt, 'armhole')
    .curve(add(abPt, p(0, (scye - abPt.y) * 0.55)), sub(sideB, p((sideB.x - abPt.x) * 0.6, 0)), sideB, 'armhole')
    .line(swB, 'side')
    .line(p(0, wb), 'waist')
    .line(p(0, 0), 'centre');
  back.closed = true;

  const backLines: Path[] = [];
  if (dartB > 0.3) {
    const c = swB.x * 0.48;
    backLines.push(new Path(p(c - dartB / 2, wb)).line(p(c, scye + 2.5)).line(p(c + dartB / 2, wb)));
  }
  const backCut = 'Cut 2 (1 pair)';
  const backPiece: Piece = {
    name: 'Bodice back',
    outline: back,
    lines: backLines,
    grain: [p(backW * 0.2, scye - 4), p(backW * 0.2, wb - 3)],
    notches: [
      [add(abPt, p(0, -0.5)), p(1, 0)], // double notch = back
      [add(abPt, p(0, 0.5)), p(1, 0)],
    ],
    labels: [
      { at: p(backW * 0.42, scye - 7), text: 'BODICE BACK', size: 1.4 },
      { at: p(backW * 0.42, scye - 5), text: backCut, size: 0.9 },
    ],
    cut: backCut,
    seamAllowance: s.seamAllowance,
    allowances: { neck: s.neckArmholeAllowance, armhole: s.neckArmholeAllowance },
    meta: {},
  };

  // ---- front --------------------------------------------------------------
  const nwF = nw - 0.2;
  const hpsF = p(nwF, -2);
  const cfNeck = p(0, hpsF.y + nw + 1);
  const dropF = drop + 0.5; // front shoulder slopes slightly more
  const runF = Math.sqrt(Math.max(SL ** 2 - dropF ** 2, 1));
  const spF = p(nwF + runF, hpsF.y + dropF);
  const uF = unit(sub(spF, hpsF));

  if (FL < NW + 1) {
    warnings.push(
      `front length ${FL} cm is not longer than back length ${NW} cm; drafted with ${NW + 1} cm, please re-measure`,
    );
    FL = NW + 1;
  }
  const dx = AS / 2 - nwF;
  const apex = p(AS / 2, hpsF.y + Math.sqrt(Math.max(BD ** 2 - dx ** 2, 1)));
  const wf = apex.y + Math.max(FL - BD, 0);

  const afPt = p(AF / 2, (spF.y + scye) / 2 + 1.5);
  const sideF = p(frontW, scye);

  // Side bust dart: the extra front length over the bust, but at least what the cup size
  // (full minus high bust) calls for. A bigger dart lowers the side waist, which is what a
  // side-dart block looks like with the dart open.
  const backSide = len(sub(swB, sideB));
  const bustDart = Math.max(len(sub(p(frontW - sideSupp, wf), sideF)) - backSide, (B - HB) / 2, 0);
  const down = Math.sqrt(Math.max((backSide + bustDart) ** 2 - sideSupp ** 2, 0));
  const swF = p(frontW - sideSupp, scye + down);
  const frontSide = len(sub(swF, sideF));

  const front = new Path(cfNeck)
    .curve(p(nwF * 0.55, cfNeck.y), add(hpsF, mul(perp(uF), (cfNeck.y - hpsF.y) * 0.45)), hpsF, 'neck')
    .line(spF, 'shoulder')
    .curve(add(spF, mul(perp(uF), 2.5)), sub(afPt, p(0, 3)), afPt, 'armhole')
    .curve(add(afPt, p(0, (scye - afPt.y) * 0.5)), sub(sideF, p((sideF.x - afPt.x) * 0.75, 0)), sideF, 'armhole')
    .line(swF, 'side')
    .line(p(0, wf), 'waist') // slopes down to the side while the bust dart is open
    .line(cfNeck, 'fold');
  front.closed = true;

  const frontLines: Path[] = [];
  const towardApex = (from: P, shortBy: number) => add(from, mul(unit(sub(apex, from)), len(sub(apex, from)) - shortBy));
  if (bustDart > 0.3) {
    const uSide = unit(sub(swF, sideF));
    const s1 = add(sideF, mul(uSide, Math.min(5, Math.max(2.5, backSide - bustDart - 4))));
    const s2 = add(s1, mul(uSide, bustDart));
    frontLines.push(new Path(s1).line(towardApex(lerp(s1, s2, 0.5), 2.5)).line(s2));
  }
  if (dartF > 0.3) {
    frontLines.push(new Path(p(apex.x - dartF / 2, wf)).line(p(apex.x, apex.y + 2.5)).line(p(apex.x + dartF / 2, wf)));
  }
  // Bust point marker
  frontLines.push(new Path(sub(apex, p(0.5, 0))).line(add(apex, p(0.5, 0))));
  frontLines.push(new Path(sub(apex, p(0, 0.5))).line(add(apex, p(0, 0.5))));

  const frontCut = 'Cut 1 on fold';
  const frontPiece: Piece = {
    name: 'Bodice front',
    outline: front,
    lines: frontLines,
    grain: [p(frontW * 0.62, scye + 1), p(frontW * 0.62, Math.min(wf, swF.y) - 4)],
    fold: [p(0, cfNeck.y + 2), p(0, wf - 2)],
    notches: [[afPt, p(1, 0)]],
    labels: [
      { at: p(frontW * 0.4, scye - 3), text: 'BODICE FRONT', size: 1.4 },
      { at: p(frontW * 0.4, scye - 1), text: frontCut, size: 0.9 },
    ],
    cut: frontCut,
    seamAllowance: s.seamAllowance,
    allowances: { neck: s.neckArmholeAllowance, armhole: s.neckArmholeAllowance, fold: 0 },
    meta: {},
  };

  // ---- checks -------------------------------------------------------------
  return {
    pieces: [frontPiece, backPiece],
    bustDart: r(bustDart),
    waistDarts: { front: r(dartF), back: r(dartB) },
    sideSuppression: r(sideSupp),
    armholeDepth: r(scye, 1),
    armhole: r(taggedLength(back, 'armhole') + taggedLength(front, 'armhole'), 1),
    shoulder: { front: r(len(sub(spF, hpsF))), back: r(len(sub(spB, hpsB))) },
    sideSeam: { frontLessDart: r(frontSide - bustDart), back: r(backSide) },
    finishedBust: r(2 * (backW + frontW), 1),
    finishedWaist: r(2 * (swB.x - dartB + swF.x - dartF), 1),
    neck: r(2 * (taggedLength(back, 'neck') + taggedLength(front, 'neck')), 1),
    warnings,
  };
}

// A garment all the way round, for the turning shape preview: where its seams and darts sit round the
// body, where its neck and hem fall at every point, its sleeves and legs, and whether stripes meet at the
// side seams. Read from the drafted pieces, so it shows the garment as it will be cut.
// Seams are trued as each garment is drafted (see matchSides and shapeHem in hem.ts), so this only
// reports what is true of the draft: it never asks the sewist to fix anything.
import { P, len, sub } from './geometry';
import { asymOffset } from './asymHem';
import { offsetAt } from './hem';
import { dartsOf } from './marks';
import { Piece } from './piece';
import { checkPattern } from './qc';
import type { SkirtDraft } from './skirt';
import type { BodiceDraft } from './bodice';
import type { DressDraft } from './dress';
import type { TeeDraft } from './tee';
import type { OuterDraft } from './outerwear';
import type { TrousersDraft } from './trousers';
import type { SleeveDraft } from './sleeve';

/** A point on the garment: its angle round the body (0 the centre front, pi / 2 the wearer's left side,
 * pi the centre back) and how far below the waist it sits, in cm (negative above the waist). */
export interface RoundPt {
  phi: number;
  cm: number;
}

export type SeamKind = 'side' | 'centre_back' | 'centre_front' | 'princess' | 'shoulder' | 'crotch' | 'inseam' | 'sleeve';

export interface RoundSeam {
  kind: SeamKind;
  pts: RoundPt[];
  /** On a trouser leg (1 the wearer's left, -1 the right): phi is then the angle round that leg. */
  leg?: 1 | -1;
  /** On a sleeve (1 the wearer's left, -1 the right), down the underarm. */
  sleeve?: 1 | -1;
  /** The same seam carried on down a leg: drawn, but not counted twice. */
  cont?: boolean;
}

export interface RoundDart {
  base: RoundPt;
  tip: RoundPt;
  lengthCm: number;
}

export interface RoundZip {
  phi: number;
  fromCm: number;
  toCm: number;
}

export interface RoundGarment {
  kind: 'skirt' | 'top' | 'dress' | 'trousers';
  /** Where the top edge sits at angle phi: the waist for skirts and trousers, the neckline for tops. */
  topAt: (phi: number) => number;
  /** Where the hem sits at angle phi, in cm below the waist: the length from the waist to the hem. */
  lengthAt: (phi: number) => number;
  seams: RoundSeam[];
  darts: RoundDart[];
  /** Seams that run all the way round, such as a dress's waist seam. */
  rings: ((phi: number) => number)[];
  zip?: RoundZip;
  /** A waistband's height above the top edge, in cm (0 for none or a facing). */
  bandCm: number;
  /** The hem's girth over the hip's: above 1 flares out, below 1 tapers in. */
  flare: number;
  /** Finished girths, in cm, where the garment reaches them. */
  girth: { bust?: number; waist: number; hip?: number };
  /** The armhole on the body: the shoulder tip and the underarm, in cm from the waist. */
  armhole?: { shoulderCm: number; underarmCm: number };
  sleeve?: { lengthCm: number; bicepCm: number; hemCm: number };
  legs?: { crotchCm: number; lengthCm: number; kneeCm: number; hemCm: number };
  /** An open centre front, closed with buttons at these heights (cm from the waist). */
  opening?: { buttons: number[] };
  /** A centre back vent, from this height to the hem. */
  vent?: { fromCm: number };
  elastic: boolean;
  /** Every pair of seams that sew together is the same length, and every dart is trued. */
  seamsMeet: boolean;
  /** Each side seam's angle to the straight grain, in degrees, front and back: stripes cut on the
   * grain meet at the side seam when the two match, and dip toward it as the angle grows. */
  sideAngle: { front: number; back: number };
  /** Lengths to read out: the centre front, the sides and the centre back; left and right separately
   * when the hem differs side to side. */
  readings: { front: number; back: number; left: number; right: number };
}

/** The skirt keeps its own name for the screens and tests that read it. */
export type RoundSkirt = RoundGarment;

const HALF = Math.PI / 2;
const ease = (u: number) => u * u * (3 - 2 * u);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const deg = (r: number) => (r * 180) / Math.PI;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const r1 = (v: number) => Math.round(v);

/** The points of a piece's edges with any of these tags, in outline order. */
function edge(pc: Piece, names: string[]): P[] {
  const { pts, tags } = pc.outline.taggedPoints(24);
  const out: P[] = [];
  tags.forEach((t, i) => {
    if (names.includes(t) && pts[i + 1]) out.push(pts[i], pts[i + 1]);
  });
  return out;
}

/** A piece's side seam: the run of 'side' edges, from the top down. */
function sideSeam(pc: Piece): P[] {
  return [...edge(pc, ['side'])].sort((a, b) => a.y - b.y);
}

/** The angle between the lower side seam and the grain, in degrees. */
function sideToGrain(pc: Piece): number {
  const s = sideSeam(pc);
  if (s.length < 2) return 0;
  const lower = s.slice(Math.floor(s.length / 2));
  const d = sub(lower[lower.length - 1], lower[0]);
  const g = pc.grain ? sub(pc.grain[1], pc.grain[0]) : { x: 0, y: 1 };
  const a = Math.abs(deg(Math.atan2(d.x, d.y) - Math.atan2(g.x, g.y)));
  const folded = a % 180;
  return Math.round(Math.min(folded, 180 - folded) * 10) / 10;
}

/** A curve over angle, from points round half the body (0 to pi), read back at any angle. */
function curve(pts: RoundPt[], fallback: number): (phi: number) => number {
  const s = [...pts].filter((p) => Number.isFinite(p.cm)).sort((a, b) => a.phi - b.phi);
  if (!s.length) return () => fallback;
  return (phi: number) => {
    const a = Math.abs(wrap(phi));
    if (a <= s[0].phi) return s[0].cm;
    for (let i = 1; i < s.length; i++) {
      if (a <= s[i].phi) {
        const d = s[i].phi - s[i - 1].phi;
        return d < 1e-9 ? s[i].cm : s[i - 1].cm + ((s[i].cm - s[i - 1].cm) * (a - s[i - 1].phi)) / d;
      }
    }
    return s[s.length - 1].cm;
  };
}

/** Drops points that repeat the one before. */
const dedupe = (pts: RoundPt[]) => pts.filter((p, i) => !i || Math.abs(p.phi - pts[i - 1].phi) > 1e-4 || Math.abs(p.cm - pts[i - 1].cm) > 0.05);

const mirror = (p: RoundPt): RoundPt => ({ phi: wrap(-p.phi), cm: p.cm });

const readingsOf = (lengthAt: (phi: number) => number) => ({
  front: r1(lengthAt(0)),
  back: r1(lengthAt(Math.PI)),
  left: r1(lengthAt(HALF)),
  right: r1(lengthAt(-HALF)),
});

const meets = (pieces: Piece[], finishedWaist?: number) =>
  checkPattern(pieces, { finishedWaist })
    .filter((c) => c.group !== 'Corners')
    .every((c) => c.ok);

/** Where a skirt's darts sit round the body, from how far they are from the centre to the side seam. */
function skirtDarts(pc: Piece, back: boolean): RoundDart[] {
  const s = sideSeam(pc);
  const sideX = Math.abs(s[0]?.x ?? 0) || 1;
  return dartsOf(pc).flatMap(({ near, tip, far }) => {
    const mid = { x: (near.x + far.x) / 2, y: (near.y + far.y) / 2 };
    const u = Math.min(1, Math.abs(mid.x) / sideX);
    const phi = (u * Math.PI) / 2;
    const lengthCm = Math.round(len(sub(tip, mid)) * 10) / 10;
    const at = back ? Math.PI - phi : phi;
    const one = (a: number): RoundDart => ({ base: { phi: a, cm: 0 }, tip: { phi: a, cm: lengthCm }, lengthCm });
    // A half piece is cut as a pair: its darts sit on both sides of the body.
    return pc.meta.whole ? [one(wrap(at))] : [one(at), one(wrap(-at))];
  });
}

export function roundSkirt(draft: SkirtDraft): RoundGarment {
  const [front, back] = draft.pieces;
  const half = draft.halves ?? [front, back];
  const L = draft.lengthCm;
  const lengthAt = (phi: number) => {
    const a = wrap(phi);
    if (draft.asym) return L + asymOffset(draft.asym, a);
    if (!draft.hem) return L;
    const isFront = Math.abs(a) <= HALF;
    // From the centre (0) to the side seam (1), eased the way shapeHem lays the drawn offsets on.
    const u = isFront ? Math.abs(a) / HALF : (Math.PI - Math.abs(a)) / HALF;
    return L + offsetAt(isFront ? draft.hem.front : draft.hem.back, ease(u));
  };
  const down = (phi: number, kind: SeamKind): RoundSeam => ({ kind, pts: [{ phi, cm: 0 }, { phi, cm: lengthAt(phi) }] });
  const seams = [down(HALF, 'side'), down(-HALF, 'side')];
  const cb = !back.fold && !back.meta.whole;
  // A centre back seam unless the back is cut on the fold or whole.
  if (cb) seams.push(down(Math.PI, 'centre_back'));
  const zipPhi = draft.opening === 'left_side' || !cb ? HALF : Math.PI;
  const blocks = draft.block ?? half;
  return {
    kind: 'skirt',
    topAt: () => 0,
    lengthAt,
    seams,
    darts: [...skirtDarts(blocks[0], false), ...skirtDarts(blocks[1], true)],
    rings: [],
    zip: draft.zipCm > 0 ? { phi: zipPhi, fromCm: 0, toCm: draft.zipCm } : undefined,
    bandCm: draft.faced || draft.elastic ? (draft.elastic ? 3 : 0) : 3,
    flare: draft.hemCm / draft.finishedHip,
    girth: { waist: draft.finishedWaist, hip: draft.finishedHip },
    elastic: !!draft.elastic,
    seamsMeet: meets(draft.pieces, draft.finishedWaist),
    sideAngle: { front: sideToGrain(half[0]), back: sideToGrain(half[1]) },
    readings: readingsOf(lengthAt),
  };
}

/** Stripes meet at the side seams when the front and back cut the same angle to the grain there. */
export const stripesMeet = (r: RoundGarment) => r.kind !== 'trousers' && Math.abs(r.sideAngle.front - r.sideAngle.back) <= 1;

// ---- Tops: bodices, tees, jackets and coats ----

interface TopInput {
  /** The front and back as sewn, centre at x = 0 and the side seam at positive x. */
  front: Piece;
  back: Piece;
  /** The shell's front when the block is closed at the centre front: its neck, break and opening. */
  openFront?: Piece;
  /** Every piece of the shell, for the seam check and the princess seams. */
  pieces: Piece[];
  napeToWaist: number;
  sleeve?: SleeveDraft;
  /** Lines drawn on the sewn bodice in place of its darts (a moved dart or princess seams). */
  styleLines?: BodiceDraft['styleLines'];
  buttons?: number[];
  zipCm?: number;
  vent?: { top: number };
  girth: RoundGarment['girth'];
  hemGirth?: number;
  finishedWaist?: number;
}

const isShell = (pc: Piece) => !pc.kind && !/sleeve|skirt|neckband|collar|pocket|welt|fly/i.test(pc.name);

function roundTop(t: TopInput): RoundGarment {
  const N = t.napeToWaist;
  const F = t.front;
  const B = t.back;
  const sideF = sideSeam(F);
  const sideB = sideSeam(B);
  const neckB = edge(B, ['neck']);
  const neckF = edge(t.openFront ?? F, ['neck']);
  const nape = neckB.reduce((a, p) => (Math.abs(p.x) < Math.abs(a.x) ? p : a), neckB[0] ?? { x: 0, y: 0 });
  const napeY = nape.y;
  // The front's side seam comes down to the same point as the back's: that lines the two up.
  const lowest = (s: P[]) => (s.length ? s[s.length - 1].y : 0);
  const offset = lowest(sideB) - lowest(sideF);
  const cmB = (y: number) => y - napeY - N;
  const cmF = (y: number) => y + offset - napeY - N;
  const sideAt = (s: P[], y: number) => {
    if (!s.length) return 20;
    if (y <= s[0].y) return s[0].x;
    for (let i = 1; i < s.length; i++) if (y <= s[i].y) return s[i - 1].x + ((s[i].x - s[i - 1].x) * (y - s[i - 1].y)) / (s[i].y - s[i - 1].y || 1);
    return s[s.length - 1].x;
  };
  const uOf = (s: P[], p: P) => clamp(Math.max(0, p.x) / (Math.abs(sideAt(s, p.y)) || 1), 0, 1);
  const onF = (p: P): RoundPt => ({ phi: uOf(sideF, p) * HALF, cm: cmF(p.y) });
  const onB = (p: P): RoundPt => ({ phi: Math.PI - uOf(sideB, p) * HALF, cm: cmB(p.y) });

  // The neckline: from the centre front (or an open front's break point) round by the neck point at the
  // shoulder to the nape.
  const hps = (pts: P[]) => pts.reduce((a, p) => (p.x > a.x ? p : a), pts[0] ?? { x: 1, y: 0 });
  const hpsF = hps(neckF);
  const hpsB = hps(neckB);
  const opening = edge(t.openFront ?? F, ['opening']);
  const neckPts: RoundPt[] = [
    ...neckF.filter((p) => p.x >= 0).map((p) => ({ phi: clamp(p.x / (hpsF.x || 1), 0, 1) * HALF, cm: cmF(p.y) })),
    ...neckB.map((p) => ({ phi: Math.PI - clamp(p.x / (hpsB.x || 1), 0, 1) * HALF, cm: cmB(p.y) })),
  ];
  if (opening.length) neckPts.push({ phi: 0, cm: cmF(Math.min(...opening.map((p) => p.y))) });
  const topAt = curve(neckPts, -N);

  // The hem: the hem edges, or the waist on a bodice that stops there.
  const hemTags = edge(F, ['hem', 'opening-hem']).length ? ['hem', 'opening-hem'] : ['waist'];
  const hemPts = [...edge(F, hemTags).map(onF), ...edge(B, hemTags).map(onB)];
  const lengthAt = curve(hemPts, 0);

  const shoulderB = edge(B, ['shoulder']);
  const tip = shoulderB.reduce((a, p) => (p.x > a.x ? p : a), shoulderB[0] ?? { x: 0, y: 0 });
  const armhole = { shoulderCm: cmB(tip.y), underarmCm: cmB(sideB[0]?.y ?? 20) };

  const seams: RoundSeam[] = [];
  for (const s of [1, -1] as const) {
    seams.push({ kind: 'side', pts: [{ phi: s * HALF, cm: armhole.underarmCm }, { phi: s * HALF, cm: lengthAt(HALF) }] });
    seams.push({ kind: 'shoulder', pts: [{ phi: s * HALF, cm: topAt(HALF) }, { phi: s * HALF, cm: armhole.shoulderCm }] });
  }
  if (!B.fold && !B.meta.whole) seams.push({ kind: 'centre_back', pts: [{ phi: Math.PI, cm: topAt(Math.PI) }, { phi: Math.PI, cm: lengthAt(Math.PI) }] });
  if (!F.fold && !F.meta.whole) seams.push({ kind: 'centre_front', pts: [{ phi: 0, cm: topAt(0) }, { phi: 0, cm: lengthAt(0) }] });

  // Princess seams and darts, as sewn.
  const both = (raw: RoundPt[], kind: SeamKind) => {
    const pts = dedupe(raw);
    seams.push({ kind, pts }, { kind, pts: pts.map(mirror) });
  };
  const dartOn = (on: (p: P) => RoundPt, near: P, tipP: P, far: P): RoundDart => {
    const mid = { x: (near.x + far.x) / 2, y: (near.y + far.y) / 2 };
    return { base: on(mid), tip: on(tipP), lengthCm: Math.round(len(sub(tipP, mid)) * 10) / 10 };
  };
  let darts: RoundDart[] = [];
  const blockDarts = (pc: Piece, on: (p: P) => RoundPt) => dartsOf(pc).map(({ near, tip: tp, far }) => dartOn(on, near, tp, far));
  const skip = t.styleLines?.skip ?? 'none';
  if (skip !== 'all') {
    darts = [...blockDarts(F, onF), ...blockDarts(B, onB)];
    // A moved bust dart leaves the side seam.
    if (skip === 'side') darts = darts.filter((d) => !(d.base.phi > HALF * 0.85 && d.base.phi < HALF * 1.15));
  }
  if (t.styleLines) {
    for (const [lines, on] of [
      [t.styleLines.front, onF],
      [t.styleLines.back, onB],
    ] as const) {
      for (const ln of lines) {
        if (ln.kind === 'seam') both(ln.pts.map(on), 'princess');
        else if (ln.kind === 'dart' && ln.pts.length >= 2) {
          const [a, b, c] = ln.pts;
          darts.push(c ? dartOn(on, a, b, c) : dartOn(on, a, b, a));
        }
      }
    }
  } else {
    // Princess panels cut as pieces: the seam is the centre panel's princess edge.
    for (const [want, on] of [
      [/front/i, onF],
      [/back/i, onB],
    ] as const) {
      const centre = t.pieces.find((pc) => want.test(pc.name) && /centre/i.test(pc.name) && edge(pc, ['princess']).length);
      if (!centre) continue;
      both(
        [...edge(centre, ['princess'])].sort((a, b) => a.y - b.y).map(on),
        'princess',
      );
      darts = darts.filter((d) => (want.source === 'front' ? d.base.phi > HALF : d.base.phi < HALF));
    }
  }
  const mirrored = darts.flatMap((d) => [d, { ...d, base: mirror(d.base), tip: mirror(d.tip) }]);

  if (t.sleeve) for (const s of [1, -1] as const) seams.push({ kind: 'sleeve', pts: [], sleeve: s });

  const hipGirth = t.girth.hip;
  return {
    kind: 'top',
    topAt,
    lengthAt,
    seams,
    darts: mirrored,
    rings: [],
    zip: t.zipCm && t.zipCm > 0 ? { phi: Math.PI, fromCm: topAt(Math.PI), toCm: topAt(Math.PI) + t.zipCm } : undefined,
    bandCm: 0,
    flare: t.hemGirth && hipGirth ? t.hemGirth / hipGirth : 1,
    girth: t.girth,
    armhole,
    sleeve: t.sleeve ? { lengthCm: t.sleeve.lengthCm, bicepCm: t.sleeve.bicep, hemCm: t.sleeve.hemCm } : undefined,
    opening: opening.length ? { buttons: (t.buttons ?? []).map(cmF) } : undefined,
    vent: t.vent ? { fromCm: cmB(napeY + t.vent.top) } : undefined,
    elastic: false,
    seamsMeet: meets(t.pieces, t.finishedWaist),
    sideAngle: { front: sideToGrain(F), back: sideToGrain(B) },
    readings: readingsOf(lengthAt),
  };
}

interface Nape {
  nape_to_waist?: number;
  full_bust?: number;
  full_hip?: number;
}
const napeOf = (m: Nape, fallback: number) => m.nape_to_waist ?? fallback;

export function roundBodice(draft: BodiceDraft, m: Nape, sleeve?: SleeveDraft): RoundGarment {
  const [front, back] = draft.block ?? draft.pieces;
  const pieces = draft.pieces.filter(isShell);
  const hip = draft.drop > 0 && draft.finishedHem ? draft.finishedHem : undefined;
  return roundTop({
    front,
    back,
    pieces: [...pieces, ...(sleeve?.pieces ?? [])],
    napeToWaist: napeOf(m, draft.back.waistCentre.y - draft.back.neckCentre.y),
    sleeve,
    styleLines: draft.styleLines,
    buttons: draft.closure === 'front_buttons' ? draft.buttons?.at : undefined,
    zipCm: draft.closure === 'back_zip' ? draft.zipCm : undefined,
    girth: { bust: draft.finishedBust, waist: draft.finishedWaist, hip },
    finishedWaist: draft.finishedWaist,
  });
}

export function roundTee(draft: TeeDraft, m: Nape): RoundGarment {
  const front = draft.pieces.find((pc) => /front/i.test(pc.name)) ?? draft.pieces[0];
  const back = draft.pieces.find((pc) => /back/i.test(pc.name)) ?? draft.pieces[1];
  return roundTop({
    front,
    back,
    pieces: draft.pieces.filter((pc) => pc.kind !== 'band'),
    napeToWaist: napeOf(m, 41),
    sleeve: draft.sleeve,
    girth: { bust: draft.finishedBust, waist: draft.finishedWaist, hip: draft.finishedHem },
  });
}

export function roundOuter(draft: OuterDraft, m: Nape): RoundGarment {
  const [front, back] = draft.block;
  // The block is closed at the centre front: the shell's front carries the opening and the lapel.
  const shellFront = draft.pieces.find((pc) => !pc.kind && /front/i.test(pc.name) && edge(pc, ['opening']).length) ?? front;
  const shell = draft.pieces.filter(isShell);
  const sleeves = draft.pieces.filter((pc) => !pc.kind && /sleeve/i.test(pc.name));
  const hip = m.full_hip && m.full_bust ? Math.min(draft.finishedHem, m.full_hip + draft.finishedBust - m.full_bust) : undefined;
  const r = roundTop({
    front,
    back,
    openFront: shellFront,
    pieces: [...shell, ...sleeves],
    napeToWaist: napeOf(m, 41),
    sleeve: draft.sleeve,
    buttons: draft.buttons.at,
    vent: draft.vent,
    // Past the hip it keeps the bust's ease over the hip, then flares to its hem.
    girth: { bust: draft.finishedBust, waist: draft.finishedWaist, hip: hip ?? (draft.drop > 0 ? draft.finishedHem : undefined) },
    hemGirth: hip ? draft.finishedHem : undefined,
  });
  // The front opens from the break, where the lapel turns back, to the hem.
  const opening = edge(shellFront, ['opening']);
  const princess = shell.some((pc) => edge(pc, ['princess']).length);
  if (opening.length && !r.seams.some((s) => s.kind === 'centre_front')) {
    r.seams.push({ kind: 'centre_front', pts: [{ phi: 0, cm: r.topAt(0) }, { phi: 0, cm: r.lengthAt(0) }] });
  }
  if (princess && !r.seams.some((s) => s.kind === 'princess')) {
    const pr = roundTop({ front, back, pieces: shell, napeToWaist: napeOf(m, 41), girth: r.girth });
    r.seams.push(...pr.seams.filter((s) => s.kind === 'princess'));
  }
  if (!r.opening) r.opening = { buttons: [] };
  return r;
}

export function roundDress(draft: DressDraft, m: Nape, sleeve?: SleeveDraft): RoundGarment {
  const top = roundBodice(draft.bodice, m, sleeve);
  const plain = roundSkirt(draft.skirt);
  // A dropped waist: the skirt hangs from the seam at the high hip, so all its heights move down.
  const D = draft.seamDrop ?? 0;
  const down = (q: RoundPt): RoundPt => ({ ...q, cm: q.cm + D });
  const skirt = D
    ? {
        ...plain,
        lengthAt: (phi: number) => plain.lengthAt(phi) + D,
        seams: plain.seams.map((s) => ({ ...s, pts: s.pts.map(down) })),
        darts: plain.darts.map((d) => ({ ...d, base: down(d.base), tip: down(d.tip) })),
      }
    : plain;
  const waistAt = top.lengthAt;
  const seams: RoundSeam[] = top.seams.map((s) =>
    s.kind === 'side' || s.kind === 'centre_back' ? { ...s, pts: [s.pts[0], { phi: s.pts[0].phi, cm: skirt.lengthAt(s.pts[0].phi) }] } : s,
  );
  // A skirt seam the bodice doesn't have, such as a centre back seam under a bodice on the fold.
  for (const s of skirt.seams) if (!seams.some((t) => t.kind === s.kind && Math.abs(wrap(t.pts[0].phi - s.pts[0].phi)) < 0.01)) seams.push(s);
  const neck = top.topAt(Math.PI);
  const zip: RoundZip | undefined =
    draft.zipCm > 0
      ? draft.zipSide
        ? { phi: -HALF, fromCm: top.armhole?.underarmCm ?? -20, toCm: (top.armhole?.underarmCm ?? -20) + draft.zipCm }
        : { phi: Math.PI, fromCm: neck, toCm: neck + draft.zipCm }
      : undefined;
  return {
    ...top,
    kind: 'dress',
    lengthAt: skirt.lengthAt,
    seams,
    darts: [...top.darts, ...skirt.darts],
    rings: [waistAt],
    zip,
    flare: skirt.flare,
    girth: { bust: draft.finishedBust, waist: draft.finishedWaist, hip: draft.finishedHip },
    seamsMeet: top.seamsMeet && skirt.seamsMeet,
    sideAngle: skirt.sideAngle,
    readings: D ? readingsOf(skirt.lengthAt) : skirt.readings,
  };
}

interface TrouserM {
  crotch_depth?: number;
  waist_to_hip?: number;
}

export function roundTrousers(draft: TrousersDraft, m: TrouserM): RoundGarment {
  const crotchCm = m.crotch_depth ?? (m.waist_to_hip ?? 20) * 1.35;
  const L = draft.lengthCm;
  const lengthAt = () => L;
  const seams: RoundSeam[] = [
    { kind: 'crotch', pts: [{ phi: 0, cm: 0 }, { phi: 0, cm: crotchCm }] },
    { kind: 'crotch', pts: [{ phi: Math.PI, cm: 0 }, { phi: Math.PI, cm: crotchCm }] },
  ];
  for (const s of [1, -1] as const) {
    seams.push({ kind: 'side', pts: [{ phi: s * HALF, cm: 0 }, { phi: s * HALF, cm: crotchCm }] });
    seams.push({ kind: 'side', pts: [{ phi: s * HALF, cm: crotchCm }, { phi: s * HALF, cm: L }], leg: s, cont: true });
    seams.push({ kind: 'inseam', pts: [{ phi: -s * HALF, cm: crotchCm }, { phi: -s * HALF, cm: L }], leg: s });
  }
  // The darts, spaced across each half between the centre and the side, their lengths as drafted.
  const [front, back] = draft.block;
  const lengths = (pc: Piece) => dartsOf(pc).map(({ near, tip, far }) => len(sub(tip, { x: (near.x + far.x) / 2, y: (near.y + far.y) / 2 })));
  const darts: RoundDart[] = [];
  const place = (n: number, ls: number[], at: (i: number) => number) => {
    for (let i = 0; i < n; i++) {
      const lengthCm = Math.round((ls[i] ?? ls[0] ?? 9) * 10) / 10;
      for (const phi of [at(i), -at(i)]) darts.push({ base: { phi, cm: 0 }, tip: { phi, cm: lengthCm }, lengthCm });
    }
  };
  if (!draft.elastic) {
    place(draft.dartsPerSide.front, lengths(front), (i) => 0.55 + i * 0.25);
    place(draft.dartsPerSide.back, lengths(back), (i) => Math.PI - 0.6 - i * 0.28);
  }
  const zip: RoundZip | undefined =
    draft.closure === 'none' || !(draft.zipCm > 0) ? undefined : { phi: draft.closure === 'fly' ? 0 : HALF, fromCm: 0, toCm: draft.zipCm };
  return {
    kind: 'trousers',
    topAt: () => 0,
    lengthAt,
    seams,
    darts,
    rings: [],
    zip,
    bandCm: 3.5,
    flare: 1,
    girth: { waist: draft.finishedWaist, hip: draft.finishedHip },
    legs: { crotchCm, lengthCm: L, kneeCm: draft.kneeCm, hemCm: draft.hemCm },
    elastic: !!draft.elastic,
    seamsMeet: meets(draft.pieces.filter((pc) => !pc.kind), draft.finishedWaist),
    sideAngle: { front: sideToGrain(front), back: sideToGrain(back) },
    readings: readingsOf(lengthAt),
  };
}

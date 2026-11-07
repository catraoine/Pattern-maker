// The jumpsuit (Garment range, Cat 2026-11-07): the top and the trousers joined at a waist seam, as the dress joins
// the top and the skirt. Five starting Looks on the option sheet: J1 boiler, J2 cami wide leg, J3 halter flare,
// J4 tailored V, J5 playsuit. In testing until testers sew it.
//
// - The top is the bodice block cut to the waist, any neckline, collar and sleeve it takes.
// - The legs are the trouser block with no waistband, each half's waist drafted to the bodice's (TrousersStyle
//   joinTo), walked until the seams meet edge for edge, so the side seams and darts line up.
// - A jumpsuit has to let you sit and bend: the crotch is cut lower and the crotch seam longer than trousers' alone
//   (BODY_RISE), the one change a one-piece needs over two.
// - It zips down the centre back, on past the waist into the back seam so it steps in over the hips; a buttoned
//   top (a boiler suit) opens with a fly below the waist instead.
import { p, taggedLength } from './geometry';
import type { Piece } from './piece';
import { BodiceDraft, BodiceMeasurements, BodiceStyle, draftBodice } from './bodice';
import { draftSleeve, SleeveDraft } from './sleeve';
import type { SleeveMeasurements, SleeveStyle } from './sleeve';
import { TrousersDraft, TrousersMeasurements, TrousersStyle, draftTrousers, pointAlong, trouserLength } from './trousers';

export type JumpsuitMeasurements = BodiceMeasurements & TrousersMeasurements & SleeveMeasurements;

/** The extra a one-piece needs to sit in: the crotch this much lower, the crotch seam this much longer, in cm. */
export const BODY_RISE = { depth: 2, crotch: 4 };
/** How far below the waist a back zip runs, so the jumpsuit steps in over the hips. */
export const ZIP_BELOW_WAIST = 20;

export interface JumpsuitStyle {
  top: Partial<BodiceStyle>;
  /** Long sleeves and the like: the sleeve drafted to the top's armhole. None when missing. */
  sleeve?: Pick<SleeveStyle, 'length' | 'shape'>;
  legs: Partial<Omit<TrousersStyle, 'joinTo' | 'closure' | 'waist' | 'loops' | 'riseCm'>>;
}

export interface JumpsuitDraft {
  pieces: Piece[];
  bodice: BodiceDraft;
  sleeve?: SleeveDraft;
  trousers: TrousersDraft;
  /** Back zip from the neck, or a fly below a buttoned front. */
  closure: 'back_zip' | 'front_buttons';
  zipCm: number;
  /** How far the bodice and leg waists still differ after the walk, front and back, cm (eased in). */
  waistDiff: { front: number; back: number };
  warnings: string[];
}

const r1 = (v: number) => Math.round(v * 10) / 10;

export function draftJumpsuit(m: JumpsuitMeasurements, style: JumpsuitStyle): JumpsuitDraft {
  const buttoned = style.top.closure === 'front_buttons';
  const top: Partial<BodiceStyle> = { ...style.top, length: 'waist', dropCm: undefined, hem: undefined, peplum: 'none', closure: buttoned ? 'front_buttons' : 'back_zip', sleeve: style.sleeve?.length ?? 'none' };
  const bodice = draftBodice(m, top);
  const sleeve = style.sleeve ? draftSleeve(bodice, m, { ...style.sleeve, fit: top.fit ?? 'regular', seamAllowance: 1.5, armholeAllowance: 1.5, hemAllowance: 2.5 }) : undefined;
  const side = (which: 'front' | 'back') => bodice.pieces.filter((pc) => !pc.kind && new RegExp(which, 'i').test(pc.name));
  const waistOf = (pcs: Piece[]) => pcs.reduce((t, pc) => t + taggedLength(pc.outline, 'waist') / (pc.meta.whole ? 2 : 1), 0);
  const want = { front: waistOf(side('front')), back: waistOf(side('back')) };
  const body: TrousersMeasurements = { ...m, crotch_depth: m.crotch_depth + BODY_RISE.depth, crotch_length: m.crotch_length + BODY_RISE.crotch };
  // Shorts are measured from the crotch: pinned to where they'd land on the body, so the lower crotch doesn't lengthen them.
  const shortsCm = style.legs.length === 'shorts' && style.legs.leg !== 'culotte' && style.legs.lengthCm === undefined ? trouserLength(m, { leg: style.legs.leg ?? 'straight', length: 'shorts' }) : style.legs.lengthCm;
  const legsOf = (j: { front: number; back: number }) => draftTrousers(body, { ...style.legs, lengthCm: shortsCm, closure: buttoned ? 'fly' : 'side_zip', joinTo: j, loops: 'none', pleats: style.legs.pleats });
  const join = { ...want };
  let legs = legsOf(join);
  const legWaist = (d: TrousersDraft, i: 0 | 1) => taggedLength(d.pieces[i].outline, 'waist');
  for (let i = 0; i < 5; i++) {
    const df = want.front - legWaist(legs, 0);
    const db = want.back - legWaist(legs, 1);
    if (Math.abs(df) < 0.05 && Math.abs(db) < 0.05) break;
    join.front += df;
    join.back += db;
    legs = legsOf(join);
  }
  const waistDiff = { front: r1(want.front - legWaist(legs, 0)), back: r1(want.back - legWaist(legs, 1)) };
  // The legs' pieces less the waistband (the bodice is sewn on in its place); the leg halves get their names.
  const legPieces = legs.pieces
    .filter((pc) => pc.kind !== 'waistband')
    .map((pc) => (/^Trousers? /.test(pc.name) && !pc.kind ? { ...pc, name: pc.name.replace(/^Trousers? /, 'Leg ') } : pc));
  // The zip runs on through the waist into the back seam: the bodice loses its zip-end mark, the legs' back gets one.
  let zipCm = 0;
  if (!buttoned) {
    // The zip's end on the back's crotch seam, measured down it from the waist (the seam runs either way round).
    const back = legPieces[1];
    const run = taggedLength(back.outline, 'crotch');
    const [a, b] = [pointAlong(back.outline, 'crotch', 0.01), pointAlong(back.outline, 'crotch', run - 0.01)];
    const fromWaist = !!a && !!b && a.q.y < b.q.y;
    const at = pointAlong(back.outline, 'crotch', fromWaist ? ZIP_BELOW_WAIST : run - ZIP_BELOW_WAIST);
    if (at) {
      const inward = p(-at.dir.y, at.dir.x);
      back.notches = [...back.notches, [at.q, inward]];
      const xs = back.outline.points().map((q) => q.x);
      const toMiddle = Math.sign((Math.min(...xs) + Math.max(...xs)) / 2 - at.q.x) || 1;
      back.labels = [...back.labels, { at: p(at.q.x + toMiddle * 2.5, at.q.y + 0.3), text: 'ZIP ENDS', size: 0.7 }];
    }
    zipCm = r1(bodice.backLength + ZIP_BELOW_WAIST);
  } else zipCm = legs.zipCm;
  const unzip = (pc: Piece): Piece => (/back/i.test(pc.name) && !buttoned ? { ...pc, labels: pc.labels.filter((l) => l.text !== 'ZIP ENDS'), notches: pc.notches.filter(([q, d]) => !(Math.abs(q.x) < 1e-6 && d.x < 0)) } : pc);
  return {
    pieces: [...bodice.pieces.map(unzip), ...(sleeve?.pieces ?? []), ...legPieces],
    bodice,
    sleeve,
    trousers: legs,
    closure: buttoned ? 'front_buttons' : 'back_zip',
    zipCm,
    waistDiff,
    warnings: [...bodice.warnings, ...(sleeve?.warnings ?? [])],
  };
}

// Measurement tables for the tech pack: each body measurement the draft used, the ease added and the
// finished garment measurement.
import type { Elastic, SkirtDraft, SkirtMeasurements } from './skirt';
import type { OuterDraft, OuterMeasurements } from './outerwear';
import type { BodiceDraft, BodiceLength, BodiceMeasurements } from './bodice';
import type { SpecRow } from './techpack';
import type { SleeveDraft, SleeveMeasurements } from './sleeve';
import type { DressDraft, DressMeasurements } from './dress';
import { TROUSER_EASE, type TrousersDraft, type TrousersMeasurements } from './trousers';
import { volumeSpec } from './skirtVolume';
import { drapeSpec, zipSide } from './drape';
import { SLIP_FACING } from './slip';
import { STRETCH_WORDS } from './knits';
import type { TeeDraft, TeeMeasurements } from './tee';
import type { LingerieDraft, LingerieMeasurements } from './lingerie';
import { INSEAM, SLANT } from './pockets';

const r1 = (v: number) => Math.round(v * 10) / 10;
const row = (label: string, body: number | undefined, finished: number): SpecRow =>
  body === undefined ? { label, finished: r1(finished) } : { label, body: r1(body), ease: r1(finished - body), finished: r1(finished) };

export function skirtSpec(m: SkirtMeasurements, d: SkirtDraft): SpecRow[] {
  return [
    row('Waist', m.waist, d.finishedWaist),
    row('Hip', m.full_hip, d.finishedHip),
    { label: 'Waist to hip', body: r1(m.waist_to_hip), finished: '' },
    // Posture, when measured: the centre waist is raised or lowered to match.
    ...(m.front_waist_to_hip !== undefined ? [{ label: 'Waist to hip, centre front', body: r1(m.front_waist_to_hip), finished: '' }] : []),
    ...(m.back_waist_to_hip !== undefined ? [{ label: 'Waist to hip, centre back', body: r1(m.back_waist_to_hip), finished: '' }] : []),
    row('Length, waist to hem', undefined, d.lengthCm),
    row('Hem circumference', undefined, d.hemCm),
    ...(d.asym ? [{ label: `Hem ${d.asym.kind === 'diagonal' ? 'left to right' : 'front to back'}, shortest to longest`, finished: `${r1(d.lengthCm + d.asym.shift - d.asym.amp)} to ${r1(d.lengthCm + d.asym.shift + d.asym.amp)}` }] : []),
    // Pleats, godets, a flounce or tiers: how they are made.
    ...volumeSpec(d),
    ...(d.pocket ? [row('In-seam pocket opening', undefined, d.pocket[1] - d.pocket[0])] : []),
    ...(d.faced
      ? [
          { label: `Waist facing, ${SLIP_FACING} deep`, finished: 'cut 1 front, 1 back' },
          { label: 'Invisible zip, left side seam', finished: `${d.zipCm}` },
        ]
      : waistRows(d, d.opening === 'left_side' ? 'Invisible zip, left side seam' : 'Invisible zip, centre back')),
  ];
}

/** A wrap's two ties, finished and cut. */
function tieRows(t: { outer: number; inner: number; cutWidth: number; cut: { outer: number; inner: number } }): SpecRow[] {
  return [
    { label: 'Wrap ties, finished (long / short)', finished: `${t.outer} / ${t.inner}` },
    { label: 'Wrap ties, cut on the grain', finished: `${t.cut.outer} and ${t.cut.inner} x ${t.cutWidth}` },
  ];
}

/** The waistband, and the zip or the elastic that closes it, or the ties of a wrap. */
function waistRows(d: { waistband: { cutLength: number; cutWidth: number }; elastic?: Elastic; zipCm: number; wrap?: SkirtDraft['wrap'] }, zip = 'Invisible zip, centre back'): SpecRow[] {
  if (d.wrap?.ties) return [{ label: 'Waistband (finished width 3), ties sewn into its ends', finished: `cut ${d.waistband.cutLength} x ${d.waistband.cutWidth}` }, ...tieRows(d.wrap.ties)];
  return d.elastic
    ? [
        { label: 'Waistband, elastic casing (finished width 3)', finished: `cut ${d.waistband.cutLength} x ${d.waistband.cutWidth}` },
        { label: `Elastic, ${d.elastic.widthCm} cm wide`, finished: `cut ${d.elastic.cutCm} (${d.elastic.finishedCm} joined)` },
      ]
    : [
        { label: 'Waistband (finished width 3)', finished: `cut ${d.waistband.cutLength} x ${d.waistband.cutWidth}` },
        { label: zip, finished: `${d.zipCm}` },
      ];
}

export function bodiceSpec(m: BodiceMeasurements, d: BodiceDraft, length: BodiceLength, dropCm?: number): SpecRow[] {
  const rows: SpecRow[] = [row('Bust', m.full_bust, d.finishedBust), row('Waist', m.waist, d.finishedWaist)];
  if (d.finishedHem !== undefined && dropCm !== undefined) {
    rows.push(row(`Hem, ${d.drop} cm below the waist`, undefined, d.finishedHem));
  } else if (d.finishedHem !== undefined) {
    const body = length === 'hip' ? m.full_hip : (m.high_hip ?? m.full_hip);
    rows.push(row(length === 'hip' ? 'Hip (hem)' : 'High hip (hem)', body, d.finishedHem));
  }
  const t = d.top;
  if (t) {
    // A top cut below the shoulders: no armhole or shoulder seam, but a top edge, its bones and straps.
    rows.push(
      row('Centre back, top edge to waist', undefined, d.backLength),
      row('Top edge, round', undefined, t.topEdge),
      ...(t.grip ? [row('Top edge, taken in to grip', undefined, t.grip)] : []),
      ...t.bones.map((b) => ({ label: `Bone, ${b.where.toLowerCase()} (${b.count})`, finished: r1(b.lengthCm) })),
      ...(t.waistStay ? [{ label: `Waist stay, ${t.waistStay.widthCm} grosgrain`, finished: r1(t.waistStay.lengthCm) }] : []),
      ...(t.straps ? [row('Strap, finished (each)', undefined, t.straps.lengthCm), { label: 'Strap, cut on the bias', finished: `${t.straps.cutLengthCm} x ${t.straps.cutWidthCm}` }] : []),
      ...(t.ties ? [row('Neck tie, finished (each)', undefined, t.ties.lengthCm), { label: 'Neck tie, cut on the grain', finished: `${t.ties.cutLengthCm} x ${t.ties.cutWidthCm}` }] : []),
      { label: 'Invisible zip, centre back', finished: `${d.zipCm}` },
    );
    return rows;
  }
  rows.push(
    { label: 'Nape to waist', body: r1(m.nape_to_waist), finished: '' },
    row('Centre back length', undefined, d.backLength),
    row('Armhole', m.armscye, d.armhole),
    row('Shoulder seam (back)', m.shoulder_length, d.shoulder.back),
    { label: 'Shoulder angle, front / back', finished: `${d.shoulderSlope.front} / ${d.shoulderSlope.back} degrees` },
    ...drapeSpec(d),
    ...(d.wrap ? tieRows(d.wrap.ties) : [{ label: d.drape?.kind === 'one_shoulder' ? `Invisible zip, ${zipSide(d)} side` : 'Invisible zip, centre back', finished: `${d.zipCm}` }]),
  );
  return rows;
}

/** The sleeve's rows, added under the bodice's. */
export function sleeveSpec(m: SleeveMeasurements, s: SleeveDraft): SpecRow[] {
  return [
    row('Upper arm (bicep)', m.upper_arm, s.bicep),
    row('Sleeve length, crown to hem', undefined, s.lengthCm),
    row(s.gathers ? 'Sleeve band, round' : 'Sleeve hem, round', undefined, s.hemCm),
    row('Crown height', undefined, s.capHeight),
    { label: 'Crown ease, front / back', finished: s.gathers?.crown !== undefined ? `${s.gathers.crown} gathered` : `${s.crownEase.front} / ${s.crownEase.back}` },
    ...(s.elbowDart ? [row('Elbow dart', undefined, s.elbowDart)] : []),
  ];
}

/** The dress: the bodice's rows, then the skirt's below the waist seam, and the one long zip. */
export function dressSpec(m: DressMeasurements, d: DressDraft, sleeve?: SleeveDraft): SpecRow[] {
  const zip = /zip/i;
  return [
    ...bodiceSpec(m, d.bodice, 'waist').filter((r) => !zip.test(r.label)),
    ...skirtSpec(m, d.skirt).filter((r) => r.label !== 'Waist' && !zip.test(r.label) && !/Waistband/.test(r.label)),
    row('Length, nape to hem', undefined, d.lengthCm),
    ...(sleeve ? sleeveSpec(m, sleeve) : []),
    ...(d.bodice.wrap ? [] : [{ label: d.zipSide ? `Invisible zip, ${zipSide(d.bodice)} side` : 'Invisible zip, centre back', finished: `${d.zipCm}` }]),
  ];
}

/** Trousers: waist and hip, the crotch as measured and as drafted, and the leg. */
export function trousersSpec(m: TrousersMeasurements, d: TrousersDraft): SpecRow[] {
  return [
    row('Waist', m.waist, d.finishedWaist),
    row('Hip', m.full_hip, d.finishedHip),
    { label: 'Waist to hip', body: r1(m.waist_to_hip), finished: '' },
    row('Crotch depth', m.crotch_depth, m.crotch_depth + TROUSER_EASE[d.fit].depth),
    row('Crotch length', m.crotch_length, d.crotch.front + d.crotch.back),
    { label: 'Crotch curve, front / back', finished: `${d.crotch.front} / ${d.crotch.back}` },
    row('Outside leg, waist to hem', undefined, d.lengthCm),
    row('Knee, round', undefined, d.kneeCm),
    row('Hem, round', undefined, d.hemCm),
    ...(d.pockets !== 'none' ? [{ label: d.pockets === 'slant' ? 'Slant pockets' : d.pocketSides === 'right' ? 'In-seam pocket, right side' : 'In-seam pockets', finished: d.pockets === 'slant' ? `opening ${SLANT.in} in, ${SLANT.down} down` : `opening ${INSEAM.opening}` }] : []),
    ...waistRows(d, d.closure === 'fly' ? 'Trouser zip, fly front' : 'Invisible zip, left side'),
  ];
}

/** The T-shirt: bust, waist and hem against the body (negative ease is the knit stretching on), the
 * neckline and its band, and the sleeve. */
export function teeSpec(m: TeeMeasurements, d: TeeDraft): SpecRow[] {
  const hemBody = d.length === 'cropped' ? m.waist : m.full_hip;
  return [
    { label: 'Knit stretch', finished: STRETCH_WORDS[d.stretch] },
    row('Bust', m.full_bust, d.finishedBust),
    row('Waist', m.waist, d.finishedWaist),
    row(d.length === 'cropped' ? 'Hem (at the waist)' : d.length === 'hip' ? 'Hip (hem)' : 'Hem, below the hip', hemBody, d.finishedHem),
    { label: 'Nape to waist', body: r1(m.nape_to_waist), finished: '' },
    row('Centre back length', undefined, d.backLength),
    row('Armhole', m.armscye, d.armhole),
    row('Neckline, round', undefined, d.necklineCm),
    { label: `Neckband (${Math.round(d.neckband.ratio * 100)}% of the neckline)`, finished: `${d.neckband.length} x ${d.neckband.width} finished` },
    row('Upper arm (bicep)', m.upper_arm, d.sleeve.bicep),
    row('Sleeve length, crown to hem', undefined, d.sleeve.lengthCm),
    row('Sleeve hem, round', undefined, d.sleeve.hemCm),
  ];
}

/** Soft lingerie and swimwear: cut smaller than the body, with the elastic for every edge. */
export function lingerieSpec(m: LingerieMeasurements, d: LingerieDraft): SpecRow[] {
  return [
    { label: 'Knit stretch', finished: d.style.stretch === 'high' ? 'high stretch (50% or more)' : 'medium stretch (30 to 50%)' },
    ...(d.finishedBust !== undefined ? [row('Bust', m.full_bust, d.finishedBust)] : []),
    ...(d.finishedBand !== undefined ? [row('Underbust (band)', m.underbust, d.finishedBand)] : []),
    ...(d.finishedWaist !== undefined ? [row('Waist edge', m.waist, d.finishedWaist)] : []),
    ...(d.style.piece !== 'bralette' ? [row('Hip', m.full_hip, d.finishedHip)] : []),
    ...(m.crotch_length !== undefined && d.style.piece !== 'bralette' ? [{ label: 'Crotch length', body: r1(m.crotch_length), finished: '' }] : []),
    { label: 'Length reduction for stretch', finished: `${Math.round(d.lengthReduction * 100)}%` },
    ...(m.torso_loop !== undefined && (d.style.piece === 'bodysuit' || d.style.piece === 'swimsuit') ? [{ label: 'Torso loop', body: r1(m.torso_loop), finished: '' }] : []),
    ...d.elastic.map((e) => ({ label: `Elastic, ${e.edge.toLowerCase()}${e.count > 1 ? ` (cut ${e.count})` : ''}`, finished: `${r1(e.length)} x ${e.width}` })),
  ];
}

/** A jacket or a coat: the block's girths with outerwear ease, the length, the sleeve and the buttons. */
export function outerSpec(m: OuterMeasurements, d: OuterDraft): SpecRow[] {
  return [
    row('Bust', m.full_bust, d.finishedBust),
    row('Waist', m.waist, d.finishedWaist),
    row(`Hem, ${d.drop} cm below the waist`, undefined, d.finishedHem),
    { label: 'Nape to waist', body: r1(m.nape_to_waist), finished: '' },
    row('Centre back length', undefined, d.lengthCm),
    row('Armhole', m.armscye, d.base.armhole),
    row('Shoulder seam (back)', m.shoulder_length, d.base.shoulder.back),
    ...sleeveSpec(m, d.sleeve),
    { label: `Buttons, ${d.buttons.columns.length > 1 ? 'double-breasted' : 'single-breasted'}`, finished: `${d.buttons.at.length * d.buttons.columns.length} x ${d.buttons.sizeCm}` },
    row('Extension beyond the centre front', undefined, d.ext),
    ...(d.pads ? [row('Shoulder pad, drafted in', undefined, d.pads)] : []),
    ...(d.vent ? [row('Centre back vent', undefined, d.vent.length)] : []),
  ];
}

// Measurement tables for the tech pack: each body measurement the draft used, the ease added and the
// finished garment measurement.
import type { Elastic, SkirtDraft, SkirtMeasurements } from './skirt';
import type { BodiceDraft, BodiceLength, BodiceMeasurements } from './bodice';
import type { SpecRow } from './techpack';
import type { SleeveDraft, SleeveMeasurements } from './sleeve';
import type { DressDraft, DressMeasurements } from './dress';
import { TROUSER_EASE, type TrousersDraft, type TrousersMeasurements } from './trousers';
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
    ...(d.pocket ? [row('In-seam pocket opening', undefined, d.pocket[1] - d.pocket[0])] : []),
    ...waistRows(d),
  ];
}

/** The waistband, and the zip or the elastic that closes it. */
function waistRows(d: { waistband: { cutLength: number; cutWidth: number }; elastic?: Elastic; zipCm: number }, zip = 'Invisible zip, centre back'): SpecRow[] {
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
  rows.push(
    { label: 'Nape to waist', body: r1(m.nape_to_waist), finished: '' },
    row('Centre back length', undefined, d.backLength),
    row('Armhole', m.armscye, d.armhole),
    row('Shoulder seam (back)', m.shoulder_length, d.shoulder.back),
    { label: 'Shoulder angle, front / back', finished: `${d.shoulderSlope.front} / ${d.shoulderSlope.back} degrees` },
    { label: 'Invisible zip, centre back', finished: `${d.zipCm}` },
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
    { label: 'Invisible zip, centre back', finished: `${d.zipCm}` },
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

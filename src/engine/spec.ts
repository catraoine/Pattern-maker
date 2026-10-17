// Measurement tables for the tech pack: each body measurement the draft used, the ease added and the
// finished garment measurement.
import type { SkirtDraft, SkirtMeasurements } from './skirt';
import type { BodiceDraft, BodiceLength, BodiceMeasurements } from './bodice';
import type { SpecRow } from './techpack';
import type { SleeveDraft, SleeveMeasurements } from './sleeve';
import type { DressDraft, DressMeasurements } from './dress';
import { TROUSER_EASE, type TrousersDraft, type TrousersMeasurements } from './trousers';
import { STRETCH_WORDS } from './knits';
import type { TeeDraft, TeeMeasurements } from './tee';

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
    { label: 'Waistband (finished width 3)', finished: `cut ${d.waistband.cutLength} x ${d.waistband.cutWidth}` },
    { label: 'Invisible zip, centre back', finished: `${d.zipCm}` },
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
    { label: 'Waistband (finished width 3)', finished: `cut ${d.waistband.cutLength} x ${d.waistband.cutWidth}` },
    { label: d.closure === 'fly' ? 'Trouser zip, fly front' : 'Invisible zip, left side', finished: `${d.zipCm}` },
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

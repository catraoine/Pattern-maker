// Measurement tables for the tech pack: each body measurement the draft used, the ease added and the
// finished garment measurement.
import type { SkirtDraft, SkirtMeasurements } from './skirt';
import type { BodiceDraft, BodiceLength, BodiceMeasurements } from './bodice';
import type { SpecRow } from './techpack';

const r1 = (v: number) => Math.round(v * 10) / 10;
const row = (label: string, body: number | undefined, finished: number): SpecRow =>
  body === undefined ? { label, finished: r1(finished) } : { label, body: r1(body), ease: r1(finished - body), finished: r1(finished) };

export function skirtSpec(m: SkirtMeasurements, d: SkirtDraft): SpecRow[] {
  return [
    row('Waist', m.waist, d.finishedWaist),
    row('Hip', m.full_hip, d.finishedHip),
    { label: 'Waist to hip', body: r1(m.waist_to_hip), finished: '' },
    row('Length, waist to hem', undefined, d.lengthCm),
    row('Hem circumference', undefined, d.hemCm),
    { label: 'Waistband (finished width 3)', finished: `cut ${d.waistband.cutLength} x ${d.waistband.cutWidth}` },
    { label: 'Invisible zip, centre back', finished: `${d.zipCm}` },
  ];
}

export function bodiceSpec(m: BodiceMeasurements, d: BodiceDraft, length: BodiceLength): SpecRow[] {
  const rows: SpecRow[] = [row('Bust', m.full_bust, d.finishedBust), row('Waist', m.waist, d.finishedWaist)];
  if (d.finishedHem !== undefined) {
    const body = length === 'hip' ? m.full_hip : (m.high_hip ?? m.full_hip);
    rows.push(row(length === 'hip' ? 'Hip (hem)' : 'High hip (hem)', body, d.finishedHem));
  }
  rows.push(
    { label: 'Nape to waist', body: r1(m.nape_to_waist), finished: '' },
    row('Centre back length', undefined, d.backLength),
    row('Armhole', m.armscye, d.armhole),
    row('Shoulder seam (back)', m.shoulder_length, d.shoulder.back),
    { label: 'Invisible zip, centre back', finished: `${d.zipCm}` },
  );
  return rows;
}

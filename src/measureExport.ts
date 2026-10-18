// A person's measurements as files for other pattern software: an individual measurements file for
// Seamly2D and Valentina (.vit), and a plain table (CSV) to type into CLO 3D, Browzwear or any CAD.
import { FIELDS, type MeasurementId, type MeasurementValues } from './measurements';
import type { Alteration } from './engine/fitting';

/** Our measurements by their Seamly2D/Valentina known names. Ones they have no name for are written
 * as custom measurements (a leading @), which both programs accept in an individual file. */
export const SEAMLY_NAMES: Partial<Record<MeasurementId, string>> = {
  waist: 'waist_circ',
  full_hip: 'hip_circ',
  waist_to_hip: 'waist_to_hip_side',
  front_waist_to_hip: 'waist_to_hip_f',
  back_waist_to_hip: 'waist_to_hip_b',
  waist_to_knee: 'leg_waist_side_to_knee',
  waist_to_floor: 'leg_waist_side_to_floor',
  crotch_depth: 'rise_length_side_sitting',
  crotch_length: 'crotch_length',
  full_bust: 'bust_circ',
  high_bust: 'highbust_circ',
  neck: 'neck_circ',
  shoulder_width: 'shoulder_tip_to_shoulder_tip_b',
  shoulder_length: 'shoulder_length',
  across_back: 'across_back_b',
  across_front: 'across_chest_f',
  nape_to_waist: 'neck_back_to_waist_b',
  front_hps_to_waist: 'neck_side_to_waist_bustpoint_f',
  bust_depth: 'bustpoint_to_neck_side',
  apex_separation: 'bustpoint_to_bustpoint',
  armscye: 'armscye_circ',
  arm_length: 'arm_shoulder_tip_to_wrist',
  upper_arm: 'arm_upper_circ',
  wrist: 'arm_wrist_circ',
};

/** Every measurement we ask for, once each, in the order the app asks them. */
function fields() {
  const seen = new Set<MeasurementId>();
  return Object.values(FIELDS)
    .flat()
    .filter((f) => !seen.has(f.id) && seen.add(f.id));
}

/** The measurements that have a value, in the app's order. */
function taken(values: MeasurementValues) {
  return fields().filter((f) => typeof values[f.id] === 'number' && Number.isFinite(values[f.id]));
}

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cm = (v: number) => String(Math.round(v * 10) / 10);

/** An individual measurements file (Valentina format 0.3.3, which Seamly2D and SeamlyMe open), in cm. */
export function toVit(values: MeasurementValues, name: string): string {
  const rows = taken(values).map((f) => {
    const known = SEAMLY_NAMES[f.id];
    const v = cm(values[f.id] as number);
    return known
      ? `        <m name="${known}" value="${v}"/>`
      : `        <m name="@${f.id}" value="${v}" full_name="${xml(f.label)}" description="${xml(f.tip)}"/>`;
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<vit>',
    '    <!--Measurements from Maison Trace.-->',
    '    <version>0.3.3</version>',
    '    <read-only>false</read-only>',
    `    <notes>${xml(`${name}, measured in Maison Tracé.`)}</notes>`,
    '    <unit>cm</unit>',
    '    <pm_system>998</pm_system>',
    '    <personal>',
    '        <family-name/>',
    `        <given-name>${xml(name)}</given-name>`,
    '        <birth-date>1800-01-01</birth-date>',
    '        <gender>unknown</gender>',
    '        <email/>',
    '    </personal>',
    '    <body-measurements>',
    ...rows,
    '    </body-measurements>',
    '</vit>',
    '',
  ].join('\n');
}

const csvCell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** A measurements table in cm and inches, with how each was taken, for CLO 3D's avatar editor or any CAD. */
export function toMeasurementsCsv(values: MeasurementValues): string {
  const rows = taken(values).map((f) => {
    const v = values[f.id] as number;
    return [f.label, cm(v), String(Math.round((v / 2.54) * 10) / 10), SEAMLY_NAMES[f.id] ?? '', f.tip].map(csvCell).join(',');
  });
  return ['Measurement,cm,in,Seamly2D name,How it was taken', ...rows, ''].join('\r\n');
}

/** The toile alterations as a table, for a pattern cutter to apply to their own block. */
export function toAlterationsCsv(alterations: Alteration[]): string {
  const rows = alterations.map((a) => [a.area, a.seen, a.change].map(csvCell).join(','));
  return ['Area,What the toile showed,Alteration', ...rows, ''].join('\r\n');
}

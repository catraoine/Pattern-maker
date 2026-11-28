// The tech pack's seam list: every seam on the garment with its type, allowance, finish and topstitching, so a
// dressmaker reads them in one table and does not have to dig them out of the steps. The first finished dress came back
// with its armholes felled the wrong way out (Nov 28): the seam type was only ever said inside a long step.
//
// The rows are read from the sewing steps themselves, so the table can never say something the steps do not.
import type { SewingGuide } from './instructions';

interface SeamRow {
  /** The step that sews it, numbered as in Construction. */
  seam: string;
  type: string;
  allowance: string;
  finish: string;
  topstitch: string;
}

// A step that joins garment pieces: it starts with a sewing word and names a seam or the pieces joined. Darts,
// facings, collars, linings, zips, trims and pockets are not seams of the shell.
const JOINS = /^(Sew|Join|Set|Close|Attach) .*(seam|shoulder|sleeves|sides?$|side panels|centre (front|back)|inside leg|crotch|yoke|godets|tiers|flounce|midriff|the top|the legs|the shorts|the skirt|the halves|waistband|peplum|bodice to|top to)/i;
const NOT_A_SEAM = /dart|facing|collar|lining|zip|French seams$|armhole seams$|underskirt|ruffle|band|button|cuff|pocket|Join the seams/i;

const OPEN = /press(ed)? (the|each|both|it|them)?[a-z' ]*open|seams? open/gi;
const TO_SIDE = /press (it|them|the seams?|both allowances|the allowances)[a-z' ]*(toward|up|down|to one side)/gi;
/** Where the last match starts, or -1: a step that sews two seams says the titled seam's own pressing last. */
const lastAt = (re: RegExp, t: string) => [...t.matchAll(re)].reduce((at, m) => m.index ?? at, -1);

/** The seam list for a garment's steps. */
export function seamSchedule(guide: SewingGuide): SeamRow[] {
  const steps = guide.steps;
  const neatened = steps.some((s) => /^Neaten/.test(s.title));
  const lined = steps.some((s) => /lining/i.test(s.title));
  const armholes = steps.find((s) => s.title === 'Finish the armhole seams');
  // Unlined, the Neaten step zigzags or overlocks each edge before the seams. A lining may cover only part of the
  // garment (a boned bodice over an unlined skirt), so the table does not say every edge is under it.
  const edges = neatened ? 'each edge zigzagged or overlocked' : lined ? 'edges covered where the garment is lined' : 'edges as the step says';
  const rows: SeamRow[] = [];
  steps.forEach((s, i) => {
    if (!JOINS.test(s.title) || NOT_A_SEAM.test(s.title)) return;
    const t = s.text;
    const from = [...t.matchAll(/(\d+(?:\.\d+)?) cm from the edge/g)].pop();
    const allowance = from ? `${from[1]} cm` : 'As the piece list';
    const seam = `${i + 1}. ${s.title}`;
    const open = lastAt(OPEN, t);
    const side = lastAt(TO_SIDE, t);
    if (/flat-felled/.test(t)) {
      const at = /(\d+(?:\.\d+)?) cm from the seam/.exec(t)?.[1] ?? '0.5';
      rows.push({ seam, type: 'Flat-felled, fold inside', allowance, finish: `Enclosed, about ${at} cm wide`, topstitch: `2 rows: beside the seam and ${at} cm from it` });
    } else if (/\bas (a )?French seams?\b/.test(t)) {
      // Only a step that sews one, not one that says why it cannot ("a French seam cannot go round a zip").
      // A French seam uses the whole allowance in two passes, so no single "from the edge" in its step is the allowance.
      rows.push({ seam, type: 'French', allowance: 'The whole allowance, in two passes', finish: 'Enclosed, about 0.6 cm wide', topstitch: 'None' });
    } else if (/^(Set|Sew) in the (raglan )?sleeves/.test(s.title)) {
      // A jacket's armhole has no finishing step of its own: its allowances turn into the sleeve and the lining covers them.
      const finish = !armholes
        ? lined
          ? 'Both allowances turned into the sleeve, under the lining'
          : 'Edges as the step says'
        : /bias strips/.test(armholes.text)
          ? 'Trimmed to 0.6 cm and bound in a bias strip of the cloth'
          : 'Trimmed under the arm, the two edges neatened together, turned toward the sleeve';
      rows.push({ seam, type: /stretch stitch|zigzag/.test(t) ? 'Stretch seam, sleeve set in' : 'Plain, sleeve set in', allowance, finish, topstitch: 'None' });
    } else {
      const top = /topstitch|edge-stitch/i.test(t) ? `Yes, as step ${i + 1} says` : 'None';
      const finish = open >= 0 && open > side ? `Pressed open, ${edges}` : side >= 0 ? 'Pressed to one side, as the step says' : 'As the step says';
      rows.push({ seam, type: /stretch stitch/.test(t) ? 'Stretch seam' : 'Plain', allowance, finish, topstitch: top });
    }
  });
  return rows;
}

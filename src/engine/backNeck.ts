// Back details on the bodice: a low scoop or V at the back, or a keyhole at the top of the centre back
// that closes with a button and a rouleau loop, the zip starting below it. A low back is stayed with
// tape so it hugs the back instead of gaping. Plain ASCII punctuation (see instructions.ts).
import { isTop } from './corset';
import type { SewingGuide, SewStep } from './instructions';

export type BackNeck = 'plain' | 'scoop' | 'v' | 'keyhole';
export const BACK_NECKS: [BackNeck, string][] = [
  ['plain', 'Plain'],
  ['scoop', 'Scoop back'],
  ['v', 'V back'],
  ['keyhole', 'Keyhole'],
];

/** A keyhole 9 cm long and 2.5 cm wide each side, its edge bound (0.6 cm allowance), closed at the
 * top by a 1 cm button and a loop cut 4 cm long. */
export const KEYHOLE = { length: 9, width: 2.5, allowance: 0.6, button: 1, loop: 4 };

/** How low a scoop or V back goes below the nape, from the back length: about a third of it for a
 * scoop, nearly half for a V, always leaving room for the shortest zip (20 cm) and 2 cm below it. */
export const backDepthFor = (b: 'scoop' | 'v', backLength: number) =>
  Math.round(Math.max(0, Math.min(b === 'scoop' ? Math.min(16, backLength * 0.38) : Math.min(21, backLength * 0.5), backLength - 22)) * 10) / 10;

interface BackStyle {
  back?: BackNeck;
  neckline: string;
  neck?: unknown;
  unevenNeck?: unknown;
  closure?: string;
  collar?: string;
  yoke?: { back?: number };
}

/** Why a back detail can't go with the rest, or undefined when it can. A top cut below the shoulders and
 * a draped neckline have their own backs; a collar sits on the back neck; a back yoke takes the space a
 * low back would cut away; and a keyhole opens above the back zip. */
export function backBlocked(s: BackStyle, b: BackNeck): string | undefined {
  if (b === 'plain') return undefined;
  if (isTop(s.neckline) || s.neckline === 'one_shoulder' || s.neckline === 'cowl') return 'A strapless, cami, halter, one-shoulder or cowl top has its own back.';
  if (s.collar && s.collar !== 'none') return 'A collar goes round the back neck, so the back stays high.';
  if (b === 'keyhole') return (s.closure ?? 'back_zip') === 'back_zip' ? undefined : 'A keyhole opens above the back zip, so it needs the back zip.';
  if (s.yoke?.back !== undefined) return 'A back yoke sits where a low back would be cut away.';
  return undefined;
}

/** The back detail as drafted: plain where it can't be had. */
export const backNeckOf = (s: BackStyle): BackNeck => (s.back && !backBlocked(s, s.back) ? s.back : 'plain');

/** The guide with the back detail's steps: staying a low back, or binding the keyhole and closing it. */
export function withBackNeck(g: SewingGuide, back: BackNeck | undefined): SewingGuide {
  if (!back || back === 'plain') return g;
  // Idempotent: a dress's guide is built round its bodice's, which already has some of these steps.
  const steps = [...g.steps];
  const at = (re: RegExp) => steps.findIndex((s) => re.test(s.title));
  if (back === 'scoop' || back === 'v') {
    if (at(/^Stay the back neckline$/) >= 0) return g;
    const cut = at(/^Cut out$/);
    steps.splice(cut + 1, 0, {
      title: 'Stay the back neckline',
      text: `A low back stretches as you handle it and then gapes. As soon as the backs are cut, stay-stitch the back neckline 1 cm in, from the centre back to the shoulder. Cut two strips of narrow stay tape (or the selvedge of a lightweight cotton) each 0.5 cm shorter than the back neckline, and pin one along each back neck seam line, easing the fabric in to fit. Stitch it on along the seam line, so the finished back lies close against your shoulder blades.`,
    });
    return { ...g, steps };
  }
  // A keyhole: bound before the neck is finished, the loop basted in at the top, the zip starting below it.
  const zip = at(/^Put in the zip$/);
  if (zip >= 0) steps[zip] = { ...steps[zip], text: steps[zip].text.replace(/with the top of the teeth [^ ]+ cm below the neck edge/, 'with the top of the teeth at the foot of the keyhole') };
  const keyhole: SewStep = {
    title: 'Bind the keyhole',
    text: `Cut a bias strip 3 cm wide and 25 cm long. Fold it in half lengthways and sew it to the right side of the keyhole, raw edges together, ${KEYHOLE.allowance} cm from the edge, from the neck edge of one back down round the foot and up to the other, clipping the curve. Turn it to the inside and stitch it down close to its fold. Make a rouleau loop: fold a second bias strip, 2.5 cm wide, in half, sew 0.4 cm from the fold, and turn it through with a loop turner. Cut ${KEYHOLE.loop} cm of it, fold it in half and baste its ends at the top of the right back neck edge (as you wear it), the loop pointing in, so it is caught when the neck is finished.`,
  };
  const neck = at(/^(Bind|Face|Line) the neck(line)?$|^Line the neck and armholes$/);
  if (at(/^Bind the keyhole$/) < 0) steps.splice(neck >= 0 ? neck : at(/^Hem$/) >= 0 ? at(/^Hem$/) : steps.length, 0, keyhole);
  const fin = at(/^Finish$/);
  if (at(/^Sew on the keyhole button$/) < 0)
    steps.splice(fin >= 0 ? fin : steps.length, 0, {
      title: 'Sew on the keyhole button',
      text: `Sew a ${KEYHOLE.button} cm button at the top of the left back neck edge, opposite the loop, so the loop slips over it and closes the keyhole.`,
    });
  const button = `1 small button, ${KEYHOLE.button} cm, for the keyhole`;
  const notions = g.notions.includes(button) ? g.notions : [...g.notions.slice(0, -1), button, ...g.notions.slice(-1)];
  return { ...g, notions, steps };
}

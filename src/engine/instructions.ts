// Plain-language sewing steps for the drafted skirt, shown in the app and added to the end of the PDF.
// Keep to plain ASCII punctuation: the PDF uses a standard font without curly quotes.
import type { Length, Silhouette, SkirtDraft } from './skirt';

// Widest strip that fits across 140 cm fabric, leaving room for the selvedges.
export const BAND_ACROSS_MAX = 135;

export interface SewStep {
  title: string;
  text: string;
}

export interface SewingGuide {
  notions: string[];
  steps: SewStep[];
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function sewingGuide(draft: SkirtDraft, style: { silhouette: Silhouette; length: Length }, fabricM: number): SewingGuide {
  const { front, back } = draft.dartsPerSide;
  const band = draft.waistband;
  const dartCount = 2 * front + 2 * back;
  const slit = style.silhouette === 'pencil' || (style.silhouette === 'straight' && (style.length === 'midi' || style.length === 'maxi'));

  const steps: SewStep[] = [
    {
      title: 'Print and check the size',
      text: 'Print the pattern at 100% (actual size). Measure the test square: it should be exactly 10 cm. Trim each page along the dashed line, then tape the pages together, matching the row letters and column numbers.',
    },
    {
      title: 'Cut out',
      text: 'Fold the fabric in half with the selvedges together. Place the skirt front on the fold, and the skirt back on both layers so you get a pair. Keep each grain arrow parallel to the selvedge. Cut along the solid outer line, snip the small notches, and chalk-mark the dart lines.',
    },
    {
      title: 'Cut the waistband',
      text: `The waistband is a plain strip, so it isn't printed. On a single layer of fabric, mark a strip ${band.cutLength} cm long and ${band.cutWidth} cm wide, ${band.cutLength <= BAND_ACROSS_MAX ? 'running across the width of the fabric' : 'running along the length of the fabric'}, and cut it out. Snip a small notch at the middle of both long edges (centre front) and ${band.sideMark} cm in from each end (the side seams). Snip a notch at each end of the line halfway across the width: this is the fold line.`,
    },
    {
      title: 'Interface the waistband',
      text: 'Fuse lightweight interfacing to the wrong side of the waistband, on one half of its width (from one long edge to the fold line). This half will be the outside.',
    },
    {
      title: 'Neaten the edges',
      text: 'Zigzag or overlock the side and centre back edges of the skirt pieces, so they will not fray inside.',
    },
    {
      title: `Sew the ${plural(dartCount, 'dart', 'darts')}`,
      text: 'Fold each dart with right sides together so the two dart lines meet. Stitch from the waist to the point, running off the fold, and knot the threads. Press front darts toward the centre front and back darts toward the centre back.',
    },
    {
      title: 'Put in the zip',
      text: `Sew a ${draft.zipCm} cm invisible zip into the centre back edges, with the top of the teeth 1.5 cm below the waist edge, stopping at the ZIP ENDS notch.`,
    },
    {
      title: 'Close the centre back',
      text: `Sew the rest of the centre back seam, from the bottom of the zip to the hem, 1.5 cm from the edge.${slit ? ' Leave the bottom 15 cm open as a walking slit.' : ''} Press the seam open.`,
    },
    {
      title: 'Sew the side seams',
      text: 'Pin the front to the back at the sides, right sides together, matching the hip notches. Sew 1.5 cm from the edge and press the seams open. Try the skirt on now: this is the easiest moment to take it in or let it out at the sides.',
    },
    {
      title: 'Attach the waistband',
      text: 'Pin the interfaced long edge of the waistband to the skirt waist, right sides together. Match the centre front notch to the centre front, the side notches to the side seams, and let each end extend 1.5 cm past the zip. Sew 1.5 cm from the edge and press the seam up into the band.',
    },
    {
      title: 'Finish the waistband',
      text: 'Fold the band along its fold line, right sides together, and sew across each end 1.5 cm in. Trim the corners and turn it right side out. Press under 1.5 cm on the loose edge, then hand-stitch it over the seam inside, or stitch in the ditch from the outside.',
    },
    {
      title: 'Hem',
      text:
        style.silhouette === 'a_line'
          ? 'Press up 1 cm, then 3 cm more. The hem is curved, so ease in the extra fullness with steam as you press. Stitch by hand or machine.'
          : `Press up 1 cm, then 3 cm more, and stitch by hand or machine.${slit ? ' Turn the slit edges under and stitch them down.' : ''}`,
    },
    {
      title: 'Finish',
      text: 'Sew a hook and eye to the waistband ends above the zip. Give the skirt a final press.',
    },
  ];

  return {
    notions: [
      `${fabricM.toFixed(1)} m of woven fabric, 140 cm wide`,
      `${draft.zipCm} cm invisible zip`,
      'Hook and eye',
      '0.3 m lightweight fusible interfacing',
      'Matching thread',
    ],
    steps,
  };
}

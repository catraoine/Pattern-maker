// Plain-language sewing steps for the drafted skirt and bodice, shown in the app and added to the end of the PDF.
// Keep to plain ASCII punctuation: the PDF uses a standard font without curly quotes.
import { isCircle } from './skirt';
import type { Length, Silhouette, SkirtDraft } from './skirt';
import type { BodiceDraft, BodiceLength } from './bodice';

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
  const circle = isCircle(style.silhouette);
  const frontSeam = !draft.pieces[0].fold;
  // A front too wide for the fold (big circle skirts) is cut as a pair with a centre front seam, and
  // the back is then too wide for folded fabric as well.
  const wide = frontSeam;
  const slit = style.silhouette === 'pencil' || (style.silhouette === 'straight' && (style.length === 'midi' || style.length === 'maxi'));

  const steps: SewStep[] = [
    {
      title: 'Print and check the size',
      text: 'Print the pattern at 100% (actual size). Measure the test square: it should be exactly 10 cm. Trim each page along the dashed line, then tape the pages together, matching the row letters and column numbers.',
    },
    {
      title: 'Cut out',
      text: wide
        ? `These pieces are too wide to cut from folded fabric, so open it out to a single layer. Cut each piece twice, turning the pattern over for the second one so you get a pair. Keep each grain arrow parallel to the selvedge. Cut along the solid outer line and snip the small notches.${circle ? ' To save fabric, turn every other piece upside down so the curves nest together.' : ''}`
        : `Fold the fabric in half with the selvedges together. ${frontSeam ? 'Place the skirt front and the skirt back on both layers so you get a pair of each.' : 'Place the skirt front on the fold, and the skirt back on both layers so you get a pair.'} Keep each grain arrow parallel to the selvedge. Cut along the solid outer line, snip the small notches${dartCount ? ', and chalk-mark the dart lines' : ''}.`,
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
      text: `Zigzag or overlock the side and centre ${frontSeam ? 'front and centre back' : 'back'} edges of the skirt pieces, so they will not fray inside.`,
    },
    ...(dartCount
      ? [
          {
            title: `Sew the ${plural(dartCount, 'dart', 'darts')}`,
            text: 'Fold each dart with right sides together so the two dart lines meet. Stitch from the waist to the point, running off the fold, and knot the threads. Press front darts toward the centre front and back darts toward the centre back.',
          },
        ]
      : []),
    ...(frontSeam
      ? [
          {
            title: 'Sew the centre front',
            text: 'Pin the two front pieces right sides together along the straight centre edge. Sew 1.5 cm from the edge and press the seam open.',
          },
        ]
      : []),
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
      text: circle
        ? 'Hang the skirt up for a day before hemming: the parts cut across the grain drop and stretch. Try it on, have someone mark an even hem with pins measured up from the floor, and trim to the marks. Press up 0.5 cm, then 1 cm more, easing the curve with steam, and stitch.'
        : style.silhouette === 'trumpet'
          ? 'The hem is curved and full, so keep it narrow. Press up 0.5 cm, then 1.5 cm more, easing in the fullness with steam, and stitch by hand or machine.'
          : style.silhouette === 'a_line'
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

/** Sewing steps for the sleeveless bodice: centre back zip, bias-bound neck and armholes. */
export function bodiceGuide(draft: BodiceDraft, style: { length: BodiceLength }, fabricM: number, bindingM: number): SewingGuide {
  const below = style.length !== 'waist';
  const bust = draft.bustDart > 0.3;
  const waist = draft.waistDarts.front > 0.3 || draft.waistDarts.back > 0.3;
  const dartWords = bust && waist ? 'bust and waist darts' : bust ? 'bust darts' : 'waist darts';

  const steps: SewStep[] = [
    {
      title: 'Print and check the size',
      text: 'Print the pattern at 100% (actual size). Measure the test square: it should be exactly 10 cm. Trim each page along the dashed line, then tape the pages together, matching the row letters and column numbers.',
    },
    {
      title: 'Cut out',
      text: `Fold the fabric in half with the selvedges together. Place the bodice front on the fold, and the bodice back on both layers so you get a pair. Keep each grain arrow parallel to the selvedge. Cut along the solid outer line, snip the small notches${bust || waist ? ', and chalk-mark the dart lines and the bust point' : ''}.`,
    },
    {
      title: 'Neaten the edges',
      text: 'Zigzag or overlock the shoulder, side and centre back edges, so they will not fray inside.',
    },
    ...(bust || waist
      ? [
          {
            title: `Sew the ${dartWords}`,
            text: [
              bust ? 'Fold each bust dart with right sides together so the dart lines meet, stitch from the side seam to the point, and press it down.' : '',
              waist && below
                ? 'The waist darts are pointed at both ends. Fold each one along its centre, stitch from one point through the widest part at the waist to the other point, then clip into the fold at the waist so it lies flat. Press toward the centre.'
                : waist
                  ? 'Fold each waist dart the same way, stitch from the hem edge to the point, and press toward the centre.'
                  : '',
              'Run each line of stitching off the fold at the point and knot the threads.',
            ]
              .filter(Boolean)
              .join(' '),
          },
        ]
      : []),
    {
      title: 'Put in the zip',
      text: `Sew a ${draft.zipCm} cm invisible zip into the centre back edges, with the top of the teeth 1 cm below the neck edge, stopping at the ZIP ENDS notch.`,
    },
    {
      title: 'Close the centre back',
      text: `${below ? 'Sew the rest of the centre back seam, from the bottom of the zip to the hem, 1.5 cm from the edge, and press it open.' : 'Sew the last few centimetres of the centre back seam below the zip, 1.5 cm from the edge, and press it open.'}`,
    },
    {
      title: 'Sew the shoulders',
      text: 'Pin the front to the back at the shoulders, right sides together. The back shoulder is 1 cm longer: ease it in so it fits without pleats. Sew 1.5 cm from the edge and press the seams open.',
    },
    {
      title: 'Sew the side seams',
      text: 'Pin the front to the back at the sides, right sides together. Sew 1.5 cm from the edge and press the seams open. Try the bodice on now: this is the easiest moment to take it in or let it out at the sides.',
    },
    {
      title: 'Bind the neckline',
      text: 'Open out one fold of the bias binding and pin it to the neckline, right sides together, with the crease 1 cm from the edge and 1 cm extra at each end. Sew along the crease, trim the seam to 0.5 cm and clip the curves. Fold the ends in, then turn the binding to the inside, press it flat, and stitch it down close to its folded edge.',
    },
    {
      title: 'Bind the armholes',
      text: 'Bind each armhole the same way, starting and ending at the side seam with the ends overlapped by 1 cm.',
    },
    {
      title: 'Hem',
      text: below
        ? 'Press up 1 cm, then 1.5 cm more, and stitch by hand or machine.'
        : 'Press up 0.5 cm, then 1 cm more, and stitch close to the fold.',
    },
    {
      title: 'Finish',
      text: 'Sew a hook and eye at the top of the zip, inside the neckline. Give the bodice a final press.',
    },
  ];

  return {
    notions: [
      `${fabricM.toFixed(1)} m of woven fabric, 140 cm wide`,
      `${draft.zipCm} cm invisible zip`,
      `${bindingM.toFixed(1)} m of 2 cm wide bias binding`,
      'Hook and eye',
      'Matching thread',
    ],
    steps,
  };
}

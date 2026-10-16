// Plain-language sewing steps for the drafted skirt and bodice, shown in the app and added to the end of the PDF.
// Keep to plain ASCII punctuation: the PDF uses a standard font without curly quotes.
import { isCircle } from './skirt';
import type { Length, Silhouette, SkirtDraft } from './skirt';
import type { BodiceDraft, BodiceLength } from './bodice';
import { SEAM_WIDTHS, SeamWidths } from './allowances';
import type { Piece } from './piece';
import type { DiagramId } from './diagrams';

// Widest strip that fits across 140 cm fabric, leaving room for the selvedges.
export const BAND_ACROSS_MAX = 135;

export interface SewStep {
  title: string;
  text: string;
  /** A small drawing of the technique. */
  diagram?: DiagramId;
}

export interface SewingGuide {
  /** The maker's own fabric, line by line, when they have recorded it. */
  fabric?: string[];
  notions: string[];
  steps: SewStep[];
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const n1 = (v: number) => `${v} cm`;

/** How the garment is finished, chosen on the print screen. */
export interface SkirtFinish {
  seams?: SeamWidths;
  /** Lining fabric needed, in metres, when the skirt is lined. */
  liningM?: number;
  /** Fabric width in cm, when it isn't 140. */
  width?: number;
  /** Hem allowance on a straight or A-line skirt, when it isn't the usual 4 cm. */
  hem?: number;
}

export type BodiceEdges = 'binding' | 'facings' | 'lined';

export interface BodiceFinish {
  seams?: SeamWidths;
  edges?: BodiceEdges;
  liningM?: number;
  /** Fabric width in cm, when it isn't 140. */
  width?: number;
}

/** A pencil skirt, or a straight one below the knee, needs a walking slit at the centre back. */
export function hasSlit(style: { silhouette: string; length: string }): boolean {
  return style.silhouette === 'pencil' || (style.silhouette === 'straight' && (style.length === 'midi' || style.length === 'maxi'));
}

/** For a body that differs side to side: trim that side's pieces to their own line once cut. */
function oneSide(pc: Piece, also: string): string {
  if (!pc.alternate) return '';
  const side = /right/i.test(pc.alternate.label) ? 'right' : 'left';
  return ` Then trim the pieces for your ${side} side (as you wear it) ${also ? `${also} ` : ''}along the line marked ${pc.alternate.label}, and chalk an R or L on the wrong side of each so the two sides don't get swapped.`;
}

export function sewingGuide(draft: SkirtDraft, style: { silhouette: Silhouette; length: Length }, fabricM: number, finish: SkirtFinish = {}): SewingGuide {
  const { front, back } = draft.dartsPerSide;
  const sw = finish.seams ?? SEAM_WIDTHS.home;
  const seam = n1(sw.seam);
  const waist = n1(sw.waist);
  const lined = finish.liningM !== undefined;
  const dartCount = 2 * front + 2 * back;
  // A shape matched from a photo can come out as part of a circle whatever its silhouette chip says.
  const circle = isCircle(style.silhouette) || !!draft.circleShare;
  const frontSeam = !draft.pieces[0].fold;
  // A front too wide for the fold (big circle skirts) is cut as a pair with a centre front seam, and
  // the back is then too wide for folded fabric as well.
  const wide = frontSeam;
  const slit = hasSlit(style);

  const steps: SewStep[] = [
    {
      title: 'Print and check the size',
      text: 'Print the pattern at 100% (actual size). Measure the test square: it should be exactly 10 cm. Trim each page along the dashed line, then tape the pages together, matching the row letters and column numbers.',
    },
    {
      title: 'Cut out',
      text: (wide
        ? `These pieces are too wide to cut from folded fabric, so open it out to a single layer. Cut each piece twice, turning the pattern over for the second one so you get a pair. Keep each grain arrow parallel to the selvedge. Cut along the solid outer line and snip the small notches.${dartCount ? ' Chalk-mark the dart lines.' : ''}${circle ? ' To save fabric, turn every other piece upside down so the curves nest together.' : ''}`
        : `Fold the fabric in half with the selvedges together. ${frontSeam ? 'Place the skirt front and the skirt back on both layers so you get a pair of each.' : 'Place the skirt front on the fold, and the skirt back on both layers so you get a pair.'} Keep each grain arrow parallel to the selvedge. Cut along the solid outer line, snip the small notches${dartCount ? ', and chalk-mark the dart lines' : ''}.`) + oneSide(draft.pieces[0], lined ? 'and the lining' : ''),
    },
    {
      title: 'Cut the waistband',
      text: 'Cut the waistband from its pattern piece with the grain arrow along the selvedge, so it won\'t stretch. Snip the notches for the centre front and the side seams on both long edges, and at each end of the fold line.',
    },
    ...(lined
      ? [
          {
            title: 'Cut the lining',
            text: 'Cut the lining front and back from the lining fabric the same way as the skirt. The lining pieces are 2.5 cm shorter, so the lining never shows below the hem.',
          },
        ]
      : []),
    {
      title: 'Interface the waistband',
      text: 'Fuse lightweight interfacing to the wrong side of the waistband, on the half marked HOOK and EYE (from the edge that joins the skirt to the fold line). This half will be the outside.',
    },
    {
      title: 'Neaten the edges',
      diagram: 'overlock' as const,
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
            text: `Pin the two front pieces right sides together along the straight centre edge. Sew ${seam} from the edge and press the seam open.`,
          },
        ]
      : []),
    {
      title: 'Put in the zip',
      text: `Sew a ${draft.zipCm} cm invisible zip into the centre back edges, with the top of the teeth ${waist} below the waist edge, stopping at the ZIP ENDS notch.`,
    },
    {
      title: 'Close the centre back',
      text: `Sew the rest of the centre back seam, from the bottom of the zip to the hem, ${seam} from the edge.${slit ? ' Leave the bottom 15 cm open as a walking slit.' : ''} Press the seam open.`,
    },
    {
      title: 'Sew the side seams',
      text: `Pin the front to the back at the sides, right sides together, matching the hip notches. Sew ${seam} from the edge and press the seams open. Try the skirt on now: this is the easiest moment to take it in or let it out at the sides.`,
    },
    ...(lined
      ? [
          {
            title: 'Make the lining',
            text: `Sew the lining darts as tucks: stitch each one only 3 cm down from the waist, so the lining has room to move. Sew the lining side seams, and the centre back seam from the ZIP ENDS notch down, ${seam} from the edge. Press up 1 cm at the hem, then 1 cm more, and stitch.`,
          },
          {
            title: 'Put the lining in',
            text: `Slip the lining inside the skirt, wrong sides together, matching the side seams. Turn the lining's centre back edges under beside the zip and slip-stitch them to the zip tape, clear of the teeth. Tack the waist edges together ${n1(Math.max(0.5, sw.waist - 0.5))} from the edge, and treat them as one from here on.`,
          },
        ]
      : []),
    {
      title: 'Attach the waistband',
      text: `Pin the interfaced long edge of the waistband to the skirt waist, right sides together. Match the centre front notch to the centre front, the side notches to the side seams, and let each end extend ${seam} past the zip. Sew ${waist} from the edge and press the seam up into the band.`,
    },
    {
      title: 'Finish the waistband',
      text: `Fold the band along its fold line, right sides together, and sew across each end ${seam} in. Trim the corners and turn it right side out. Press under ${seam} on the loose edge, then hand-stitch it over the seam inside, or stitch in the ditch from the outside.`,
    },
    {
      title: 'Hem',
      text: circle
        ? 'Hang the skirt up for a day before hemming: the parts cut across the grain drop and stretch. Try it on, have someone mark an even hem with pins measured up from the floor, and trim to the marks. Press up 0.5 cm, then 1 cm more, easing the curve with steam, and stitch.'
        : style.silhouette === 'trumpet'
          ? 'The hem is curved and full, so keep it narrow. Press up 0.5 cm, then 1.5 cm more, easing in the fullness with steam, and stitch by hand or machine.'
          : style.silhouette === 'a_line'
            ? `Press up 1 cm, then ${(finish.hem ?? 4) - 1} cm more. The hem is curved, so ease in the extra fullness with steam as you press. Stitch by hand or machine.`
            : `Press up 1 cm, then ${(finish.hem ?? 4) - 1} cm more, and stitch by hand or machine.${slit ? ' Turn the slit edges under and stitch them down.' : ''}`,
    },
    {
      title: 'Finish',
      text: 'Sew the hook and eye to the waistband ends at the HOOK and EYE marks. Give the skirt a final press.',
    },
  ];

  return {
    notions: [
      `${fabricM.toFixed(1)} m of woven fabric, ${finish.width ?? 140} cm wide`,
      ...(lined ? [`${finish.liningM!.toFixed(1)} m of lining, ${finish.width ?? 140} cm wide`] : []),
      `${draft.zipCm} cm invisible zip`,
      'Hook and eye',
      '0.3 m lightweight fusible interfacing',
      'Matching thread',
    ],
    steps,
  };
}

/** Sewing steps for the sleeveless bodice: centre back zip, and the neck and armholes bias-bound, faced or lined. */
export function bodiceGuide(draft: BodiceDraft, style: { length: BodiceLength }, fabricM: number, bindingM: number, finish: BodiceFinish = {}): SewingGuide {
  const below = style.length !== 'waist';
  const sw = finish.seams ?? SEAM_WIDTHS.home;
  const seam = n1(sw.seam);
  const curve = n1(sw.curve);
  const edges = finish.edges ?? 'binding';
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
      text: `Fold the fabric in half with the selvedges together. Place the bodice front on the fold, and the bodice back on both layers so you get a pair. Keep each grain arrow parallel to the selvedge. Cut along the solid outer line, snip the small notches${bust || waist ? ', and chalk-mark the dart lines and the bust point' : ''}.${
        edges === 'lined' ? ' Cut the front and back again from the lining the same way.' : edges === 'facings' ? ' Cut the four facing pieces from the fabric, and again from fusible interfacing.' : ''
      }${oneSide(draft.pieces[0], edges === 'lined' ? 'and the lining' : edges === 'facings' ? 'and the armhole facings to match' : '')}`,
    },
    ...(edges === 'facings'
      ? [
          {
            title: 'Interface the facings',
            text: 'Fuse the interfacing to the wrong side of each facing. Join the front and back neck facings at the shoulders, and the armhole facings at the shoulders and the sides, ' + seam + ' from the edge. Press the seams open and overlock or zigzag the outer edges marked NEATEN THIS EDGE.',
          },
        ]
      : []),
    {
      title: 'Neaten the edges',
      diagram: 'overlock' as const,
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
      text: `Sew a ${draft.zipCm} cm invisible zip into the centre back edges, with the top of the teeth ${curve} below the neck edge, stopping at the ZIP ENDS notch.`,
    },
    {
      title: 'Close the centre back',
      text: `${below ? 'Sew the rest of the centre back seam, from the bottom of the zip to the hem, ' + seam + ' from the edge, and press it open.' : 'Sew the last few centimetres of the centre back seam below the zip, ' + seam + ' from the edge, and press it open.'}`,
    },
    ...(edges === 'lined'
      ? []
      : [
        {
          title: 'Sew the shoulders',
          text: `Pin the front to the back at the shoulders, right sides together. The back shoulder is 1 cm longer: ease it in so it fits without pleats. Sew ${seam} from the edge and press the seams open.`,
        },
        ]),
    {
      title: 'Sew the side seams',
      text: `Pin the front to the back at the sides, right sides together. Sew ${seam} from the edge and press the seams open. Try the bodice on now: this is the easiest moment to take it in or let it out at the sides.`,
    },
    ...(edges === 'binding'
      ? [
          {
            title: 'Bind the neckline',
            text: `Open out one fold of the bias binding and pin it to the neckline, right sides together, with the crease ${curve} from the edge and 1 cm extra at each end. Sew along the crease, trim the seam to 0.5 cm and clip the curves. Fold the ends in, then turn the binding to the inside, press it flat, and stitch it down close to its folded edge.`,
          },
          {
            title: 'Bind the armholes',
            text: 'Bind each armhole the same way, starting and ending at the side seam with the ends overlapped by 1 cm.',
          },
        ]
      : edges === 'facings'
        ? [
            {
              title: 'Face the neckline',
              diagram: 'understitch' as const,
              text: `Pin the neck facing to the neckline, right sides together, matching the shoulder seams, with its centre back ends folded back over the zip tape. Sew ${curve} from the edge, trim the seam to 0.5 cm and clip the curves. Understitch the facing to the seam allowance close to the seam, so it rolls to the inside, then press it in and hand-tack it to the shoulder seams.`,
            },
            {
              title: 'Face the armholes',
              text: `Pin each armhole facing into its armhole, right sides together, matching the shoulder and side seams and the notches. Sew ${curve} from the edge, trim, clip, understitch and press to the inside the same way. Tack the facing to the shoulder and side seams.`,
            },
          ]
        : [
            {
              title: 'Make the lining',
              text: `Sew the lining's darts and side seams the same way as the bodice, and its centre back seam below the ZIP ENDS notch, ${seam} from the edge. Leave the shoulders of both open for now. Press the lining darts the opposite way to the bodice's, so they don't stack.`,
            },
            {
              title: 'Line the neck and armholes',
              text: `Pin the lining to the bodice, right sides together. Sew the neckline ${curve} from the edge, from one centre back seam line to the other, then sew each armhole from shoulder to shoulder. Trim to 0.5 cm, clip the curves, understitch as far as you can reach, and turn right side out by pulling the back through the shoulders. Sew the outer shoulders right sides together, easing in the extra 1 cm of the back, press them open, then turn the lining shoulders under and slip-stitch them closed over the seam. Press so the lining rolls just inside.`,
            },
            {
              title: 'Finish the lining at the zip',
              text: 'Turn the lining centre back edges under and slip-stitch them to the zip tape, clear of the teeth.',
            },
          ]),
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
      `${fabricM.toFixed(1)} m of woven fabric, ${finish.width ?? 140} cm wide`,
      `${draft.zipCm} cm invisible zip`,
      ...(edges === 'binding' ? [`${bindingM.toFixed(1)} m of 2 cm wide bias binding`] : []),
      ...(edges === 'facings' ? ['0.5 m lightweight fusible interfacing'] : []),
      ...(edges === 'lined' ? [`${(finish.liningM ?? fabricM).toFixed(1)} m of lining, ${finish.width ?? 140} cm wide`] : []),
      'Hook and eye',
      'Matching thread',
    ],
    steps,
  };
}

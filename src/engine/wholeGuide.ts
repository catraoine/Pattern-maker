// Sewing steps for a skirt cut whole, single layer: the bias slip, and skirts whose hem differs side
// to side. With no centre back seam the zip goes in the left side seam. The slip is handled the way
// bias is handled in a workroom: cut flat on a single layer, its waist stay-stitched at once, French
// seams, a faced waist, and hung for a day so the bias can drop before the hem is levelled and rolled.
// Keep to plain ASCII punctuation: the PDF uses a standard font without curly quotes.
import { SEAM_WIDTHS } from './allowances';
import type { SewStep, SewingGuide, SkirtFinish } from './instructions';
import type { Piece } from './piece';
import type { SkirtDraft } from './skirt';
import { SLIP_LEVEL } from './slip';

const n1 = (v: number) => `${Math.round(v * 10) / 10} cm`;

/** For a body that differs side to side: the side marked on the pieces, trimmed along its own line. */
function oneSide(pc: Piece): string {
  if (!pc.alternate) return '';
  const side = /right/i.test(pc.alternate.label) ? 'right' : 'left';
  return ` The pieces carry a second waist line on your ${side} side (as you wear it), marked ${pc.alternate.label}: trim that side along it once cut.`;
}

export function wholeGuide(draft: SkirtDraft, fabricM: number, finish: SkirtFinish = {}): SewingGuide {
  const sw = finish.seams ?? SEAM_WIDTHS.home;
  const seam = n1(sw.seam);
  const waist = n1(sw.waist);
  const lined = finish.liningM !== undefined;
  const bias = !!draft.bias;
  const darts = 2 * (draft.dartsPerSide.front + draft.dartsPerSide.back);
  const diagonal = draft.asym?.kind === 'diagonal';
  const highLow = draft.asym?.kind === 'high_low';
  // A French seam: wrong sides together first, trimmed, then right sides together on the seam line.
  const first = n1(Math.max(0.6, sw.seam - 0.6));

  const steps: SewStep[] = [
    {
      title: 'Print and check the size',
      text: 'Print the pattern at 100% (actual size). Measure the test square: it should be exactly 10 cm. Trim each page along the dashed line, then tape the pages together, matching the row letters and column numbers.',
    },
    {
      title: 'Cut out',
      text: bias
        ? `Open the fabric out to a single layer, right side up, on a table big enough to hold all of it: bias cloth stretches if any of it hangs over the edge. Lay each piece with its grain arrow parallel to the selvedge, so it sits at 45 degrees across the cloth, on the true bias. Weight it or pin inside the seam allowances with fine pins, and cut each piece once with long strokes of sharp shears, never lifting the cloth. Slippery silk cuts cleanly with tissue paper laid underneath and cut through with it. Snip the notches.${diagonal ? ' The two sides of the skirt differ, so keep the pieces printed side up on the right side of the fabric.' : ''}${oneSide(draft.pieces[0])}`
        : `Open the fabric out to a single layer, right side up. The two sides of the skirt differ, so lay the skirt front and back printed side up on the right side of the fabric and cut each once, never turned over: turned, it would come out the other way round. Keep each grain arrow parallel to the selvedge. Cut along the solid outer line, snip the small notches${darts ? ', and chalk-mark the dart lines' : ''}.${oneSide(draft.pieces[0])}`,
    },
    draft.faced
      ? {
          title: 'Cut the facings',
          text: 'Cut the front and back waist facings once each from a single layer, their grain arrows parallel to the selvedge: on the straight grain, they hold the bias waist to its size. Cut the same two pieces from lightweight fusible interfacing.',
        }
      : {
          title: 'Cut the waistband',
          text: "Cut the waistband from its pattern piece with the grain arrow along the selvedge, so it won't stretch. Snip the notches for the centre front, the right side seam and the centre back on both long edges, and at each end of the fold line.",
        },
    ...(lined
      ? [
          {
            title: 'Cut the lining',
            text: `Cut the lining front and back from the lining fabric the same way as the skirt${bias ? ', on the bias too, so it moves with it' : ''}. The lining pieces are 2.5 cm shorter, so the lining never shows below the hem.`,
          },
        ]
      : []),
    ...(bias
      ? [
          {
            title: 'Stay-stitch the waist',
            diagram: 'staystitch' as const,
            text: `As soon as the pieces are cut, machine a line of stitching ${n1(Math.max(0.5, sw.waist - 0.5))} from the waist edge of each, in the seam allowance, sewing from each side toward the centre. The bias waist stretches the moment it is handled; the stitching holds it to the pattern. Handle the pieces flat from now on, and never hang them by an edge.`,
          },
        ]
      : []),
    draft.faced
      ? {
          title: 'Interface the facings',
          text: 'Fuse the interfacing to the wrong side of each facing. Neaten the lower edge of each with zigzag, or turn it under 0.5 cm and stitch.',
        }
      : {
          title: 'Interface the waistband',
          text: 'Fuse lightweight interfacing to the wrong side of the waistband, on the half marked HOOK and EYE (from the edge that joins the skirt to the fold line). This half will be the outside.',
        },
    ...(bias
      ? []
      : [
          {
            title: 'Neaten the edges',
            diagram: 'overlock' as const,
            text: 'Zigzag or overlock the side edges of the skirt front and back, so they will not fray inside.',
          },
        ]),
    ...(darts
      ? [
          {
            title: `Sew the ${darts} darts`,
            text: 'Fold each dart with right sides together so the two dart lines meet. Stitch from the waist to the point, running off the fold, and knot the threads. Press front darts toward the centre front and back darts toward the centre back.',
          },
        ]
      : []),
    bias
      ? {
          title: 'Sew the right side seam',
          diagram: 'french' as const,
          text: `Sew the right side seam (as you wear it) as a French seam, so no raw edge shows through fine cloth. Pin the front to the back wrong sides together, matching the hip notches, and sew ${first} from the edge. Trim to 0.3 cm, fold right sides together along the seam, press and sew again 0.6 cm from the fold, enclosing the raw edges. Sew bias with a slightly longer stitch and let the cloth feed itself: pulled, a bias seam ripples. Press the seam toward the back.`,
        }
      : {
          title: 'Sew the right side seam',
          text: `Pin the front to the back along the right side seam (as you wear it), right sides together, matching the hip notches, and sew ${seam} from the edge. Press the seam open.`,
        },
    {
      title: 'Put in the side zip',
      text: `${bias ? 'Fuse a 1.5 cm strip of interfacing along the left side edges of the front and back, down past the ZIP ENDS notches, so the bias does not stretch as the zip goes in. ' : ''}Sew a ${draft.zipCm} cm invisible zip into the left side seam edges (as you wear it), with the top of the teeth ${waist} below the waist edge, stopping at the ZIP ENDS notches.`,
    },
    {
      title: 'Sew the left side seam',
      text: `Sew the rest of the left side seam, from the bottom of the zip to the hem, ${seam} from the edge, matching the hip notches. Press the seam open${bias ? ' and overcast or zigzag each allowance on its own: a French seam cannot go round a zip' : ''}. Try the skirt on now: this is the easiest moment to take it in or let it out at the sides.`,
    },
    ...(lined
      ? [
          {
            title: 'Make the lining',
            text: `Sew the lining side seams, ${seam} from the edge, leaving the left one open from the waist to the ZIP ENDS notch.${darts ? ' Sew the lining darts as tucks, only 3 cm down from the waist.' : ''} Press up 1 cm at the hem, then 1 cm more, and stitch.`,
          },
          {
            title: 'Put the lining in',
            text: `Slip the lining inside the skirt, wrong sides together, matching the side seams. Turn the lining's edges under beside the zip and slip-stitch them to the zip tape, clear of the teeth. Tack the waist edges together ${n1(Math.max(0.5, sw.waist - 0.5))} from the edge, and treat them as one from here on.`,
          },
        ]
      : []),
    ...(draft.faced
      ? [
          {
            title: 'Face the waist',
            diagram: 'understitch' as const,
            text: `Sew the front facing to the back facing at the right side, ${seam} from the edge, and press the seam open. Pin the facing to the skirt waist, right sides together, matching the side seams and the centre front and back, with the facing's ends turned back level with the zip tape. Sew ${waist} from the edge, trim the seam to 0.5 cm and clip the curve. Understitch: stitch the facing to the seam allowances close to the seam, so it rolls inside. Turn the facing in, press, slip-stitch its ends to the zip tape and catch it to the side seam allowances.`,
          },
        ]
      : [
          {
            title: 'Attach the waistband',
            text: `Pin the interfaced long edge of the waistband to the skirt waist, right sides together. Match the centre front notch to the centre front, the side notch to the right side seam and the centre back notch to the centre back, and let each end extend ${seam} past the zip. Sew ${waist} from the edge and press the seam up into the band.`,
          },
          {
            title: 'Finish the waistband',
            text: `Fold the band along its fold line, right sides together, and sew across each end ${seam} in. Trim the corners and turn it right side out. Press under ${seam} on the loose edge, then hand-stitch it over the seam inside, or stitch in the ditch from the outside.`,
          },
        ]),
    {
      title: 'Hem',
      text: bias
        ? `Hang the skirt up for a day before hemming, by its waist on a clip hanger or on a dress form: cut on the bias, it drops as it hangs, unevenly and often by 2 cm or more. The hem allowance has ${n1(SLIP_LEVEL)} spare for this. Try it on with the shoes you will wear and have someone mark the hem with pins measured up from the floor${draft.asym ? `, following the ${diagonal ? 'diagonal' : 'high-low'} line of the pattern` : ''}. Trim 1 cm below the marks. Finish with a narrow rolled hem: press up 0.5 cm, then 0.5 cm more, and stitch close to the fold, or roll it by hand in silk.`
        : `The hem ${diagonal ? 'runs on a slant, short on the left and long on the right' : highLow ? 'curves from short at the front to long at the back' : 'is curved'}, so keep it narrow. Press up 0.5 cm, then 1 cm more, easing the curve with steam, and stitch by hand or machine.`,
    },
    {
      title: 'Finish',
      text: draft.faced
        ? 'Sew a small hook and eye on the facing at the top of the zip. Press from the wrong side through a press cloth, lifting the iron rather than sliding it, so the bias does not stretch. Give the skirt a final press.'
        : 'Sew the hook and eye to the waistband ends at the HOOK and EYE marks. Give the skirt a final press.',
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
      ...(bias ? ['Fine pins, a fine machine needle (size 60 or 70) and tissue paper, for slippery cloth'] : []),
    ],
    steps,
  };
}

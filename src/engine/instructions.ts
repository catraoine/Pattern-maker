// Plain-language sewing steps for the drafted skirt and bodice, shown in the app and added to the end of the PDF.
// Keep to plain ASCII punctuation: the PDF uses a standard font without curly quotes.
import { isBandCollar } from './collar';
import { isCircle } from './skirt';
import type { Elastic, Length, Silhouette, SkirtDraft } from './skirt';
import type { BodiceDraft, BodiceLength } from './bodice';
import type { SleeveDraft } from './sleeve';
import type { DressDraft } from './dress';
import { SEAM_WIDTHS, SeamWidths } from './allowances';
import type { Piece } from './piece';
import type { DiagramId } from './diagrams';
import { placeWords, styleBodiceSteps } from './styleSteps';
import { VolumeStyle, needsNoSlit, volumeSteps } from './skirtVolume';
import { drapeBodiceSteps, drapeDressSteps } from './drapeSteps';
import { mirrorWords } from './drape';
import { bonedDressSteps, strapCut, topSteps } from './corsetGuide';
import { wrapDressSteps, wrapSkirtSteps, wrapSteps } from './wrapGuide';
import { isShaped } from './hem';
import { SLIP_LEVEL } from './slip';
import { wholeGuide } from './wholeGuide';
import { skirtWaistSteps } from './skirtWaistGuide';
import { slitHem, slitLining, slitStop, toHem, walkingSlit } from './slit';

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
  /** Hem allowance on a straight or A-line skirt, when it isn't the draft's own. */
  hem?: number;
}

export type BodiceEdges = 'binding' | 'facings' | 'lined';

export interface BodiceFinish {
  seams?: SeamWidths;
  edges?: BodiceEdges;
  liningM?: number;
  /** Coutil interlining for a boned bodice, in metres. */
  coutilM?: number;
  /** Fabric width in cm, when it isn't 140. */
  width?: number;
  /** Set-in sleeves, when the bodice has them: the armholes are then sewn to the sleeves, not finished. */
  sleeve?: SleeveDraft;
}

/** A pencil skirt, or a straight one below the knee, needs a walking slit at the centre back, unless
 * pleats, godets, a flounce or tiers give the room to walk. */
export function hasSlit(style: { silhouette: string; length: string } & Partial<Pick<VolumeStyle, 'pleats' | 'godets' | 'flounce'>>): boolean {
  if (needsNoSlit(style as VolumeStyle)) return false;
  return walkingSlit(style);
}

/** For a body that differs side to side: trim that side's pieces to their own line once cut. */
function oneSide(pc: Piece, also: string): string {
  if (!pc.alternate) return '';
  const side = /right/i.test(pc.alternate.label) ? 'right' : 'left';
  return ` Then trim the pieces for your ${side} side (as you wear it) ${also ? `${also} ` : ''}along the line marked ${pc.alternate.label}, and chalk an R or L on the wrong side of each so the two sides don't get swapped.`;
}

export function sewingGuide(draft: SkirtDraft, style: { silhouette: Silhouette; length: Length } & Partial<VolumeStyle>, fabricM: number, finish: SkirtFinish = {}): SewingGuide {
  // The hem depth is the draft's own hem allowance, which varies with the shape (narrower on a curve).
  const hemDepth = draft.pieces.find((pc) => pc.allowances?.hem !== undefined)?.allowances.hem ?? finish.hem ?? 4;
  // Cut whole, with the zip in the left side seam: the slip, or a hem that differs side to side.
  if (draft.opening === 'left_side' && draft.halves) return wholeGuide(draft, fabricM, finish);
  const { front, back } = draft.dartsPerSide;
  const sw = finish.seams ?? SEAM_WIDTHS.home;
  const seam = n1(sw.seam);
  const waist = n1(sw.waist);
  const lined = finish.liningM !== undefined;
  const dartCount = 2 * front + 2 * back;
  // A shape matched from a photo can come out as part of a circle whatever its silhouette chip says.
  const circle = isCircle(style.silhouette) || !!draft.circleShare;
  // A wrap skirt's fronts each reach across the body, so they have no centre front seam either.
  const frontSeam = !draft.pieces[0].fold && !draft.pieces[0].meta.wrap;
  // A front too wide for the fold (big circle skirts) is cut as a pair with a centre front seam, and
  // the back is then too wide for folded fabric as well.
  // A front cut as a pair for its slit is no wider than one on the fold.
  const wide = frontSeam && !draft.pieces[0].meta.slitSeam;
  const slit = draft.slit;
  // A pull-on elastic waist: no zip, and the back on the fold when it fits.
  const elastic = draft.elastic;
  const backSeam = !draft.pieces[1].fold;
  const pockets = !!draft.pocket;
  // The lining is the same skirt without its pleats, godets or flounce, 2.5 cm shorter: it has darts
  // where the plain skirt does (none on a circle), and the same centre seams.
  const liningDarts = !circle && (dartCount > 0 || !!draft.volume?.pleats || !!draft.volume?.inverted);
  const liningSeams = (also: string) => `Sew the lining ${frontSeam ? 'centre front seam, ' : ''}side seams${also}, ${seam} from the edge.`;

  const steps: SewStep[] = [
    {
      title: 'Print and check the size',
      text: 'Print the pattern at 100% (actual size). Measure the test square: it should be exactly 10 cm. Trim each page along the dashed line, then tape the pages together, matching the row letters and column numbers.',
    },
    {
      title: 'Cut out',
      text: (wide
        ? `These pieces are too wide to cut from folded fabric, so open it out to a single layer. Cut each piece twice, turning the pattern over for the second one so you get a pair. Keep each grain arrow parallel to the selvedge. Cut along the solid outer line and snip the small notches.${dartCount ? ' Chalk-mark the dart lines.' : ''}${circle ? ' To save fabric, turn every other piece upside down so the curves nest together.' : ''}`
        : `Fold the fabric in half with the selvedges together. ${frontSeam ? (backSeam ? 'Place the skirt front and the skirt back on both layers so you get a pair of each.' : 'Place the skirt back on the fold, and the skirt front on both layers so you get a pair.') : backSeam ? 'Place the skirt front on the fold, and the skirt back on both layers so you get a pair.' : 'Place the skirt front and the skirt back on the fold.'} Keep each grain arrow parallel to the selvedge. Cut along the solid outer line, snip the small notches${dartCount ? ', and chalk-mark the dart lines' : ''}.`) +
        (pockets ? ` ${POCKET_CUT}` : '') +
        oneSide(draft.pieces[0], lined ? 'and the lining' : ''),
    },
    {
      title: 'Cut the waistband',
      text: elastic
        ? "Cut the waistband from its pattern piece with the grain arrow along the selvedge. It is a casing for the elastic, as long as the skirt's waist so the skirt pulls on over your hips, and it has no interfacing so it can gather. Snip the notches for the side seams and the centre front on both long edges."
        : 'Cut the waistband from its pattern piece with the grain arrow along the selvedge, so it won\'t stretch. Snip the notches for the centre front and the side seams on both long edges, and at each end of the fold line.',
    },
    ...(lined
      ? [
          {
            title: 'Cut the lining',
            text: 'Cut the lining front and back from the lining fabric the same way as the skirt. The lining pieces are 2.5 cm shorter, so the lining never shows below the hem.',
          },
        ]
      : []),
    ...(elastic
      ? []
      : [
          {
            title: 'Interface the waistband',
            text: 'Fuse lightweight interfacing to the wrong side of the waistband, on the half marked HOOK and EYE (from the edge that joins the skirt to the fold line). This half will be the outside.',
          },
        ]),
    {
      title: 'Neaten the edges',
      diagram: 'overlock' as const,
      text: `Zigzag or overlock the side${frontSeam ? ' and centre front and centre back' : backSeam ? ' and centre back' : ''} edges of the skirt pieces, so they will not fray inside.`,
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
            text: `Pin the two front pieces right sides together along the straight centre edge. Sew ${seam} from the edge, from the waist ${toHem(slit, 'front')}, and press the seam open.${slitStop(slit, 'front')}`,
          },
        ]
      : []),
    ...(pockets ? [pocketBagsStep('skirt piece')] : []),
    ...(elastic
      ? backSeam
        ? [
            {
              title: 'Sew the centre back',
              text: `Pin the two back pieces right sides together along the centre back and sew ${seam} from the edge, from the waist ${toHem(slit, 'back')}. Press the seam open.${slitStop(slit, 'back')}`,
            },
          ]
        : []
      : [
          {
            title: 'Put in the zip',
            text: `Sew a ${draft.zipCm} cm invisible zip into the centre back edges, with the top of the teeth ${waist} below the waist edge, stopping at the ZIP ENDS notch.`,
          },
          {
            title: 'Close the centre back',
            text: `Sew the rest of the centre back seam, from the bottom of the zip ${toHem(slit, 'back')}, ${seam} from the edge. Press the seam open.${slitStop(slit, 'back')}`,
          },
        ]),
    {
      title: 'Sew the side seams',
      text: pockets
        ? `Pin the front to the back at the sides, right sides together, matching the hip notches and the pocket bags edge to edge. ${pocketSeamWords(seam)}${slitStop(slit, 'side')} Try the skirt on now: this is the easiest moment to take it in or let it out at the sides.`
        : `Pin the front to the back at the sides, right sides together, matching the hip notches. Sew ${seam} from the edge and press the seams open.${slitStop(slit, 'side')} Try the skirt on now: this is the easiest moment to take it in or let it out at the sides.`,
    },
    ...(lined
      ? [
          {
            title: 'Make the lining',
            text: `${liningDarts ? 'Sew the lining darts as tucks: stitch each one only 3 cm down from the waist, so the lining has room to move. ' : ''}${
              elastic ? liningSeams(backSeam ? ' and centre back seam' : '') : liningSeams(' and the centre back seam from the ZIP ENDS notch down')
            } Press up 1 cm at the hem, then 1 cm more, and stitch.${slitLining(slit)}`,
          },
          {
            title: 'Put the lining in',
            text: `Slip the lining inside the skirt, wrong sides together, matching the side seams.${elastic ? '' : " Turn the lining's centre back edges under beside the zip and slip-stitch them to the zip tape, clear of the teeth."} Tack the waist edges together ${n1(Math.max(0.5, sw.waist - 0.5))} from the edge, and treat them as one from here on.`,
          },
        ]
      : []),
    ...(elastic
      ? casingSteps(elastic, seam, waist, 'skirt', backSeam ? 'the centre back seam' : 'the middle of the back')
      : [
          {
            title: 'Attach the waistband',
            text: `Pin the interfaced long edge of the waistband to the skirt waist, right sides together. Match the centre front notch to the centre front, the side notches to the side seams, and let each end extend ${seam} past the zip. Sew ${waist} from the edge and press the seam up into the band.`,
          },
          {
            title: 'Finish the waistband',
            text: `Fold the band along its fold line, right sides together, and sew across each end ${seam} in. Trim the corners and turn it right side out. Press under ${seam} on the loose edge, then hand-stitch it over the seam inside, or stitch in the ditch from the outside.`,
          },
        ]),
    {
      title: 'Hem',
      text: (draft.bias
        ? `Hang the skirt up for a day before hemming: cut on the bias, it drops as it hangs, unevenly and often by 2 cm or more. The hem allowance has ${n1(SLIP_LEVEL)} spare for this. Try it on, have someone mark the hem with pins measured up from the floor${draft.asym ? ', following the high-low line of the pattern' : ''}, and trim 1 cm below the marks. Finish with a narrow rolled hem: press up 0.5 cm, then 0.5 cm more, and stitch close to the fold.`
        : circle
        ? 'Hang the skirt up for a day before hemming: the parts cut across the grain drop and stretch. Try it on, have someone mark an even hem with pins measured up from the floor, and trim to the marks. Press up 0.5 cm, then 1 cm more, easing the curve with steam, and stitch.'
        : isShaped(draft.hem)
          ? `The hem ${draft.asym ? 'curves from short at the front to long at the back' : 'is shaped'}, so keep it narrow. Press up 0.5 cm, then 1 cm more, easing the curve with steam, and stitch by hand or machine.`
        : style.silhouette === 'trumpet'
          ? 'The hem is curved and full, so keep it narrow. Press up 0.5 cm, then 1.5 cm more, easing in the fullness with steam, and stitch by hand or machine.'
          : style.silhouette === 'a_line'
            ? `Press up 1 cm, then ${hemDepth - 1} cm more. The hem is curved, so ease in the extra fullness with steam as you press. Stitch by hand or machine.`
            : `Press up 1 cm, then ${hemDepth - 1} cm more, and stitch by hand or machine.`) + slitHem(slit),
    },
    {
      title: 'Finish',
      text: elastic
        ? `${ELASTIC_FINISH} Give the skirt a final press.`
        : 'Sew the hook and eye to the waistband ends at the HOOK and EYE marks. Give the skirt a final press.',
    },
  ];

  // A wrap skirt: no zip, a free front edge, and ties (wrapGuide.ts).
  return wrapSkirtSteps(skirtWaistSteps({
    notions: [
      `${fabricM.toFixed(1)} m of woven fabric, ${finish.width ?? 140} cm wide`,
      ...(lined ? [`${finish.liningM!.toFixed(1)} m of lining, ${finish.width ?? 140} cm wide`] : []),
      ...(elastic ? elasticNotions(elastic) : [`${draft.zipCm} cm invisible zip`, 'Hook and eye', '0.3 m lightweight fusible interfacing']),
      'Matching thread',
    ],
    // Pleats, godets, a flounce or tiers, sewn in at the right moment; a gathered skirt's gathers.
    steps: gatherSteps(volumeSteps(steps, draft, { seam, waist, hem: hemDepth }), draft, elastic ? 'casing' : 'band'),
  }, draft, { seam, waist }), draft);
}

/** Gathering a skirt's waist, sewn the way a pattern cutter would. */
export function gatherStep(g: NonNullable<SkirtDraft['gathers']>, into: string, zipped: boolean): SewStep {
  return {
    title: 'Gather the waist',
    text: `Sew two rows of long machine stitches along the waist of each piece, one just inside the seam line and one 0.5 cm further out, stopping ${zipped ? 'at the zip and ' : ''}at each seam. Leave long thread ends. The waist is ${n1(g.round)} round as cut and gathers into ${n1(g.into)} of ${into}, ${Math.round((g.round / g.into) * 10) / 10} times as much: pull up the bobbin threads from both ends until each quarter fits its quarter of ${into}, matching the notches, and spread the gathers evenly. Gathers are easiest to control in sections, so pin often.`,
  };
}

/** A gathered skirt: the waist gathered after the side seams and before the band or casing goes on. */
function gatherSteps(steps: SewStep[], draft: SkirtDraft, kind: 'band' | 'casing'): SewStep[] {
  const g = draft.gathers;
  if (!g) return steps;
  const at = steps.findIndex((st) => st.title === 'Attach the waistband' || st.title === 'Make the waistband loop');
  const out = steps.map((st) =>
    st.title === 'Attach the waistband'
      ? {
          ...st,
          text: st.text
            .replace('The band is the same length as the waist, so nothing needs easing. ', 'Pull up the gathers to fit the band, spread them evenly between the notches, and pin often. ')
            .replace(', and let each end extend', ', pull up the gathers to fit and spread them evenly, and let each end extend'),
        }
      : st,
  );
  out.splice(at < 0 ? out.length - 2 : at, 0, gatherStep(g, kind === 'casing' ? 'the casing' : 'the waistband', kind === 'band' && draft.zipCm > 0));
  return out;
}

/** Cutting the pocket bags, added to the cutting step. */
export const POCKET_CUT =
  'Cut the four pocket bags (two pairs) from the fabric, or from a lightweight cotton in a matching colour for less bulk, and snip their POCKET notches.';

/** Sewing an in-seam pocket's bags to the side edges, before the side seams are sewn. */
export function pocketBagsStep(piece: string, only?: string): SewStep {
  return {
    title: 'Sew on the pocket bags',
    text: `Pin a pocket bag to the side edge of each ${piece}${only ? ` ${only}` : ''}, right sides together, matching the POCKET notches. Sew 1 cm from the edge, just inside the seam line, so the join rolls out of sight. Press the bags out, away from the garment, with the seam allowances toward the bags, and understitch each bag close to the seam, through the bag and the allowances only, so it stays hidden inside the pocket.`,
  };
}

/** The side seam sewn round the pocket bags. */
export function pocketSeamWords(seam: string): string {
  return `Sew ${seam} from the edge from the waist down to the top POCKET notch, pivot and sew round the pocket bags 1 cm from their edge, pivot again at the lower POCKET notch and carry on down to the hem. Clip the back seam allowance just above and below the pocket so the seam presses open there, press the bags toward the front, and zigzag or overlock the bag edges together.`;
}

/** Elastic, to buy and cut. */
export function elasticNotions(e: Elastic): string[] {
  return [`${e.cutCm} cm of ${e.widthCm} cm wide elastic (your waist less 6 cm, plus 2 cm to overlap the ends${e.forHips ? ', a little longer so it stretches over your hips' : ''})`, 'A safety pin, to thread the elastic'];
}

export const ELASTIC_FINISH = 'Spread the gathers evenly round the waist, then stitch in the ditch of each side seam through the band and the elastic, so the elastic cannot twist.';

/** A pull-on waist: the casing joined into a loop, sewn on, and the elastic threaded through it. */
export function casingSteps(e: Elastic, seam: string, waist: string, garment: string, back: string): SewStep[] {
  return [
    {
      title: 'Make the waistband loop',
      text: `Fold the waistband in half crosswise, right sides together, and sew the short ends ${seam} from the edge. Leave a 3 cm gap in this seam on the half that will be inside, between its long edge and the fold line, to thread the elastic through. Press the seam open, then fold the band in half lengthwise along the fold line, wrong sides together, and press.`,
    },
    {
      title: 'Attach the waistband',
      text: `Pin both long raw edges of the band to the ${garment} waist, right sides together, with the band's seam at ${back}, its side notches at the side seams and its centre front notch at the centre front. The band is the same length as the waist, so nothing needs easing. Sew ${waist} from the edge through all the layers, zigzag or overlock the edges together and press them down into the ${garment}.`,
    },
    {
      title: 'Thread the elastic',
      text: `Cut ${e.cutCm} cm of ${e.widthCm} cm wide elastic: your waist less 6 cm, plus 2 cm to overlap the ends${e.forHips ? ', a little longer than that so it stretches over your hips' : ''}. Pin a safety pin to one end and feed it through the gap all the way round the casing, holding the other end so it does not slip in. Try it on and shorten the elastic if you would like it firmer. Overlap the ends 2 cm and zigzag them together firmly, let the elastic slip inside and slip-stitch the gap closed. Keep the iron off the elastic from now on: heat takes its stretch.`,
    },
  ];
}

/** Sewing steps for the bodice: centre back zip, the neck (and, sleeveless, the armholes) bias-bound, faced or
 * lined, and set-in sleeves when it has them. */
export function bodiceGuide(draft: BodiceDraft, _style: { length: BodiceLength }, fabricM: number, bindingM: number, finish: BodiceFinish = {}): SewingGuide {
  const below = draft.finishedHem !== undefined;
  const sw = finish.seams ?? SEAM_WIDTHS.home;
  const seam = n1(sw.seam);
  const curve = n1(sw.curve);
  const edges = finish.edges ?? 'binding';
  const bust = draft.bustDart > 0.3;
  // When the draft notes the bust dart as pivoted into the waist dart, the side dart is 5 cm wide and the waist dart carries the rest.
  const pivoted = draft.pieces.some((pc) => pc.draft?.points.some((pt) => pt.n === 'B' && /pivoted into the waist dart/i.test(pt.note ?? '')));
  const waist = draft.waistDarts.front > 0.3 || draft.waistDarts.back > 0.3;
  const dartWords = bust && waist ? 'bust and waist darts' : bust ? 'bust darts' : 'waist darts';
  const sleeve = finish.sleeve;
  const sleeveCut = sleeveCutWords(sleeve);
  const facingCut = sleeve ? ' Cut the neck facings from the fabric, and again from fusible interfacing.' : ' Cut the four facing pieces from the fabric, and again from fusible interfacing.';

  const steps: SewStep[] = [
    {
      title: 'Print and check the size',
      text: 'Print the pattern at 100% (actual size). Measure the test square: it should be exactly 10 cm. Trim each page along the dashed line, then tape the pages together, matching the row letters and column numbers.',
    },
    {
      title: 'Cut out',
      text: `Fold the fabric in half with the selvedges together. Place the bodice front on the fold, and the bodice back on both layers so you get a pair. Keep each grain arrow parallel to the selvedge. Cut along the solid outer line, snip the small notches${bust || waist ? ', and chalk-mark the dart lines and the bust point' : ''}.${
        edges === 'lined' ? ' Cut the front and back again from the lining the same way.' : edges === 'facings' ? facingCut : ''
      }${sleeveCut}${oneSide(draft.pieces[0], edges === 'lined' ? 'and the lining' : edges === 'facings' && !sleeve ? 'and the armhole facings to match' : '')}`,
    },
    ...(edges === 'facings'
      ? [
          {
            title: 'Interface the facings',
            text: `Fuse the interfacing to the wrong side of each facing. Join the front and back neck facings at the shoulders${sleeve ? '' : ', and the armhole facings at the shoulders and the sides'}, ${seam} from the edge. Press the seams open and overlock or zigzag the outer edges marked NEATEN THIS EDGE.`,
          },
        ]
      : []),
    {
      title: 'Neaten the edges',
      diagram: 'overlock' as const,
      text: `Zigzag or overlock the shoulder, side and centre back edges${sleeve ? ", and the sleeves' underarm seam edges" : ''}, so they will not fray inside.`,
    },
    ...(bust || waist
      ? [
          {
            title: `Sew the ${dartWords}`,
            text: [
              bust ? `Fold each bust dart with right sides together so the dart lines meet, stitch from the side seam to the point, and press it down.${pivoted ? ' The side bust dart is 5 cm wide; the rest of the bust shaping is carried in the waist dart.' : ''}` : '',
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
    ...(edges === 'lined' && !sleeve
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
          ...(sleeve
            ? []
            : [
                {
                  title: 'Bind the armholes',
                  text: 'Bind each armhole the same way, starting and ending at the side seam with the ends overlapped by 1 cm.',
                },
              ]),
        ]
      : edges === 'facings'
        ? [
            {
              title: 'Face the neckline',
              diagram: 'understitch' as const,
              text: `Pin the neck facing to the neckline, right sides together, matching the shoulder seams, with its centre back ends folded back over the zip tape. Sew ${curve} from the edge, trim the seam to 0.5 cm and clip the curves. Understitch the facing to the seam allowance close to the seam, so it rolls to the inside, then press it in and hand-tack it to the shoulder seams.`,
            },
            ...(sleeve
              ? []
              : [
                  {
                    title: 'Face the armholes',
                    text: `Pin each armhole facing into its armhole, right sides together, matching the shoulder and side seams and the notches. Sew ${curve} from the edge, trim, clip, understitch and press to the inside the same way. Tack the facing to the shoulder and side seams.`,
                  },
                ]),
          ]
        : sleeve
          ? [
              {
                title: 'Make the lining',
                text: `Sew the lining's darts, shoulders and side seams the same way as the bodice, and its centre back seam below the ZIP ENDS notch, ${seam} from the edge. Press the lining darts the opposite way to the bodice's, so they don't stack.`,
              },
              {
                title: 'Line the neckline',
                text: `Pin the lining to the bodice round the neckline, right sides together, matching the shoulder seams. Sew ${curve} from the edge, from one centre back seam line to the other. Trim to 0.5 cm, clip the curves, understitch the lining to the seam allowance, and turn it inside. Press so the lining rolls just inside the edge.`,
              },
              {
                title: 'Baste the lining to the armholes',
                text: `Smooth the lining into place, matching the shoulder and side seams, and baste it to the bodice round each armhole, inside the ${curve} seam allowance. From here the two layers are sewn into the sleeve as one.`,
              },
              {
                title: 'Finish the lining at the zip',
                text: 'Turn the lining centre back edges under and slip-stitch them to the zip tape, clear of the teeth.',
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
    ...(sleeve ? sleeveSteps(sleeve, seam, curve, edges === 'lined') : []),
    {
      title: 'Hem',
      text: isShaped(draft.hem)
        ? 'The hem is shaped, so keep it narrow. Press up 0.5 cm, then 1 cm more, easing the curve with steam, and stitch by hand or machine.'
        : below
          ? 'Press up 1 cm, then 1.5 cm more, and stitch by hand or machine.'
          : 'Press up 0.5 cm, then 1 cm more, and stitch close to the fold.',
    },
    {
      title: 'Finish',
      text: 'Sew a hook and eye at the top of the zip, inside the neckline. Give the bodice a final press.',
    },
  ];

  const guide: SewingGuide = {
    notions: [
      `${fabricM.toFixed(1)} m of woven fabric, ${finish.width ?? 140} cm wide`,
      `${draft.zipCm} cm invisible zip`,
      ...(edges === 'binding' || (sleeve && edges === 'lined') ? [`${bindingM.toFixed(1)} m of 2 cm wide bias binding`] : []),
      ...(edges === 'facings' ? ['0.5 m lightweight fusible interfacing'] : []),
      ...(edges === 'lined' ? [`${(finish.liningM ?? fabricM).toFixed(1)} m of lining, ${finish.width ?? 140} cm wide`] : []),
      'Hook and eye',
      'Matching thread',
    ],
    steps,
  };
  // The top neckline's steps (corsetGuide.ts), then a draped neckline's and a peplum's (drapeSteps.ts).
  return mirroredGuide(draft, drapeBodiceSteps(
    wrapSteps(topSteps(styleBodiceSteps(guide, draft, { seam, curve, edges, sleeve: !!sleeve }), draft, { seam, curve, fabricM, liningM: finish.liningM, coutilM: finish.coutilM, width: finish.width }), draft, { curve }),
    draft,
    { seam, curve, edges, sleeve: !!sleeve },
  ));
}

/** A one-shoulder cut for the right shoulder: every step with left and right, and the fabric's face, turned over. */
function mirroredGuide(d: BodiceDraft, g: SewingGuide): SewingGuide {
  if (d.drape?.side !== 'right') return g;
  return { ...g, steps: g.steps.map((st) => ({ ...st, text: mirrorWords(st.text) })) };
}

/** Cutting the sleeves, added to the cutting step. */
function sleeveCutWords(sleeve: SleeveDraft | undefined): string {
  if (!sleeve) return '';
  return ` Place the sleeve on both layers too, so you get a pair, and snip its notches: one at the top of the crown, one on the front, two on the back.${
    sleeve.pieces.length > 1 ? ' Cut the two sleeve bands.' : ''
  }${sleeve.vent ? ' Snip the vent notch on the back seam too.' : ''}${sleeve.elbowDart ? ' Chalk-mark the elbow dart.' : ''}`;
}

/**
 * Sewing steps for the dress: the bodice's and the skirt's own steps, put in the order a dress is
 * sewn. Darts first, then bodice and skirt joined at the waist while they are still flat, the zip
 * across the waist seam, and the side seams sewn in one from the underarm to the hem.
 */
export function dressGuide(draft: DressDraft, style: { silhouette: Silhouette; length: Length } & Partial<VolumeStyle>, fabricM: number, bindingM: number, finish: BodiceFinish = {}): SewingGuide {
  const sw = finish.seams ?? SEAM_WIDTHS.home;
  const seam = n1(sw.seam);
  const waist = n1(sw.waist);
  const curve = n1(sw.curve);
  const edges = finish.edges ?? 'binding';
  if (draft.noSeam) return noSeamGuide(draft, fabricM, bindingM, finish);
  const top = bodiceGuide(draft.bodice, { length: 'waist' }, fabricM, bindingM, finish);
  // The skirt's pleats, godets or flounce are sewn in with the dress's own steps, below.
  const skirt = sewingGuide({ ...draft.skirt, volume: undefined }, style, fabricM, { seams: sw, width: finish.width });
  const find = (g: SewingGuide, re: RegExp) => g.steps.filter((s) => re.test(s.title));
  const at = (title: string) => top.steps.findIndex((s) => s.title === title);
  const slit = draft.skirt.slit;
  // A skirt front cut as a pair for its slit is no wider than one on the fold.
  const frontSlit = slit?.at === 'front';
  const wide = !draft.skirt.pieces[0].fold && !frontSlit;
  const lined = edges === 'lined';
  const pockets = !!draft.skirt.pocket;
  const dartLines = draft.bodice.bustDart > 0.3 || draft.skirt.dartsPerSide.front + draft.skirt.dartsPerSide.back > 0;
  if (draft.bodice.top?.boned) return gatheredJoin(bonedDressSteps(draft, top, skirt, { seam, curve, fabricM, liningM: finish.liningM, coutilM: finish.coutilM, width: finish.width, waist, slit, wide }), draft);

  // The bodice's own finishing, from the neck to the sleeves: everything after its side seams.
  const finishing = top.steps.slice(at('Sew the side seams') + 1, at('Hem')).map((s) =>
    s.title === 'Make the lining'
      ? { ...s, text: s.text.replace(/, and its centre back seam below the ZIP ENDS notch,/, ',') }
      : s.title === 'Finish the lining at the zip'
        ? { ...s, text: `${s.text} Turn the lining's waist edge under and slip-stitch it over the waist seam inside.` }
        : s,
  );

  const steps: SewStep[] = [
    top.steps[0],
    {
      title: 'Cut out',
      text: `Fold the fabric in half with the selvedges together. ${placeWords(draft.bodice)}${wide ? '' : frontSlit ? ' Place the skirt front and the skirt back on both layers so you get a pair of each.' : ' Place the skirt front on the fold and the skirt back on both layers.'}${
        draft.skirt.bias
          ? ' The skirt is cut on the bias, from a single layer opened out flat on a big table: the front once, whole, and the back twice, turning the pattern over for the second. Lay each with its grain arrow parallel to the selvedge, so it sits at 45 degrees across the cloth. As soon as the skirt pieces are cut, stay-stitch their waist edges 1 cm in, so the bias waist cannot stretch before it is joined to the bodice.'
          : wide ? ' The skirt pieces are too wide for folded fabric: cut them from a single layer, turning the pattern over for the second of each so you get pairs.' : ''
      } Keep each grain arrow parallel to the selvedge. Cut along the solid outer line, snip the small notches${dartLines ? ', and chalk-mark the dart lines and the bust point' : ''}.${pockets ? ` ${POCKET_CUT}` : ''}${collarCut(draft.bodice)}${
        lined ? ' Cut the bodice pieces again from the lining.' : edges === 'facings' ? (finish.sleeve ? ' Cut the neck facings from the fabric, and again from fusible interfacing.' : ' Cut the four facing pieces from the fabric, and again from fusible interfacing.') : ''
      }${sleeveCutWords(finish.sleeve)}${strapCut(draft.bodice)}${oneSide(draft.bodice.pieces[0], lined ? 'and the lining' : '')}`,
    },
    ...find(top, /^Interface the facings$/),
    {
      title: 'Neaten the edges',
      diagram: 'overlock',
      text: `Zigzag or overlock the shoulder and side edges of the bodice, the side edges of the skirt${frontSlit ? ' and its centre front edges' : ''}, and the centre back edges of both${finish.sleeve ? ", and the sleeves' underarm seam edges" : ''}, so they will not fray inside.`,
    },
    ...find(top, /^(Sew the (.*darts?|princess seams|panel seams)|Join the (.*yokes?|midriff band))$/),
    ...find(skirt, /^Sew the .*darts?$/).map((s) => ({ ...s, title: 'Sew the skirt darts' })),
    ...find(skirt, /^Sew the centre front$/).map((s) => ({ ...s, title: 'Sew the skirt centre front' })),
    ...find(skirt, /^Sew on the pocket bags$/),
    {
      title: 'Join the bodice to the skirt',
      text: `Pin the bodice front to the skirt front at the waist, right sides together, matching the centre front, the side edges and the darts, so each bodice dart runs on into the skirt dart below it in one line. Pin each back half the same way. Sew ${waist} from the edge, press the seams up toward the bodice, and zigzag or overlock the two edges together.`,
    },
    {
      title: 'Put in the zip',
      text: `Sew a ${draft.zipCm} cm invisible zip into the centre back edges, with the top of the teeth ${curve} below the neck edge, across the waist seam, to the ZIP ENDS notch on the skirt. Sew one side, close the zip and mark where the waist seam crosses the other tape, so the waist meets exactly when you sew the second side.`,
    },
    {
      title: 'Close the centre back',
      text: `Sew the rest of the centre back seam, from the bottom of the zip ${toHem(slit, 'back')}, ${seam} from the edge. Press the seam open.${slitStop(slit, 'back')}`,
    },
    ...find(top, /^Sew the shoulders$/),
    {
      title: 'Sew the side seams',
      text: pockets
        ? `Pin the front to the back at the sides, right sides together, from the underarm to the hem, matching the waist seams, the hip notches and the pocket bags edge to edge. Sew ${seam} from the edge in one seam, from the underarm down to the top POCKET notch, then pivot and sew round the pocket bags 1 cm from their edge, pivot again at the lower POCKET notch and carry on to the hem. Clip the back seam allowance just above and below the pocket, press the seam open and the bags toward the front, and zigzag or overlock the bag edges together.${slitStop(slit, 'side')} Try the dress on now: this is the easiest moment to take it in or let it out at the sides.`
        : `Pin the front to the back at the sides, right sides together, from the underarm to the hem, matching the waist seams and the hip notches. Sew ${seam} from the edge in one seam and press it open.${slitStop(slit, 'side')} Try the dress on now: this is the easiest moment to take it in or let it out at the sides.`,
    },
    ...finishing,
    ...find(skirt, /^Hem$/),
    { title: 'Finish', text: `Sew a hook and eye at the top of the zip, inside the ${draft.bodice.top ? 'top edge' : 'neckline'}. Give the dress a final press.` },
  ];

  return wrapDressSteps(shirtDress(gatheredJoin(mirroredGuide(draft.bodice, drapeDressSteps(
    {
      notions: top.notions.map((n) => (/invisible zip/.test(n) ? `${draft.zipCm} cm invisible zip` : n)),
      steps: volumeSteps(steps, draft.skirt, { seam, waist, hem: draft.skirt.pieces[0].allowances.hem ?? 4 }, 'dress'),
    },
    top,
    draft,
    { seam, waist, curve, edges, slit, sleeve: !!finish.sleeve },
  )), draft), draft, top, { seam, waist }), draft, { seam, waist });
}

/**
 * A sheath or a shift: the bodice's own steps, the block carried on to the hem, with a dress's words,
 * and a sheath's walking slit left open below its notch at the centre back.
 */
function noSeamGuide(draft: DressDraft, fabricM: number, bindingM: number, finish: BodiceFinish): SewingGuide {
  const g = bodiceGuide(draft.bodice, { length: 'hip' }, fabricM, bindingM, finish);
  const slit = draft.pieces.find((pc) => /back/i.test(pc.name) && !pc.kind)?.meta.slitCm as number | undefined;
  const dress = (t: string) => t.replace(/\bbodice\b/g, 'dress').replace(/\bBodice\b/g, 'Dress');
  // A lined sheath's lining stops at the slit too, its edges turned under clear of the slit's own.
  const lining = (t: string) => (slit ? t.replace(/below the ZIP ENDS notch,/, 'from the ZIP ENDS notch down to the SLIT ENDS notch,') : t);
  const steps = g.steps.map((st) =>
    st.title === 'Close the centre back' && slit
      ? {
          ...st,
          text: `Sew the rest of the centre back seam, from the bottom of the zip down to the SLIT ENDS notch, ${n1((finish.seams ?? SEAM_WIDTHS.home).seam)} from the edge, and backstitch firmly there. Below it the seam stays open as a ${slit} cm walking slit: press the seam open all the way down, the slit's edges turned under along the seam line, and topstitch round the slit 1 cm from its edges, across the top at the notch.`,
        }
      : { ...st, text: dress(st.title === 'Make the lining' ? lining(st.text) : st.text) },
  );
  return { ...g, steps };
}

/**
 * A shirt dress: no zip, and the back cut whole on the fold. The bodice's and the skirt's front facings
 * join at the waist into one long facing, the buttonholes run on down the skirt, and the facing is
 * turned at the hem.
 */
function shirtDress(g: SewingGuide, draft: DressDraft, top: SewingGuide, o: { seam: string; waist: string }): SewingGuide {
  const below = draft.skirtButtons;
  const above = draft.bodice.buttons;
  if (!below || !above) return g;
  const count = above.count + below.count;
  const fromTop = (title: string) => top.steps.filter((st) => st.title === title);
  const steps = g.steps.flatMap((st): SewStep[] => {
    switch (st.title) {
      case 'Put in the zip':
      case 'Close the centre back':
      case 'Sew the skirt centre front':
        return [];
      case 'Cut out':
        return [
          {
            ...st,
            text: st.text
              .replace(/The skirt pieces are too wide for folded fabric:[^.]*\./, '')
              .replace(/ Place the skirt front on the fold and the skirt back on both layers\./, '')
              .replace(/(Place the bodice back on the fold, and the bodice front on both layers so you get a pair\.)/, 'Place the bodice back and the skirt back on the fold, and the bodice front and the skirt front on both layers so you get pairs.')
              .replace(/\s+/g, ' ')
              .concat(' Cut the skirt front facings as a pair, from the fabric and again from fusible interfacing.'),
          },
        ];
      case 'Interface the facings':
        return [
          { ...st, text: st.text.replace('Fuse the interfacing to the wrong side of the front facings', 'Fuse the interfacing to the wrong side of the front facings, the skirt front facings') },
          {
            title: 'Join the front facings at the waist',
            text: `Pin each skirt front facing to the foot of its bodice front facing, right sides together, the extension edges level. Sew ${o.waist} from the edge and press the seam open, so each front has one long facing from the neck to the hem.`,
          },
        ];
      case 'Neaten the edges':
        return [{ ...st, text: st.text.replace(', and the centre back edges of both', '').replace('the side edges of the skirt', 'the side edges of the skirt and the inner edges of the skirt front facings') }];
      case 'Join the bodice to the skirt':
        return [{ ...st, text: st.text.replace('matching the centre front,', 'matching the front edges,').replace('Pin each back half the same way.', 'Pin the back the same way, matching the centre backs.') }];
      case 'Attach the front facings':
        return [{ ...st, text: st.text.replace('from the hem to the neck seam line', 'from the hem to the neck seam line, matching the waist seams') }];
      case 'Finish the lining at the front':
        return [{ ...st, text: `${st.text} Turn the lining's waist edge under and slip-stitch it over the waist seam inside.` }];
      case 'Hem':
        return [
          {
            ...st,
            text: `At each front edge, fold the facing back over the dress, right sides together, and sew across it at the hem's depth. Trim, turn the facing back inside and push out the corner. Then hem the rest of the way round: ${st.text.charAt(0).toLowerCase()}${st.text.slice(1)}`,
          },
          ...fromTop('Make the buttonholes').map((b) => ({ ...b, text: b.text.replace(`Work ${above.count} buttonholes`, `Work ${count} buttonholes, ${above.count} on the bodice and ${below.count} on the skirt,`) })),
          ...fromTop('Sew on the buttons'),
        ];
      case 'Finish':
        return [{ ...st, text: 'Give the dress a final press, over a ham at the bust.' }];
      default:
        return [st];
    }
  });
  return {
    notions: g.notions.filter((n) => !/zip/.test(n)).map((n) => n.replace(/^(\d+) buttons/, (_, k: string) => `${Number(k) + below.count} buttons`)),
    steps,
  };
}

/** A gathered dress skirt: its waist gathered before it is joined to the bodice, the gathers taking
 * the place of the darts that would run on through the seam. */
function gatheredJoin(g: SewingGuide, draft: DressDraft): SewingGuide {
  const gathers = draft.skirt.gathers;
  if (!gathers) return g;
  const steps = g.steps.flatMap((st) =>
    st.title === 'Join the bodice to the skirt'
      ? [
          gatherStep(gathers, 'the bodice waist', false),
          {
            ...st,
            text: st.text
              .replace(/the side edges and the darts, so each bodice dart runs on into the skirt dart below it in one line/g, 'the side edges and the halfway notches, then pull up the gathers to fit and spread them evenly')
              .replace(/the side edges and the princess seams to the skirt darts, so each runs on in one line/g, 'the side edges and the halfway notches, then pull up the gathers to fit and spread them evenly')
              .replace(/Sew ([^ ]+ cm) from the edge/, 'Sew $1 from the edge with the gathers on top, so they stay even'),
          },
        ]
      : [st],
  );
  return { ...g, steps };
}

/** Cutting a dress's collar. */
const collarCut = (d: BodiceDraft) =>
  d.collar === 'peter_pan' ? ' Cut four collar pieces (two pairs), and interface two of them.' : isBandCollar(d.collar) ? ' Cut the collar twice on the fold, and interface one.' : '';

/** The steps for set-in sleeves, after the bodice is closed and its neck finished. */
function sleeveSteps(sl: SleeveDraft, seam: string, curve: string, lined: boolean): SewStep[] {
  const puff = sl.gathers?.crown !== undefined;
  const band = sl.pieces.length > 1;
  const ease = Math.round((sl.crownEase.front + sl.crownEase.back) * 10) / 10;
  const hemAllowance = sl.pieces[0].allowances.hem ?? 2.5;
  return [
    ...(sl.elbowDart
      ? [
          {
            title: 'Sew the elbow darts',
            text: 'Fold each elbow dart right sides together so its lines meet, stitch from the back edge to the point, run off the fold and knot the threads. Press the dart down toward the wrist.',
          },
        ]
      : []),
    {
      title: 'Sew the sleeve seams',
      text: `Fold each sleeve right sides together, matching the underarm corners, the notches and the hem. Sew the underarm seam ${seam} from the edge${
        sl.vent ? `, from the underarm down to the vent notch ${sl.vent.lengthCm} cm above the hem, and backstitch there: the seam stays open below it for the wrist vent. Press it` : ' and press it'
      } open over a sleeve board or a rolled towel, so the crease doesn't press through to the top of the sleeve.`,
    },
    band
      ? {
          title: 'Attach the sleeve bands',
          text: `Sew two rows of long gathering stitches round each sleeve hem, inside the seam allowance. Join each band's short ends into a ring, ${seam} from the edge, and press the seam open. Pin one edge of the band to the sleeve hem, right sides together, with its seam at the underarm and its notch at the middle of the sleeve, pull up the gathers to fit (${sl.gathers!.hem} cm is gathered into each band), and sew ${seam} from the edge. Fold the band in half to the inside along its fold line, turn its raw edge under ${seam}, and stitch it down over the seam.`,
        }
      : sl.pieces[0].meta.flutter
        ? {
            title: 'Hem the flutters',
            text: 'The hem is curved and flared, so it takes a narrow hem only. Stay-stitch 0.5 cm from the edge, press up along that line, then fold the raw edge in to meet the crease and press again, easing it round the curve. Stitch close to the inner fold. In a fine fabric a rolled hem on an overlocker is lovely here. It is far easier now than once the sleeves are in.',
          }
        : {
          title: 'Hem the sleeves',
          text: `${
            sl.vent
              ? `Finish the vent first: press the open seam allowances below the notch to the wrong side along the seam line, turn their raw edges under and stitch them down close to the fold, with a bar tack or a few stitches across the top of the vent so it doesn't tear. Then press up 1 cm`
              : 'Press up 1 cm'
          }, then ${Math.round((hemAllowance - 1) * 10) / 10} cm more, and stitch by hand or machine${sl.vent ? ', mitring the hem at the vent corners' : ''}. It is far easier now than once the sleeves are in.`,
        },
    puff
      ? {
          title: 'Gather the sleeve heads',
          text: `Sew two rows of long gathering stitches across each crown between the front and back notches, one just inside the seam line and one 0.5 cm further out. Leave long thread ends. The crown is ${sl.gathers!.crown} cm longer than the armhole: that is the puff.`,
        }
      : {
          title: 'Ease the sleeve heads',
          text: `Sew two rows of long machine stitches round each crown between the front and back notches, one just inside the seam line and one 0.5 cm further out. The crown is ${ease} cm longer than the armhole, a little more at the back: draw the threads up just enough to cup it to the armhole's shape, with no gathers or tucks. Steam it over a ham and let it cool.`,
        },
    {
      title: 'Set in the sleeves',
      text: `Turn the bodice inside out and the sleeve right side out, and slip the sleeve into its armhole, right sides together. Match the underarm seam to the side seam, the top notch to the shoulder seam, the single notch to the front and the double notches to the back. Pin there first, then ${puff ? 'pull up the gathers to fit and spread them evenly over the top of the shoulder' : 'spread the ease evenly between the notches'}. Sew with the sleeve on top, ${curve} from the edge, all the way round, easing as you go so no tucks form.`,
    },
    {
      title: 'Finish the armhole seams',
      text: lined
        ? `Trim the armhole seam to 0.7 cm through all the layers. Bind it with bias binding, folded over the raw edges and stitched through, so the lining and the bodice are covered together. Let the seam turn toward the sleeve.`
        : `Trim the armhole seam to 0.7 cm under the arm, where it has to curve, and zigzag or overlock the two edges together all the way round. Let the seam turn toward the sleeve, pressing only the edge of the crown so the sleeve keeps its round head.`,
    },
  ];
}

// Plain-language sewing steps for trousers, in the app and at the end of the PDF. Plain ASCII only:
// the PDF's standard font has no curly quotes.
import { INVISIBLE_ZIP_LAY } from './stepWords';
import { SEAM_WIDTHS, SeamWidths } from './allowances';
import { ELASTIC_FINISH, POCKET_CUT, casingSteps, elasticNotions, pocketBagsStep, pocketSeamWords } from './instructions';
import type { SewingGuide, SewStep } from './instructions';
import type { TrouserLength, TrousersDraft } from './trousers';
import { PLEAT_STITCH_CM } from './trouserPleats';
import { longBandInterfacing } from './finishing';
import { PRINT_FIRST } from './printFirst';

const n1 = (v: number) => `${v} cm`;

/** Where each length's hem is pinned at the fitting. */
const HEM_AT: Record<TrouserLength, string> = {
  shorts: 'shorts end at mid-thigh, level all round',
  knee: 'knee-length trousers end just past the knee, so they cover it when you sit',
  capri: 'capri trousers end below the calf, a little above the ankle',
  cropped: 'cropped trousers end a hand above the ankle bone',
  ankle: 'ankle-length trousers end just above the ankle bone, clear of the shoe',
  full: 'full-length trousers just touch the top of the shoe at the front',
};

/**
 * `finish.length` is the length chosen, which the draft itself does not record; without
 * it the hem step describes both.
 */
// Unlined, the cutting layout lays the back pocket bags in the fabric, so the fabric bought covers them; the step said
// lining or pocketing only, and read as the layout being wrong (pretend tester DO walk, Nov 20).
const BAGS_IN_FABRIC = ', or from the fabric itself: the cutting layout leaves room for them.';

export function trousersGuide(d: TrousersDraft, fabricM: number, finish: { seams?: SeamWidths; width?: number; length?: TrouserLength; lined?: boolean } = {}): SewingGuide {
  const sw = finish.seams ?? SEAM_WIDTHS.home;
  const seam = n1(sw.seam);
  const waist = n1(sw.waist);
  const fly = d.closure === 'fly';
  // The crotch is always sewn at 1 cm. A tester sewed it at 1.5 cm like every other seam and only saw at the fly that it
  // differs (fit audit, findings row 161), so it says so when the other seams are wider.
  const narrower = sw.seam > 1 ? ', which is narrower than the other seams' : '';
  // (Only a fly's band runs on past the opening, as its underlap. A side zip's ends stop level with it and a hook and eye
  // closes them, so its steps name no extension: they sent the sewist looking for one; era pattern review, Nov 14.)
  // A low rise's band is cut curved, a band and its facing: not folded (trouserBand.ts).
  const curved = !!d.bandTop;
  const sideZip = d.closure === 'side_zip';
  const elastic = d.elastic;
  // Shorts end above the knee: no knee notches, and the crease runs from the hem.
  const knee = d.shorts ? '' : ' and knee';
  const things = d.shorts ? 'shorts' : 'trousers';
  const darts = 2 * (d.dartsPerSide.front + d.dartsPerSide.back);
  const hem = d.pieces[0].allowances.hem ?? 4;
  const culotte = d.leg === 'culotte';
  const inseam = d.pockets === 'inseam';
  const slant = d.pockets === 'slant';
  const pleats = d.pleats?.count ?? 0;
  const loops = d.loops ?? 0;
  // Beside a left side zip the in-seam pocket is on the right only.
  const rightOnly = d.pocketSides === 'right';
  const pocketCut = inseam
    ? rightOnly
      ? ' Cut the two pocket bags (a pair, for the right side) from the fabric, or from a lightweight cotton for less bulk, and snip their POCKET notches.'
      : ` ${POCKET_CUT}`
    : slant
      ? ' Cut the pocket facings (a pair) from the fabric, and the pocket linings (a pair) from the fabric or a lightweight cotton for less bulk.'
      : '';
  const sideSeam = (plain: string) =>
    inseam
      ? `Pin each front to its back at the side, right sides together, matching the hip${knee} notches${rightOnly ? ', and on the right leg the pocket bags edge to edge' : ' and the pocket bags edge to edge'}. ${rightOnly ? `On the right leg: ${pocketSeamWords(seam)}` : pocketSeamWords(seam)}${
          sideZip ? ' On the left leg, leave the seam open from the waist to the LEFT ZIP ENDS notch, and sew from there to the hem.' : ''
        } Press the seams open over a sleeve board.`
      : plain;
  const steps: SewStep[] = [
    {
      title: 'Print and check the size',
      text: PRINT_FIRST + ' Cut each page along the solid line marked CUT on its left and top edges, lay it over the page before it so the half diamonds make whole ones, and tape, matching the row letters and column numbers.',
    },
    {
      title: 'Cut out',
      text: `Fold the fabric in half with the selvedges together. Place the trousers front and back on both layers so you get a pair of each, with the crease line on each parallel to the selvedge. Cut along the solid outer line${darts ? ', snip the notches and chalk-mark the darts' : ' and snip the notches'}. Mark the crease line on the wrong side with tailor's chalk.${pleats ? ' Snip the notches for the pleat folds and placement lines on each front, and chalk the fold lines.' : ''}${fly ? ' Cut the fly facing and the fly shield, and the fly facing again from fusible interfacing.' : ''}${pocketCut}${loops ? ' Cut the belt loop strip with the grain along its length.' : ''}${d.backWelt ? ' Cut the two back welts and the two back pocket facings from the fabric, the welts again from fusible interfacing, and the four back pocket bags from lining or pocketing' + (finish.lined ? '.' : BAGS_IN_FABRIC) : ''}`,
    },
    {
      title: 'Cut the waistband',
      text: elastic
        ? 'Cut the waistband from its pattern piece with the grain along its length. It is a casing for the elastic, as long as the trousers waist so they pull on over your hips, and it has no interfacing so it can gather. Snip the notches for the side seams and the centre front.'
        : curved
          ? `You need two curved waistbands, one for the band and one for its facing: on folded fabric that is one cut through both layers. Lay the piece with its grain arrow parallel to the selvedge, and fuse interfacing to the outer band so the curve cannot stretch. Snip the notches for the ${fly ? 'centre fronts, side seams and centre back' : 'side seams, centre front and centre back'} on both long edges.`
          : `Cut the waistband from its pattern piece with the grain along its length, and fuse interfacing to the outer half. Snip the notches for the ${fly ? 'centre fronts, side seams and centre back' : 'side seams, centre front and centre back'}.`,
    },
    {
      title: 'Neaten the edges',
      diagram: 'overlock',
      text: `Zigzag or overlock the side seam, inside leg and crotch edges of every front and back.${fly ? ' Do the same to the curved edge of the fly facing. Fold the fly shield in half lengthwise, wrong sides together, and neaten its two long raw edges as one.' : ''}${slant ? ' Neaten the side edges of the pocket facings too.' : ''}`,
    },
    ...(darts
      ? [
          {
            title: `Sew the ${darts} darts`,
            text: 'Fold each dart with right sides together so the dart lines meet. Stitch from the waist to the point, running off the fold, and knot the threads. Press front darts toward the centre front and back darts toward the centre back.',
          },
        ]
      : []),
    ...(pleats
      ? [
          {
            title: `Fold the front pleat${pleats > 1 ? 's' : ''}`,
            text: `On each front, fold along the chalked fold line${pleats > 1 ? 's' : ''} with wrong sides together and bring the fold over to its placement notch, so the fold points toward the centre front${pleats > 1 ? ', the pleat nearer the crease first' : ''}. Pin, then stitch each pleat down just inside the fold, for the first ${PLEAT_STITCH_CM} cm below the waist edge, and baste across the top inside the seam allowance so it stays put under the waistband. Press the folded part flat toward the centre front; below the stitching the pleat hangs free.`,
          },
        ]
      : []),
    ...(d.backWelt
      ? [
          {
            title: 'Make the back welt pockets',
            // The bags are sewn at the opening, 7 cm below the waist (BACK_WELT.below), and are 17 cm deep, so they hang
            // free: the step used to ask to tack their tops into the waistband, which a tester found can't be done
            // (fit audit, findings row 162). The welt and facing are cut with 1 cm allowances and the box is 1.2 cm deep:
            // their stitching lines go on the box's lines, raw edges inside the box (UX/UI's step diagrams, Nov 27).
            text: `On the right side of each back, chalk the BACK POCKET box from the pattern. Fuse a strip of interfacing behind it on the wrong side. Fold each back welt in half lengthwise, right side out, and press. Lay it on the back below the box, raw edges toward the box, with its stitching line on the box's lower line, and stitch along that line from end to end. Lay a back pocket facing above the box, raw edge toward it, with its stitching line on the box's upper line, and stitch along it, stopping 0.5 cm short of each end. Cut through the back between the lines and into each corner in a small V, stopping just short of the stitching. Push the facing through, flip the welt up over the opening and press. Sew a back pocket bag to the welt's seam allowance and another to the facing's, then sew the two bags together round their edges, catching the little triangles at the ends. The bags hang free from the opening and do not reach the waist.`,
          },
        ]
      : []),
    d.softPress
      ? {
          title: 'Press the legs',
          text: `Press each front and each back flat through a press cloth, without folding it along the crease line: no crease is pressed in, so the legs${pleats ? ' and the pleats' : ''} fall soft from the band.${pleats ? ' Press the pleat folds only where they are stitched down at the waist.' : ''}`,
        }
      : {
          title: 'Press the creases',
          text: `Fold each front and each back along its chalked crease line, wrong sides together, and press the crease in from the hem${
            culotte ? (d.shorts ? '' : ' up to the knee') : ` upward: as far as the crotch line on each back, and ${d.dartsPerSide.front ? 'the point of the dart' : 'the hip line'} on each front`
          }. Use a press cloth and plenty of steam. A crease pressed now stays sharp.`,
        },
    ...(slant
      ? [
          {
            title: 'Make the slant pockets',
            diagram: 'understitch' as const,
            text: `Pin a pocket lining to each front along the slanted POCKET OPENING edge, right sides together. Sew ${seam} from the edge, trim the seam to 0.5 cm, then press the lining away from the front and understitch it to the seam allowance close to the seam. Turn the lining to the inside, press the opening edge so the lining rolls just out of sight, and topstitch 0.7 cm from the edge if you like. Lay a pocket facing under each lining, right side up toward the lining, matching the curved bag edges, and sew the bag edges together 1 cm in. Zigzag or overlock them together. Then lay the front flat: the facing fills in the corner cut away for the pocket. Match the facing's notch to the foot of the opening, and baste the facing to the front along the waist and down the side edge, inside the seam allowance. From here the front is one piece again.`,
          },
        ]
      : []),
    ...(inseam ? [pocketBagsStep('front and back', rightOnly ? 'of the right leg' : undefined)] : []),
    {
      title: 'Sew the side seams',
      text: sideZip
        ? sideSeam(
            `Pin each front to its back at the side, right sides together, matching the hip${knee} notches. On the right leg, sew the whole side seam ${seam} from the edge. On the left leg, leave the seam open from the waist to the LEFT ZIP ENDS notch, and sew from there to the hem. Press the seams open.`,
          )
        : sideSeam(`Pin each front to its back at the side, right sides together, matching the hip${knee} notches. Sew ${seam} from the edge, from the waist to the hem, and press the seams open over a sleeve board.`),
    },
    {
      title: 'Sew the inside legs',
      text: `Pin each front to its back along the inside leg, right sides together, matching ${d.shorts ? 'the hem ends' : 'the knee notches'} and the crotch points. The back is a little more curved at the top: ease it in rather than stretch it. Sew ${seam} from the edge and press open. You now have two legs.`,
    },
    {
      title: 'Sew the crotch seam',
      text: fly
        ? `Turn one leg right side out and slip it inside the other, so they are right sides together. Match the inside leg seams and pin the crotch seam from the ZIP ENDS notch on the front, round under, and up to the centre back waist. Sew it 1 cm from the edge${narrower}. Then sew the curve a second time, just inside the first row, so the seam is strong where it takes the strain. Clip the curve below the back hip and press the upper part open.`
        : `Turn one leg right side out and slip it inside the other, so they are right sides together. Match the inside leg seams and pin the crotch seam from the centre front waist, round under, and up to the centre back waist. Sew it 1 cm from the edge${narrower}. Then sew the curve a second time, just inside the first row, so the seam is strong where it takes the strain. Clip the curve below the hip and press the upper parts open.`,
    },
    ...(fly
      ? [
          {
            title: 'Put in the fly zip',
            text: `The left and the right here are as you wear the trousers. Sew the fly facing to the left front's centre front edge, right sides together, 1 cm from the edge, from the waist to the ZIP ENDS notch, and press it to the inside. On the right front, press the centre front edge under 0.5 cm, so its fold sits 0.5 cm past the centre front line. Fold the fly shield in half lengthwise, wrong sides together. Lay the ${d.zipCm} cm trouser zip face up under the right front's fold, the fold close to the teeth, with the shield behind the zip, and stitch close to the fold through the front, the zip tape and the shield. Close the zip and lap the left front over it until the two centre front lines meet, so the left edge hides the teeth, and pin. From the inside, stitch the zip's free tape to the fly facing only. Then from the outside stitch the curved fly line through the left front and its facing, keeping the shield clear. Bar-tack across the foot of the fly, through the shield.`,
          },
        ]
      : sideZip
        ? [
            {
              title: 'Put in the side zip',
              text: `The ${d.zipCm} cm invisible zip goes into the open part of the left side seam, the top of its teeth ${waist} below the waist edge, down to the LEFT ZIP ENDS notch, where the seam you sewed below it begins.${INVISIBLE_ZIP_LAY}`,
            },
          ]
        : []),
    ...(elastic
      ? casingSteps(elastic, seam, waist, 'trousers', 'the centre back seam')
      : [
          ...(loops
            ? [
                {
                  title: 'Make the belt loops',
                  text: `Press the belt loop strip into thirds along its length, the raw edges inside, and topstitch close to both long edges. Cut it into ${loops} pieces at the notches. Pin the loops to the right side of the trousers waist: one at the centre back, one at each side seam${loops > 5 ? ', one halfway across each front and one halfway across each back' : ' and one halfway across each front'}. They hang down the leg with their top ends level with the waist edge, so the waistband seam catches them.`,
                },
              ]
            : []),
          {
            title: 'Attach the waistband',
            text: fly
              ? `Pin the ${curved ? "outer band's longer, lower edge" : 'interfaced edge of the waistband'} to the trousers waist, right sides together, matching the notches to the side seams and the centre back seam. The end with the extension goes on the right front, over the fly shield; the other end runs ${seam} past the left front's fly edge, which is the allowance for the seam across the band's end. Sew ${waist} from the edge and press the seam up into the band.`
              : `Pin the ${curved ? "outer band's longer, lower edge" : 'interfaced edge of the waistband'} to the trousers waist, right sides together, matching the notches to the centre front, the centre back and the right side seam. The ends meet at the zip in the left side seam, each a seam allowance past its edge of the opening. Sew ${waist} from the edge and press the seam up into the band.`,
          },
          {
            title: 'Finish the waistband',
            text: `${curved ? `Pin the facing to the outer band along their shorter, top edges, right sides together, and sew ${seam} from the edge, then across each end ${seam} in${fly ? ' and along the extension' : ''}. Trim, clip the curve and the corners, and turn it right side out. Understitch the facing to the seam allowance so it rolls to the inside, and press over a ham to keep the curve. Press under ${seam} on the facing's lower edge, then hand-stitch it over the seam inside.` : `Fold the band along its fold line, right sides together, and sew across each end ${seam} in${fly ? ', and along the extension' : ''}. Trim the corners and turn it right side out. Press under ${seam} on the loose edge, then hand-stitch it over the seam inside, or stitch in the ditch from the outside.`}${loops ? ' Turn each belt loop up over the band, turn its top end under and stitch it across the top of the band by machine, through the loop and the band.' : ''}`,
          },
        ]),
    d.ruffle
      ? {
          title: 'Add the hem ruffles',
          text: `Join each ruffle strip into a ring with a French seam. Roll a narrow hem on one long edge: press up 0.5 cm, then 0.5 cm more, and stitch. Run two rows of long gathering stitches along the other edge, either side of the seam line. Pin it round the leg's hem, right sides together, the seam at the inside leg and the quarter notches spaced evenly, and pull up the gathers to fit. Sew ${seam} from the edge, neaten the seam together and press it up into the leg.`,
        }
      : {
      // The rest of the allowance, not a second number: in inches, 1 cm then 3 cm read 3/8 + 1-1/8 = 1-1/2 in on a
      // 1-5/8 in allowance (pretend tester DO walk, Nov 20).
      title: 'Hem',
      text: `Try the ${things} on with the shoes you will wear and pin up the hem: ${
        culotte
          ? 'culottes sit at mid-calf'
          : finish.length
            ? HEM_AT[finish.length]
            : 'full-length trousers just touch the top of the shoe at the front, ankle-length ones end just above the ankle bone'
      }. Press up 1 cm, then turn up the rest of the ${hem} cm hem allowance, and slip-stitch by hand so no stitches show on the outside.`,
    },
    {
      title: 'Finish',
      text: `${elastic ? ELASTIC_FINISH : fly ? 'Make a buttonhole in the end of the waistband on the left front, the end that laps over, and sew a button to the extension marked UNDERLAP on the right front, or sew on a trouser hook and bar.' : 'Sew a hook and eye at the top of the zip.'}${
        d.pockets !== 'none' ? ' Bar-tack across each end of the pocket openings, by machine or by hand, so they take a hand without tearing.' : ''
      }${d.softPress ? ' Press lightly from the inside, with no crease.' : ' Press the creases again through a press cloth.'}`,
    },
  ];
  return {
    notions: [
      `${fabricM.toFixed(1)} m of woven fabric, ${finish.width ?? 140} cm wide`,
      ...(elastic
        ? elasticNotions(elastic)
        : [fly ? `${d.zipCm} cm trouser zip (metal or nylon, closed end)` : `${d.zipCm} cm invisible zip`, fly ? 'One 1.5 cm button, or a trouser hook and bar' : 'Hook and eye', `0.4 m lightweight fusible interfacing${curved ? longBandInterfacing(d.finishedWaist + d.waistband.underlap) : ''}`]),
      'Matching thread',
    ],
    steps,
  };
}

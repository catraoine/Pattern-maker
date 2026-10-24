// Plain-language sewing steps for trousers, in the app and at the end of the PDF. Plain ASCII only:
// the PDF's standard font has no curly quotes.
import { SEAM_WIDTHS, SeamWidths } from './allowances';
import { ELASTIC_FINISH, POCKET_CUT, casingSteps, elasticNotions, pocketBagsStep, pocketSeamWords } from './instructions';
import type { SewingGuide, SewStep } from './instructions';
import type { TrouserLength, TrousersDraft } from './trousers';

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
export function trousersGuide(d: TrousersDraft, fabricM: number, finish: { seams?: SeamWidths; width?: number; length?: TrouserLength } = {}): SewingGuide {
  const sw = finish.seams ?? SEAM_WIDTHS.home;
  const seam = n1(sw.seam);
  const waist = n1(sw.waist);
  const fly = d.closure === 'fly';
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
      text: 'Print the pattern at 100% (actual size). Measure the test square: it should be exactly 10 cm. Trim each page along the dashed line, then tape the pages together, matching the row letters and column numbers.',
    },
    {
      title: 'Cut out',
      text: `Fold the fabric in half with the selvedges together. Place the trousers front and back on both layers so you get a pair of each, with the crease line on each parallel to the selvedge. Cut along the solid outer line, snip the notches${darts ? ' and chalk-mark the darts' : ''}. Mark the crease line on the wrong side with tailor's chalk.${fly ? ' Cut the fly facing and the fly shield, and the fly facing again from fusible interfacing.' : ''}${pocketCut}`,
    },
    {
      title: 'Cut the waistband',
      text: elastic
        ? 'Cut the waistband from its pattern piece with the grain along its length. It is a casing for the elastic, as long as the trousers waist so they pull on over your hips, and it has no interfacing so it can gather. Snip the notches for the side seams and the centre front.'
        : `Cut the waistband from its pattern piece with the grain along its length, and fuse interfacing to the outer half. Snip the notches for the ${fly ? 'centre fronts, side seams and centre back' : 'side seams, centre front and centre back'}.`,
    },
    {
      title: 'Neaten the edges',
      diagram: 'overlock',
      text: `Zigzag or overlock the side seams, the inside legs and the crotch seams of every piece${fly ? ', and the curved edge of the fly facing and the long edge of the fly shield once folded' : ''}${slant ? ', and the side edges of the pocket facings' : ''}.`,
    },
    ...(darts
      ? [
          {
            title: `Sew the ${darts} darts`,
            text: 'Fold each dart with right sides together so the dart lines meet. Stitch from the waist to the point, running off the fold, and knot the threads. Press front darts toward the centre front and back darts toward the centre back.',
          },
        ]
      : []),
    {
      title: 'Press the creases',
      text: `Fold each front and each back along its chalked crease line, wrong sides together, and press the crease in from the hem${d.shorts ? '' : ' up to the knee'}${
        culotte ? '' : ` and on up to the crotch line on the back, ${d.dartsPerSide.front ? 'to the dart' : 'to the hip line'} on the front`
      }. Use a press cloth and plenty of steam. A crease pressed now stays sharp.`,
    },
    ...(slant
      ? [
          {
            title: 'Make the slant pockets',
            diagram: 'understitch' as const,
            text: `Pin a pocket lining to each front along the slanted POCKET OPENING edge, right sides together. Sew ${seam} from the edge, trim the seam to 0.5 cm, then press the lining away from the front and understitch it to the seam allowance close to the seam. Turn the lining to the inside, press the opening edge so the lining rolls just out of sight, and topstitch 0.7 cm from the edge if you like. Lay a pocket facing under each lining, right side up toward the lining, matching the curved bag edges, and sew the bag edges together 1 cm in. Zigzag or overlock them together. Then lay the front flat: the facing fills in the corner cut away for the pocket. Match the facing's notch to the foot of the opening, and tack the facing to the front along the waist and down the side edge, inside the seam allowance. From here the front is one piece again.`,
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
        ? 'Turn one leg right side out and slip it inside the other, so they are right sides together. Match the inside leg seams and pin the crotch seam from the ZIP ENDS notch on the front, round under, and up to the centre back waist. Sew it 1 cm from the edge twice, the second row just inside the first through the curve. Clip the curve below the back hip and press the upper part open.'
        : `Turn one leg right side out and slip it inside the other, so they are right sides together. Match the inside leg seams and pin the crotch seam from the centre front waist, round under, and up to the centre back waist. Sew it 1 cm from the edge twice, the second row just inside the first through the curve. Clip the curve below the hip and press the upper parts open.`,
    },
    ...(fly
      ? [
          {
            title: 'Put in the fly zip',
            text: `Sew the fly facing to the left front's centre front edge, right sides together, from the waist to the ZIP ENDS notch, and press it to the inside. Fold the fly shield in half lengthwise, wrong sides together. Lay the ${d.zipCm} cm trouser zip face up under the right front's centre edge, with the shield behind it, and stitch the right front close to the teeth through all layers. Close the zip, lap the left front over it to the centre front line, and from the outside stitch the curved fly line through the front and the facing only, keeping the shield clear. Bar-tack across the foot of the fly.`,
          },
        ]
      : sideZip
        ? [
            {
              title: 'Put in the side zip',
              text: `Sew a ${d.zipCm} cm invisible zip into the open part of the left side seam, the top of the teeth ${waist} below the waist edge, stopping at the LEFT ZIP ENDS notch, where the seam you sewed below it begins.`,
            },
          ]
        : []),
    ...(elastic
      ? casingSteps(elastic, seam, waist, 'trousers', 'the centre back seam')
      : [
          {
            title: 'Attach the waistband',
            text: fly
              ? `Pin the interfaced edge of the waistband to the trousers waist, right sides together, matching the notches to the side seams and the centre back seam. The end with the extension goes on the right front, over the fly shield; the other end is level with the left front's fly edge, plus ${seam}. Sew ${waist} from the edge and press the seam up into the band.`
              : `Pin the interfaced edge of the waistband to the trousers waist, right sides together, matching the notches to the centre front, the centre back and the right side seam. The ends meet the zip at the left side, the extension end on the back. Sew ${waist} from the edge and press the seam up into the band.`,
          },
          {
            title: 'Finish the waistband',
            text: `Fold the band along its fold line, right sides together, and sew across each end ${seam} in, and along the extension. Trim the corners and turn it right side out. Press under ${seam} on the loose edge, then hand-stitch it over the seam inside, or stitch in the ditch from the outside.`,
          },
        ]),
    {
      title: 'Hem',
      text: `Try the ${things} on with the shoes you will wear and pin up the hem: ${
        culotte
          ? 'culottes sit at mid-calf'
          : finish.length
            ? HEM_AT[finish.length]
            : 'full-length trousers just touch the top of the shoe at the front, ankle-length ones end just above the ankle bone'
      }. Press up 1 cm, then ${Math.max(1, hem - 1)} cm more, and slip-stitch by hand so no stitches show on the outside.`,
    },
    {
      title: 'Finish',
      text: `${elastic ? ELASTIC_FINISH : fly ? 'Make a buttonhole in the waistband extension and sew a button to the underlap, or sew on a trouser hook and bar.' : 'Sew a hook and eye at the top of the zip.'}${
        d.pockets !== 'none' ? ' Bar-tack across each end of the pocket openings, by machine or by hand, so they take a hand without tearing.' : ''
      } Press the creases again through a press cloth.`,
    },
  ];
  return {
    notions: [
      `${fabricM.toFixed(1)} m of woven fabric, ${finish.width ?? 140} cm wide`,
      ...(elastic
        ? elasticNotions(elastic)
        : [fly ? `${d.zipCm} cm trouser zip (metal or nylon, closed end)` : `${d.zipCm} cm invisible zip`, fly ? 'One 1.5 cm button, or a trouser hook and bar' : 'Hook and eye', '0.4 m lightweight fusible interfacing']),
      'Matching thread',
    ],
    steps,
  };
}

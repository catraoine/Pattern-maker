// Plain-language sewing steps for a jacket or a coat, in the app and at the end of the PDF: interfacing,
// the shell, the collar and facings, set-in sleeves, then a bagged lining. Plain ASCII only: the PDF's
// standard font has no curly quotes.
import { SEAM_WIDTHS, SeamWidths } from './allowances';
import type { SewingGuide, SewStep } from './instructions';
import type { OuterDraft } from './outerwear';

const n1 = (v: number) => `${v} cm`;

export function outerGuide(d: OuterDraft, fabricM: number, finish: { seams?: SeamWidths; width?: number; liningM?: number; interfacingM?: number } = {}): SewingGuide {
  const sw = finish.seams ?? SEAM_WIDTHS.home;
  const seam = n1(sw.seam);
  const curve = n1(sw.curve);
  const kind = d.kind;
  const [over, under] = d.lapsLeft ? ['left', 'right'] : ['right', 'left'];
  const names = d.pieces.map((pc) => pc.name);
  const princess = names.some((n) => /side front/i.test(n));
  // A princess front may have no front lining: the facing is then the whole centre front panel, cut to
  // the princess seam, and the side front lining joins it there.
  const panelFacing = princess && !names.some((n) => /^front lining$/i.test(n));
  const collar = names.includes('Collar') ? (d.lapel ? 'notched' : 'stand') : 'none';
  const pockets = names.includes('Patch pocket');
  const welts = names.includes('Welt');
  const tailored = names.includes('Top sleeve');
  const vent = d.vent;
  const darts = !princess && d.base.bustDart > 0.3;
  const waistDarts = !princess && (d.base.waistDarts.front > 0.3 || d.base.waistDarts.back > 0.3);
  const count = d.buttons.at.length * d.buttons.columns.length;
  const holes = d.buttons.at.length;
  const hem = d.pieces[0].allowances['opening-hem'] ?? 4;
  const sleeveHem = d.sleeve.pieces[0].allowances.hem ?? 4;
  const width = finish.width ?? 140;

  const notions = [
    `${fabricM} m of ${width} cm wide fabric`,
    ...(finish.liningM ? [`${finish.liningM} m of lining`] : []),
    `${finish.interfacingM ?? (kind === 'coat' ? 1.5 : 1)} m of fusible weft interfacing`,
    `${count} buttons, ${n1(d.buttons.sizeCm)} across${d.buttons.columns.length > 1 ? `, plus one small button for the inside` : ''}`,
    ...(d.pads ? [`A pair of set-in shoulder pads, ${d.pads < 1 ? `${Math.round(d.pads * 10)} mm` : n1(d.pads)} thick: the shoulders are drafted for them`] : []),
    ...(welts ? ['A strip of lining or pocketing for the pocket bags'] : []),
    'Matching thread, and silk thread for the buttonholes if you sew them by hand',
  ];

  const steps: SewStep[] = [
    {
      title: 'Print and check the size',
      text: 'Print the pattern at 100% (actual size). Measure the test square: it should be exactly 10 cm. Trim each page along the dashed line, then tape the pages together, matching the row letters and column numbers.',
    },
    {
      title: 'Cut the fabric',
      text: `Fold the fabric in half with the selvedges together. Cut the ${princess ? 'centre fronts, side fronts, side backs' : 'fronts'}${vent ? ', the backs' : ''} and the ${tailored ? 'top and under sleeves' : 'sleeves'} on both layers so you get pairs${vent ? '' : ', and the back on the fold'}. Cut the front facings${collar !== 'none' ? ' and the collar' : ''}${pockets ? ' and the pockets' : ''}${welts ? ', the welts and the pocket facings' : ''} too. Keep each grain arrow parallel to the selvedge. Snip the notches and chalk-mark the ${darts || waistDarts ? 'darts, the ' : ''}buttonholes${d.lapel ? ', the roll line' : ''}${pockets ? ' and the pocket corners' : ''}${welts ? ' and the welt pocket boxes' : ''}${vent ? ' and the top of the vent' : ''}.`,
    },
    {
      title: 'Cut the lining',
      text: vent
        ? `Cut the ${panelFacing ? '' : 'front linings, '}${princess ? 'side front linings, ' : ''}two back linings${princess ? ', side back linings' : ''} and the ${tailored ? 'top and under sleeve linings' : 'sleeve linings'} from the lining fabric${welts ? ', and four pocket bags' : ''}. Cut the left back lining on the main line and the right one on the second line, which stops short at the vent. Each back lining is wider at the centre back for a pleat that gives you room to reach forward.${panelFacing ? ' There is no front lining: the front facing is the whole centre front panel, cut to the princess seam.' : ''}`
        : `Cut the ${panelFacing ? '' : 'front linings, '}${princess ? 'side front linings, ' : ''}the back lining on the fold${princess ? ', side back linings' : ''} and the ${tailored ? 'top and under sleeve linings' : 'sleeve linings'} from the lining fabric${welts ? ', and four pocket bags' : ''}. The back lining is wider at the centre back for a pleat that gives you room to reach forward.${panelFacing ? ' There is no front lining: the front facing is the whole centre front panel, cut to the princess seam.' : ''}`,
    },
    {
      title: 'Interface',
      text: `Fuse interfacing to the wrong side of the front facings${collar !== 'none' ? ', both collar pieces' : ''}, and the top 10 cm of each ${princess ? 'centre front' : 'front'} and the back${pockets ? ', and the top fold of each pocket' : ''}${welts ? ', the welts, and a 5 cm strip behind each welt pocket box' : ''}${vent ? ', and the vent underlaps' : ''}. Fuse a 5 cm strip along the hem of every shell piece and the sleeve hems. Use a press cloth and hold the iron still for 10 seconds at a time; let each piece cool flat before you move it.`,
    },
    ...(darts || waistDarts
      ? [
          {
            title: 'Sew the darts',
            text: `Fold each dart right sides together, matching the lines, and stitch to the point, running off the fold. The waist darts are fish-eye darts, pointed at both ends: sew from one point to the other. Press bust darts down, waist darts toward the centre. In thick cloth, slash the darts open and press them flat.`,
          },
        ]
      : []),
    ...(princess
      ? [
          {
            title: 'Sew the princess seams',
            text: `Pin each side front to its centre front, matching the notches, and ease the side front over the bust. Sew ${seam} from the edge, clip the curve and press the seams open over a tailor's ham. Sew the side backs to the back the same way.`,
          },
        ]
      : []),
    ...(pockets
      ? [
          {
            title: 'Make and sew on the patch pockets',
            text: 'Fold the top of each pocket to the outside along the fold line and stitch the sides 1 cm in. Turn it right side out and press. Press the curved edges under 1 cm, easing the corners with a gathering stitch. Pin each pocket on its marks and topstitch close to the edge, with a small triangle of stitching at each top corner for strength.',
          },
        ]
      : []),
    ...(welts
      ? [
          {
            title: 'Make the welt pockets',
            text: `Fold each welt in half lengthwise, right side out, and press. Lay it on the front below its box, raw edges up to the box's lower line, and stitch along that line from end to end. Lay a pocket facing, edge to the box's upper line, and stitch along it, stopping 0.5 cm short of each end. Cut through the front between the lines and into each corner in a small V, stopping just short of the stitching. Push the facing through, flip the welt up over the opening and press. Sew a pocket bag to the welt's seam allowance and another to the facing's, then sew the two bags together round their edges, catching the little triangles at the ends. Slip-stitch the welt's ends down by hand.`,
          },
        ]
      : []),
    ...(vent
      ? [
          {
            title: 'Sew the centre back and the vent',
            text: `Sew the backs together down the centre back, from the neck to the vent mark, and pivot to stitch across the top of the vent along its slanted edge. Clip into the corner on the right back only, and press the seam open above the vent. Fold the right back's underlap to the inside along the centre back line as a facing; the left back's lies flat under it. From the outside, stitch a short slanted line through all layers at the top of the vent to hold it.`,
          },
        ]
      : []),
    {
      title: 'Sew the shoulders and side seams',
      text: `Sew the fronts to the back at the shoulders, right sides together, easing the back shoulder in to fit (it is 1 cm longer). Sew the side seams, matching the notches. Press every seam open over a sleeve board or a ham.`,
    },
    ...(collar === 'notched'
      ? [
          {
            title: 'Sew the collar to the jacket',
            text: `Use one collar as the under collar. Sew it to the neck of the ${kind} from one gorge mark to the other, matching the centre back notch, and stop exactly at the end of each gorge line. Clip the neck seam allowance at the shoulder seams and press the seam open.`,
          },
          {
            title: 'Sew the upper collar to the facings',
            text: 'Sew the other collar, the upper collar, to the neck edge of each front facing, from the gorge mark to the shoulder end of the facing. Its middle stays free for now: it is sewn to the back neck of the lining later. Press the seams open.',
          },
          {
            title: 'Join the collar and lapels',
            text: `Pin the facings and upper collar to the ${kind} right sides together, matching the gorge seams exactly. Sew round the outer edge of the collar, pivot at the notches without stitching across the seam, and carry on down the lapels to the break point and the front edge to the hem. Trim, clip the notch corners, and turn. Roll the lapels and collar along the roll line and press so the seam rolls just to the underside.`,
          },
        ]
      : [
          {
            title: collar === 'stand' ? 'Sew the stand collar' : 'Face the neck and front',
            text:
              collar === 'stand'
                ? `Sew one collar piece to the neck of the ${kind}, matching the centre back and the ends to the front edges. Sew the other to the neck edge of each front facing, from the front edge to the shoulder end of the facing; its middle stays free for now and is sewn to the lining's back neck later. Pin the facings to the fronts right sides together and sew up each front edge, round the collar and down the other front. Trim, clip the curves and turn.`
                : `Pin the front facings to the fronts right sides together, and sew up each front edge and round the neck as far as the shoulder seam, ${curve} from the edge. Trim and clip the curve, then understitch the facing and press it to the inside. The back neck is finished by the lining.`,
          },
        ]),
    {
      title: 'Set in the sleeves',
      text: `${tailored ? 'Sew each top sleeve to its under sleeve along the back seam, then the front seam, matching the elbow notches, and press both seams open over a sleeve board' : `Sew each sleeve seam${d.sleeve.elbowDart ? ' (sew the elbow dart first)' : ''} and press it open`}. Run two rows of long stitches round the crown between the notches and draw them up a little: the crown is ${Math.round((d.sleeve.crownEase.front + d.sleeve.crownEase.back) * 10) / 10} cm longer than the armhole, and shrinking that ease over a ham with steam gives a smooth, round head. Pin the sleeve in, matching the crown notch to the shoulder seam and the double notches at the back, and sew from the sleeve side. Sew again in the underarm and trim it there.${d.pads ? ' Slip the shoulder pads in, their straight edge 1 cm past the armhole seam and their middle notch on the shoulder seam, and tack them by hand to the shoulder and armhole seam allowances.' : ''}`,
    },
    {
      title: 'Hem the shell',
      text: `Turn up the ${kind} hem by ${n1(hem)} and the sleeve hems by ${n1(sleeveHem)}, press, and catch-stitch the raw edges by hand to the interfacing. Leave the front facings unfolded at the hem for now.${vent ? ' At the vent, mitre the corner of the right back facing and turn the left back underlap\'s hem up with the rest.' : ''}`,
    },
    {
      title: 'Make the lining',
      text: `${
        panelFacing
          ? `Sew each side back lining to its back lining along the princess seam, ${seam} from the edge, and press the seam open. `
          : princess
            ? `Sew each side front lining to its front lining and each side back lining to its back lining along the princess seams, ${seam} from the edge, and press the seams open. `
            : ''
      }${vent ? 'Sew the back linings together down the centre back to just above the vent, then tack the pleat' : 'Tack the back lining pleat'} along its line, 8 cm down from the neck. Sew the lining's shoulders, side seams and sleeve seams, and set the sleeve linings into the armholes, leaving a 25 cm gap in one sleeve lining seam for turning. ${panelFacing ? `Sew each side front lining to its front facing along the princess seam, right sides together, ${seam} from the edge, so the facing is the lining's centre front panel` : 'Sew the lining to the inner edges of the front facings'}${
        collar === 'notched' ? " and the upper collar to the lining's back neck" : collar === 'stand' ? " and the inner collar to the lining's back neck" : `, and its back neck to the ${kind}'s back neck between the shoulder seams, right sides together`
      }, matching the notches.`,
    },
    {
      title: 'Bag the lining',
      text: `With the ${kind} and its lining right sides together, sew the lining to the hem allowance of the ${kind} all round, 1 cm from the lining's edge, so a small fold of lining (the jump hem) stands below the stitching.${vent ? " Sew the back linings' lower edges round the vent: the left one to the underlap's edge, the right one to the vent facing's edge." : ''} Reach into each sleeve and sew the sleeve lining hems to the sleeve hems the same way. Turn the ${kind} right side out through the gap in the sleeve lining, then close the gap by machine close to the edge.`,
    },
    {
      title: 'Buttonholes and buttons',
      text: `Mark ${holes} buttonholes on the ${over} front (as you wear it) where the pattern shows them, ${n1(d.buttons.sizeCm + 0.3)} long. Sew them by machine or by hand with buttonhole twist, and cut them open. Sew the buttons to the ${under} front to match${d.buttons.columns.length > 1 ? `, and the second column on the ${over} front as the pattern shows; sew the small button inside the ${under} front to hold the underlap` : ''}, on a thread shank as long as the cloth is thick.`,
    },
    {
      title: 'Final press',
      text: `Press the whole ${kind} from the wrong side with a press cloth, ${d.lapel ? 'rolling the lapels over your hand rather than pressing a crease into the roll line, and ' : ''}letting each part cool before it moves.`,
    },
  ];
  return { notions, steps };
}

// Plain-language sewing steps for the soft lingerie and swimwear, on a home machine with a zigzag or an
// overlocker. Plain ASCII only: the PDF's standard font has no curly quotes.
import type { SewingGuide, SewStep } from './instructions';
import { HOOK_TAPE, LINGERIE_SEAM, LOOP_OVERLAP, LingerieDraft, SNAP_OVERLAP, isSwim } from './lingerie';

const cm = (v: number) => `${Math.round(v * 10) / 10} cm`;

/** Elastic to buy: one total per width, with a little over for trying it on. */
export function elasticToBuy(d: LingerieDraft): { width: number; metres: number }[] {
  const byWidth = new Map<number, number>();
  for (const e of d.elastic) byWidth.set(e.width, (byWidth.get(e.width) ?? 0) + e.length * e.count);
  return [...byWidth.entries()].sort((a, b) => b[0] - a[0]).map(([width, total]) => ({ width, metres: Math.ceil((total + 20) / 10) / 10 }));
}

/** Notions, then the steps in sewing order: the elastic lengths come from the draft. */
export function lingerieGuide(d: LingerieDraft, fabricM: number, finish: { width?: number } = {}): SewingGuide {
  const { piece, closure } = d.style;
  const swim = isSwim(piece);
  const seam = cm(LINGERIE_SEAM);
  const hasTop = piece === 'bralette' || piece === 'bikini';
  const hasBottom = piece !== 'bralette';
  const onePiece = piece === 'bodysuit' || piece === 'swimsuit';
  const snaps = piece === 'bodysuit' && closure === 'snaps';
  const kind = swim ? 'swim elastic (rubber or chlorine-resistant)' : 'plush-back lingerie elastic';
  const fabric = swim ? 'swim Lycra (nylon or polyester with elastane), and the same again in swim lining' : 'knit fabric: jersey, stretch lace or power mesh';
  const width = finish.width ? ` (${finish.width} cm wide)` : '';
  const notions = [
    `${fabricM} m of ${fabric}${width}`,
    ...(hasBottom && !swim ? ['A scrap of cotton jersey for the gusset lining'] : []),
    ...(onePiece ? [`A piece of ${swim ? 'swim lining' : 'power mesh'} for the shelf, about 30 cm`] : []),
    ...elasticToBuy(d).map((e) => `${e.metres} m of ${cm(e.width)} ${e.width <= 0.8 ? 'picot-edge ' : ''}${kind}`),
    ...(hasTop
      ? [
          '2 strap sliders and 2 rings, the width of the strap elastic',
          swim ? 'A swim clasp (plastic or coated metal, so it does not rust in salt water or chlorine)' : `Hook-and-eye tape, 2 rows, the height of the band, about ${cm(HOOK_TAPE)} wide closed`,
        ]
      : []),
    ...(snaps ? ['10 cm of snap tape, or 3 sew-on snaps'] : []),
    `Polyester thread, and a ${swim ? 'stretch needle (75 or 90; a ballpoint skips stitches on Lycra)' : 'ballpoint or stretch needle (75)'}`,
    'The cut lengths of every elastic are listed in the measurement table at the front of the pattern.',
  ];
  const foldPieces = onePiece ? 'the front, back and shelf' : hasBottom ? 'the front and back' : 'the band';
  const steps: SewStep[] = [
    {
      title: 'Print and check the size',
      text: 'Print the pattern at 100% (actual size). Measure the test square: it should be exactly 10 cm. Trim each page along the dashed line, then tape the pages together, matching the row letters and column numbers.',
    },
    {
      title: 'Cut out',
      text: `Keep the fabric on the table, so nothing stretches as you cut, with the most stretch going round the body. First fold it, right sides together, with the fold running down its length, and cut ${foldPieces} with their centre edge on the fold. Then open the rest out to a single layer, right side up, and cut the ${[hasTop ? 'cups' : '', hasBottom ? 'gusset' : ''].filter(Boolean).join(' and ')} as the pattern says, turning the pattern over for the second of a pair.${swim ? ' Cut every piece again in the swim lining.' : hasBottom ? ' Cut one gusset in your knit and one in the cotton jersey.' : ''} Snip the notches no deeper than 3 mm.`,
    },
    {
      title: 'Set up your machine',
      text: `Use polyester thread and a ${swim ? 'stretch needle' : 'ballpoint or stretch needle'}. Sew every seam ${seam} from the edge with a narrow zigzag (width 1.5 mm, length 2 mm) or an overlocker. For the elastic you need a wide zigzag or a three-step zigzag. Try both on a scrap first: the seam should stretch with the fabric without the stitches popping.`,
    },
  ];
  if (swim) {
    steps.push({
      title: 'Join the lining',
      text: 'Lay each lining piece on the wrong side of its Lycra piece and baste them together round every edge, inside the seam allowance. From here on, sew each pair as one layer.',
    });
  }
  if (hasBottom && !snaps) {
    steps.push({
      title: 'Sew the gusset',
      text: swim
        ? `Pin the gusset's narrow end to the front and its wide end to the back, right sides together, and sew ${seam} from the edge.`
        : `Make a sandwich at the back crotch: the back between the knit gusset (right side to the back's right side) and the cotton gusset (right side to the back's wrong side), wide ends to the back. Sew through all three ${seam} from the edge. Roll the front up inside, pin the narrow ends of both gussets to it the same way, and sew. Turn it out through the leg: both seams are now hidden.`,
    });
  }
  if (snaps) {
    steps.push({
      title: 'Sew the snap gusset',
      text: `Sew the front gusset half to the front and the back half to the back, each with its cotton lining, the same sandwich way: the knit half right side to the right side, the cotton half to the wrong side, then turn them out. Baste the leg edges of each half together. Sew the socket side of the snap tape to the inside of the front half's free end and the ball side to the outside of the back half's, so the front laps ${cm(SNAP_OVERLAP)} over the back.`,
    });
  }
  if (onePiece) {
    steps.push(
      {
        title: 'Make the shelf',
        text: `Lay the shelf elastic on the wrong side of the shelf's lower edge, zigzag it on, stretching it a little, then fold it up and topstitch. Lay the shelf on the wrong side of the front, matching the neckline, shoulders and armholes, and baste round them. Its sides are basted into the side seams in the next step.`,
      },
      {
        title: 'Sew the shoulders and sides',
        text: `Pin the front to the back at the shoulders and down each side, right sides together, matching the notches. Sew ${seam} from the edge and press the seams toward the back with a cool iron.`,
      },
    );
  } else if (hasBottom) {
    steps.push({ title: 'Sew the sides', text: `Pin the front to the back at each side, right sides together, and sew ${seam} from the edge.` });
  }
  if (hasTop) {
    steps.push(
      {
        title: 'Sew the cups',
        text: d.seamedCup
          ? `Each cup is two pieces. Pin the centre piece to the side piece along their seam, right sides together, matching the notch at the bust point, and sew ${seam} from the edge, easing round the point. Press the seam toward the centre. Pin each cup's lower edge to the band, right sides together, from the centre front to the CUP ENDS notch, and sew.`
          : `Fold each cup's dart right sides together and sew it from the edge to the point, tapering off the fold. Press it toward the centre. Pin each cup's lower edge to the band, right sides together, from the centre front to the CUP ENDS notch, and sew ${seam} from the edge.`,
      },
      {
        title: 'Elastic on the cups and band',
        text: `Each cup has two elastics: one up the neck edge and one up the underarm edge, each running to the flat tab at the top. Lay each on the right side, its picot edge pointing into the cup, and zigzag along its inner edge, stretching the elastic a little, not the fabric. Fold it to the inside and topstitch with a three-step zigzag. Sew the band elastic along the lower edge of the band the same way, stretching it evenly; the allowance there is as wide as the elastic.`,
      },
      {
        title: 'Straps and back',
        text: `Each strap is ${cm(d.strap ?? 30)} of strap elastic. Stitch a ring to each cup's tab with a short loop of elastic. Thread the strap through the slider, round the ring and back through the slider, then stitch the end down. Stitch the other end to the back band at the STRAP notch. ${swim ? 'Sew the swim clasp to the band ends at the centre back.' : 'Sew the hook side of the tape to one band end and the eye side to the other, at the centre back: the band is cut short by the tape, so it closes at size on the middle row.'}`,
      },
    );
  }
  if (hasBottom) {
    const openings = onePiece ? 'the neckline, each armhole and each leg' : 'the waist and each leg';
    steps.push(
      {
        title: 'Elastic at the openings',
        text: `Each elastic is cut shorter than its edge, so it holds the edge close to you. Join each into a loop, overlapping the ends ${cm(LOOP_OVERLAP)} (the cut length allows for this), and zigzag across. Pin it to the wrong side of ${openings}, matching its join to a side seam, and zigzag along its outer edge. Fold it to the inside and topstitch through all layers with a three-step zigzag. The allowance on each edge is as wide as its elastic, so it turns once and covers it.`,
      },
      {
        title: 'How to stretch the leg elastic',
        text: 'Not evenly: that makes the back ride up and the front gape. From the side seam to the front gusset seam, let the elastic lie almost flat, barely stretched. From the side seam round the seat to the back gusset seam, stretch it firmly: this is where it holds the brief in place. Pin it that way before you sew.',
      },
    );
  }
  steps.push({
    title: 'Try it on',
    text: swim
      ? 'Try it on dry. Then rinse it in cool fresh water after every swim and dry it flat in the shade: chlorine and sun break down elastane. Never iron Lycra. If anything gapes, rides up or digs, say so on the style screen and the pattern is redrawn.'
      : 'Try it on. If anything gapes, rides up or digs, say so on the style screen under "How did it fit?" and the pattern is redrawn for the next one. Wash it cool and dry it flat.',
  });
  return { notions, steps };
}

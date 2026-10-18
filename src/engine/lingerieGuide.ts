// Plain-language sewing steps for the soft lingerie and swimwear, on a home machine with a zigzag or an
// overlocker. Plain ASCII only: the PDF's standard font has no curly quotes.
import type { SewingGuide, SewStep } from './instructions';
import { LINGERIE_SEAM, LingerieDraft, isSwim } from './lingerie';

const cm = (v: number) => `${v} cm`;

/** Notions, then the steps in sewing order: the elastic lengths come from the draft. */
export function lingerieGuide(d: LingerieDraft, fabricM: number, finish: { width?: number } = {}): SewingGuide {
  const { piece } = d.style;
  const swim = isSwim(piece);
  const seam = cm(LINGERIE_SEAM);
  const hasTop = piece === 'bralette' || piece === 'bikini';
  const hasBottom = piece !== 'bralette';
  const onePiece = piece === 'bodysuit' || piece === 'swimsuit';
  const elastic = d.elastic.map((e) => `${e.edge}: ${cm(e.length)} of ${cm(e.width)} ${swim ? 'swim (rubber or chlorine-resistant)' : 'plush-back'} elastic`);
  const fabric = swim ? 'swim Lycra (nylon or polyester with elastane), and the same again in swim lining' : 'knit fabric: jersey, stretch lace or power mesh';
  const width = finish.width ? ` (${finish.width} cm wide)` : '';
  const notions = [
    `${fabricM} m of ${fabric}${width}`,
    ...(hasBottom && !swim ? ['A scrap of cotton jersey for the gusset lining'] : []),
    ...elastic,
    ...(hasTop ? ['2 strap sliders and 2 rings, the width of the strap elastic, and a hook-and-eye or clasp for the back'] : []),
    'Polyester thread, and a ballpoint or stretch needle (size 75)',
  ];
  const steps: SewStep[] = [
    {
      title: 'Print and check the size',
      text: 'Print the pattern at 100% (actual size). Measure the test square: it should be exactly 10 cm. Trim each page along the dashed line, then tape the pages together, matching the row letters and column numbers.',
    },
    {
      title: 'Cut out',
      text: `Lay the knit flat in a single layer, right side up, with the most stretch going round the body. Keep it all on the table so nothing stretches as you cut. Cut each piece as the pattern says, flipping it over for the second of a pair.${swim ? ' Cut every piece again in the swim lining.' : ''}${hasBottom && !swim ? ' Cut one gusset from your knit and one from the cotton jersey.' : ''} Snip the notches no deeper than 3 mm.`,
    },
    {
      title: 'Set up your machine',
      text: `Fit a ballpoint or stretch needle and use polyester thread. Sew every seam ${seam} from the edge with a narrow zigzag (width 1.5 mm, length 2 mm) or an overlocker. For the elastic you need a wide zigzag or a three-step zigzag. Try both on a scrap first: the seam should stretch with the fabric without the stitches popping.`,
    },
  ];
  if (swim) {
    steps.push({
      title: 'Join the lining',
      text: 'Lay each lining piece on the wrong side of its Lycra piece and baste them together round every edge, inside the seam allowance. From here on, sew each pair as one layer.',
    });
  }
  if (hasBottom) {
    steps.push({
      title: 'Sew the gusset',
      text: swim
        ? `Pin the gusset to the front at its narrow end and to the back at its wide end, right sides together, and sew ${seam} from the edge.`
        : `Make a sandwich at the back crotch: the back between the knit gusset (right side to the back's right side) and the cotton gusset (right side to the back's wrong side). Sew through all three ${seam} from the edge. Roll the front up inside, pin the other ends of both gussets to it the same way, and sew. Turn it out through the leg: both seams are now hidden.`,
    });
  }
  if (onePiece) {
    steps.push({
      title: 'Sew the shoulders and sides',
      text: `Pin the front to the back at the shoulders and down each side, right sides together, matching the notches. Sew ${seam} from the edge and press the seams toward the back with a cool iron.`,
    });
  } else if (hasBottom) {
    steps.push({ title: 'Sew the sides', text: `Pin the front to the back at each side, right sides together, and sew ${seam} from the edge.` });
  }
  if (hasTop) {
    steps.push(
      {
        title: 'Sew the cups',
        text: `Fold each cup's dart right sides together and sew it from the edge to the point, tapering off the fold. Press it toward the centre. Pin each cup's lower edge to the band, right sides together, the cups meeting at the centre front, and sew ${seam} from the edge.`,
      },
      {
        title: 'Elastic on the cups and band',
        text: `Lay the cup elastic on the right side of each cup's top edges, its decorative edge pointing inward, and zigzag along its inner edge, stretching the elastic a little, not the fabric. Fold it to the inside and topstitch with a three-step zigzag. Sew the band elastic along the lower edge of the band the same way, stretching it evenly all round.`,
      },
      {
        title: 'Straps and back',
        text: `Each strap is ${cm(d.strap ?? 30)} of strap elastic: thread one end through the slider, round the ring and back through the slider, then stitch the end down. Stitch the ring end to the top of the cup and the other end to the back band. Sew the hook-and-eye to the ends of the band, so it closes at the centre back.`,
      },
    );
  }
  const openings = onePiece ? 'the neckline, each armhole and each leg' : hasBottom ? 'the waist and each leg' : '';
  if (openings) {
    steps.push({
      title: 'Elastic at the openings',
      text: `Each elastic is cut shorter than its edge, so it holds the edge close to you. Join each one into a loop, overlapping the ends 1 cm, and zigzag across. Mark the loop and its opening in quarters with pins. Pin the elastic to the wrong side of ${openings}, matching the pins, and zigzag along its outer edge, stretching the elastic between the pins, not the fabric. Fold it to the inside and topstitch through all layers with a three-step zigzag.`,
    });
  }
  steps.push({
    title: 'Finish',
    text: swim
      ? 'Rinse it in cool fresh water after every swim and dry it flat in the shade: chlorine and sun break down elastane. Never iron Lycra.'
      : 'Try it on. If a leg or neckline gapes, pull a little more elastic through and restitch that section. Wash it cool and dry it flat.',
  });
  return { notions, steps };
}

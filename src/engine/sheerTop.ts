// A top in sheer cloth (silk organza, chiffon) finished so the inside is as clean as the outside, since through a sheer
// every seam, dart and zip tape shows (SS27 Look 04, the Ice Peplum Top, Nov 11: it was sewn with overlocked seams, a
// 50 cm invisible zip and a bought bias binding, all of which read as dark lines through ice organza). Seams are French,
// the armholes and the peplum join are bound in the same cloth, and the neck is bound in it too. A look can also close
// the back with a row of small buttons and rouleau loops in place of the zip (backLoops).
import type { SewStep, SewingGuide } from './instructions';
import type { BodiceDraft } from './bodice';
import { KEYHOLE } from './backNeck';

/** The space between the buttons down a looped back, in cm: close enough that the edges never gape between them. */
export const LOOP_GAP = 2.5;

/** How many buttons and loops close a back opening `cm` long, the first 1 cm below the neck. */
const loopCount = (cm: number): number => Math.max(3, Math.floor((cm - 1) / LOOP_GAP) + 1);

/** What of a top's draft says how long its back opening is. */
type LoopedBack = Pick<BodiceDraft, 'zipCm' | 'back' | 'pieces'>;

/** How many buttons and loops close this back. The last loop sits at least 1 cm above the foot of the opening: counted
 *  from the zip's length alone, a back that opens right down to a peplum seam was given a loop to sew 1.5 cm past its
 *  lower edge (the Ice Peplum at a 105 cm hip: 20 loops for a 47 cm back; tester pattern review, Nov 13). */
export function loopsFor(d: LoopedBack): number {
  // A keyhole takes the top of the back: the buttons start below it, so its length is not theirs to fill.
  const keyhole = d.pieces.some((pc) => pc.meta.backNeck === 'keyhole') ? KEYHOLE.length : 0;
  const opening = d.back.zipEnd.y - d.back.neckCentre.y - keyhole;
  return loopCount(Math.min(d.zipCm, opening - 1));
}

/** How a French seam is sewn, as a sentence on its own. */
const FRENCH = (seam: string, toward = 'the back') =>
  `With the pieces wrong sides together, sew 0.6 cm outside the stitching line, in the ${seam} allowance. Trim to 0.3 cm and press, then fold right sides together along the seam, press again and sew on the stitching line, enclosing the raw edges. Press it toward ${toward}`;

/** A narrow binding cut from the sheer itself, for the edges a French seam cannot go round. */
const SELF_BIND =
  'Cut 2.5 cm bias strips from the same sheer. Trim the seam to 0.6 cm, lay a strip over it right sides together, sew 0.5 cm from the edge, wrap the strip round the raw edges and slip-stitch its fold down by hand over the stitching';

/** The sewing guide for a top in sheer cloth: French seams, self-bound edges, and a stiffened big peplum. */
export function withSheerTop(g: SewingGuide, d: Pick<BodiceDraft, 'peplum' | 'zipCm'> & { backLoops?: boolean }, seam: string): SewingGuide {
  const steps: SewStep[] = [];
  for (const st of g.steps) {
    switch (st.title) {
      case 'Neaten the edges':
        // Nothing is overlocked in a sheer: each seam encloses its own edges as it is sewn.
        steps.push({ title: 'Sew French seams', text: `Every seam shows through a sheer, so none is overlocked: each one is sewn as a French seam, which leaves a neat 0.3 cm fold inside. ${FRENCH(seam)}. Test one on scraps first, with a fine needle and a short stitch.` });
        break;
      case 'Sew the princess seams':
        steps.push({
          ...st,
          text: `Sew each side front to its centre front, and each side back to its centre back, as French seams, matching the notches above and below the bust. ${FRENCH(seam, 'the side')}, over a tailor's ham at the bust so it keeps its shape. On the first pass the centre front curves in where the side front curves out: ease it rather than stretch it, and clip only the 0.6 cm you sew through, never past the line.`,
        });
        break;
      case 'Sew the shoulders':
      case 'Sew the side seams':
      case 'Sew the sleeve seams': {
        // The pinning and fitting words stay; the sewing and pressing are the French seam's.
        const kept = st.text
          .replace(/,? right sides together/g, '')
          .replace(/ Sew (the underarm seam )?[\d.]+ cm from the edge[^.]*\./g, '')
          .replace(/ and press (it|the seams?) open[^.]*\./, '.');
        steps.push({ ...st, text: `${kept} ${st.title === 'Sew the sleeve seams' ? 'Sew each underarm seam as a French seam' : 'Sew them as French seams'}. ${FRENCH(seam)}.` });
        break;
      }
      case 'Sew the bust and waist darts':
        steps.push({ ...st, text: `${st.text} Then trim each dart to 0.3 cm from its stitching and overcast the edges together by hand, so only a fine line shows through.` });
        break;
      case 'Bind the neckline':
        steps.push({ ...st, text: `${SELF_BIND.replace('Trim the seam to 0.6 cm, lay a strip over it right sides together', 'Pin a strip to the neckline right sides together, 1 cm extra at each end')}. Bought binding is heavier and darker than the sheer and would show as a band.` });
        break;
      case 'Finish the armhole seams':
        steps.push({ ...st, text: `${SELF_BIND} round each armhole, starting at the underarm. Let the seam turn toward the sleeve.` });
        break;
      case 'Make the peplum': {
        const big = d.peplum?.size === 'big' && d.peplum.kind === 'flared';
        const sides = st.text.replace(/,? right sides together, ([\d.]+ cm) from the edge, matching the notches, and press the seams open\./, `, matching the notches, as French seams. ${FRENCH(seam)}.`);
        steps.push({
          ...st,
          text: big
            ? sides.replace(/ Hem it narrowly:[^]*$/, ` Hem it with 2.5 cm horsehair braid, so the big peplum stands out from the body as drawn instead of collapsing: lay the braid on the right side along the hem, its edge 0.5 cm from the raw edge, and stitch close to the edge. Turn the braid to the inside, so 0.5 cm of the sheer rolls over it, and slip-stitch the braid's top edge to the seams only. Turn the open edges in twice by 0.5 cm and stitch.`)
            : sides,
        });
        break;
      }
      case 'Attach the peplum':
        steps.push({ ...st, text: st.text.replace(/, overlock or zigzag the edges together,/, `, then bind the seam: ${SELF_BIND.charAt(0).toLowerCase()}${SELF_BIND.slice(1)},`) });
        break;
      default:
        steps.push(st);
    }
  }
  const braid = d.peplum?.size === 'big' && d.peplum.kind === 'flared' ? [`${Math.ceil(d.peplum.hemCm / 10 + 1) / 10} m of 2.5 cm horsehair braid, for the peplum hem`] : [];
  return { ...g, notions: [...g.notions.filter((n) => !/bias binding/i.test(n)), ...braid], steps };
}

/** A back closed with small covered buttons and rouleau loops in place of the zip, edge to edge down the opening. */
export function withBackLoops(g: SewingGuide, d: LoopedBack, seam: string): SewingGuide {
  const n = loopsFor(d);
  // The bodice's back edges fold on the centre back line (half the allowance, twice), so the peplum's open edges do too.
  const half = `${Math.round((parseFloat(seam) / 2) * 100) / 100} cm`;
  const peplumEdges = `Turn the open edges in twice by ${half} and stitch, so they finish on the centre back line as the bodice's edges do.`;
  const steps = g.steps.flatMap((st): SewStep[] => {
    if (st.title === 'Put in the zip')
      return [
        {
          title: 'Make the rouleau loops',
          text: `Cut a 2.5 cm bias strip of the same cloth, ${Math.ceil(n * 3 + 10)} cm long. Fold it in half lengthwise, right sides together, and sew 0.3 cm from the fold, the end angled out. Trim close, then turn it through with a loop turner. Cut it into ${n} loops, each 3 cm long.`,
        },
        {
          title: 'Close the back with buttons and loops',
          text: `On the right back (as you wear it), mark ${n} points down the centre back line ${LOOP_GAP} cm apart, the first 1 cm below the neck edge. Fold each loop in half and baste its ends to the right side at a mark, raw edges in the ${seam} allowance and the loop pointing toward the side seam. Turn the allowance on both backs under twice, ${half} then ${half}, enclosing the loop ends, and slip-stitch it down so the loops stand out from the fold. On the left back, sew a 1 cm covered button opposite each loop, 0.3 cm in from the fold, so the two edges meet with no gap.`,
        },
      ];
    if (st.title === 'Finish') return [{ ...st, text: st.text.replace(/Sew a hook and eye at the top of the zip, inside the [a-z ]+\. ?/, '') }];
    // (Each kind of peplum words its open edges its own way: flared and gathered, the big one on horsehair, the balloon.)
    const text = st.title === 'Make the peplum' ? st.text.replace(/Turn the open edges in twice by 0\.5 cm and stitch\.|Hem the open edges the same way\.|Neaten those open edges: press each under 0\.5 cm twice and stitch close to the fold\./, peplumEdges) : st.text;
    return [text.includes('zip') || text !== st.text ? { ...st, text: text.replace(/the zip seam lines/g, 'the centre back lines').replace(/at the zip\b/g, 'at the centre back').replace(/below the zip/g, 'below the buttons') } : st];
  });
  const notions = [...g.notions.filter((x) => !/invisible zip|hook and eye/i.test(x)), `${n} covered buttons, 1 cm across`, 'A loop turner'];
  return { ...g, notions, steps };
}

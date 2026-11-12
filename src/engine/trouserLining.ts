// A lining for trousers or shorts (In testing; SS27 Gold Python Bermuda, Cat Nov 12: "Lining do"). In silk the legs
// cling and the pocket bags show through; a lining hangs between, so the cloth falls clear of the body. It is the same
// legs drafted again with no pockets and no loops, 2.5 cm shorter so it never shows below the hem. It keeps the
// trousers' pleats, folded as soft tucks, because they hold the hip room (12 cm on the Bermuda): drafted without them
// the lining would pull. Darts are sewn as tucks too, so the lining can move. It goes in at the waist under the
// waistband, and is turned under round the opening.
import { p } from './geometry';
import type { SewStep, SewingGuide } from './instructions';
import type { Piece } from './piece';
import type { TrousersDraft, TrousersStyle } from './trousers';

/** How much shorter than the trousers the lining is cut, in cm: it hangs this far above the finished hem. */
export const TROUSER_LINING_SHORTER = 2.5;

/** The style the lining is drafted in, from the trousers' own style and finished length. */
export function liningStyle(s: Partial<TrousersStyle>, lengthCm: number): Partial<TrousersStyle> {
  return { ...s, lengthCm: lengthCm - TROUSER_LINING_SHORTER, loops: 'none', pockets: 'none', backPockets: undefined, hemRuffle: undefined, press: undefined };
}

/** The lining's two pieces, the front and the back legs, named and marked as lining. */
export function trouserLiningPieces(lining: TrousersDraft): Piece[] {
  return lining.pieces
    .filter((pc) => !pc.kind && /^Trousers (front|back)$/.test(pc.name))
    .map((pc) => {
      const name = pc.name.replace(/^Trousers/, 'Lining');
      return {
        ...pc,
        name,
        kind: 'lining' as const,
        fabric: 'Lining',
        allowances: { ...pc.allowances, hem: Math.min(pc.allowances.hem ?? 2, 2) },
        labels: [
          ...pc.labels.map((l) => (l.text === pc.name.toUpperCase() ? { ...l, text: name.toUpperCase() } : l)),
          ...((pc.meta.dartsCm as number[] | undefined)?.length || lining.pleats ? [{ at: p(pc.labels[0].at.x, pc.labels[0].at.y - 2.6), text: 'SEW AS TUCKS', size: 0.6 }] : []),
        ],
        draft: undefined,
      };
    });
}

/** The sewing guide with the lining's steps let in: cut it, make it, put it in before the waistband, hem it apart. */
export function withTrouserLining(g: SewingGuide, d: TrousersDraft, o: { metres: number; width: number; seam: string }): SewingGuide {
  const things = d.shorts ? 'shorts' : 'trousers';
  const fly = d.closure === 'fly';
  const cut: SewStep = {
    title: 'Cut the lining',
    text: `Fold the lining in half with the selvedges together. Pin the LINING FRONT and LINING BACK on both layers, so you get a pair of each, and cut them out. Snip the notches and mark the ${d.pleats ? 'pleat folds and ' : ''}darts.`,
  };
  const make: SewStep = {
    title: 'Make the lining',
    text: `${d.pleats ? "Fold the lining's pleats as on the trousers and stitch each down only 2 cm from the waist, and sew the back darts as tucks, stitching only their top 3 cm" : "Sew the lining's darts as tucks: stitch only the top 3 cm of each"}. Press, so the lining has room to move. Sew its side seams and inside legs ${o.seam} from the edge and press them open${
      fly ? '' : ', leaving the left side seam open above the zip notch'
    }. Turn one leg right side out, slip it inside the other and sew the crotch seam from the back waist round to ${fly ? 'the bottom of the fly opening, 2 cm below the zip stop' : 'the front waist'}.`,
  };
  const put: SewStep = {
    title: 'Put in the lining',
    text: `Slip the lining into the ${things}, wrong sides together, matching the side seams, the inside legs and the crotch seams. Baste the two together round the waist inside the seam allowance; the waistband goes on over both. ${
      fly ? "At the fly, turn the lining's front edges under and slip-stitch them to the zip tape, clear of the teeth." : 'At the zip, turn the open edges of the lining under and slip-stitch them to the zip tape, clear of the teeth.'
    }`,
  };
  const hem: SewStep = {
    title: 'Hem the lining',
    text: `Turn the lining's hem under 1 cm and then 1 cm again, and stitch: it hangs ${TROUSER_LINING_SHORTER} cm above the ${things}' hem. At each side seam and inside leg, join the lining to the ${things} with a 3 cm thread chain, so it stays put without pulling.`,
  };
  const steps: SewStep[] = [];
  const before = g.steps.some((st) => st.title === 'Make the belt loops') ? 'Make the belt loops' : 'Attach the waistband';
  for (const st of g.steps) {
    if (st.title === before) steps.push(make, put);
    steps.push(st);
    if (st.title === 'Cut out') steps.push(cut);
    if (st.title === 'Hem') steps.push(hem);
  }
  return { ...g, notions: [...g.notions, `${o.metres.toFixed(1)} m of lining, ${o.width} cm wide`], steps };
}

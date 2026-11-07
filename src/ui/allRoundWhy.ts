import type { QualityProblem } from '../engine/drape/quality';

// Why a design isn't shown turning in cloth yet, in plain words (Cat, Nov 7: "there needs to be a better explanation
// of why"). The drape's quality check (engine/drape/quality.ts) names each fault and the piece it is on; this turns the
// first of them into one short line a maker can read under All round, so they know it is the turning view that isn't
// ready, not their design or their pattern.

/** The piece a fault is on, as a maker would say it: "Skirt front to Skirt back" is the skirt, "Sleeve hem" the sleeve. */
function pieceWord(part: string): string {
  const first = part.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  if (!first || first === 'hem') return 'garment';
  return first;
}

/** What goes wrong in the turning view, by the check that caught it. */
const WHAT: Record<QualityProblem['check'], (piece: string) => string> = {
  seam: (p) => `the ${p}'s seams open up as it turns`,
  stretched: (p) => `the ${p} stretches out of shape as it turns`,
  broken: (p) => `the ${p} doesn't settle on the form yet`,
  jagged: (p) => `the ${p}'s edge comes out ragged`,
  fin: (p) => `the ${p} creases where it should lie smooth`,
  inside: (p) => `the ${p} sinks into the form`,
  collar: () => "the collar stands away from the neck instead of lying flat",
  hem: () => "the hem doesn't hang level yet",
  missing: (p) => `the ${p} goes missing from the turning view`,
};

/**
 * The line under All round when a design's turning view is still in testing. `standIn` says the Front drawing is
 * showing in its place; `gaveUp` says the sewing never finished (it crashed or ran too long), so there is no fault to name.
 */
export function inTestingNote(problems: readonly QualityProblem[] | undefined, standIn: boolean, gaveUp: boolean): string {
  const shown = standIn ? 'so here is its drawing' : 'so here is its shape';
  const first = problems?.[0];
  if (gaveUp || !first) return `This design is too new for the turning view: it couldn't be sewn on the form in time, ${shown}. Your pattern is not affected.`;
  return `The turning view can't show this design well yet: ${WHAT[first.check](pieceWord(first.part))}, ${shown}. Your pattern is not affected.`;
}

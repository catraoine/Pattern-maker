// The knit T-shirt sewn on the form for All round (Cat, 2026-11-07: "break freeze"): its front and back, each cut on
// the fold, and its sleeves, hung at the waist as a bodice is. A neckband is a narrow strip folded over the neck edge:
// it is drawn as the neckline's own edge. A mock neck stands up the neck, so it is sewn on as a band collar standing
// from the tee's own neckline (drawn only: the tee's pattern keeps its own folded band).
import type { TeeDraft } from '../tee';
import { band } from '../collar';
import { taggedLength } from '../geometry';
import type { Space } from './space';
import { DrapeOptions, Draped, collarsOf, drape, isShell, levelHemSpikes } from './garment';

/** How tall the mock neck is drawn: the form's neck ends a little above a 6 cm band, and drawn the full 6 cm its top
 *  stood off past it, stretched (5.5 cm passes on every cloth; the difference doesn't show at the size it is drawn). */
const MOCK_DRAWN_CM = 5.5;

export function drapeTee(sp: Space, d: TeeDraft, o: DrapeOptions = {}): Draped {
  const [front, back] = ['Tee front', 'Tee back'].map((n) => d.pieces.find((pc) => pc.name === n)!);
  const torso = [front, back].map((pc) => ({ pc, back: pc === back, waistY: d.waistY }));
  const mock = d.neckline === 'mock' ? [band({ back: taggedLength(back.outline, 'neck'), front: taggedLength(front.outline, 'neck'), ext: 0, closure: 'back_zip', sa: 0 }, 'Collar', Math.min(MOCK_DRAWN_CM, d.neckband.width), 1.4).piece].map((pc) => ({ ...pc, meta: { ...pc.meta, knit: true } })) : [];
  const out = drape(sp, torso, { sleeve: d.sleeveless ? [] : d.sleeve.pieces.filter(isShell), collars: collarsOf(mock) }, { closedFront: true, curtain: d.finishedWaist >= d.finishedBust - 2, ...(d.hemShape ? { shapedHem: true } : {}), ...(d.shoulder === 'dropped' ? { flatCrown: true } : {}), ...o });
  // (A knit's straight hem settles with a point hanging below its neighbours at the fold and the side seam, as a shift's.)
  if (!d.hemShape) levelHemSpikes(out);
  return out;
}

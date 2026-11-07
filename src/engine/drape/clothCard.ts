// How a cloth behaves in All round, from the fabric the maker picked: its stiffness, its weight and how far it gives
// (Design: Fabric behaviour, Cat 2026-11-07, A + B + C). Before this, only the fibre reached the drape, and a cotton,
// a silk and a wool half circle hung the same.
//
// The fabric's own weight and drape come first (set by the maker or a shop fabric), then a special cloth's (denim,
// satin...), then a knit's, then the fibre's usual ones. A plain cotton with nothing else set is drawn exactly as
// before, so the All round checks' cotton designs keep their scores.
import type { Drape, Fibre, MyFabric, Weight } from '../fabrics';
import { SPECIALS } from '../specialFabrics';
import { KNITS } from '../knitFabrics';

export interface ClothCard {
  /** Resistance to bending, the sim's bendK. */
  bendK: number;
  /** How a skirt's cloth bends against the rest of the garment: the cloth's own stiffness, which shows where it hangs
   *  free (a fluid cloth pours, a denim stands out). 1 = as the garment. */
  skirtBend: number;
  /** How far off the body the cloth lies, cm. */
  thick: number;
  /** How much harder than the light pull the cloth hangs: a fluid or heavy cloth drops into its folds. 1 = as before. */
  fall: number;
  /** How far it gives along its length, 0 (woven, held to its cut) to about 0.4 (a high stretch knit). */
  stretch: number;
  /** A crisp cloth: a peplum this many times stiffer than the cloth, so it stands out. */
  crisp?: number;
  /** A woven cloth gives on the bias, not on the grain (B): how much of its hold it loses at 45 degrees. */
  bias: number;
}

/** The fabric's Feel, set by the maker in All round (C): each a step from -2 to 2, 0 = the fabric's own card. */
export interface Feel {
  stiff?: number;
  weight?: number;
}

/** Each fibre's usual weight and drape, and its stiffness and thickness at those (the old fibre table). */
const FIBRE: Record<Fibre, { weight: Weight; drape: Drape; bendK: number; thick: number }> = {
  cotton: { weight: 'medium', drape: 'soft', bendK: 0.06, thick: 0.35 },
  linen: { weight: 'medium', drape: 'soft', bendK: 0.07, thick: 0.35 },
  wool: { weight: 'medium', drape: 'soft', bendK: 0.12, thick: 0.5 },
  silk: { weight: 'light', drape: 'fluid', bendK: 0.02, thick: 0.25 },
  viscose: { weight: 'light', drape: 'fluid', bendK: 0.02, thick: 0.25 },
  polyester: { weight: 'light', drape: 'soft', bendK: 0.04, thick: 0.3 },
  blend: { weight: 'medium', drape: 'soft', bendK: 0.05, thick: 0.3 },
};

const RANK: Record<Weight, number> = { light: 0, medium: 1, heavy: 2 };

/** Cloths whose stiffness is their own, whatever the weight says. */
const SPECIAL_BEND: Partial<Record<keyof typeof SPECIALS, { bendK: number; thick: number }>> = {
  denim: { bendK: 0.35, thick: 0.6 },
  leather: { bendK: 0.45, thick: 0.6 },
  corduroy: { bendK: 0.16, thick: 0.55 },
  velvet: { bendK: 0.06, thick: 0.5 },
};

const STRETCH = { low: 0.12, medium: 0.25, high: 0.38 } as const;

/** Kept in a range the sim holds steady in: past these it blows up or the cloth never settles. */
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const FEEL_STEPS = 2;

export function clothCard(f: Pick<MyFabric, 'fibre' | 'weight' | 'drape' | 'special' | 'knit'> & { feel?: Feel } = {}): ClothCard {
  const sp = f.special ? SPECIALS[f.special] : undefined;
  const kn = f.knit ? KNITS[f.knit] : undefined;
  const fibre: Fibre = f.fibre ?? sp?.fibre ?? kn?.fibre ?? 'cotton';
  const base = FIBRE[fibre];
  const weight = f.weight ?? sp?.weight ?? kn?.weight ?? base.weight;
  const drape = f.drape ?? sp?.drape ?? kn?.drape ?? base.drape;
  let bendK = base.bendK;
  let thick = base.thick;
  let fall = 1;
  // Weight, against the fibre's usual: each step heavier lies thicker, bends a little stiffer and pulls down harder.
  const dw = RANK[weight] - RANK[base.weight];
  bendK *= 1.3 ** dw;
  thick *= dw > 0 ? 1.3 ** dw : 0.8 ** -dw;
  // The whole garment bends as this; a skirt's cloth bends as `own` below. (Made stiffer all through, a crisp or
  // denim top's peplum and square neck folded into fins or blew apart: the cloth's own stiffness shows in the skirt,
  // where it hangs free, Fabric behaviour 2026-11-07.)
  const body = clamp(bendK, 0.004, 0.6);
  // (Not a crisp cloth: it holds itself out, and pulled down it lost the stand-away that makes it crisp.)
  if (dw > 0 && drape !== 'crisp') fall *= 1.4 ** dw;
  // Drape: a crisp cloth stands away; a fluid one pours, falling hard into its folds. (2.5 times: at 3 a silk half
  // circle midi was drawn 2.5 times its cut. Given longer to settle as well, a dress took 20 seconds to sew, and it
  // settled no better.)
  if (drape === 'crisp') bendK *= base.drape === 'crisp' ? 1 : 2.5;
  if (drape === 'fluid') {
    bendK = Math.min(bendK, 0.02) * 0.6;
    fall *= 2.5;
  }
  const special = f.special ? SPECIAL_BEND[f.special] : undefined;
  if (special && !f.drape && !f.weight) ({ bendK, thick } = special);
  // The maker's Feel (C): a step stiffer is 1.6 times the bend; a step heavier pulls 1.35 times harder.
  const s = clamp(Math.round(f.feel?.stiff ?? 0), -FEEL_STEPS, FEEL_STEPS);
  const w = clamp(Math.round(f.feel?.weight ?? 0), -FEEL_STEPS, FEEL_STEPS);
  bendK *= 1.6 ** s;
  fall *= 1.35 ** w;
  thick *= 1.1 ** w;
  const own = clamp(bendK, 0.004, 0.6);
  return {
    bendK: body,
    skirtBend: Math.round((own / body) * 1000) / 1000,
    thick: clamp(thick, 0.12, 0.8),
    fall: clamp(fall, 1, 4),
    stretch: kn ? STRETCH[kn.stretch] : 0,
    bias: kn ? 0 : drape === 'fluid' ? 0.25 : drape === 'crisp' ? 0.1 : 0.2,
    // (A crisp peplum stands out at 2.4 in all, a crisp cotton's 40 times 0.06: 40 times a stiffer cloth's own blew
    // the sim apart.)
    ...(drape === 'crisp' ? { crisp: Math.max(1, 2.4 / body) } : {}),
  };
}

/** The card a job carries when it has only the old fibre and crisp fields (a test page, a saved job). */
export const cardOf = (fibre?: Fibre, crisp?: boolean): ClothCard => clothCard({ fibre, ...(crisp ? { drape: 'crisp' } : {}) });

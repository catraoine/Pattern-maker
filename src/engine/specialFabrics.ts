// Special fabrics: cloth that changes how the pattern is cut and sewn, not just which fabric suits it.
// Denim, leather, velvet, corduroy, sheers, satin, lace and sequins each bring their own seams, lay plan,
// pressing and tools. Checks and stripes are a separate switch, since any fabric can be checked.
// Kept apart from fabrics.ts so other fabric work (such as knits) can change that file without clashing.
// Keep to plain ASCII punctuation: these words go into the PDF and the tech pack.
import type { Cloth } from './couture';
import type { Piece } from './piece';

export type Special = 'denim' | 'leather' | 'velvet' | 'corduroy' | 'sheer' | 'satin' | 'lace' | 'sequins';
type Weight = 'light' | 'medium' | 'heavy';
type Drape = 'crisp' | 'soft' | 'fluid';
type Fibre = 'cotton' | 'linen' | 'wool' | 'silk' | 'viscose' | 'polyester' | 'blend';
type Garment = 'skirt' | 'bodice' | 'dress' | 'trousers' | 'tee' | 'jacket' | 'coat' | 'lingerie';

export interface SpecialInfo {
  label: string;
  /** The fibre it usually is, recorded with it when the maker has not chosen one. */
  fibre?: Fibre;
  weight: Weight;
  drape: Drape;
  /** The couture route's cloth, for seam finishes and pressing. */
  cloth: Cloth;
  /** Thick or without give: takes the heavy-cloth ease. */
  thick?: boolean;
  /** Pile, sheen or one-way motifs: every piece is cut the same way up. */
  nap?: boolean;
  /** Seam and curve allowances the cloth needs, in cm, when they differ from the chosen style. */
  seam?: number;
  /** Hem allowance in cm, when the cloth needs its own. 0 means the edge of the cloth is the hem. */
  hem?: number;
  prewash: string;
  press: string;
  /** What the pattern does for this cloth. */
  added?: string;
  cut: string;
  need: string;
  sew?: string;
  lining?: string;
}

export const SPECIALS: Record<Special, SpecialInfo> = {
  denim: {
    label: 'Denim',
    fibre: 'cotton',
    weight: 'heavy',
    drape: 'crisp',
    cloth: 'cotton',
    thick: true,
    prewash: 'Wash it hot and dry it hot, twice, the way you will wash the finished piece. Rigid denim can shrink up to 10 percent, and the dye runs at first, so wash it on its own.',
    press: 'Cotton setting (about 200 C) with plenty of steam. Press every seam before you topstitch it.',
    added: 'Felled seams with two rows of topstitching, on the 1.5 cm allowance.',
    cut: 'Mark on the wrong side with chalk. Rigid denim only: stretch denim needs a pattern drafted for stretch.',
    need: 'A jeans needle 100/16, topstitch thread, a jeans button and rivets.',
    sew: 'Topstitch at 3 to 3.5 mm. Tap thick seam crossings flat with a hammer before you sew over them.',
  },
  leather: {
    label: 'Leather',
    weight: 'medium',
    drape: 'crisp',
    cloth: 'cotton',
    thick: true,
    seam: 1,
    hem: 3,
    prewash: 'Do not wash it. Unroll it and let it rest flat for a day so it relaxes.',
    press: 'No steam. Press on a low, dry setting through brown paper, or roll the seams flat with a seam roller.',
    added: '1 cm seams and a 3 cm hem, glued down. Darts are cut open and glued flat.',
    cut: 'Every pin and needle hole stays, so make a calico test first and fit that. Cut single layer from the right side of the hide, each piece once, then turn the pattern over for the other side. Hold the pattern down with weights, not pins.',
    need: 'A leather needle 90/14, a non-stick or roller foot, clips instead of pins, leather glue and a 3.5 mm stitch.',
    sew: 'Do not backstitch: tie the threads off. Never unpick, the holes show.',
  },
  velvet: {
    label: 'Velvet',
    weight: 'medium',
    drape: 'soft',
    cloth: 'silk',
    nap: true,
    prewash: 'Most velvet should be dry cleaned. If the label says it can be washed, wash a sample first.',
    press: 'Never press it flat. Lay it face down on a towel or a needle board and steam it from the wrong side.',
    added: 'Every piece laid the same way up, so it takes a little more fabric.',
    cut: 'Cut single layer, face down. Run the pile up the body for a deeper colour.',
    need: 'A walking foot and a Microtex needle 70/10. Tack the seams by hand first so the layers do not creep.',
  },
  corduroy: {
    label: 'Corduroy',
    fibre: 'cotton',
    weight: 'heavy',
    drape: 'soft',
    cloth: 'cotton',
    thick: true,
    nap: true,
    prewash: 'Wash it inside out, warm, the way you will wash the finished piece. It can shrink 3 to 5 percent.',
    press: 'Face down on a towel, with steam from the wrong side, so the ribs do not crush.',
    added: 'Every piece laid the same way up, so it takes a little more fabric.',
    cut: 'Run the pile down the body, so it wears well. Line the ribs up with the grain line.',
    need: 'A walking foot and a 90/14 needle.',
  },
  sheer: {
    label: 'Sheer',
    weight: 'light',
    drape: 'fluid',
    cloth: 'silk',
    hem: 1,
    prewash: 'Hand wash a small sample first, as for its fibre, and dry it flat.',
    press: 'Low heat, dry, through a press cloth.',
    added: 'French seams on the 1.5 cm allowance, and a 1 cm hem rolled narrow.',
    cut: 'Lay it between sheets of tissue paper and cut through the paper too. Single layer, with fine pins in the seam allowance only.',
    need: 'A Microtex needle 60/8, fine thread, and a straight-stitch plate if you have one.',
    lining: 'A sheer needs a lining or an underlayer, unless you mean to wear it as a layer.',
  },
  satin: {
    label: 'Satin',
    weight: 'light',
    drape: 'fluid',
    cloth: 'silk',
    nap: true,
    prewash: 'Hand wash a small sample first. If it keeps its sheen, hand wash the whole length cool and dry it flat; if not, keep it dry clean only.',
    press: 'Silk setting, dry, through a press cloth. Water drops can spot it.',
    cut: 'Cut single layer on a cotton sheet, satin side down, every piece the same way up so the sheen matches. Pin inside the seam allowance only: pins leave marks.',
    need: 'A Microtex needle 70/10 and fine thread. Test on a scrap first, since unpicking leaves holes.',
  },
  lace: {
    label: 'Lace',
    weight: 'light',
    drape: 'soft',
    cloth: 'silk',
    nap: true,
    hem: 0,
    prewash: 'Hand wash it cool if the label allows, and dry it flat.',
    press: 'Low heat, face down on a towel, through a press cloth.',
    added: 'No hem allowance: the scalloped edge is the hem.',
    cut: 'Cut single layer, right side up, so you can place every piece on the motifs. Put the hem on the scalloped edge and match the motifs at the side seams.',
    need: 'Fine pins, a fine needle and silk thread for the hand stitching.',
    sew: 'Overlap the seams and hand-stitch around a motif, then trim the extra close to the stitches.',
    lining: 'Back it with an underlay of silk organza or cotton batiste.',
  },
  sequins: {
    label: 'Sequins',
    weight: 'medium',
    drape: 'fluid',
    cloth: 'silk',
    nap: true,
    prewash: 'Do not wash it. If the label allows, hand wash a sample first.',
    press: 'Never press the sequins, they melt. Press the seams from the wrong side, cool, through a cloth.',
    cut: 'Cut single layer, face down, every piece the same way up so the sequins lie the same way. Use old scissors.',
    need: 'A zipper foot, an old needle and strong thread.',
    sew: 'Before sewing, take the sequins or beads off the seam allowances and knot the threads. After sewing, hand-sew a few back over the seams to hide them.',
    lining: 'Line it, so the back of the sequins does not scratch.',
  },
};

export const SPECIAL_IDS = Object.keys(SPECIALS) as Special[];

/** Styles a special cloth does not suit, and why. */
const NOT_FOR: Partial<Record<Special, { silhouettes?: string[]; legs?: string[]; text: string }>> = {
  leather: { silhouettes: ['half_circle', 'circle', 'trumpet'], legs: ['wide'], text: 'Leather is too stiff for a flared or full shape. It suits a pencil, straight or A-line skirt and slim trousers.' },
  denim: { silhouettes: ['half_circle', 'circle', 'trumpet'], legs: ['wide'], text: 'Rigid denim stands out stiffly in a flared or full shape. It suits a straight or A-line skirt and straight or tapered legs.' },
  corduroy: { silhouettes: ['half_circle', 'circle'], text: 'Corduroy is heavy for a full circle: it drags and the pile shades unevenly around it.' },
  sheer: { silhouettes: ['pencil'], text: 'A sheer pencil skirt shows everything and seats. Line it, or choose a fuller shape.' },
  sequins: { silhouettes: ['pencil'], text: 'Sequins are stiff and scratchy at the close seams of a pencil skirt. Line it well.' },
};

/** What to watch for with a special cloth in this style. */
export function specialWarnings(special: Special | undefined, style: { garment?: string; silhouette?: string; leg?: string; fit?: string }): string[] {
  const n = special && NOT_FOR[special];
  if (!n) return [];
  const bad = (style.silhouette && n.silhouettes?.includes(style.silhouette)) || (style.leg && n.legs?.includes(style.leg));
  return bad ? [n.text] : [];
}

/** The fabric's checks or stripes, when it has them. */
export interface Checks {
  /** The repeat in cm, from one check to the same point on the next. */
  repeat?: number;
}

const MAIN_PIECES: Record<Garment, number> = { skirt: 2, bodice: 2, dress: 4, trousers: 2, tee: 2, jacket: 4, coat: 4, lingerie: 3 };
const DEFAULT_REPEAT = 10;

/** Extra fabric for matching checks: about one repeat for each main piece. In metres, to 0.1. */
export function checksExtra(checks: Checks, garment: Garment): number {
  const repeat = checks.repeat && checks.repeat > 0 ? checks.repeat : DEFAULT_REPEAT;
  return Math.ceil((repeat * MAIN_PIECES[garment]) / 10) / 10;
}

/** Lines for checks or stripes, for the card, the PDF and the tech pack. */
export function checksLines(checks: Checks | undefined, garment: Garment): string[] {
  if (!checks) return [];
  const extra = checksExtra(checks, garment);
  return [
    `Checks or stripes: buy about ${extra.toFixed(1)} m more${checks.repeat ? ` for a ${checks.repeat} cm repeat` : ' (for a 10 cm repeat; enter yours to work it out)'}.`,
    'Lay plan: put every piece on the same check line, and line the checks up at the side seams, centre back and the waist, matching at the notches. Cut single layer if the checks are not printed on the grain.',
  ];
}

/** Lines describing the special cloth, for the card, the PDF and the tech pack. */
export function specialLines(special: Special | undefined): { label: string; text: string }[] {
  if (!special) return [];
  const s = SPECIALS[special];
  return [
    s.added && { label: 'Added for you', text: s.added },
    { label: 'Cut', text: s.cut },
    s.sew && { label: 'Sew', text: s.sew },
    { label: "You'll need", text: s.need },
    s.lining && { label: 'Lining', text: s.lining },
  ].filter((l): l is { label: string; text: string } => !!l);
}

/** Hide area to buy for leather, in square feet: the pieces' own area from the cutting layout, plus a third for the hide's shape and flaws. */
export function hideSqFt(lay: { metres: number; width: number; efficiency: number }): number {
  return Math.ceil(lay.metres * (lay.width / 100) * lay.efficiency * 10.764 * 1.35);
}

/** How to cut leather, in place of the cutting layout's folding words. */
export const LEATHER_LAY = 'Leather is cut single layer from the right side of the hide, never folded. Use this layout as a guide to the pieces: cut each one once, then turn the pattern over for the second side, and keep every piece off the flaws you chalked. Keep the grain lines running down the hide, from neck to tail.';

/** The piece with the allowances the special cloth needs, on top of the chosen allowance style. */
export function withSpecialAllowances(pc: Piece, special: Special | undefined): Piece {
  const s = special && SPECIALS[special];
  // Lining is cut from its own cloth and keeps its allowances.
  if (!s || (s.seam === undefined && s.hem === undefined) || pc.kind === 'lining') return pc;
  const allowances: Record<string, number> = { ...pc.allowances };
  if (s.seam !== undefined) {
    for (const tag of ['neck', 'armhole', 'waist', 'dart']) if (tag in allowances) allowances[tag] = s.seam;
  }
  if (s.hem !== undefined && 'hem' in allowances) allowances.hem = s.hem;
  return { ...pc, seamAllowance: s.seam ?? pc.seamAllowance, allowances };
}

/** The piece's balance lines marked for matching checks: the same check line sits on each at that level. */
export function withCheckMarks(pc: Piece): Piece {
  if (!pc.balance?.length) return pc;
  // A fold line on a waistband is where it folds, not a level to match.
  return { ...pc, balance: pc.balance.map((b) => (b.label === 'FOLD LINE' ? b : { ...b, label: `${b.label}: MATCH CHECKS` })) };
}

/** Every piece the same way up: for pile, sheen and one-way motifs. */
export const needsNap = (special: Special | undefined) => !!special && !!SPECIALS[special].nap;

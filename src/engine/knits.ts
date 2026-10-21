// Fabric advice for knits: the T-shirt is the one garment drafted for stretch fabric, so it takes knits
// and rules out wovens, the other way round from every other pattern (fabrics.ts). Keep to plain ASCII
// punctuation: these words go into the PDF and the tech pack.
import type { FabricAdvice, FabricPick, MyFabric } from './fabrics';
import { describeFabric, fabricLines } from './fabrics';
import type { SewingGuide } from './instructions';
import type { Stretch, TeeFit, TeeNeck } from './tee';
import { isSwim, type LingeriePiece, type LingerieStretch } from './lingerie';

/** The style the knit is checked against. */
export interface TeeFabricStyle {
  garment: 'tee';
  fit: TeeFit;
  stretch: Stretch;
  neckline: TeeNeck;
}

export const STRETCH_WORDS: Record<Stretch, string> = { low: 'low stretch (20 to 30%)', medium: 'medium stretch (30 to 50%)', high: 'high stretch (50% or more)' };

const pick = (name: string, weight: FabricPick['weight'], drape: FabricPick['drape'], why: string): FabricPick => ({ name, weight, drape, why });

const PICKS: Record<Stretch, FabricPick[]> = {
  low: [
    pick('Cotton interlock', ['medium'], 'soft', 'Smooth on both sides and stable: easy to sew, and it does not curl.'),
    pick('Heavier cotton jersey', ['medium'], 'soft', 'The classic tee fabric. Holds its shape and washes well.'),
    pick('Organic cotton jersey', ['light', 'medium'], 'soft', 'Soft and breathable, with a little give.'),
  ],
  medium: [
    pick('Cotton-elastane jersey', ['light', 'medium'], 'soft', 'Stretches and springs back, so the neck and hems stay neat.'),
    pick('Bamboo or viscose jersey', ['light'], 'fluid', 'Cool and silky, with a soft drape.'),
    pick('Merino jersey', ['light'], 'soft', 'Warm, breathable and does not hold smells.'),
  ],
  high: [
    pick('Viscose-elastane jersey', ['light'], 'fluid', 'Very stretchy and drapey: lovely in a fitted tee.'),
    pick('Cotton-elastane rib knit', ['light', 'medium'], 'soft', 'Hugs the body and recovers well.'),
    pick('Modal jersey', ['light'], 'fluid', 'Silky soft and keeps its colour.'),
  ],
};

/** The neckband's fabric, in the slot the other garments use for their lining. */
const NECKBAND = pick('Neckband: the same knit, or 1x1 rib', ['light', 'medium'], 'soft', 'Rib springs back best, so the neck lies flat.');

const FIT_WORDS: Record<TeeFit, string> = { fitted: 'a fitted T-shirt', regular: 'a regular fit T-shirt', relaxed: 'a relaxed T-shirt' };

/** Fabrics for the T-shirt: knits with at least the stretch chosen; no wovens. */
export function teeFabrics(style: { fit: TeeFit; stretch: Stretch; neckline?: TeeNeck }): FabricAdvice {
  return {
    style: FIT_WORDS[style.fit],
    picks: PICKS[style.stretch],
    avoid:
      'Woven fabrics such as poplin, linen or chambray: this pattern is drafted for a knit, close to or smaller than the body, and a woven will not go on. Also avoid knits with less stretch than you chose, and loose sweater knits that ladder.',
    note: `Choose a knit with ${STRETCH_WORDS[style.stretch]} across the width, that springs back when you let go.${style.neckline === 'v' ? ' For the V-neck, a knit with good recovery keeps the point sharp.' : ''}`,
    lining: NECKBAND,
  };
}

/** Lingerie and swimwear, checked against the piece and the knit's stretch. */
export interface LingerieFabricStyle {
  garment: 'lingerie';
  piece: LingeriePiece;
  stretch: LingerieStretch;
}

const SWIM_PICKS: FabricPick[] = [
  pick('Nylon-elastane swim Lycra', ['light', 'medium'], 'soft', 'Four-way stretch with strong recovery: the classic swimsuit fabric.'),
  pick('Recycled nylon swim fabric', ['light', 'medium'], 'soft', 'Made from fishing nets and waste nylon, and just as stretchy.'),
  pick('Polyester-elastane swim fabric', ['light', 'medium'], 'soft', 'Lasts longest in chlorine and keeps its colour.'),
];
const INTIMATE_PICKS: Record<LingerieStretch, FabricPick[]> = {
  medium: [
    pick('Cotton-elastane jersey', ['light'], 'soft', 'Soft and breathable for everyday briefs and bralettes.'),
    pick('Stretch lace', ['light'], 'soft', 'Pretty and close-fitting. Many laces stretch across only: choose that on the style screen if yours does.'),
    pick('Power mesh', ['light'], 'soft', 'Firm, with strong recovery rather than a lot of stretch: good for a band, a shelf or a smoothing bodysuit.'),
  ],
  high: [
    pick('Microfibre Lycra', ['light'], 'soft', 'Smooth and invisible under clothes.'),
    pick('Modal-elastane jersey', ['light'], 'fluid', 'Silky soft against the skin, and very stretchy.'),
    pick('Silk-elastane jersey', ['light'], 'fluid', 'Luxurious and very fine.'),
  ],
};

/** Fabrics for lingerie and swimwear: four-way stretch with strong recovery, and their lining. */
export function lingerieFabrics(style: { piece: LingeriePiece; stretch: LingerieStretch; way?: 'four' | 'two' }): FabricAdvice {
  const swim = isSwim(style.piece);
  return {
    style: `a ${style.piece}`,
    picks: swim ? SWIM_PICKS : INTIMATE_PICKS[style.stretch],
    avoid: 'Woven fabrics, and knits that do not spring back: this pattern is cut smaller than you and relies on the stretch.',
    note: swim
      ? 'Choose a swim fabric with at least 50% stretch both ways and chlorine-resistant elastane.'
      : `Choose a knit with ${style.stretch === 'high' ? 'high stretch (50% or more)' : 'medium stretch (30 to 50%)'} across${style.way === 'two' ? '' : ' and some stretch down its length'}, that springs back when you let go.`,
    lining: swim
      ? pick('Swim lining', ['light'], 'soft', 'Lines the whole piece so it is opaque when wet.')
      : pick('Gusset: cotton jersey', ['light'], 'soft', 'Breathable next to the skin.'),
  };
}

/** What to watch for with this knit in this style. */
export function teeWarnings(style: { fit: TeeFit; stretch: Stretch }, { weight, drape }: Pick<MyFabric, 'weight' | 'drape'>): string[] {
  const out: string[] = [];
  if (drape === 'crisp') out.push('Crisp knits like ponte or scuba are firm and stretch less. Choose Low stretch so the tee is cut with more room.');
  if (drape === 'fluid' && style.fit === 'fitted') out.push('A fluid knit clings in a fitted tee and shows every line underneath. A regular or relaxed fit hangs better.');
  if (weight === 'heavy' && style.fit === 'fitted') out.push('A heavy knit feels tight in a fitted tee. Choose a regular fit, or Low stretch.');
  if (weight === 'light' && style.stretch === 'low') out.push('Light knits are usually stretchier than low stretch. Do the stretch test: if it stretches more, choose that stretch so the tee is not baggy.');
  return out;
}

const PREPARE_TITLE = 'Prepare your fabric';

/** The first step for a knit: wash it, let it relax, and find the grain along the ribs. */
export function knitPrepareStep(f: MyFabric | undefined): { title: string; text: string } {
  const wash =
    f?.fibre === 'wool'
      ? 'Hand wash it cool and dry it flat, or it will felt.'
      : 'Wash and dry it the way you will wash the finished tee: knits shrink, cotton most of all, often 5 percent or more.';
  return {
    title: PREPARE_TITLE,
    text: `${wash} Let it rest flat on a table for a few hours so it relaxes. Do not tear or pull a knit straight: find the grain by following one rib (the fine lengthwise lines on the right side) and fold the fabric along it.`,
  };
}

/** The T-shirt's guide with the knit named in the notions, its details listed, and the knit prepare step first. */
export function withKnitFabric(guide: SewingGuide, f: MyFabric | undefined): SewingGuide {
  const name = describeFabric(f);
  return {
    ...guide,
    // Heavy cloth's extra ease is for wovens; a knit's room comes from its stretch.
    fabric: fabricLines(f, 'tee').filter((l) => !/^Ease:/.test(l)),
    notions: name ? guide.notions.map((n, i) => (i === 0 ? n.replace('knit fabric', name) : n)) : guide.notions,
    steps: guide.steps[0]?.title === PREPARE_TITLE ? guide.steps : [knitPrepareStep(f), ...guide.steps],
  };
}

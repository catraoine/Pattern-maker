// Fabric guidance: which cloth suits each style, what to avoid, the fabric the maker actually bought,
// a check of that fabric against the style, ease for heavy cloth, and getting the fabric ready to cut.
// Woven fabrics only: every draft is for woven cloth, so stretch fabrics and knits are always ruled out.
// Keep to plain ASCII punctuation: these words go into the PDF and the tech pack.
import type { Fit, Length, Silhouette, SkirtFitting } from './skirt';
import type { BodiceDarts, BodiceFit, BodiceFitting, BodiceLength, Neckline } from './bodice';
import type { Leg } from './trousers';
import type { Cloth } from './couture';
import type { SewingGuide } from './instructions';
import { Checks, SPECIALS, Special, checksLines, specialLines, specialWarnings } from './specialFabrics';

export type Weight = 'light' | 'medium' | 'heavy';
export type Drape = 'crisp' | 'soft' | 'fluid';
/** Every garment the fabric advice covers. */
export type FabricGarment = 'skirt' | 'bodice' | 'dress' | 'trousers' | 'jacket' | 'coat';
export type Fibre = 'cotton' | 'linen' | 'wool' | 'silk' | 'viscose' | 'polyester' | 'blend';

/** The fabric the maker has bought, or means to buy. Every field is optional. */
export interface MyFabric {
  name?: string;
  colour?: string;
  fibre?: Fibre;
  weight?: Weight;
  drape?: Drape;
  /** A cloth that changes the cutting and sewing (denim, leather, velvet...). */
  special?: Special;
  /** Checks or stripes to match at the seams. */
  checks?: Checks;
  /** Adjust the ease for this fabric. On unless turned off. */
  matchEase?: boolean;
}

export interface FabricPick {
  name: string;
  /** One weight, or a range from the first to the second. */
  weight: [Weight] | [Weight, Weight];
  drape: Drape;
  why: string;
}

export interface FabricAdvice {
  /** Who the advice is for, such as "a midi A-line". */
  style: string;
  picks: FabricPick[];
  avoid: string;
  /** A note on the length or neckline, when it changes the choice. */
  note?: string;
  lining: FabricPick;
}

export const WEIGHTS: { id: Weight; label: string; examples: string }[] = [
  { id: 'light', label: 'Light', examples: 'Lawn, voile, silk crepe de chine' },
  { id: 'medium', label: 'Medium', examples: 'Poplin, linen, wool crepe' },
  { id: 'heavy', label: 'Heavy', examples: 'Twill, gabardine, tweed' },
];

export const DRAPES: { id: Drape; label: string; about: string }[] = [
  { id: 'crisp', label: 'Crisp', about: 'Stands away from you. Pencil, A-line, fitted.' },
  { id: 'soft', label: 'Soft', about: 'Bends gently. Most styles.' },
  { id: 'fluid', label: 'Fluid', about: 'Pours and clings. Circle skirts.' },
];

interface FibreInfo {
  label: string;
  /** The couture route's cloth, for seam finishes and pressing. */
  cloth: Cloth;
  prewash: string;
  press: string;
}

export const FIBRES: Record<Fibre, FibreInfo> = {
  cotton: {
    label: 'Cotton',
    cloth: 'cotton',
    prewash: 'Wash and dry it warm, the way you will wash the finished piece. Cotton can shrink 3 to 5 percent.',
    press: 'Cotton setting (about 200 C) with steam.',
  },
  linen: {
    label: 'Linen',
    cloth: 'linen',
    prewash: 'Wash and dry it twice, warm, the way you will wash the finished piece. Linen shrinks 3 to 5 percent and softens with each wash.',
    press: 'Linen setting (about 220 C) with plenty of steam, from the wrong side.',
  },
  wool: {
    label: 'Wool',
    cloth: 'wool',
    prewash: 'Do not wash it. Steam it all over with the iron held just above the cloth and let it dry flat, or ask a dry cleaner to steam it, so it shrinks now and not at the first press.',
    press: 'Wool setting (about 150 C) with steam, through a press cloth.',
  },
  silk: {
    label: 'Silk',
    cloth: 'silk',
    prewash: 'Wash a 10 cm square by hand first. If it keeps its colour and finish, hand wash the whole length in cool water and dry it flat; if not, keep the garment dry clean only.',
    press: 'Silk setting (about 120 C), dry, through a silk organza press cloth.',
  },
  viscose: {
    label: 'Viscose',
    cloth: 'silk',
    prewash: 'Hand wash it cool and dry it flat. Viscose can shrink up to 5 percent and is weak while wet, so do not wring it.',
    press: 'About 150 C with a little steam, through a press cloth, from the wrong side.',
  },
  polyester: {
    label: 'Polyester',
    cloth: 'silk',
    prewash: 'It barely shrinks, so a quick wash is only needed to remove the finish. Dry it on low heat.',
    press: 'Synthetic setting (about 120 C) through a press cloth: too hot and it melts or shines.',
  },
  blend: {
    label: 'Blend',
    cloth: 'cotton',
    prewash: 'Wash and dry it the way the label says for the main fibre, the way you will wash the finished piece.',
    press: 'Set the iron for the most delicate fibre on the label, and test on a scrap first.',
  },
};

export const FIBRE_IDS = Object.keys(FIBRES) as Fibre[];

const pick = (name: string, weight: FabricPick['weight'], drape: Drape, why: string): FabricPick => ({ name, weight, drape, why });

const STRETCH = 'Also avoid stretch fabrics and knits: this pattern is drafted for woven cloth.';

const SKIRT: Record<Silhouette, { picks: FabricPick[]; avoid: string }> = {
  pencil: {
    picks: [
      pick('Wool suiting or gabardine', ['medium'], 'crisp', 'Holds a close line and resists seating.'),
      pick('Cotton sateen or twill', ['medium'], 'crisp', 'Firm enough to hug the hip smoothly.'),
      pick('Wool crepe', ['medium'], 'soft', 'Moulds to the hip with steam.'),
    ],
    avoid: 'Fluid or very light fabrics like chiffon, charmeuse or voile. They cling and show every line underneath.',
  },
  straight: {
    picks: [
      pick('Linen or linen blend', ['medium'], 'crisp', 'Hangs straight and cool.'),
      pick('Wool flannel or suiting', ['medium', 'heavy'], 'crisp', 'Keeps a clean line from hip to hem.'),
      pick('Cotton twill or chambray', ['medium'], 'crisp', 'Easy to sew, a good first make.'),
    ],
    avoid: 'Fluid fabrics like charmeuse or chiffon. They collapse onto the body instead of hanging straight.',
  },
  a_line: {
    picks: [
      pick('Linen or linen blend', ['medium'], 'crisp', 'Holds the A shape away from the body.'),
      pick('Cotton twill or chambray', ['medium'], 'crisp', 'Easy to sew, a good first make.'),
      pick('Wool crepe', ['medium'], 'soft', 'Swings more and falls in softer folds.'),
    ],
    avoid: 'Very fluid fabrics like chiffon. They lose the A shape and hang limp.',
  },
  trumpet: {
    picks: [
      pick('Wool crepe', ['medium'], 'soft', 'Fitted through the hip, with a flare that swings.'),
      pick('Crepe-back satin', ['medium'], 'fluid', 'Flutes into soft folds at the flare.'),
      pick('Viscose crepe', ['light', 'medium'], 'fluid', 'Moves well and is kind on a budget.'),
    ],
    avoid: 'Stiff fabrics like heavy denim or canvas. The flare stands out like a cone.',
  },
  half_circle: {
    picks: [
      pick('Viscose crepe or challis', ['light', 'medium'], 'fluid', 'Falls in soft, even ripples.'),
      pick('Wool challis', ['light'], 'soft', 'Warm and still light enough to swing.'),
      pick('Cotton lawn or poplin', ['light'], 'crisp', 'Holds a fuller, fresher shape.'),
    ],
    avoid: 'Heavy, crisp fabrics like canvas or heavy denim. They stand out stiffly and weigh a lot.',
  },
  circle: {
    picks: [
      pick('Viscose crepe or challis', ['light'], 'fluid', 'Falls in deep, even ripples.'),
      pick('Silk crepe de chine', ['light'], 'fluid', 'Moves beautifully and weighs almost nothing.'),
      pick('Cotton lawn or poplin', ['light'], 'crisp', 'For a fuller, petticoat look.'),
    ],
    avoid: 'Heavy fabrics. A full circle uses a lot of cloth, and heavy cloth drags on the bias and stretches the hem.',
  },
};

const SILHOUETTE_WORDS: Record<Silhouette, string> = {
  pencil: 'pencil skirt',
  straight: 'straight skirt',
  a_line: 'A-line',
  trumpet: 'trumpet skirt',
  half_circle: 'half circle skirt',
  circle: 'full circle skirt',
};

const LENGTH_WORDS: Record<Length, string> = { mini: 'mini', above_knee: 'above-knee', knee: 'knee-length', midi: 'midi', maxi: 'maxi' };

const SKIRT_LINING = pick('Lining: Bemberg (cupro) or acetate', ['light'], 'fluid', 'Slides over tights and breathes.');
const BODICE_LINING = pick('Lining: cotton lawn or Bemberg (cupro)', ['light'], 'soft', 'Breathes and slides on easily.');

/** Fabrics for a skirt style. */
export function skirtFabrics(style: { fit?: Fit; silhouette: Silhouette; length: Length }): FabricAdvice {
  const base = SKIRT[style.silhouette];
  const full = style.silhouette === 'half_circle' || style.silhouette === 'circle';
  const note =
    style.length === 'maxi' && !full
      ? 'At maxi length a lighter weight keeps it from feeling heavy.'
      : style.length === 'mini' && full
        ? 'At mini length a crisper fabric keeps the hem from flipping up.'
        : style.length === 'maxi' && full
          ? 'A maxi circle takes a lot of fabric: choose the lightest weight you like.'
          : undefined;
  return {
    style: `a ${LENGTH_WORDS[style.length]} ${SILHOUETTE_WORDS[style.silhouette]}`.replace('a above', 'an above'),
    picks: base.picks,
    avoid: `${base.avoid} ${STRETCH}`,
    note,
    lining: SKIRT_LINING,
  };
}

const BODICE: Record<BodiceFit, { picks: FabricPick[]; avoid: string }> = {
  fitted: {
    picks: [
      pick('Cotton poplin or sateen', ['light', 'medium'], 'crisp', 'Darts press flat and the shape stays sharp.'),
      pick('Silk dupion', ['medium'], 'crisp', 'Holds its shape. Pair it with a lining.'),
      pick('Wool crepe', ['medium'], 'soft', 'Moulds well to the body with steam.'),
    ],
    avoid: 'Very fluid fabrics like chiffon or charmeuse. They pucker at the darts and will not hold the shape.',
  },
  regular: {
    picks: [
      pick('Cotton poplin or lawn', ['light', 'medium'], 'crisp', 'Cool, easy to sew and presses well.'),
      pick('Linen or linen blend', ['medium'], 'crisp', 'Relaxed and breathable.'),
      pick('Silk or viscose crepe', ['light'], 'soft', 'Softer and dressier.'),
    ],
    avoid: 'Very fluid fabrics like chiffon or charmeuse. They are hard to sew darts in and cling.',
  },
  relaxed: {
    picks: [
      pick('Linen or washed linen', ['medium'], 'soft', 'Softens with wear and hangs easily.'),
      pick('Viscose crepe or challis', ['light'], 'fluid', 'Drapes into soft folds without darts.'),
      pick('Cotton double gauze', ['light'], 'soft', 'Airy and comfortable.'),
    ],
    avoid: 'Stiff, heavy fabrics like canvas or heavy denim. Without darts they stand away from the body.',
  },
};

const NECK_NOTES: Partial<Record<Neckline, string>> = {
  square: 'For a square neck, choose a fabric that presses sharply so the corners stay crisp.',
  v: 'For a V-neck, a fabric that presses well keeps the point sharp.',
  boat: 'A boat neck sits best in a firmer fabric that will not slip off the shoulder.',
};

const FIT_WORDS: Record<BodiceFit, string> = { fitted: 'fitted', regular: 'regular fit', relaxed: 'relaxed' };

/** Fabrics for a bodice style. */
export function bodiceFabrics(style: { fit: BodiceFit; neckline: Neckline; length?: BodiceLength; darts?: BodiceDarts }): FabricAdvice {
  const base = BODICE[style.fit];
  return {
    style: `a ${FIT_WORDS[style.fit]} bodice`,
    picks: base.picks,
    avoid: `${base.avoid} ${STRETCH}`,
    note: NECK_NOTES[style.neckline],
    lining: BODICE_LINING,
  };
}

const TROUSERS: Record<Leg, { picks: FabricPick[]; avoid: string }> = {
  straight: {
    picks: [
      pick('Wool suiting or gabardine', ['medium'], 'crisp', 'Holds a crease and hangs cleanly.'),
      pick('Cotton twill or drill', ['medium', 'heavy'], 'crisp', 'Hard-wearing and easy to sew.'),
      pick('Linen or linen blend', ['medium'], 'soft', 'Cool for summer. It creases, which is part of its charm.'),
    ],
    avoid: 'Very light or sheer fabrics. The seat and knees bag and show through.',
  },
  wide: {
    picks: [
      pick('Wool crepe', ['medium'], 'soft', 'Swings as you walk.'),
      pick('Viscose twill or crepe', ['medium'], 'fluid', 'Falls in long, soft lines.'),
      pick('Linen', ['medium'], 'soft', 'Relaxed and breathable.'),
    ],
    avoid: 'Stiff, heavy fabrics like canvas. Wide legs stand out instead of falling.',
  },
  tapered: {
    picks: [
      pick('Cotton twill or chino drill', ['medium'], 'crisp', 'Keeps the narrow shape at the ankle.'),
      pick('Wool suiting', ['medium'], 'crisp', 'Smart and resists seating.'),
      pick('Corduroy, needlecord', ['medium'], 'soft', 'Warm. Cut every piece the same way up for the nap.'),
    ],
    avoid: 'Fluid fabrics. They cling at the seat and lose the taper.',
  },
  culotte: {
    picks: [
      pick('Linen or linen blend', ['medium'], 'crisp', 'Holds the wide, cropped shape.'),
      pick('Cotton twill or chambray', ['medium'], 'crisp', 'Crisp and easy to sew.'),
      pick('Wool crepe', ['medium'], 'soft', 'Softer and dressier.'),
    ],
    avoid: 'Very fluid fabrics. Culottes lose their shape and look like a skirt that clings.',
  },
};

const LEG_WORDS: Record<Leg, string> = { straight: 'straight-leg trousers', wide: 'wide-leg trousers', tapered: 'tapered trousers', culotte: 'culottes' };

/** Fabrics for trousers. */
export function trousersFabrics(style: { leg: Leg }): FabricAdvice {
  const base = TROUSERS[style.leg];
  return {
    style: LEG_WORDS[style.leg],
    picks: base.picks,
    avoid: `${base.avoid} ${STRETCH}`,
    note: 'Trousers take hard wear at the seat and knees: a medium weight lasts best.',
    lining: SKIRT_LINING,
  };
}

const OUTER_LINING = pick('Lining: Bemberg (cupro) or acetate twill', ['light'], 'fluid', 'Slippery, so it slides on over other clothes, and it breathes.');

const OUTER: Record<'jacket' | 'coat', FabricPick[]> = {
  jacket: [
    pick('Wool suiting, flannel or crepe', ['medium'], 'soft', 'Shapes with steam round the shoulders and collar, and tailors beautifully.'),
    pick('Linen or cotton drill', ['medium'], 'crisp', 'A crisp summer jacket that presses sharply.'),
    pick('Tweed or boucle', ['medium', 'heavy'], 'soft', 'Warm and textured. Interface the fronts so they keep their shape.'),
  ],
  coat: [
    pick('Wool melton or coating', ['heavy'], 'crisp', 'Dense and warm. Cut edges barely fray, and it presses to a sharp edge.'),
    pick('Wool and cashmere coating', ['heavy'], 'soft', 'Soft and luxurious, with a little drape.'),
    pick('Cotton gabardine or twill', ['medium', 'heavy'], 'crisp', 'A trench-weight coat for spring and autumn.'),
  ],
};

/** Fabrics for a jacket or a coat. */
export function outerFabrics(style: { garment: 'jacket' | 'coat'; fit: BodiceFit }): FabricAdvice {
  return {
    style: `a ${FIT_WORDS[style.fit]} ${style.garment}`,
    picks: OUTER[style.garment],
    avoid: `Light or fluid fabrics like lawn, chiffon or crepe de chine. They will not hold the collar, lapels and shoulders. ${STRETCH}`,
    note: 'Interface the front facings, collar and hems with a fusible weft interfacing.',
    lining: OUTER_LINING,
  };
}

/** Fabrics for a dress: the skirt's suggestions that also suit the bodice come first. */
export function dressFabrics(style: { fit: BodiceFit; neckline: Neckline; silhouette: Silhouette; length: Length }): FabricAdvice {
  const skirt = skirtFabrics(style);
  const bodice = bodiceFabrics({ fit: style.fit, neckline: style.neckline });
  const both = skirt.picks.filter((p) => bodice.picks.some((b) => b.drape === p.drape && b.weight[0] === p.weight[0]));
  const rest = [...skirt.picks, ...bodice.picks].filter((p, i, all) => !both.includes(p) && all.findIndex((q) => q.name === p.name) === i);
  return {
    style: `a dress with ${skirt.style}${/skirt$/.test(skirt.style) ? '' : ' skirt'}`,
    picks: [...both, ...rest].slice(0, 3),
    // Both halves warn about fluid cloth for most styles; say it once.
    avoid: /fluid/i.test(skirt.avoid) && /fluid/i.test(bodice.avoid) ? bodice.avoid : `${bodice.avoid.replace(` ${STRETCH}`, '')} ${skirt.avoid}`,
    note: bodice.note ?? skirt.note,
    lining: BODICE_LINING,
  };
}

/** "Medium, crisp" or "Light to medium, fluid". */
export function pickTag(p: Pick<FabricPick, 'weight' | 'drape'>): string {
  const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
  return `${cap(p.weight.join(' to '))}, ${p.drape}`;
}

export interface FabricNote {
  level: 'ok' | 'warn' | 'info';
  text: string;
}

export type FabricStyle =
  | { garment: 'skirt'; silhouette: Silhouette; length: Length }
  | { garment: 'bodice'; fit: BodiceFit; neckline: Neckline }
  | { garment: 'dress'; fit: BodiceFit; neckline: Neckline; silhouette: Silhouette; length: Length }
  | { garment: 'trousers'; fit: Fit; leg: Leg }
  | { garment: 'jacket' | 'coat'; fit: BodiceFit };

const weightRank: Record<Weight, number> = { light: 0, medium: 1, heavy: 2 };

/** How the fabric suits the style: a good match, or what to watch for. Empty until weight or drape is set. */
export function checkFabric(style: FabricStyle, f: MyFabric): FabricNote[] {
  const notes: FabricNote[] = [];
  const { weight, drape } = f;
  if (weight || drape) {
    const warns = styleWarnings(style, f);
    const advice = adviceFor(style);
    if (warns.length) notes.push(...warns.map((text) => ({ level: 'warn' as const, text })));
    else {
      const close = advice.picks.some(
        (p) => (!drape || p.drape === drape) && (!weight || (weightRank[weight] >= weightRank[p.weight[0]] && weightRank[weight] <= weightRank[p.weight[p.weight.length - 1]])),
      );
      notes.push(
        close
          ? { level: 'ok', text: `Good match for ${advice.style}.` }
          : { level: 'info', text: `It will work for ${advice.style}, though the fabrics suggested on the style screen suit it best.` },
      );
    }
  }
  if (f.special) {
    notes.push(...specialWarnings(f.special, style).map((text) => ({ level: 'warn' as const, text })));
    notes.push({ level: 'info', text: SPECIALS[f.special].prewash });
  } else if (f.fibre) notes.push({ level: 'info', text: FIBRES[f.fibre].prewash });
  return notes;
}

/** The advice for any garment's style. */
export function adviceFor(style: FabricStyle): FabricAdvice {
  if (style.garment === 'skirt') return skirtFabrics(style);
  if (style.garment === 'bodice') return bodiceFabrics(style);
  if (style.garment === 'dress') return dressFabrics(style);
  if (style.garment === 'trousers') return trousersFabrics(style);
  return outerFabrics(style);
}

/** What to watch for with this fabric in this style. */
function styleWarnings(style: FabricStyle, { weight, drape }: MyFabric): string[] {
  const out: string[] = [];
  const name = adviceFor(style).style;
  if (style.garment === 'skirt' || style.garment === 'dress') {
    const s = style.silhouette;
    if (drape === 'fluid' && (s === 'pencil' || s === 'straight')) out.push(`A fluid fabric on ${name} will cling and show every line underneath. Lining it helps.`);
    if (drape === 'fluid' && s === 'a_line') out.push('A fluid fabric will soften the A shape so it hangs closer to the body.');
    if (weight === 'light' && s === 'pencil') out.push('A light fabric wrinkles and seats on a pencil skirt. Line it, or choose a medium weight.');
    if (drape === 'crisp' && weight === 'heavy' && (s === 'trumpet' || s === 'half_circle' || s === 'circle')) out.push('A heavy, crisp fabric makes the flare stand out stiffly. A softer one swings better.');
    else if (weight === 'heavy' && (s === 'half_circle' || s === 'circle')) out.push('Heavy fabric drags on the bias of a circle. Hang the skirt for two days before you hem it.');
    else if (drape === 'crisp' && s === 'trumpet') out.push('A crisp fabric makes the trumpet flare stand out. A soft or fluid one flutes better.');
  }
  if (style.garment === 'bodice' || style.garment === 'dress') {
    if (drape === 'fluid' && style.fit !== 'relaxed') out.push('A fluid fabric puckers at the darts and will not hold a fitted bodice. Underline it with cotton batiste, or choose a relaxed fit.');
    if (weight === 'heavy' && style.fit !== 'relaxed') out.push('A heavy fabric makes thick darts and a bulky neckline. Face or line it with something light, and trim the seams well.');
    if (drape === 'crisp' && weight === 'heavy' && style.fit === 'relaxed') out.push('A heavy, crisp fabric stands away from the body without darts.');
    if (style.neckline === 'boat' && drape === 'fluid') out.push('A boat neck in a fluid fabric can slide off the shoulder. Stay the neckline with tape.');
  }
  if (style.garment === 'jacket' || style.garment === 'coat') {
    if (weight === 'light') out.push(`A light fabric will not hold the collar and shoulders of ${name}. Interface it throughout, or choose a medium or heavy weight.`);
    if (drape === 'fluid') out.push(`A fluid fabric collapses at the lapels and hem of ${name}. Choose a crisper cloth.`);
  }
  if (style.garment === 'trousers') {
    if (weight === 'light') out.push('Light fabric bags at the seat and knees in trousers, and can show through. Choose a medium weight, or line them.');
    if (drape === 'fluid' && style.leg !== 'wide') out.push(`A fluid fabric clings at the seat on ${name}. It suits a wide leg better.`);
    if (drape === 'crisp' && weight === 'heavy' && style.leg === 'wide') out.push('A heavy, crisp fabric makes wide legs stand out instead of falling.');
  }
  return out;
}

/** Extra ease (cm) for the fabric: heavy cloth takes up room with its own thickness. */
export function fabricEase(f: MyFabric | undefined, garment: FabricGarment): { waist: number; hip: number; bust: number } {
  if (!f || f.matchEase === false || (f.weight !== 'heavy' && !(f.special && SPECIALS[f.special].thick))) return { waist: 0, hip: 0, bust: 0 };
  return garment === 'skirt' || garment === 'trousers' ? { waist: 0.5, hip: 1, bust: 0 } : { waist: 0.5, hip: 1, bust: 1 };
}

/** The fabric's extra ease in words: "0.5 cm more at the waist and 1 cm at the hip". */
export function easeWords(f: MyFabric | undefined, garment: FabricGarment): string {
  const e = fabricEase({ ...f, matchEase: true }, garment);
  if (garment === 'skirt' || garment === 'trousers') return `${e.waist} cm more at the waist and ${e.hip} cm at the hip`;
  if (garment === 'dress') return `${e.bust} cm more at the bust and hip, and ${e.waist} cm at the waist`;
  return `${e.bust} cm more at the bust (and at the hip on longer tops) and ${e.waist} cm at the waist`;
}

/** The toile's corrections with the fabric's ease added on top. */
export function withFabricEase(fit: SkirtFitting, f: MyFabric | undefined, garment: 'skirt'): SkirtFitting;
export function withFabricEase(fit: BodiceFitting, f: MyFabric | undefined, garment: 'bodice'): BodiceFitting;
export function withFabricEase(fit: SkirtFitting | BodiceFitting, f: MyFabric | undefined, garment: 'skirt' | 'bodice'): SkirtFitting | BodiceFitting {
  const e = fabricEase(f, garment);
  if (!e.waist && !e.hip && !e.bust) return fit;
  const add = (a: number | undefined, b: number) => (a ?? 0) + b;
  if (garment === 'skirt') {
    const s = fit as SkirtFitting;
    return { ...s, waistEase: add(s.waistEase, e.waist), hipEase: add(s.hipEase, e.hip) };
  }
  const b = fit as BodiceFitting;
  return { ...b, waistEase: add(b.waistEase, e.waist), bustEase: add(b.bustEase, e.bust), hipEase: add(b.hipEase, e.hip) };
}

/** "olive washed linen" or "medium, crisp linen", or undefined when nothing is recorded. */
export function describeFabric(f: MyFabric | undefined): string | undefined {
  if (!f) return undefined;
  const name = f.name?.trim();
  if (name) return name;
  const traits = [f.weight, f.drape].filter(Boolean).join(', ');
  const fibre = f.special ? SPECIALS[f.special].label.toLowerCase() : f.fibre ? FIBRES[f.fibre].label.toLowerCase() : '';
  return [traits, fibre].filter(Boolean).join(' ') || undefined;
}

/** Lines describing the fabric, for the PDF and the tech pack. Empty when nothing is recorded. */
export function fabricLines(f: MyFabric | undefined, garment: FabricGarment): string[] {
  if (!f || (!describeFabric(f) && !f.checks)) return [];
  const name = f.name?.trim();
  const lines: string[] = [];
  if (name) lines.push(`Fabric: ${name}${f.colour?.trim() ? `, ${f.colour.trim()}` : ''}`);
  else if (f.colour?.trim()) lines.push(`Colour: ${f.colour.trim()}`);
  if (f.special) lines.push(`Cloth: ${SPECIALS[f.special].label.toLowerCase()}`);
  if (f.fibre) lines.push(`Fibre: ${FIBRES[f.fibre].label.toLowerCase()}`);
  if (f.weight || f.drape) lines.push(`Weight and drape: ${[f.weight, f.drape].filter(Boolean).join(', ')}`);
  if (f.special) {
    lines.push(`Before cutting: ${SPECIALS[f.special].prewash}`);
    lines.push(`Press: ${SPECIALS[f.special].press}`);
    lines.push(...specialLines(f.special).map((l) => `${l.label}: ${l.text}`));
  } else if (f.fibre) {
    lines.push(`Before cutting: ${FIBRES[f.fibre].prewash}`);
    lines.push(`Press: ${FIBRES[f.fibre].press}`);
  }
  if (fabricEase(f, garment).hip) lines.push(`Ease: ${easeWords(f, garment)}, for the ${f.special ? SPECIALS[f.special].label.toLowerCase() : 'heavy cloth'}.`);
  lines.push(...checksLines(f.checks, garment));
  return lines;
}

const PREPARE_TITLE = 'Prepare your fabric';

/** The first sewing step: shrink, press and square the fabric before any pattern goes on it. */
export function prepareStep(f: MyFabric | undefined): { title: string; text: string } {
  const wash = f?.special
    ? SPECIALS[f.special].prewash
    : f?.fibre
    ? FIBRES[f.fibre].prewash
    : 'Wash and dry your fabric the way you will wash the finished piece, so it shrinks now and not after you sew it. For wool, steam it all over instead; for silk, test a small square first.';
  if (f?.special === 'leather')
    return { title: PREPARE_TITLE, text: `${wash} Look the hide over from the right side, and chalk a ring on the wrong side around any scar, hole or thin patch, so no piece sits on one.` };
  return {
    title: PREPARE_TITLE,
    text: `${wash} Press it, then straighten the grain: snip into the selvedge, pull a thread across, or tear across, and trim the end along that line. Fold it with the selvedges together and check the cut end sits square. If it doesn't, pull gently on the bias, from the short corners, until it does.`,
  };
}

/** A cutting step for a special cloth or checks, after preparing it. */
function cutStep(f: MyFabric | undefined): { title: string; text: string }[] {
  if (!f?.special && !f?.checks) return [];
  const s = f.special && SPECIALS[f.special];
  const text = [s?.cut, f.checks && 'Put every piece on the same check line, and line the checks up at the side seams, centre back and the waist, matching at the notches.', s?.sew]
    .filter(Boolean)
    .join(' ');
  return [{ title: s ? `Cut the ${s.label.toLowerCase()}` : 'Match the checks', text }];
}

/** The sewing guide with the fabric named in the notions, its details listed, and the prepare step first. */
export function withFabric(guide: SewingGuide, f: MyFabric | undefined, garment: FabricGarment): SewingGuide {
  const name = describeFabric(f);
  return {
    ...guide,
    fabric: fabricLines(f, garment),
    notions: name ? guide.notions.map((n, i) => (i === 0 ? n.replace('woven fabric', name) : n)) : guide.notions,
    steps: guide.steps[0]?.title === PREPARE_TITLE ? guide.steps : [prepareStep(f), ...cutStep(f), ...guide.steps],
  };
}

/** The couture route's cloth: from the recorded fibre when there is one. */
export const clothFor = (f: MyFabric | undefined, fallback: Cloth): Cloth => (f?.special ? SPECIALS[f.special].cloth : f?.fibre ? FIBRES[f.fibre].cloth : fallback);

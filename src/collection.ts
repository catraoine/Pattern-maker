// The Maison collection: the house's signature designs, each a set of style choices drafted to the
// sewist's own measurements like any other pattern. Making a look opens its style screen with the
// choices set, so every detail can still be changed.
import type { Finish } from './savedWork';
import type { MyFabric } from './engine/fabrics';
import { COLOURS } from './engine/shopFabrics';
import { dressBelt, skirtBelt } from './engine/belt';
import type { Choices } from './savedWork';
import { crotchGuess, draftBodice } from './engine/bodice';
import { draftDress } from './engine/dress';
import { Flat, bodiceFlat, dressFlat, outerFlat, skirtFlat, teeFlat, trousersFlat } from './engine/flat';
import { draftOuter } from './engine/outerwear';
import { LENGTHS, draftSkirt, skirtFitOf } from './engine/skirt';
import { SleeveDraft, draftSleeve, needsArms } from './engine/sleeve';
import { draftTrousers } from './engine/trousers';
import { draftTee } from './engine/tee';
import { isRange, rangeFlat } from './garmentRange';
import type { BodiceDraft } from './engine/bodice';
import {
  BodiceChoices,
  DEFAULT_BODICE,
  DEFAULT_JACKET_CHOICES,
  DEFAULT_TROUSERS_CHOICES,
  DressChoices,
  PatternChoices,
  isBodice,
  isDress,
  isOuter,
  isLingerie,
  isTee,
  isTrousers,
  sleeveOf,
  validDetails,
} from './garments';
import { EXAMPLE_BODY, Garment, MeasurementId, MeasurementValues, isComplete } from './measurements';

/** The house's own colours, named in a look's fabric words and not on the shop's list (SS27, 2026-11-05). */
const HOUSE_COLOURS: [string, string][] = [['gold', '#C9962E'], ['ice', '#9CC3E6'], ['lavender', '#a796c4'], ['blue-grey', '#B9C3CF'], ['chocolate', '#3d2418']];

/** The house's own prints, photographed from the real cloth: the words that name one in a look's fabric, its tile in
 * public/prints/house (see fabricPhoto.ts) and how wide one tile shows on the garment, in cm. */
const HOUSE_PRINTS: [string, { id: string; size: number }][] = [['leopard python', { id: 'house-leopard-python', size: 26 }]];

/** The fabric a look is named for, read from its words, so its thumbnail draws in that cloth. */
export function lookFabric(words: string): MyFabric {
  const w = words.toLowerCase();
  const special = (['denim', 'leather', 'velvet', 'corduroy', 'satin', 'lace', 'sequin'] as const).find((k) => w.includes(k));
  const sheer = /georgette|chiffon|organza|voile|sheer/.test(w);
  const fibre = (['silk', 'wool', 'cotton', 'linen', 'viscose', 'polyester'] as const).find((k) => w.includes(k));
  const colour = COLOURS.map((c) => c.name).find((c) => w.includes(c.toLowerCase())) ?? HOUSE_COLOURS.find(([n]) => w.includes(n))?.[1];
  // A python (or any animal skin) is a one-way print: its scales run one way down the cloth.
  const print = /python|snake|leopard|zebra/.test(w) ? 'oneway' : undefined;
  const crisp = /crisp|sateen|gabardine|poplin|taffeta/.test(w);
  const photo = HOUSE_PRINTS.find(([k]) => w.includes(k))?.[1];
  return {
    ...(fibre ? { fibre } : {}),
    ...(special ? { special: special === 'sequin' ? 'sequins' : special } : sheer ? { special: 'sheer' } : {}),
    // A sheer satin only hints at the body: a satin, faintly see-through.
    ...(special === 'satin' && sheer ? { seeThrough: 'faint' as const } : {}),
    ...(colour ? { colour } : {}),
    ...(print ? { print } : {}),
    ...(crisp ? { drape: 'crisp' } : {}),
    ...(/sateen/.test(w) && !special ? { sheen: 'soft' as const } : {}),
    ...(photo ? { photo } : {}),
  };
}

export interface HouseLook {
  id: string;
  /** Its place in the collection, printed as LOOK 01. */
  number: number;
  name: string;
  /** One line on the look, in the house's voice. */
  line: string;
  fabric: string;
  garment: Garment;
  choices: PatternChoices;
  /** A look of two pieces sewn as a set (SS27 Look 02, the black vest and pleated skirt): both share the look's number
   * and are shown together, each made on its own. */
  set?: string;
  /** How the look is finished when it is made, over the maker's own setting: the Blush Shift comes lined to the hem
   *  (Nov 11). The maker can still change it on the print screen. */
  finish?: Pick<Finish, 'bodiceEdges'>;
}

const skirt = (c: Partial<Choices>): Choices => ({ fit: 'regular', silhouette: 'a_line', length: 'knee', ...c });
const bodice = (c: Partial<BodiceChoices>): BodiceChoices => ({ ...DEFAULT_BODICE, ...c });
const dress = (fit: BodiceChoices['fit'], b: Partial<BodiceChoices>, s: Partial<Choices>): DressChoices => ({
  garment: 'dress',
  fit,
  bodice: bodice({ ...b, fit, length: 'waist' }),
  skirt: skirt({ ...s, fit: skirtFitOf(fit) }),
});

/** The season the house is showing: a new set of looks each spring and autumn, drawn from that season's
 * shows in its colours (Cat, 2026-10-29). Last season's looks move to the Archive, still made the same way. */
export const SEASON = { code: 'SS27', name: 'Spring Summer 2027' };

export const COLLECTION: HouseLook[] = [
  {
    id: 'blush-shift',
    number: 1,
    name: 'Blush Shift',
    line: 'A sleeveless shift above the knee, with a little room at the bust and a hem that flares just enough.',
    fabric: 'Blush wool crepe',
    garment: 'dress',
    choices: dress('regular', { neckline: 'crew', sleeve: 'none', darts: 'bust', bustDart: 'french', bustEase: 5, shiftBack: 'shaped' }, { silhouette: 'straight', length: 'mini', noSeam: 'shift', flareCm: 4 }),
    // Lined to the hem, the neck and armholes finished with the lining and a deep hand-stitched hem (linedShift.ts).
    finish: { bodiceEdges: 'lined' },
  },
  {
    // Cat's SS27 Look 02 picture, measured and refined with her Nov 7-8: a long boxy vest in crisp black wool, its
    // shoulder well past hers, a big collar pointing down over a small lapel, a seam across the chest just under the
    // arms, and three 3 cm buttons with buttonholes across (Cat, Nov 11: into the collection before the Nov 16 freeze).
    id: 'black-vest',
    number: 2,
    set: 'The Black Vest Set',
    name: 'Black Vest',
    line: 'A long, boxy vest with square corners and straight sides, a big collar pointing down over a small lapel, and three big buttons below a seam across the chest.',
    fabric: 'Black crisp wool gabardine',
    garment: 'jacket',
    choices: { ...DEFAULT_JACKET_CHOICES, fit: 'oversized', length: 'long', shaping: 'boxy', collar: 'notched', lapel: 'high', pockets: 'welt', sleeve: 'none', pads: 'none', dropCm: 30, easeCm: 29, breakCm: 17, buttons: 3, buttonGapCm: 14, shoulderCm: 9.5, buttonSizeCm: 3, buttonholes: 'horizontal', yokeCm: 19, vent: 'none', houseCut: true },
  },
  {
    // Wide box pleats only in this set (Cat, Nov 8). Low on the hip (Cat, Nov 11: "I would like that").
    id: 'black-pleated-skirt',
    number: 2,
    set: 'The Black Vest Set',
    name: 'Black Pleated Skirt',
    line: 'Wide box pleats from low on the hip to just above the knee, crisp enough to hold their shape.',
    fabric: 'Black crisp wool gabardine',
    garment: 'skirt',
    choices: skirt({ silhouette: 'a_line', length: 'above_knee', kneeShare: 0.93, pleats: 'box', pleatWidth: 'wide', flareCm: 10, rise: 'low' }),
  },
  {
    id: 'gold-shorts',
    number: 3,
    name: 'Gold Python Bermuda',
    line: 'Loose pleated Bermudas slung low on the hip, falling straight to just below the knee, with belt loops, in gold python silk.',
    fabric: 'Gold python silk',
    garment: 'trousers',
    choices: { ...DEFAULT_TROUSERS_CHOICES, fit: 'relaxed', leg: 'wide', length: 'knee', lengthCm: 68, legCm: { knee: 66, hem: 66 }, pockets: 'slant', pleats: 'double', loops: 'loops', backPockets: 'welt', rise: 'low' },
  },
  {
    id: 'ice-peplum',
    number: 4,
    name: 'Ice Peplum Top',
    line: 'Sheer ice blue, ruffled at the neck, with bishop sleeves and a big flared peplum from a lowered waist.',
    fabric: 'Ice sheer silk organza',
    garment: 'bodice',
    choices: bodice({ fit: 'fitted', neckline: 'crew', collar: 'ruffle', sleeve: 'long', sleeveShape: 'bishop', length: 'waist', dropCm: 6, peplum: 'flared', peplumSize: 'big', princess: 'shoulder', backLoops: true }),
  },
  {
    id: 'lilac-lace',
    number: 5,
    name: 'Lilac Lace Blouse',
    line: 'Lilac lace plunging to the waist, with full bishop sleeves gathered at the wrist. Worn with gold micro shorts.',
    fabric: 'Lilac silk lace',
    garment: 'bodice',
    choices: bodice({ fit: 'relaxed', bustEase: 20, darts: 'none', sides: 'straight', pullOn: true, neckline: 'plunge', plungeDepth: 'waist', sleeve: 'long', sleeveShape: 'bishop', sleeveFullness: 'full', sleeveCuff: 'elastic', sleeveHead: 'gathered', length: 'hip', yoke: { front: 0, back: 10, frontSlant: 13, trim: true, frontGather: 4, frontBand: 3.5 }, hemTie: 'drawstring' }),
  },
  {
    // From Cat's picture of a relaxed bias satin maxi (2026-11-11, "Build bias and correct the neckline for lower
    // narrower scoop"; "the dress straps should be a touch narrower"): it replaces the Gold Python Slip. The hem is
    // flared 16 cm, the most that still cuts whole on the bias from 150 cm cloth at the example size.
    // The hem is cut 13 cm clear of the floor, 6 cm shorter than a maxi on every body (Cat, 2026-11-11: "match length
    // of inspo", "seems like it should be shorter"): the picture's hem clears the floor by about 10 cm, and bias
    // cloth drops a few cm as it hangs.
    // The straps start 2 cm out from the neck, not 3.5 (Cat, 2026-11-11: "could the slip straps sit closer to the neck
    // for a narrower neckline?", then "A"): closer still, the bottom of the scoop was cut with a square notch.
    // The armhole is lowered 5 cm, to 19 cm deep at the example size (Cat: "that arm hole looks very small", then
    // "A2"): moving the strap in had raised it 2 cm, and her picture's drops well down the side.
    id: 'ivory-slip',
    number: 6,
    name: 'Ivory Bias Slip',
    line: 'The house slip, cut in one on the bias from the shoulder to just above the ankle: a low, narrow scoop, slim straps, no waist seam and no zip, in a satin you can just see through.',
    fabric: 'Ivory sheer silk satin',
    garment: 'dress',
    choices: dress('regular', { neckline: 'scoop', sleeve: 'none', darts: 'bust', bustEase: 4, neck: { frontDepth: 14.5, width: 2, backDepth: 18, fullness: 0.85, strap: 3 }, armholeLower: 5 }, { silhouette: 'straight', length: 'maxi', floorClear: 13, noSeam: 'bias', flareCm: 16, slit: 'none' }),
  },
  {
    // Cat's own Japanese leopard and python cotton, and the house shirt cut (2026-11-10).
    id: 'leopard-shirt-dress',
    number: 7,
    name: 'Leopard Shirt Dress',
    line: 'A big shirt cut down to a mini: a long-point collar, a back yoke with a box pleat, wide sleeves to the elbow, and a shirttail hem that hangs longer at the back.',
    fabric: 'Ivory leopard python cotton',
    garment: 'bodice',
    choices: bodice({
      fit: 'oversized',
      neckline: 'crew',
      collar: 'shirt',
      closure: 'front_buttons',
      sleeve: 'elbow',
      sleeveShape: 'straight',
      // A 5 cm cuff turned back over the sleeve's hem (Nov 11).
      sleeveCuff: 'turnback',
      length: 'long',
      dropCm: 47,
      bustEase: 36,
      // A shirttail: the sides scooped up 7.5 cm, the back 3 cm longer than the front.
      hem: { front: [0, 0, -0.2, -0.7, -1.6, -3, -4.8, -6.5, -7.5], back: [3, 3, 2.9, 2.5, 1.6, 0.2, -2.2, -5.2, -7.5] },
      // A yoke across the back, with a box pleat under it at the centre.
      yoke: { back: 9 },
      shirtCut: 'house',
    }),
  },
  {
    // A low-rise barrel leg in the snakeskin brown of the leopard cloth, so it links to the Leopard Shirt Dress (Cat,
    // 2026-11-11). Look 09 once Look 02 became a set and the Red Pleat Dress left the line.
    id: 'chocolate-barrel',
    number: 8,
    name: 'Chocolate Barrel Trouser',
    line: 'Slung low on the hip, two deep pleats opening into a barrel leg that curves out round the knee and falls to the floor, in a crisp chocolate sateen.',
    fabric: 'Chocolate crisp cotton sateen',
    garment: 'trousers',
    choices: { ...DEFAULT_TROUSERS_CHOICES, fit: 'relaxed', leg: 'barrel', length: 'full', rise: 'low', pockets: 'slant', pleats: 'double', loops: 'loops', backPockets: 'welt' },
  },
];

/** The Look 02 vest, or a jacket cut as it is (sleeveless with the high lapel): drawn sewn in All round, collar, buttons
 *  and chest seam, while other jackets and coats keep the earlier All round until their lapels are at the bar (Cat,
 *  2026-11-01). It sews clean on 40 of 41 bodies in its crisp wool (Nov 11). */
export const houseVest = (c: { sleeve?: string; lapel?: string }) => c.sleeve === 'none' && c.lapel === 'high';

/** How far below the judged crotch level a mini dress look ends at the least, in cm. */
const MINI_CLEAR = 10.5;

/**
 * A look's choices for the body it is made for. A length or a leg width drawn in centimetres was drawn on the sample
 * body, and the same centimetres on another body make another garment (Fable cut review, 2026-11-11: the Bermuda's 68 cm
 * ended 1 to 18 cm below the knee, and its 66 cm leg pinched in under a fuller hip). So a trouser's drawn length goes
 * with the waist to knee and its drawn leg with the hip; on the sample body, or without those measurements, nothing changes.
 */
export function lookChoices(look: Pick<HouseLook, 'choices'>, m: MeasurementValues): PatternChoices {
  const c = look.choices;
  // A mini dress is never so short that it ends within MINI_CLEAR of the judged crotch level: the named mini came to 4 cm
  // below it on a long rise. Only then is its length set in centimetres; most bodies keep the named mini.
  if (isDress(c) && c.skirt.length === 'mini' && c.skirt.lengthCm === undefined && m.waist_to_knee && m.waist_to_hip) {
    const body = { waist_to_hip: m.waist_to_hip, waist_to_knee: m.waist_to_knee, full_hip: m.full_hip };
    const least = Math.round((crotchGuess(body) + MINI_CLEAR) * 2) / 2;
    return least > LENGTHS.mini(body as never) ? { ...c, skirt: { ...c.skirt, lengthCm: least } } : c;
  }
  if (!isTrousers(c) || (c.lengthCm === undefined && !c.legCm)) return c;
  const half = (v: number) => Math.round(v * 2) / 2;
  const long = m.waist_to_knee ? m.waist_to_knee / (EXAMPLE_BODY.waist_to_knee ?? m.waist_to_knee) : 1;
  const round = m.full_hip ? m.full_hip / (EXAMPLE_BODY.full_hip ?? m.full_hip) : 1;
  return {
    ...c,
    ...(c.lengthCm !== undefined ? { lengthCm: half(c.lengthCm * long) } : {}),
    ...(c.legCm ? { legCm: { knee: half(c.legCm.knee * round), hem: half(c.legCm.hem * round) } } : {}),
  };
}

/** Which saved choices a look's garment lives under, its drawn centimetres fitted to the measurements when given. */
export function lookPatch(look: HouseLook, m?: MeasurementValues): { garment: Garment } & Record<string, unknown> {
  const { garment } = look;
  const choices = m ? lookChoices(look, m) : look.choices;
  if (isDress(choices)) return { garment, dress: choices };
  if (isBodice(choices)) return { garment, bodice: choices };
  if (isTrousers(choices)) return { garment, trousers: choices };
  if (isTee(choices)) return { garment, tee: choices };
  if (isOuter(choices)) return { garment, [garment]: choices };
  return { garment, choices };
}

function sleeveFor(b: BodiceDraft, c: BodiceChoices, own: MeasurementValues): SleeveDraft | undefined {
  const { length, shape, cm, cuff, fullness, headGather } = sleeveOf(c);
  // Measured for the body but not the arms yet: the drawing borrows the sample arms, so a shirt still shows its
  // sleeves (it came out sleeveless; 2026-10-30).
  const m = needsArms(own as never) ? { ...EXAMPLE_BODY, ...own } : own;
  if (length === 'none' || needsArms(m as never)) return undefined;
  return draftSleeve(b, m as never, { length, shape, ...(cm !== undefined ? { lengthCm: cm } : {}), ...(cuff ? { cuff } : {}), ...(fullness ? { fullness } : {}), ...(headGather ? { headGather } : {}), fit: c.fit, seamAllowance: b.pieces[0].seamAllowance, armholeAllowance: b.pieces[0].allowances.armhole ?? 1, hemAllowance: 2.5 });
}

/** The arm measurements a look's sleeves are drafted from, and still not given: a top or dress with sleeves made from the
 *  collection before the arms are measured printed with no sleeve piece and said "Sleeveless" (bug hunt, Nov 12), so
 *  making it asks for these first. */
export function lookArmsMissing(look: Pick<HouseLook, 'choices'>, measured: MeasurementValues): MeasurementId[] {
  const c = look.choices as unknown as { bodice?: BodiceChoices } & BodiceChoices;
  const top = isDress(look.choices) ? c.bodice : isBodice(look.choices) ? c : undefined;
  if (!top || sleeveOf(top).length === 'none') return [];
  return (['arm_length', 'upper_arm', 'wrist'] as const).filter((id) => measured[id] === undefined);
}

/** The measurements a look is drawn to: the sewist's own when the garment has all it needs, or the sample set. */
export function lookValues(look: HouseLook, values: MeasurementValues): { values: MeasurementValues; own: boolean } {
  return isComplete(values, look.garment) ? { values, own: true } : { values: EXAMPLE_BODY, own: false };
}

/** Keys sorted all the way down, so two sets of choices compare by content, not by the order they were built in. */
const canon = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, x]) => [k, canon(x)])) : v;

/** The collection look these choices still are, unchanged since it was made, for the print's title card
 *  ("Leopard Shirt Dress" over the long description; Cat, Nov 12). Undefined once any option is changed. */
export function lookNameOf(garment: Garment, current: PatternChoices, values: MeasurementValues): string | undefined {
  const want = JSON.stringify(canon(current));
  return COLLECTION.find((look) => look.garment === garment && JSON.stringify(canon(lookChoices(look, lookValues(look, values).values))) === want)?.name;
}

/** The look's technical flat, drafted to the given measurements; undefined if it can't be drafted for them. */
export function lookFlat(look: HouseLook, m: MeasurementValues): Flat | undefined {
  return choicesFlat(lookChoices(look, m), m);
}

/** The technical flat of any set of choices (a look, a saved pattern), drafted to the given measurements. */
export function choicesFlat(c: PatternChoices, m: MeasurementValues): Flat | undefined {
  try {
    if (isOuter(c)) return outerFlat(draftOuter(m as never, { ...c, kind: c.garment }));
    if (isTrousers(c)) return trousersFlat(draftTrousers(m as never, c), m as never);
    if (isTee(c)) return teeFlat(draftTee(m as never, c));
    if (isDress(c)) {
      const b = { ...validDetails(c.bodice, 'dress'), fit: c.fit, length: 'waist' as const };
      const d = draftDress(m as never, b, { ...c.skirt, fit: skirtFitOf(c.fit) }, { at: c.waistSeam, cm: c.waistSeamCm });
      return dressFlat(d, 'binding', { sleeve: sleeveFor(d.bodice, b, m), belt: dressBelt(c.skirt.belt, d) });
    }
    if (isBodice(c)) {
      const b = validDetails(c);
      const d = draftBodice(m as never, b);
      return bodiceFlat(d, 'binding', sleeveFor(d, b, m));
    }
    if (isLingerie(c)) return undefined;
    if (isRange(c)) return rangeFlat(c, m);
    const k = draftSkirt(m as never, c);
    return skirtFlat(k, skirtBelt(c.belt, k));
  } catch {
    return undefined;
  }
}

/** For the Archive's cuts, set out the same way as the house's. */
export { bodice as bodiceChoices, dress as dressChoices, skirt as skirtLook };

// The Maison collection: the house's signature designs, each a set of style choices drafted to the
// sewist's own measurements like any other pattern. Making a look opens its style screen with the
// choices set, so every detail can still be changed.
import type { Finish } from './savedWork';
import type { MyFabric } from './engine/fabrics';
import { COLOURS } from './engine/shopFabrics';
import { dressBelt, skirtBelt } from './engine/belt';
import type { Choices } from './savedWork';
import { crotchGuess, draftBodice, hemDrop } from './engine/bodice';
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
  unusedFor,
  sleeveOf,
  validDetails,
} from './garments';
import { withSlipRise } from './slipRise';
import { EXAMPLE_BODY, Garment, MeasurementId, MeasurementValues, isComplete } from './measurements';
import { HOUSE_COLOURS } from './engine/houseColours';


/** The house's own prints, photographed from the real cloth: the words that name one in a look's fabric, its tile in
 * src/prints (see fabricPhoto.ts) and how wide one tile shows on the garment, in cm. */
const HOUSE_PRINTS: [string, { id: string; size: number }][] = [['leopard python', { id: 'house-leopard-python', size: 26 }]];

/** The fabric a look is named for, read from its words, so its thumbnail draws in that cloth. */
export function lookFabric(words: string): MyFabric {
  // Where the words offer a choice ("Cotton poplin or light wool"), the first cloth named is the one it is made in: read
  // whole, a poplin skirt took the wool's care steps and a satin one was cut as velvet (era pattern review, Nov 14).
  // (A first cloth the tables do not know, a plain "crepe", passes the turn to the next one named. The colour and the
  // print are read from all the words.)
  const all = words.toLowerCase();
  const read = (w: string) => ({
    special: (['denim', 'leather', 'velvet', 'corduroy', 'satin', 'lace', 'sequin'] as const).find((k) => w.includes(k)),
    sheer: /georgette|chiffon|organza|voile|sheer/.test(w),
    fibre: (['silk', 'wool', 'cotton', 'linen', 'viscose', 'polyester'] as const).find((k) => w.includes(k)),
    w,
  });
  const cloths = all.split(/,| or /).map(read);
  const { special, sheer, fibre, w: cloth } = cloths.find((c) => c.special || c.sheer || c.fibre) ?? cloths[0];
  const w = all;
  const colour = COLOURS.map((c) => c.name).find((c) => w.includes(c.toLowerCase())) ?? HOUSE_COLOURS.find(([n]) => w.includes(n))?.[1];
  // A python (or any animal skin) is a one-way print: its scales run one way down the cloth.
  const print = /python|snake|leopard|zebra/.test(w) ? 'oneway' : undefined;
  const crisp = /crisp|sateen|gabardine|poplin|taffeta/.test(cloth);
  const photo = HOUSE_PRINTS.find(([k]) => w.includes(k))?.[1];
  return {
    ...(fibre ? { fibre } : {}),
    ...(special ? { special: special === 'sequin' ? 'sequins' : special } : sheer ? { special: 'sheer' } : {}),
    // A sheer satin only hints at the body: a satin, faintly see-through.
    ...(special === 'satin' && sheer ? { seeThrough: 'faint' as const } : {}),
    ...(colour ? { colour } : {}),
    ...(print ? { print } : {}),
    ...(crisp ? { drape: 'crisp' } : {}),
    ...(/sateen/.test(cloth) && !special ? { sheen: 'soft' as const } : {}),
    // A house print's tile is one repeat of it, so the cutting step can say how to place it.
    ...(photo ? { photo, motif: { repeat: photo.size } } : {}),
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
   *  (Nov 11), the Gold Python Bermuda lined (Nov 12). The maker can still change it on the print screen. */
  finish?: Partial<Pick<Finish, 'bodiceEdges' | 'skirtLined'>>;
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
    // Mini, as the length dot names it: "above the knee" read as the Above knee length, a step longer (pretend tester, Nov 18).
    line: 'A sleeveless mini shift, with a little room at the bust and a hem that flares just enough.',
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
    choices: { ...DEFAULT_TROUSERS_CHOICES, fit: 'relaxed', leg: 'wide', length: 'knee', lengthCm: 68, legCm: { knee: 66, hem: 66 }, pockets: 'slant', pleats: 'double', loops: 'loops', backPockets: 'welt', rise: 'low', press: 'soft' },
    // Lined (Cat, Nov 12): in silk the legs cling and the pocket bags show through, so a lining hangs between.
    finish: { skirtLined: true },
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
    set: 'The Lilac Lace Set',
    name: 'Lilac Lace Blouse',
    line: 'Lilac lace plunging to the waist, with full bishop sleeves gathered at the wrist.',
    fabric: 'Lilac silk lace',
    garment: 'bodice',
    choices: bodice({ fit: 'relaxed', bustEase: 20, darts: 'none', sides: 'straight', pullOn: true, neckline: 'plunge', plungeDepth: 'waist', sleeve: 'long', sleeveShape: 'bishop', sleeveFullness: 'full', sleeveCuff: 'elastic', sleeveHead: 'gathered', length: 'hip', yoke: { front: 0, back: 10, frontSlant: 13, trim: true, frontGather: 4, frontBand: 3.5 }, hemTie: 'drawstring' }),
  },
  {
    // A low-rise barrel leg in the snakeskin brown of the leopard cloth (Cat, 2026-11-11). Worn with the lilac lace
    // blouse as one look, the two side by side (Cat, Nov 14: "put the Barrel trouser and the lilac top in order so they
    // are a look").
    id: 'chocolate-barrel',
    number: 5,
    set: 'The Lilac Lace Set',
    name: 'Chocolate Barrel Trouser',
    line: 'Slung low on the hip, one deep pleat each side opening into a barrel leg that curves out round the knee and narrows to the floor, in a crisp chocolate sateen.',
    fabric: 'Chocolate crisp cotton sateen',
    garment: 'trousers',
    // One deep pleat each side, not two: two added bulk at a low rise (Cat, Nov 14: "fix those pants now").
    choices: { ...DEFAULT_TROUSERS_CHOICES, fit: 'relaxed', leg: 'barrel', length: 'full', rise: 'low', pockets: 'slant', pleats: 'single', loops: 'loops', backPockets: 'welt' },
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
    choices: dress('regular', { neckline: 'scoop', sleeve: 'none', darts: 'bust', bustEase: 4, neck: { frontDepth: 14.5, width: 2, backDepth: 18, fullness: 0.85, strap: 3 }, armholeLower: 8 }, { silhouette: 'straight', length: 'maxi', floorClear: 13, noSeam: 'bias', flareCm: 16, slit: 'none' }),
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
  const c0 = look.choices;
  // A slip's scoop and armhole rise with a fuller bust (see slipRise.ts).
  const c = isDress(c0) ? withSlipRise(c0, m) : c0;
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
  return choicesPatch(look.garment, m ? lookChoices(look, m) : look.choices);
}

/** A look made from the garment being styled, keeping the length the maker set on it: the hem is the maker's, not the
 *  look's (see lengthless). A tester who set 55 cm on the plain skirt and then opened the Black Pleated Skirt got the
 *  look's own 49.3 cm, with no word (pretend tester, Nov 18). `own` is what was styled, `plain` the garment untouched:
 *  a length never moved from where the garment starts is not a pick, so the look keeps its own. Not a top: a peplum
 *  hangs only from some lengths. */
export function lookPatchKeeping(look: HouseLook, m: MeasurementValues, own: PatternChoices, plain: PatternChoices): { garment: Garment } & Record<string, unknown> {
  const made = lookChoices(look, m);
  const g = look.garment;
  const keys = g === 'jacket' || g === 'coat' ? ['length', 'dropCm', 'lengthCm'] : g === 'skirt' || g === 'trousers' || g === 'dress' ? ['length', 'lengthCm', 'kneeShare', 'floorClear'] : [];
  const hemOf = (c: PatternChoices) => (g === 'dress' && isDress(c) ? c.skirt : c) as unknown as Record<string, unknown>;
  const pick = (c: PatternChoices) => Object.fromEntries(keys.filter((k) => hemOf(c)[k] !== undefined).map((k) => [k, hemOf(c)[k]]));
  if (!keys.length || JSON.stringify(pick(own)) === JSON.stringify(pick(plain))) return choicesPatch(g, made);
  const rest = Object.fromEntries(Object.entries(hemOf(made)).filter(([k]) => !keys.includes(k)));
  const hem = { ...rest, ...pick(own) };
  const kept = (g === 'dress' && isDress(made) ? { ...made, skirt: hem } : hem) as unknown as PatternChoices;
  // A dress goes through lookChoices again, so a named mini still stops clear of the crotch on a long rise.
  return choicesPatch(g, g === 'dress' ? lookChoices({ choices: kept }, m) : kept);
}

/** Whether opening a top's tester look leaves behind the length set on the plain top. A top's length is where its hem
 *  sits, but on the Ice Peplum it's where the peplum is sewn on, so carrying it across would move the seam, not the
 *  hem. It stays behind, and the tester is told so rather than finding it gone (pretend-tester walk, Nov 18). */
export function lookDropsLength(look: HouseLook, own: PatternChoices, plain: PatternChoices): boolean {
  if (look.garment !== 'bodice') return false;
  const pick = (c: PatternChoices) => JSON.stringify(['length', 'dropCm', 'lengthCm'].map((k) => (c as unknown as Record<string, unknown>)[k]));
  // Set to the look's own length, nothing is left behind.
  return pick(own) !== pick(plain) && pick(own) !== pick(look.choices);
}

/** Where a garment's choices are kept in the saved work. */
function choicesPatch(garment: Garment, choices: PatternChoices): { garment: Garment } & Record<string, unknown> {
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

/** The hip measurements a top that goes below the waist is drafted from, and still not given: the Ice Peplum (its
 *  peplum seam lowered 6 cm) made from the collection asked the bodice's measuring pages, which never ask the waist to
 *  hip, and Style then stopped at "Add your full hip and waist to hip" with Review greyed out (testers, Nov 12). So
 *  making it asks for these first, as the arms are. */
export function lookHipMissing(look: Pick<HouseLook, 'choices'>, measured: MeasurementValues): MeasurementId[] {
  if (!isBodice(look.choices)) return [];
  const top = look.choices as unknown as BodiceChoices;
  if (hemDrop({ waist_to_hip: 20 }, top) <= 0) return [];
  return (['full_hip', 'waist_to_hip'] as const).filter((id) => measured[id] === undefined);
}

/** The measurements a look is drawn to: the sewist's own when the garment has all it needs, or the sample set. */
export function lookValues(look: HouseLook, values: MeasurementValues): { values: MeasurementValues; own: boolean } {
  // A vest is drawn without the arms (a jacket's arms are only for its sleeves). A top that goes below the waist (the Ice
  // Peplum) needs the hip too: drawn to a top's measurements without it, its card said "This look can't be drafted to
  // these measurements", which a tester read as being told she was too big for it (Nov 18). Until then it's drawn to
  // the sample, like any look still missing a measurement, and making it asks for the hip first.
  const own = isComplete(values, look.garment, undefined, unusedFor(look.choices)) && !lookHipMissing(look, values).length;
  return own ? { values, own: true } : { values: EXAMPLE_BODY, own: false };
}

/** A look made before its garment's measurements were all in is sized to the sample body (its mini's least length,
 *  its trousers' lengths). Once they are in, and nothing has been changed since, it is sized again to the maker's own
 *  body: a petite tester who picked the Blush Shift after the basics kept the sample's mini, and Style lost the look's
 *  name (fit tester walk, Nov 14). Undefined when there is nothing to size again. */
export function lookResized(garment: Garment, current: PatternChoices, values: MeasurementValues): ({ garment: Garment } & Record<string, unknown>) | undefined {
  const now = JSON.stringify(canon(current));
  for (const look of COLLECTION) {
    if (look.garment !== garment || !lookValues(look, values).own || JSON.stringify(canon(lookChoices(look, EXAMPLE_BODY))) !== now) continue;
    const mine = lookChoices(look, values);
    return JSON.stringify(canon(mine)) === now ? undefined : choicesPatch(garment, mine);
  }
  return undefined;
}

/** Keys sorted all the way down, so two sets of choices compare by content, not by the order they were built in. */
const canon = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, x]) => [k, canon(x)])) : v;

/** The choices without what the hem handle on the drawing sets: a skirt's, a dress's or trousers' length, and a top's
 *  length below the waist, and a jacket's or coat's length. Testers are asked to set their own length that way, so it is the maker's, not the look's. */
function lengthless(garment: Garment, c: PatternChoices): unknown {
  const hem = (s: object) => {
    const { length: _l, lengthCm: _c, kneeShare: _k, floorClear: _f, ...rest } = s as Record<string, unknown>;
    return rest;
  };
  if (garment === 'dress' && isDress(c)) return { ...c, skirt: hem(c.skirt) };
  // A jacket's length pick sets its length and lets go of the hem a look set below the waist (the Black Vest's 30 cm);
  // the Black Vest turned into "Your vest" on a length pick (pretend-tester walk, Nov 18).
  if (garment === 'bodice' || garment === 'jacket' || garment === 'coat') {
    const { length: _l, dropCm: _d, lengthCm: _c, ...rest } = c as unknown as Record<string, unknown>;
    return rest;
  }
  return garment === 'skirt' || garment === 'trousers' ? hem(c) : c;
}

/** The look each fit tester sews, by its garment: one per garment. A tester who picked "Top" from the garment list
 *  rather than the Ice Peplum Top from the collection drafted a plain top, with no peplum to pick and the plain top's
 *  questions (testers, Nov 18), so Style points a tester on the plain garment to the look itself. */
export const TESTER_LOOK: Partial<Record<Garment, string>> = { dress: 'blush-shift', bodice: 'ice-peplum', skirt: 'black-pleated-skirt', trousers: 'chocolate-barrel', jacket: 'black-vest' };

/** The collection look these choices still are, for the print's title card ("Leopard Shirt Dress" over the long
 *  description; Cat, Nov 12). Undefined once any option is changed, but not the length: a Blush Shift tester who
 *  dragged her hem to above the knee saw "Your dress" where "Blush Shift" had been (testers, Nov 17). */
export function lookNameOf(garment: Garment, current: PatternChoices, values: MeasurementValues): string | undefined {
  const want = JSON.stringify(canon(lengthless(garment, current)));
  return COLLECTION.find((look) => look.garment === garment && JSON.stringify(canon(lengthless(garment, lookChoices(look, lookValues(look, values).values)))) === want)?.name;
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

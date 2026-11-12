import { SkirtDraft, SkirtMeasurements, draftSkirt, skirtFitOf } from './engine/skirt';
import { BodiceDraft, BodiceMeasurements, draftBodice } from './engine/bodice';
import { DressDraft, DressMeasurements, draftDress } from './engine/dress';
import { TrousersDraft, TrousersMeasurements, draftTrousers, trousersWaistband } from './engine/trousers';
import { TeeDraft, TeeMeasurements, draftTee } from './engine/tee';
import { LingerieDraft, LingerieMeasurements, draftLingerie } from './engine/lingerie';
import { OuterDraft, OuterMeasurements, draftOuter } from './engine/outerwear';
import { waistPieces } from './engine/finishing';
import { SleeveDraft, SleeveMeasurements, draftSleeve, needsArms } from './engine/sleeve';
import { Fitting, toFitting } from './engine/fitting';
import { MyFabric, withFabricEase } from './engine/fabrics';
import { FormKind, Garment, MeasurementValues } from './measurements';
import { DEFAULT_LINGERIE_CHOICES, describeLingerie } from './garments';
import { BodiceChoices, DEFAULT_BODICE, DEFAULT_COAT_CHOICES, DEFAULT_JACKET_CHOICES, DEFAULT_TEE_CHOICES, DEFAULT_TROUSERS_CHOICES, OuterChoices, validDetails, DressChoices, PatternChoices, describeBodice, describeOuter, describeTee, describeTrousers, sleeveOf } from './garments';
import { describe } from './skirtChoices';
import { describePattern } from './screens/describe';
import type { Piece } from './engine/piece';
import { INITIAL, type Saved } from './savedWork';
import { KnitDressDraft, KnitDressMeasurements, draftKnitDress } from './engine/knitDress';
import { HoodieDraft, draftHoodie } from './engine/hoodie';
import { JumpsuitDraft, JumpsuitMeasurements, draftJumpsuit } from './engine/jumpsuit';
import { DEFAULT_HOODIE_CHOICES, DEFAULT_JUMPSUIT_CHOICES, DEFAULT_KNIT_DRESS_CHOICES, describeHoodie, describeJumpsuit, describeKnitDress, hoodieStyleOf, jumpsuitStyleOf, knitDressStyleOf } from './garmentRange';

// The garment catalogue: for each garment, the choices it's styled with, its name on the page, how it's drafted (for
// the style preview, the fitting screen's before and after, and a graded size run), and what its choices go back to
// if a saved choice no longer drafts. Adding a garment means adding its entry here, not finding every place that
// asks which garment is open.

/** Everything a pattern's drafts can hold: one garment's draft, and the sleeve for a bodice or a dress. */
export interface Drafts {
  skirt?: SkirtDraft;
  bodice?: BodiceDraft;
  dress?: DressDraft;
  trousers?: TrousersDraft;
  tee?: TeeDraft;
  lingerie?: LingerieDraft;
  outer?: OuterDraft;
  sleeve?: SleeveDraft;
  knitDress?: KnitDressDraft;
  hoodie?: HoodieDraft;
  jumpsuit?: JumpsuitDraft;
}

/** What every garment is drafted from: the saved choices, the person's form and the fabric bought. */
export interface DraftInputs {
  saved: Pick<Saved, 'choices' | 'bodice' | 'dress' | 'trousers' | 'tee' | 'knitDress' | 'hoodie' | 'jumpsuit' | 'lingerie' | 'jacket' | 'coat'>;
  form: FormKind;
  fabric?: MyFabric;
}

/** The sleeve for a bodice, drafted to its armhole with its allowances, when one is chosen and the arms are measured. */
function sleeveFor(bodice: BodiceDraft, choices: BodiceChoices, values: MeasurementValues): SleeveDraft | undefined {
  const { length, shape, cm, cuff, fullness, headGather } = sleeveOf(choices);
  if (length === 'none' || needsArms(values as SleeveMeasurements)) return undefined;
  return draftSleeve(bodice, values as SleeveMeasurements, {
    length,
    shape,
    ...(cm !== undefined ? { lengthCm: cm } : {}),
    ...(cuff ? { cuff } : {}),
    ...(fullness ? { fullness } : {}),
    ...(headGather ? { headGather } : {}),
    fit: choices.fit,
    seamAllowance: bodice.pieces[0].seamAllowance,
    armholeAllowance: bodice.pieces[0].allowances.armhole ?? 1,
    hemAllowance: 2.5,
  });
}

/** The bodice block's corrections: the toile's, a little ease for heavy cloth, and the menswear form's flat front. */
const bodiceFitting = ({ fabric, form }: DraftInputs, f: Fitting | undefined) => ({ ...withFabricEase(toFitting(f, 'bodice'), fabric, 'bodice'), ...(form === 'menswear' ? { flatFront: true } : {}) });
// Heavy cloth gets a little more ease, on top of the toile's corrections.
const skirtFitting = ({ fabric }: DraftInputs, f: Fitting | undefined) => withFabricEase(toFitting(f, 'skirt'), fabric, 'skirt');

export const skirtStyleOf = (i: DraftInputs, f: Fitting | undefined) => ({ ...i.saved.choices, fitting: skirtFitting(i, f) });
const bodiceStyleOf = (i: DraftInputs, f: Fitting | undefined) => ({ ...validDetails(i.saved.bodice), fitting: bodiceFitting(i, f) });
/** The dress's choices; until it is styled, it starts from the bodice and the skirt. */
export const dressOf = (saved: DraftInputs['saved']): DressChoices =>
  saved.dress ?? { garment: 'dress', fit: saved.bodice.fit, bodice: { ...saved.bodice, length: 'waist' }, skirt: saved.choices };
export const trousersChoicesOf = (saved: DraftInputs['saved']) => saved.trousers ?? DEFAULT_TROUSERS_CHOICES;
export const teeChoicesOf = (saved: DraftInputs['saved']) => saved.tee ?? DEFAULT_TEE_CHOICES;
export const knitDressChoicesOf = (saved: DraftInputs['saved']) => saved.knitDress ?? DEFAULT_KNIT_DRESS_CHOICES;
export const hoodieChoicesOf = (saved: DraftInputs['saved']) => saved.hoodie ?? DEFAULT_HOODIE_CHOICES;
export const jumpsuitChoicesOf = (saved: DraftInputs['saved']) => saved.jumpsuit ?? DEFAULT_JUMPSUIT_CHOICES;
export const lingerieChoicesOf = (saved: DraftInputs['saved']) => saved.lingerie ?? DEFAULT_LINGERIE_CHOICES;
export const outerChoicesOf = (saved: DraftInputs['saved'], g: 'jacket' | 'coat'): OuterChoices =>
  g === 'coat' ? { ...DEFAULT_COAT_CHOICES, ...saved.coat } : { ...DEFAULT_JACKET_CHOICES, ...saved.jacket };
// The menswear form's tee has no bust shaping: front and back cut alike.
const teeStyleOf = (i: DraftInputs) => ({ ...teeChoicesOf(i.saved), ...(i.form === 'menswear' ? { flatFront: true } : {}) });
export const trousersStyleOf = (i: DraftInputs, f: Fitting | undefined) => ({
  ...trousersChoicesOf(i.saved),
  ...(i.form === 'menswear' ? { cut: 'menswear' as const } : {}),
  fitting: skirtFitting(i, f),
});
// Jackets and coats are drafted on the bodice block, so they take the bodice's toile corrections.
const outerStyleOf = (i: DraftInputs, g: 'jacket' | 'coat', f: Fitting | undefined) => {
  const c = outerChoicesOf(i.saved, g);
  return { ...c, kind: c.garment, fitting: bodiceFitting(i, f) };
};
/** The dress in one fit: the bodice at the waist, the skirt below it, each with its toile corrections. */
const dressStylesOf = (i: DraftInputs, f: Fitting | undefined) => {
  const dress = dressOf(i.saved);
  return {
    bodice: { ...validDetails({ ...dress.bodice, length: 'waist' }, 'dress'), fit: dress.fit, length: 'waist' as const, fitting: bodiceFitting(i, f) },
    skirt: { ...dress.skirt, fit: skirtFitOf(dress.fit), fitting: skirtFitting(i, f) },
    seam: { at: dress.waistSeam, cm: dress.waistSeamCm },
  };
};

/** Adds seam allowances to a graded size's pieces, as the print screen would. */
type Allow = (pieces: Piece[]) => Piece[];
// The garment's own pieces: pocket bags don't change with a fitting.
const own = (pcs: Piece[]) => pcs.filter((pc) => pc.kind !== 'pocket');

interface GarmentDrafting {
  /** The choices it's styled with, as a saved pattern keeps them. */
  choices(saved: DraftInputs['saved']): PatternChoices;
  /** Its name on the page: "A-line skirt, knee length". */
  title(saved: DraftInputs['saved']): string;
  /** Its draft, with any toile corrections. Throws a DraftError for a message to the maker. */
  draft(values: MeasurementValues, i: DraftInputs, f: Fitting | undefined): Drafts;
  /** Its main pieces with another set of corrections, for the fitting screen's before and after. */
  piecesWith(values: MeasurementValues, i: DraftInputs, f: Fitting): Piece[];
  /** Its main pieces drafted to any measurements, with allowances, for grading a size run. */
  graded(m: MeasurementValues, i: DraftInputs, f: Fitting | undefined, allow: Allow): Piece[];
  /** What its saved choices go back to when one of them no longer drafts (from an older release). */
  reset: Partial<Saved>;
}

const outerwear = (g: 'jacket' | 'coat'): GarmentDrafting => ({
  choices: (s) => outerChoicesOf(s, g),
  title: (s) => describeOuter(outerChoicesOf(s, g)),
  draft: (values, i, f) => ({ outer: draftOuter(values as OuterMeasurements, outerStyleOf(i, g, f)) }),
  piecesWith: (values, i, f) => draftOuter(values as OuterMeasurements, outerStyleOf(i, g, f)).pieces.filter((pc) => !pc.kind),
  graded: (m, i, f, allow) => allow(draftOuter(m as OuterMeasurements, outerStyleOf(i, g, f)).pieces),
  reset: g === 'coat' ? { coat: DEFAULT_COAT_CHOICES } : { jacket: DEFAULT_JACKET_CHOICES },
});

export const GARMENT_DRAFTING: Record<Garment, GarmentDrafting> = {
  skirt: {
    choices: (s) => s.choices,
    title: (s) => describe(s.choices),
    draft: (values, i, f) => ({ skirt: draftSkirt(values as SkirtMeasurements, skirtStyleOf(i, f)) }),
    piecesWith: (values, i, f) => own(draftSkirt(values as SkirtMeasurements, skirtStyleOf(i, f)).pieces),
    graded: (m, i, f, allow) => {
      const k = draftSkirt(m as SkirtMeasurements, skirtStyleOf(i, f));
      return allow([...k.pieces, ...waistPieces(k, 1.5)]);
    },
    reset: { choices: INITIAL.choices },
  },
  bodice: {
    choices: (s) => s.bodice,
    title: (s) => describeBodice(s.bodice),
    draft: (values, i, f) => {
      const style = bodiceStyleOf(i, f);
      const bodice = draftBodice(values as BodiceMeasurements, style);
      return { bodice, sleeve: sleeveFor(bodice, style, values) };
    },
    piecesWith: (values, i, f) => draftBodice(values as BodiceMeasurements, { ...i.saved.bodice, fitting: bodiceFitting(i, f) }).pieces,
    graded: (m, i, f, allow) => {
      const style = bodiceStyleOf(i, f);
      const b = draftBodice(m as BodiceMeasurements, style);
      return allow([...b.pieces, ...(sleeveFor(b, style, m)?.pieces ?? [])]);
    },
    reset: { bodice: DEFAULT_BODICE },
  },
  dress: {
    choices: (s) => dressOf(s),
    title: (s) => describePattern(dressOf(s)),
    draft: (values, i, f) => {
      const st = dressStylesOf(i, f);
      const d = draftDress(values as DressMeasurements, st.bodice, st.skirt, st.seam);
      return { dress: d, sleeve: sleeveFor(d.bodice, st.bodice, values) };
    },
    piecesWith: (values, i, f) => {
      const st = dressStylesOf(i, f);
      return own(draftDress(values as DressMeasurements, st.bodice, st.skirt, st.seam).pieces);
    },
    graded: (m, i, f, allow) => {
      const st = dressStylesOf(i, f);
      const d = draftDress(m as DressMeasurements, st.bodice, st.skirt, st.seam);
      return allow([...d.pieces, ...(sleeveFor(d.bodice, st.bodice, m)?.pieces ?? [])]);
    },
    reset: { dress: undefined, choices: INITIAL.choices, bodice: DEFAULT_BODICE },
  },
  trousers: {
    choices: (s) => trousersChoicesOf(s),
    title: (s) => describeTrousers(trousersChoicesOf(s)),
    draft: (values, i, f) => ({ trousers: draftTrousers(values as TrousersMeasurements, trousersStyleOf(i, f)) }),
    piecesWith: (values, i, f) => draftTrousers(values as TrousersMeasurements, trousersStyleOf(i, f)).block,
    graded: (m, i, f, allow) => {
      const t = draftTrousers(m as TrousersMeasurements, trousersStyleOf(i, f));
      return allow([...t.pieces, trousersWaistband(t, 1.5)]);
    },
    reset: { trousers: DEFAULT_TROUSERS_CHOICES },
  },
  // A knit block fits by stretch, so no woven toile corrections or heavy-cloth ease go into it, and its pieces keep
  // their 1 cm allowances whatever the style.
  tee: {
    choices: (s) => teeChoicesOf(s),
    title: (s) => describeTee(teeChoicesOf(s)),
    draft: (values, i) => ({ tee: draftTee(values as TeeMeasurements, teeStyleOf(i)) }),
    piecesWith: (values, i) => draftTee(values as TeeMeasurements, teeStyleOf(i)).pieces,
    graded: (m, i) => draftTee(m as TeeMeasurements, teeStyleOf(i)).pieces,
    reset: { tee: DEFAULT_TEE_CHOICES },
  },
  // The Garment range (2026-11-07). The knit dress and hoodie fit by stretch like the T-shirt, so no woven toile
  // corrections go into them; the jumpsuit has none of its own yet either (its fit test comes first).
  knit_dress: {
    choices: (s) => knitDressChoicesOf(s),
    title: (s) => describeKnitDress(knitDressChoicesOf(s)),
    draft: (values, i) => ({ knitDress: draftKnitDress(values as KnitDressMeasurements, knitDressStyleOf(knitDressChoicesOf(i.saved), i.form === 'menswear')) }),
    piecesWith: (values, i) => draftKnitDress(values as KnitDressMeasurements, knitDressStyleOf(knitDressChoicesOf(i.saved), i.form === 'menswear')).pieces,
    graded: (m, i) => draftKnitDress(m as KnitDressMeasurements, knitDressStyleOf(knitDressChoicesOf(i.saved), i.form === 'menswear')).pieces,
    reset: { knitDress: DEFAULT_KNIT_DRESS_CHOICES },
  },
  hoodie: {
    choices: (s) => hoodieChoicesOf(s),
    title: (s) => describeHoodie(hoodieChoicesOf(s)),
    draft: (values, i) => ({ hoodie: draftHoodie(values as TeeMeasurements, hoodieStyleOf(hoodieChoicesOf(i.saved), i.form === 'menswear')) }),
    piecesWith: (values, i) => draftHoodie(values as TeeMeasurements, hoodieStyleOf(hoodieChoicesOf(i.saved), i.form === 'menswear')).pieces,
    graded: (m, i) => draftHoodie(m as TeeMeasurements, hoodieStyleOf(hoodieChoicesOf(i.saved), i.form === 'menswear')).pieces,
    reset: { hoodie: DEFAULT_HOODIE_CHOICES },
  },
  jumpsuit: {
    choices: (s) => jumpsuitChoicesOf(s),
    title: (s) => describeJumpsuit(jumpsuitChoicesOf(s)),
    draft: (values, i) => ({ jumpsuit: draftJumpsuit(values as JumpsuitMeasurements, jumpsuitStyleOf(jumpsuitChoicesOf(i.saved))) }),
    piecesWith: (values, i) => own(draftJumpsuit(values as JumpsuitMeasurements, jumpsuitStyleOf(jumpsuitChoicesOf(i.saved))).pieces),
    graded: (m, i, _f, allow) => allow(draftJumpsuit(m as JumpsuitMeasurements, jumpsuitStyleOf(jumpsuitChoicesOf(i.saved))).pieces),
    reset: { jumpsuit: DEFAULT_JUMPSUIT_CHOICES },
  },
  lingerie: {
    choices: (s) => lingerieChoicesOf(s),
    title: (s) => describeLingerie(lingerieChoicesOf(s)),
    draft: (values, i) => ({ lingerie: draftLingerie(values as LingerieMeasurements, lingerieChoicesOf(i.saved)) }),
    piecesWith: (values, i) => draftLingerie(values as LingerieMeasurements, lingerieChoicesOf(i.saved)).pieces,
    graded: (m, i) => draftLingerie(m as LingerieMeasurements, lingerieChoicesOf(i.saved)).pieces,
    reset: {},
  },
  jacket: outerwear('jacket'),
  coat: outerwear('coat'),
};

import { Belt, beltAllowed, beltWords } from './engine/belt';
import type { Choices } from './savedWork';
import { piecesLengthCm, toMetres } from './engine/fabric';
import { layPlan } from './engine/layplan';
import { waistPieces } from './engine/finishing';
import { Silhouette, SkirtDraft } from './engine/skirt';
import { isShaped } from './engine/hem';
import { elasticCutAllowed, validCut } from './engine/slip';
import { wrapSkirtAllowed } from './engine/wrapSkirt';
import { slitOf } from './engine/slit';
import { facedAllowed, highAllowed, sideZipAllowed } from './engine/skirtWaist';
import { buttonsOf, yokeOf } from './engine/skirtFront';
import { BAND_ACROSS_MAX } from './engine/instructions';
import { findLook } from './engine/eras';
import { layoutExtras, volumeWords } from './engine/skirtVolume';

// The skirt's choices as data: the groups on the Style screen, what each detail allows, the skirt's name in words
// and the fabric it needs. Kept apart from the screen so the drafting, the photo reading and the print can use them.

type ChoiceGroup<K extends keyof Choices> = { id: K; label: string; options: [NonNullable<Choices[K]>, string][] };

export const GROUPS: [ChoiceGroup<'fit'>, ChoiceGroup<'silhouette'>, ChoiceGroup<'length'>, ChoiceGroup<'asymHem'>] = [
  { id: 'fit', label: 'Fit', options: [['fitted', 'Fitted'], ['regular', 'Regular'], ['relaxed', 'Relaxed']] },
  {
    id: 'silhouette',
    label: 'Silhouette',
    options: [['pencil', 'Pencil'], ['straight', 'Straight'], ['a_line', 'A-line'], ['gathered', 'Gathered'], ['trumpet', 'Trumpet'], ['half_circle', 'Half circle'], ['circle', 'Full circle'], ['slip', 'Bias slip']],
  },
  {
    id: 'length',
    label: 'Length',
    options: [['mini', 'Mini'], ['above_knee', 'Above knee'], ['knee', 'Knee'], ['midi', 'Midi'], ['maxi', 'Maxi']],
  },
  { id: 'asymHem', label: 'Hem', options: [['none', 'Level'], ['high_low', 'High-low'], ['diagonal', 'Diagonal']] },
];

/** How full a gathered skirt is (In testing): soft, full or dramatic gathers. Unchosen, it follows the fit. */
export const GATHERS_GROUP: ChoiceGroup<'gathers'> = { id: 'gathers', label: 'Gathers', options: [['soft', 'Soft'], ['full', 'Full'], ['dramatic', 'Dramatic']] };
/** The gathers as they will be cut: the chosen ones, or the fit's own, named by the nearest. */
export const gathersOf = (c: Pick<Choices, 'gathers' | 'fit'>): NonNullable<Choices['gathers']> => c.gathers ?? (c.fit === 'fitted' ? 'soft' : c.fit === 'regular' ? 'full' : 'dramatic');

/** The chosen option in a group: older saves have no hem choice, which is a level hem. */
export const chosen = (c: Choices, id: keyof Choices) => (id === 'asymHem' ? c.asymHem ?? 'none' : c[id]);
/** The skirt's details: in-seam pockets, and a zipped waistband, a faced or high faced waist, a pull-on
 * elastic waist or a wrap that ties. */
export const DETAIL_GROUPS: [{ id: 'waist'; label: string; options: [NonNullable<Choices['waist']> | 'wrap', string][] }, ChoiceGroup<'pockets'>] = [
  { id: 'waist', label: 'Waist', options: [['band', 'Waistband with zip'], ['faced', 'Faced, no band'], ['high', 'High waist'], ['elastic', 'Elastic, pull-on'], ['wrap', 'Wrap, tied']] },
  { id: 'pockets', label: 'Pockets', options: [['none', 'None'], ['inseam', 'In-seam']] },
];

/** The front: plain and darted, a yoke that takes the darts, or buttoned down the centre front. */
export const FRONT_GROUP: { id: 'front'; label: string; options: ['plain' | 'yoke' | 'buttons', string][] } = {
  id: 'front',
  label: 'Front',
  options: [
    ['plain', 'Plain'],
    ['yoke', 'Yoke'],
    ['buttons', 'Buttoned'],
  ],
};

/** The front as it will be made: a yoke or buttons only where the skirt can take them. */
export const frontOf = (c: Choices): 'plain' | 'yoke' | 'buttons' => (yokeOf(c) ? 'yoke' : buttonsOf(c) ? 'buttons' : 'plain');

/** Where the zip goes, on a skirt with one: the centre back, or the left side with the back on the fold. */
export const ZIP_PLACES: ['back' | 'side', string][] = [
  ['back', 'Centre back'],
  ['side', 'Left side'],
];

/** The waist a skirt can have: a faced or high waist falls back to the band where the shape can't take it. */
const waistOf = (c: Choices): string => {
  const w = c.waist ?? 'band';
  return (w === 'faced' && !facedAllowed(c)) || (w === 'high' && !highAllowed(c)) ? 'band' : w;
};
/** A detail as saved: older saves have no pockets and a zipped waistband. A wrap is kept apart from the waist. */
export const detailOf = (c: Choices, id: 'waist' | 'pockets'): string => (id === 'waist' ? (c.wrap && wrapSkirtAllowed(c) ? 'wrap' : waistOf(c)) : (c.pockets ?? 'none'));
/** Where the zip is, or none on a pull-on or wrap skirt. */
export const zipOf = (c: Choices): 'back' | 'side' | undefined => {
  const w = detailOf(c, 'waist');
  if (w === 'elastic' || w === 'wrap' || buttonsOf(c)) return undefined;
  return c.zip === 'side' && sideZipAllowed(c) ? 'side' : 'back';
};
/** Picking a waist: the wrap is its own flag, so picking it puts the waistband back, and the others let it go. */
export const withWaist = (c: Choices, id: string): Choices =>
  id === 'wrap' ? { ...c, waist: undefined, wrap: true } : { ...c, waist: id === 'band' ? undefined : (id as Choices['waist']), wrap: undefined };
/** The choices without the wrap where the skirt can no longer wrap. */
export const keepWrap = (c: Choices): Choices => (c.wrap && !wrapSkirtAllowed(c) ? { ...c, wrap: undefined } : c);

/** A pencil skirt is shaped by its darts, so it can't be gathered onto elastic; nor can a bias slip, a
 * diagonal hem or pleats (see elasticCutAllowed). */
export const elasticAllowed = (c: Pick<Choices, 'silhouette' | 'asymHem' | 'pleats'> & { silhouette: Silhouette }) => c.silhouette !== 'pencil' && elasticCutAllowed(c);

/** In-seam pockets go in a plain side seam: not where pleats, godets, a flounce or tiers change the
 * skirt's pieces, nor on a skirt cut whole. */
export const pocketsAllowed = (c: Choices) => volumeWords(c) === '' && !yokeOf(c) && c.silhouette !== 'slip' && c.asymHem !== 'diagonal' && !(c.wrap && wrapSkirtAllowed(c));

/** The choices with the zipped waistband back where an elastic waist isn't allowed. */
export const keepWaist = (c: Choices): Choices => (elasticAllowed(c) ? c : { ...c, waist: undefined });

/** "a, b and c". */
const andList = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** What the skirt has besides its shape, for its name: " with a shaped hem, an elastic waist and pockets". */
function detailWords(c: Choices): string[] {
  // A slit chosen is named; the walking slit a narrow skirt gets unasked is not.
  const slit = c.slit && c.slit !== 'none' ? slitOf(c) : undefined;
  const waist = detailOf(c, 'waist');
  return [
    slit ? `a ${slit.at} slit` : '',
    waist === 'faced' ? 'a faced waist' : '',
    yokeOf(c) ? 'a yoke' : buttonsOf(c) ? 'a button front' : '',
    zipOf(c) === 'side' ? 'a side zip' : '',
    c.waist === 'elastic' && elasticAllowed(c) ? 'an elastic waist' : '',
    c.pockets === 'inseam' && pocketsAllowed(c) ? 'pockets' : '',
    beltWords(beltOf_(c))].filter(Boolean);
}

/** The belt as it will be made: none on a wrap, and no loops on a pull-on elastic waist. */
export const beltOf_ = (c: Choices): Belt => {
  const w = detailOf(c, 'waist');
  const b = c.belt ?? 'none';
  return beltAllowed(b, { wrap: w === 'wrap', elastic: w === 'elastic' }) ? b : 'none';
};

/** True when the skirt has been shaped by hand: a dragged length or flare, or a drawn hem. */
const handShaped = (c: Choices) => c.lengthCm !== undefined || c.flareCm !== undefined || isShaped(c.hem);

/** The era look the choices came from, if they still have its shape and length. */
export function currentLook(c: Choices) {
  const look = findLook(c.look);
  return look && look.silhouette === c.silhouette && look.length === c.length && !handShaped(c) ? look : undefined;
}

export function describe(c: Choices) {
  const look = currentLook(c);
  const v = validCut(c);
  // Pleats, godets, a flounce or tiers: "with knife pleats". A drawn hem gives way to them; a high-low
  // or diagonal hem, an elastic waist and pockets go last: "with 6 godets and a high-low hem".
  const words = volumeWords(v);
  const hem = v.asymHem === 'high_low' ? 'a high-low hem' : v.asymHem === 'diagonal' ? 'a diagonal hem' : !words && isShaped(c.hem) && !look ? 'a shaped hem' : '';
  const parts = [words.replace(/^with /, ''), hem, ...detailWords(v)].filter(Boolean);
  const withTail = parts.length ? ` with ${andList(parts)}` : '';
  if (look) return `${look.name}${withTail}`;
  if (c.shape) return `Skirt matched to a photo${withTail.replace(' with', ', with')}`;
  const len = c.lengthCm !== undefined ? `${Math.round(c.lengthCm)} cm` : GROUPS[2].options.find((o) => o[0] === v.length)![1];
  const sil = v.silhouette === 'slip' ? 'Bias-cut slip' : GROUPS[1].options.find((o) => o[0] === v.silhouette)![1];
  return `${len} ${detailOf(v, 'waist') === 'high' ? 'high-waisted ' : ''}${sil === 'A-line' ? sil : sil.toLowerCase()} ${c.wrap && wrapSkirtAllowed(v) ? 'wrap ' : ''}skirt${withTail}`;
}

/** Fabric needed on 140 cm wide fabric, from the cutting layout of the pieces and the waistband. A
 * rough estimate where the pieces are too wide to lay out. */
export function fabricMetres(draft: SkirtDraft): number {
  const all = [...draft.pieces, ...layoutExtras(draft), ...waistPieces(draft, 1.5)];
  // Whole bias pieces too wide for 140 cm cloth are bought 150 cm wide (the fabric advice says so).
  const lay = layPlan(all, 140) ?? (draft.bias ? layPlan(all, 150) : undefined);
  if (lay) return lay.metres;
  if (draft.bias) {
    // Too wide even then: each piece end to end, turned to 45 degrees.
    const along = (pc: SkirtDraft['pieces'][number]) => {
      const ys = pc.outline.taggedPoints(8).pts.map((q) => (q.x + q.y) / Math.SQRT2);
      return (Math.max(...ys) - Math.min(...ys)) * (pc.meta.whole ? 1 : 2);
    };
    return toMetres(draft.pieces.reduce((t, pc) => t + along(pc), 0) + 25);
  }
  const { cutLength, cutWidth } = draft.waistband;
  const band = cutLength <= BAND_ACROSS_MAX ? cutWidth : cutLength;
  return toMetres(piecesLengthCm([...draft.pieces, ...layoutExtras(draft)]) + band + 15);
}


// The knits the T-shirt's Fabric step offers as swatches: the tee is the one garment drafted for stretch, so it
// shows knits where every woven garment shows fibres and special cloths. Each knit records the fibre, weight and
// drape it usually comes in, and how far it usually stretches, so picking one fills those in and the fabric check
// can say when the knit stretches less than the stretch chosen for the tee.
// Kept apart from fabrics.ts (which imports nothing back from here) so the swatch row and the advice share one list.
// Keep to plain ASCII punctuation: these words go into the PDF and the tech pack.
import type { Stretch } from './tee';

export type Knit = 'jersey' | 'rib' | 'interlock' | 'terry' | 'ponte' | 'slub' | 'waffle' | 'modal';
type Weight = 'light' | 'medium' | 'heavy';
type Drape = 'crisp' | 'soft' | 'fluid';
type Fibre = 'cotton' | 'linen' | 'wool' | 'silk' | 'viscose' | 'polyester' | 'blend';

export interface KnitInfo {
  /** On the swatch card. */
  label: string;
  /** In a sentence and the PDF: "cotton jersey". */
  words: string;
  fibre: Fibre;
  weight: Weight;
  drape: Drape;
  /** How far it usually stretches across the width. */
  stretch: Stretch;
}

export const KNITS: Record<Knit, KnitInfo> = {
  jersey: { label: 'Jersey', words: 'cotton jersey', fibre: 'cotton', weight: 'light', drape: 'soft', stretch: 'medium' },
  slub: { label: 'Slub', words: 'slub jersey', fibre: 'cotton', weight: 'light', drape: 'soft', stretch: 'medium' },
  modal: { label: 'Modal', words: 'modal jersey', fibre: 'viscose', weight: 'light', drape: 'fluid', stretch: 'high' },
  rib: { label: 'Rib', words: 'rib knit', fibre: 'cotton', weight: 'medium', drape: 'soft', stretch: 'high' },
  interlock: { label: 'Interlock', words: 'cotton interlock', fibre: 'cotton', weight: 'medium', drape: 'soft', stretch: 'low' },
  waffle: { label: 'Waffle', words: 'waffle knit', fibre: 'cotton', weight: 'medium', drape: 'soft', stretch: 'low' },
  terry: { label: 'Terry', words: 'French terry', fibre: 'cotton', weight: 'medium', drape: 'soft', stretch: 'low' },
  ponte: { label: 'Ponte', words: 'ponte', fibre: 'blend', weight: 'heavy', drape: 'crisp', stretch: 'low' },
};

export const KNIT_IDS = Object.keys(KNITS) as Knit[];

export const isKnit = (id: string | undefined): id is Knit => !!id && id in KNITS;

const RANK: Record<Stretch, number> = { low: 0, medium: 1, high: 2 };
const WORD: Record<Stretch, string> = { low: 'low', medium: 'medium', high: 'high' };

/** When the knit picked usually stretches less than the stretch chosen for the tee, so the tee would come out tight. */
export function knitStretchWarning(knit: Knit | undefined, chosen: Stretch): string | undefined {
  if (!knit) return undefined;
  const k = KNITS[knit];
  if (RANK[k.stretch] >= RANK[chosen]) return undefined;
  return `${k.label} usually has ${WORD[k.stretch]} stretch, less than the ${WORD[chosen]} stretch you chose, so the tee would come out tight. Do the stretch test on your piece, or choose ${k.stretch === 'low' ? 'Low' : 'Medium'} stretch.`;
}

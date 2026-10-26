import type { DressDraft } from './engine/dress';
import { BodiceDraft } from './engine/bodice';
import { LingerieDraft } from './engine/lingerie';
import { TeeDraft } from './engine/tee';
import { OuterDraft } from './engine/outerwear';
import { SleeveDraft } from './engine/sleeve';
import { TrousersDraft } from './engine/trousers';
import { layPlan } from './engine/layplan';
import { piecesLengthCm, toMetres } from './engine/fabric';

// The fabric each garment needs, read from its cutting layout, for the Style screens' Fabric tab and the print.

/** Fabric needed on 140 cm wide fabric, from the cutting layout. */
export const bodiceFabricMetres = (draft: BodiceDraft, sleeve?: SleeveDraft) => {
  const pieces = [...draft.pieces, ...(sleeve?.pieces ?? [])];
  return layPlan(pieces, 140)?.metres ?? toMetres(piecesLengthCm(pieces) + 10);
};

/** Bias binding for the neck and armholes; with sleeves, for the neck, or for the armhole seams of a lined bodice.
 * Some to spare for joins. */
export const bindingMetres = (draft: BodiceDraft, binds: { neck: boolean; armholes: boolean } = { neck: true, armholes: true }) =>
  toMetres((binds.neck ? draft.neck : 0) + (binds.armholes ? (draft.drape?.kind === 'one_shoulder' ? 1 : 2) * draft.armhole : 0) + 20);

/** Fabric for the dress on 140 cm wide fabric, from the cutting layout, or a rough estimate. */
// Whole bias pieces too wide for 140 cm cloth are bought 150 cm wide.
export const dressFabricMetres = (pieces: DressDraft['pieces']) =>
  (layPlan(pieces, 140) ?? (pieces.some((pc) => pc.meta.bias) ? layPlan(pieces, 150) : undefined))?.metres ?? toMetres(piecesLengthCm(pieces) + 10);

/** Knit on 150 cm wide fabric, from the cutting layout; swimwear needs the same again in lining. */
export const lingerieFabricMetres = (draft: LingerieDraft) => layPlan(draft.pieces, 150)?.metres ?? toMetres(piecesLengthCm(draft.pieces) + 10);

/** Self fabric needed on 140 cm wide fabric, from the cutting layout of the shell pieces. */
export const outerFabricMetres = (draft: OuterDraft) => {
  const self = draft.pieces.filter((pc) => pc.kind !== 'lining');
  return layPlan(self, 140)?.metres ?? toMetres(piecesLengthCm(self) + 10);
};

/** Knit on 150 cm wide fabric, from the cutting layout. */
export const teeFabricMetres = (draft: TeeDraft) => layPlan(draft.pieces, 150)?.metres ?? toMetres(piecesLengthCm(draft.pieces) + 10);

/** Fabric needed on 140 cm wide fabric, from the cutting layout. */
export const trousersFabricMetres = (draft: TrousersDraft) => layPlan(draft.pieces, 140)?.metres ?? toMetres(piecesLengthCm(draft.pieces) + 10);

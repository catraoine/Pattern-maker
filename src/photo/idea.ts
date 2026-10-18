// "Something else", described: the described idea as style choices for the garment it starts from, and the
// few picks worth showing before measuring for it. Reuses the photo reading's mapping, so a described
// garment and a photographed one start the same way.
import type { Choices } from '../App';
import { BODICE_GROUPS, TEE_GROUPS, TROUSER_GROUPS, isBodice, isDress, isOuter, isTee, isTrousers, outerGroups, type PatternChoices } from '../garments';
import type { Garment } from '../measurements';
import { setVolume } from '../engine/skirtVolume';
import { validCut } from '../engine/slip';
import { GROUPS } from '../screens/StyleScreen';
import { choicesFor } from './garments';
import type { IdeaReading, PieceKind } from './types';

/** The photo reading's "top" is the app's bodice. */
export const pieceGarment = (p: PieceKind): Garment => (p === 'top' ? 'bodice' : p);

/** A skirt cut on the bias: the slip silhouette, which takes no pleats, pockets or matched proportions. */
function onBias(c: Choices): Choices {
  const { pockets: _p, shape: _s, ...rest } = setVolume(c, 'none');
  return validCut({ ...rest, silhouette: 'slip' });
}

/** The choices to start from, or none when the app can't make it yet. */
export function ideaChoices(idea: IdeaReading): PatternChoices | undefined {
  if (idea.verdict === 'not_yet' || !idea.start) return undefined;
  const c = choicesFor(idea.reading, idea.start);
  if (!idea.bias) return c;
  if (isDress(c)) return { ...c, skirt: onBias(c.skirt) };
  if (idea.start === 'skirt') return onBias(c as Choices);
  return c;
}

type Groups = { id: string; label: string; options: readonly (readonly [string, string])[] }[];

/** "Neckline: Cowl", from a style group's own words. */
function rows(groups: Groups, c: object, ids: string[], rename: Record<string, string> = {}): [string, string][] {
  const out: [string, string][] = [];
  for (const id of ids) {
    const g = groups.find((x) => x.id === id);
    const value = (c as Record<string, unknown>)[id];
    const word = g?.options.find(([v]) => v === value)?.[1];
    if (g && word) out.push([rename[id] ?? g.label, word]);
  }
  return out;
}

/** The picks shown on "We can make that": the ones that make the garment what was asked for. */
export function ideaRows(c: PatternChoices): [string, string][] {
  if (isDress(c)) return [...rows(BODICE_GROUPS, c.bodice, ['neckline', 'sleeve']), ...rows(GROUPS, c.skirt, ['silhouette', 'length'], { silhouette: 'Skirt' })];
  if (isBodice(c)) return rows(BODICE_GROUPS, c, ['neckline', 'sleeve', 'length']);
  if (isTee(c)) return rows(TEE_GROUPS, c, ['neckline', 'sleeve', 'length']);
  if (isTrousers(c)) return rows(TROUSER_GROUPS, c, ['leg', 'length', 'waist']);
  if (isOuter(c)) return rows(outerGroups(c.garment), c, ['length', 'front', 'collar']);
  return rows(GROUPS, c, ['silhouette', 'length', ...((c as Choices).asymHem && (c as Choices).asymHem !== 'none' ? ['asymHem'] : [])]);
}

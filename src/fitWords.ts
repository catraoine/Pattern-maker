// Describing a toile in your own words (Cat, Nov 28: "Yes I want that"): the person types what they see when they try
// their toile on, the reader picks the matching problems from the fitting list, and the person ticks them and sets the
// amounts themselves. Shared by the app and the server, so both work from the same list. Nothing here changes a pattern.
import { FIT_ISSUES, appliesTo, toggleIssue, type FitIssue, type FitTarget, type Fitting } from './engine/fitting';
import type { Side } from './engine/skirt';
import type { PhotoError } from './photo/types';

/** Long enough for a few sentences about a toile, short enough to bound what one reading can cost. */
export const MAX_FIT_WORDS = 600;

/** Every garment a toile can be fitted for, so the server can turn away anything else. */
const FIT_TARGETS: Record<FitTarget, true> = {
  skirt: true,
  bodice: true,
  dress: true,
  trousers: true,
  tee: true,
  knit_dress: true,
  hoodie: true,
  jumpsuit: true,
  jacket: true,
  coat: true,
  lingerie: true,
};
export const isFitTarget = (g: unknown): g is FitTarget => typeof g === 'string' && Object.prototype.hasOwnProperty.call(FIT_TARGETS, g);

/** The problems the fitting page lists for this garment: the same list on the page and for the reader. */
export const fitIssuesFor = (garment: FitTarget, hasBustDart: boolean): FitIssue[] =>
  FIT_ISSUES.filter((i) => appliesTo(i, garment) && (hasBustDart || !i.needsBustDart));

/** One problem the reader found in their words, and the side when they named one. */
export interface FitMatch {
  id: string;
  side: Side | null;
}

export interface FitReading {
  matches: FitMatch[];
  /** What they describe that the list can't correct yet, in a few of their own words each. */
  notCovered: string[];
}

export type FitWordsResponse = { ok: true; reading: FitReading } | { ok: false; error: PhotoError };

/** Their words, trimmed; null when there is nothing to read or too much. */
export function checkFitWords(text: unknown): string | null {
  if (typeof text !== 'string') return null;
  const t = text.trim();
  return t && t.length <= MAX_FIT_WORDS ? t : null;
}

/**
 * Keep only what the page can show: problems on this garment's list, each once, and never a problem with its opposite
 * (the first one named wins, as ticking one on the page clears the other).
 */
export function keepMatches(matches: FitMatch[], issues: FitIssue[]): FitMatch[] {
  const out: FitMatch[] = [];
  for (const m of matches) {
    const issue = issues.find((i) => i.id === m.id);
    if (!issue || out.some((o) => o.id === m.id || o.id === issue.opposite)) continue;
    out.push({ id: m.id, side: issue.sided ? m.side : null });
  }
  return out;
}

/**
 * Tick the problems the person confirmed, each at its usual starting amount for them to set. One already ticked keeps
 * the amount and side they gave it.
 */
export function tickMatches(f: Fitting, picked: FitMatch[]): Fitting {
  let next = f;
  for (const m of picked) {
    if (next.issues[m.id] !== undefined) continue;
    next = toggleIssue(next, m.id);
    if (m.side) next = { ...next, sides: { ...next.sides, [m.id]: m.side } };
  }
  return next;
}

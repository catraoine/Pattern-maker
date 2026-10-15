// How a sewn pattern fitted, noted by the sewist against a saved pattern. Kept on this device with the pattern,
// so the next toile can start from what was learnt.
import { PatternChoices, isBodice } from './garments';

export type Verdict = 'good' | 'tweaks' | 'off';
/** -1 too tight (or short), 0 right, 1 too loose (or long). */
export type AreaFit = -1 | 0 | 1;

export interface FitFeedback {
  verdict: Verdict;
  areas: Partial<Record<FitArea, AreaFit>>;
  notes: string;
  /** What was sewn: a toile (test garment) or the real thing. */
  made: 'toile' | 'garment';
  at: string; // ISO date
}

export type FitArea = 'waist' | 'hip' | 'length' | 'flare' | 'bust' | 'shoulders' | 'armholes' | 'neckline' | 'back';

interface AreaInfo {
  id: FitArea;
  label: string;
  /** Words for -1 and 1. */
  words: [string, string];
}

const SNUG: [string, string] = ['Too tight', 'Too loose'];

const SKIRT_AREAS: AreaInfo[] = [
  { id: 'waist', label: 'Waist', words: SNUG },
  { id: 'hip', label: 'Hip', words: SNUG },
  { id: 'flare', label: 'Hem width', words: ['Too narrow', 'Too full'] },
  { id: 'length', label: 'Length', words: ['Too short', 'Too long'] },
];

const BODICE_AREAS: AreaInfo[] = [
  { id: 'bust', label: 'Bust', words: SNUG },
  { id: 'waist', label: 'Waist', words: SNUG },
  { id: 'shoulders', label: 'Shoulders', words: ['Too narrow', 'Too wide'] },
  { id: 'armholes', label: 'Armholes', words: SNUG },
  { id: 'neckline', label: 'Neckline', words: ['Too high', 'Gapes'] },
  { id: 'back', label: 'Back length', words: ['Too short', 'Too long'] },
];

export const fitAreas = (choices: PatternChoices) => (isBodice(choices) ? BODICE_AREAS : SKIRT_AREAS);

export const VERDICTS: [Verdict, string][] = [
  ['good', 'Fits well'],
  ['tweaks', 'Needs small changes'],
  ['off', "Doesn't fit"],
];

export const NOTES_MAX = 1000;

export const emptyFit = (): FitFeedback => ({ verdict: 'good', areas: {}, notes: '', made: 'toile', at: new Date().toISOString() });

/** One line for the saved pattern list, e.g. "Needs small changes · waist too tight, length too long". */
export function fitSummary(fit: FitFeedback, choices: PatternChoices): string {
  const verdict = VERDICTS.find(([v]) => v === fit.verdict)![1];
  const off = fitAreas(choices)
    .filter((a) => fit.areas[a.id] === -1 || fit.areas[a.id] === 1)
    .map((a) => `${a.label.toLowerCase()} ${a.words[fit.areas[a.id] === -1 ? 0 : 1].toLowerCase()}`);
  return off.length ? `${verdict} · ${off.join(', ')}` : verdict;
}

/** Drop areas the garment doesn't have and trim the notes, so only clean feedback is saved. */
export function cleanFit(fit: FitFeedback, choices: PatternChoices): FitFeedback {
  const areas: FitFeedback['areas'] = {};
  for (const a of fitAreas(choices)) {
    const v = fit.areas[a.id];
    if (v === -1 || v === 0 || v === 1) areas[a.id] = v;
  }
  return { ...fit, areas, notes: fit.notes.trim().slice(0, NOTES_MAX) };
}

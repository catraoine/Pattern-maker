// Simple or all tools: a first-time sewist sees only what a first pattern needs, and the professional
// tools wait behind one quiet link. Nothing is removed; the setting is kept with the account.
import type { Account } from './account';
import type { Finish } from './App';

export type Mode = NonNullable<Account['mode']>;

/**
 * The account's chosen view. New people start simple. Accounts from before there was a choice open with
 * all the tools, so nobody finds something they used has gone.
 */
export const modeOf = (account: Account): Mode => account.mode ?? (account.onboarded ? 'all' : 'simple');

/** Tools tucked away in the simple view. Anything not listed here shows in both. */
export const PRO_TOOLS = [
  // Style screens. Starting a skirt from a photo shows in both: it is a beginner's way in, not a pro tool.
  'easeMap', // the ease map preview
  'dartMoves', // moving the bust dart, princess seams
  'insideFinish', // lining, neck and armhole finish, seam allowance styles
  // Print screen
  'bigPrint', // A0 copy shop and projector files
  'byHand', // draft-it-by-hand pages
  'techFlat', // the technical flat card
  'toile', // the true-scale view (the toile fitting itself shows in both, since 2026-10-21: it fixes what the tape can't)
  'makerPack', // send to a dressmaker, tech pack, DXF, SVG, how it was drafted
  'sizeRun', // grading a size run
  'couture', // the couture sewing route
  // Measuring and account
  'posture', // optional posture measurements
  'clientBook',
  'checkFile',
] as const;

export type ProTool = (typeof PRO_TOOLS)[number];

/** Whether a tool shows in this view. */
export const shows = (mode: Mode, tool: ProTool): boolean => mode === 'all' || !PRO_TOOLS.includes(tool);

/** What the simple view uses for the choices it hides: home seam allowances, the quick route, no extra pages. */
export const SIMPLE_FINISH = { allowances: 'home', skirtLined: false, bodiceEdges: 'binding', atelier: false, byHand: false, route: 'quick' } satisfies Partial<Finish>;

const HIDDEN = Object.keys(SIMPLE_FINISH) as (keyof typeof SIMPLE_FINISH)[];

/** The finish the pattern is drafted and printed with: in the simple view, its hidden choices are the simple ones. */
export const finishFor = (stored: Finish, mode: Mode): Finish => (mode === 'simple' ? { ...stored, ...SIMPLE_FINISH } : stored);

/**
 * The finish to keep after a change made in this view. The simple view only changes what it shows (fabric,
 * width, nap), so the choices made with all the tools are still there when they come back.
 */
export function keepFinish(stored: Finish, next: Finish, mode: Mode): Finish {
  if (mode === 'all') return next;
  const kept = { ...next };
  for (const k of HIDDEN) (kept as Record<string, unknown>)[k] = stored[k];
  return kept;
}

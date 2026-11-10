

// The app's screens, which of the three steps each belongs to, and the ladder the back button climbs.

export type Step = 'measure' | 'style' | 'export';
export type View = Step | 'plans' | 'welcome' | 'steps' | 'account' | 'photo' | 'fitting' | 'scale' | 'client' | 'check' | 'imported' | 'privacy' | 'terms' | 'tester' | 'news' | 'collection' | 'link' | 'arrive' | 'form' | 'formprint' | 'brands' | 'nights' | 'move' | 'made' | 'help';

export const STEPS: { id: Step; label: string }[] = [
  { id: 'measure', label: 'Measure' },
  { id: 'style', label: 'Style' },
  { id: 'export', label: 'Print' },
];

/** Which of the three steps each screen belongs to, lit in the header. Account and the legal pages belong to none. */
export const STEP_OF: Partial<Record<View, Step>> = { steps: 'measure', measure: 'measure', style: 'style', photo: 'style', export: 'export', fitting: 'export', scale: 'export' };

/** Side screens name where they hang off, under the header, so you can see where you are. */
export const SIDE: Partial<Record<View, [string, string]>> = {
  photo: ['Style', 'From a photo'],
  fitting: ['Print', 'Fitting'],
  scale: ['Print', 'True size'],
  client: ['Account', 'Client book'],
  arrive: ['Account', 'Client book'],
  check: ['Account', 'Check a file'],
  form: ['Account', 'Body Double'],
  formprint: ['Body Double', 'Cover pattern'],
  brands: ['Account', 'For brands'],
  nights: ['Account', 'Atelier Nights'],
  help: ['Account', 'Help & feedback'],
};

/** This tab's last screen, in sessionStorage, so a reload opens there again (journey review, Nov 10). */
export const PLACE_KEY = 'maison-trace-place';

/** Screens that draw a pattern, so they need the measurements first. */
export const NEEDS_MEASUREMENTS: View[] = ['style', 'export', 'fitting', 'scale'];

/**
 * The fixed ladder back climbs (Cat's B Fixed Ladder, 2026-10-24): Print hangs off Style, Style off your
 * measurements, the measurements off the welcome, however the sewist got there.
 */
const RUNGS: Partial<Record<View, View[]>> = { welcome: ['welcome'], measure: ['welcome', 'measure'], style: ['welcome', 'measure', 'style'], export: ['welcome', 'measure', 'style', 'export'] };
/** Side screens that always hang off the same screen. */
const HANGS_OFF: Partial<Record<View, View>> = { photo: 'style', collection: 'style', fitting: 'export', scale: 'export', client: 'account', check: 'account', form: 'account', imported: 'check', formprint: 'form', help: 'account' };
/** The screens `to` hangs off. Any other screen (Account, Plans, the legal pages, the guided measuring) hangs off
 *  the one it was opened from, and going to one already behind steps back to it. */
export const ladder = (to: View, trail: View[]): View[] => {
  // A side trip to the measurements from Style or Print hangs off the screen it was opened from, so back returns
  // there, not to the welcome (journey review, Nov 10: "Back returns to where you came from").
  const from = trail[trail.length - 1];
  if (to === 'measure' && (from === 'style' || from === 'export')) return [...trail, 'measure'];
  const rung = RUNGS[to];
  if (rung) return rung;
  const parent = HANGS_OFF[to];
  if (parent) return [...ladder(parent, trail), to];
  const at = trail.indexOf(to);
  return at >= 0 ? trail.slice(0, at + 1) : [...trail, to];
};

/** Where the header's back goes when there's nothing behind in history, such as after a reload. */
export const PARENT: Partial<Record<View, View>> = { measure: 'welcome', steps: 'welcome', style: 'measure', photo: 'style', export: 'style', fitting: 'export', scale: 'export', account: 'style', client: 'account', arrive: 'client', link: 'welcome', check: 'account', imported: 'check', form: 'account', formprint: 'form', privacy: 'welcome', terms: 'welcome', tester: 'account', news: 'account', brands: 'account', nights: 'account', move: 'welcome', made: 'welcome', help: 'account' };

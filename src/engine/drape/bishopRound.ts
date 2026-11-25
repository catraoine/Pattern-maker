// How round a bishop sleeve is held in All round. A bishop's hem is gathered into its band by about the band's round
// again or more (isBishop in sleeve.ts, the same rule as the Flat and Front drawings), and its gathers fall in soft
// folds close down the arm and blouse just above the band: it is no tube of its full girth. Held to its whole round, the Ice Peplum Top's organza bishops stood off
// the arm as two balloons wider than the top, where CLO hangs them close above the elbow and full just over the wrist
// (EG cold read, Nov 24).
// (Held to 0.75 of it the sleeve creased and failed the drawing check; 0.8 passes. Its blouse, laid on after the sim
// round the tube it already makes, swelled the forearm out past the peplum at its whole fullness; at 0.6 of it the
// sleeve is fullest just above the band as in CLO, 2026-11-25.)
import { knob } from './knob';

/** The share of its cut round a bishop is held to. */
const BISHOP_ROUND = 0.8;
/** The share of its fullness a bishop blouses out by above a plain band. */
const BISHOP_SWELL = 0.6;

/** A bishop sleeve's hold round the arm and its blouse above the band, or undefined when it is no bishop or keeps its
 *  own round (keepOwn): a puff, whose gathered crown stands out by design; a full bishop, whose gathered bulk stands it
 *  round (laid close, a full silk bishop crumpled into 15 to 29 sharp folds down the arm, 2026-11-06); a knit's, as
 *  jersey holds its round. */
export const bishopRound = (bishop: boolean, keepOwn: boolean) => (bishop && !keepOwn ? { r: knob('__bishopR') ?? BISHOP_ROUND, swell: BISHOP_SWELL } : undefined);

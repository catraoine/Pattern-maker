import { createContext } from 'react';
import type { Garment } from '../measurements';
import type { FilmPart } from './TourPlayer';

// The Watch demo clips on the testers' own garments (Cat, Nov 13: "move forward with all fixes"): How Style works and
// Draw a line on your pattern, recorded again on the collection look each group of testers sews (the Blush Shift, the
// Ice Peplum Top, the Chocolate Barrel Trouser), so the clip shows the garment on their screen. Any other garment
// plays the example skirt's clip. Recorded by scripts/record-demos.mjs as style-<kind> and patterns-<kind>.

/** The garment open on the style screen, so a Watch demo can play the clip made on that kind of garment. */
export const DemoGarment = createContext<Garment | undefined>(undefined);

type Kind = 'dress' | 'bodice' | 'trousers';

/** Which recorded kind a garment is closest to; a knit dress looks like the shift on the drawing and the pattern. */
export const kindOf = (g?: Garment): Kind | undefined =>
  g === 'dress' || g === 'knit_dress' ? 'dress' : g === 'bodice' ? 'bodice' : g === 'trousers' ? 'trousers' : undefined;

type Film = { base: string; parts: FilmPart[]; length: string };

const STYLE_SAYS = (fit: string, kind: Kind) => [
  `Pick how close it fits. Here, ${fit}. The pattern redraws to fit you.`,
  // On the peplum top the dot moves the seam the peplum hangs from (the EC tester walk, Nov 22).
  kind === 'bodice' ? 'Drag the dot to move the peplum seam up or down.' : 'Drag the hem up or down to set the length.',
  'Tap Pattern to see the pieces you will cut.',
];
const style = (kind: Kind, fit: string, at: number[], length: string): Film => ({
  base: `/demos/style-${kind}`,
  parts: ['Fit', 'Length', 'Pattern'].map((name, i) => ({ name, from: at[i], says: STYLE_SAYS(fit, kind)[i] })),
  length,
});

const patterns = (kind: Kind, fuller: string, cut: string, at: number[], length: string): Film => ({
  base: `/demos/patterns-${kind}`,
  parts: [
    { name: 'Pattern', from: at[0], says: 'These are your pattern pieces. Draw a line across one to change it.' },
    { name: 'Spread', from: at[1], says: `Choose what the line does. Here, spread it open. Drag the round handle to open it more. ${fuller}` },
    { name: 'New piece', from: at[2], says: cut },
    { name: 'Edited', from: at[3], says: 'Notches are added so the pieces match. To start again, tap Back to drafted.' },
  ],
  length,
});

/** Where each part starts, from the recording log (update with the clips). */
export const KIND_FILMS: Partial<Record<'style' | 'patterns', Record<Kind, Film>>> = {
  style: {
    dress: style('dress', 'relaxed', [0, 8.9, 14.4], '0:22'),
    bodice: style('bodice', 'relaxed', [0, 9.0, 18.1], '0:26'),
    trousers: style('trousers', 'regular', [0, 8.9, 14.6], '0:22'),
  },
  patterns: {
    dress: patterns('dress', 'The hem gets fuller.', 'Or draw across a piece and cut it off as a new piece. Here, a front yoke.', [0, 11.6, 24.3, 31.8], '0:41'),
    bodice: patterns('bodice', 'The peplum gets fuller.', 'Or draw across a piece and cut it off as a new piece. Here, a back yoke.', [0, 11.7, 24.0, 31.6], '0:41'),
    trousers: patterns('trousers', 'The leg gets wider at the hem.', 'Or draw across the hip and cut it off as a new piece. Here, a yoke.', [0, 11.9, 24.4, 32.3], '0:42'),
  },
};

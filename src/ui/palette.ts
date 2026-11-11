/** The app's colours for the drawings painted on canvas, SVG and the all-round scene, where CSS variables can't reach.
 *  They match --paper, --gild, --gild-glow, --ink and --muted in src/styles/01-base.css: change both together.
 *  The ground is true black again: Cat tried oxblood (T3) on Nov 6 and took it back the same day ("looking bad"). */
export const GROUND = '#000000';
/** The ground as r,g,b for fades into the page. */
export const GROUND_RGB = '0,0,0';
export const SHADOW = '#000000';
export const GILD = '#d9c49b';
export const GLOW = '#f3e6c8';
export const INK = '#efe4cc';
const MUTED = '#9a8e78';
/** A colour as the number three.js wants. */
export const hex = (c: string) => parseInt(c.slice(1), 16);

/** The colours a picture is painted in: the ground behind it, its lines and its quiet words. */
export type Tone = { ground: string; groundRgb: string; gild: string; glow: string; muted: string };
/** Black ground, champagne lines: the app everywhere outside the style screen's picture windows. */
export const DARK: Tone = { ground: GROUND, groundRgb: GROUND_RGB, gild: GILD, glow: GLOW, muted: MUTED };
/** The style screen's picture windows (Cat's B, Nov 11; C1 warm stone depth): chalk inside the window, the lines in dark ink so they
 *  still show. Match --chalk and the window's colours in src/styles/34-chalk-windows.css. */
export const CHALK: Tone = { ground: '#dcd5c7', groundRgb: '220,213,199', gild: '#2a2622', glow: '#1d1a17', muted: '#6c6250' };

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
export const MUTED = '#9a8e78';
/** A colour as the number three.js wants. */
export const hex = (c: string) => parseInt(c.slice(1), 16);

/** The app's colours for the drawings painted on canvas, SVG and the all-round scene, where CSS variables can't reach.
 *  They match --paper, --gild, --gild-glow, --ink and --muted in src/styles/01-base.css: change both together.
 *  The ground is oxblood taken down to near-black (Cat's T3, Nov 6; true black before), and shadows are a deeper
 *  oxblood, never black. */
export const GROUND = '#120805';
/** The ground as r,g,b for fades into the page. */
export const GROUND_RGB = '18,8,5';
export const SHADOW = '#080302';
export const GILD = '#dfbe84';
export const GLOW = '#f6e2b6';
export const INK = '#f3dfb7';
export const MUTED = '#a28c69';
/** A colour as the number three.js wants. */
export const hex = (c: string) => parseInt(c.slice(1), 16);

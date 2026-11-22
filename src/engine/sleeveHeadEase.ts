// How much longer than its armhole a set-in sleeve head can be cut depends on the cloth. Wool shrinks in under steam, so
// 3 cm disappears into a smooth round head. A sheer (silk organza, chiffon, georgette, voile) does not shrink at all:
// every extra centimetre has to sit somewhere, and it shows as small puckers along the top of the armhole, through the
// cloth and through its bound seam. The Ice Peplum Top was cut with the fitted sleeve's 3 cm in silk organza, 9 to 13
// per cent more sleeve than armhole between the notches on every body (Fit: Ice Peplum sleeve deep dive, Nov 22 2026).
// An unpadded jacket's head is held to 2 cm for the same reason (UNPADDED_CROWN in sleeve.ts).
import type { MyFabric } from './fabrics';
import type { SewStep } from './instructions';

/** The most crown ease a sleeve head takes in a sheer, in cm: enough to round the head over the shoulder, and little
 *  enough to spread by hand with no steam. */
export const SHEER_CROWN_EASE = 1.5;

/** The most crown ease this cloth's sleeve head takes, or undefined when the fit's own ease stands. */
export function crownEaseFor(f: MyFabric | undefined): number | undefined {
  return f?.special === 'sheer' && f.matchEase !== false ? SHEER_CROWN_EASE : undefined;
}

/** The easing step for a sheer: the ease is spread by hand, since steam will not shrink it away. A sleeve that kept
 *  the fit's own ease (the maker turned "adjust the ease for this fabric" off) keeps its own words too. */
export function easeSheerHead(st: SewStep): SewStep {
  const said = /by its ease, ([\d.]+) cm at the front and ([\d.]+) cm at the back/.exec(st.text);
  if (!said || Number(said[1]) + Number(said[2]) > SHEER_CROWN_EASE + 0.3) return st;
  return { ...st, text: st.text.replace(' Steam it over a ham and let it cool.', ' A sheer does not shrink in under steam, so this crown is cut with very little ease: spread it evenly with your fingers, and pin closely.') };
}

// A shift lined to the hem (SS27 Look 01, the Blush Shift, Nov 11: "to a 10", a full lining with the neck and armholes
// finished in one, and a deep hem for weight). The lined route already finishes the neck and armholes with the lining;
// what it lacked was the hem: it turned up 2.5 cm of the 4 cm allowance by machine, and the lining was never hemmed.
// Here the whole allowance turns up and is catch-stitched by hand, so nothing shows on the outside and the weight of the
// deep hem makes the crepe hang straight, and the lining hangs free 2.5 cm shorter, held at the side seams by thread chains.
import type { SewingGuide } from './instructions';

/** How much shorter the finished lining hangs than the dress, in cm. */
export const LINING_SHORTER = 2.5;

/** The sewing guide for a lined shift: a deep hand-finished hem, and the lining hemmed on its own. */
export function withLinedShiftHem(g: SewingGuide, hemCm: number): SewingGuide {
  const steps = g.steps.flatMap((st) =>
    st.title !== 'Hem'
      ? [st]
      : [
          {
            title: 'Hem the dress',
            text: `Try the dress on and check the length. Overlock or zigzag the raw edge of the hem, then press up the whole ${hemCm} cm hem allowance along the hem line, easing in any fullness with steam. Catch-stitch it to the dress by hand, catching only a thread or two of the outside so nothing shows, the stitches loose so the hem never puckers. The deep hem's weight helps the dress hang straight.`,
          },
          {
            title: 'Hem the lining',
            text: `Let the lining hang down inside the dress, and trim it level, ${LINING_SHORTER - 2} cm above the dress's finished hem. Press up 1 cm, then 1 cm more, and stitch by machine: it then hangs ${LINING_SHORTER} cm above the dress hem, free so the two can move apart. At each side seam, join the lining hem to the dress hem with a 3 cm thread chain, so the lining cannot twist round or show.`,
          },
        ],
  );
  return { ...g, steps };
}

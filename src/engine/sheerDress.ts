// A dress in a sheer cloth, sewn the quick way. The cloth card promises French seams and a narrow rolled hem, and the
// pieces are cut for them (1 cm at the hems), but the dress's steps were the plain ones: seams pressed open and
// overlocked, and hems turned up by more cloth than was cut (era pattern review, Nov 14). A top has its own (sheerTop.ts).
import type { DressDraft } from './dress';
import type { SewingGuide } from './instructions';
import type { SleeveDraft } from './sleeve';
import { asFrenchSeam } from './sheerTop';

/**
 * The dresses these steps are written for: a waist seam, a centre back zip, and set-in sleeves or none. The others (cut in
 * one, on the bias, a wrap, a shirt dress, a draped or boned bodice, a side zip, a kimono or raglan sleeve) word their
 * seams their own way, with clips, tapes and openings a French seam cannot take, and keep their plain steps.
 */
export const sheerDressSuits = (d: DressDraft, sleeve: SleeveDraft | undefined) =>
  !d.noSeam && !d.zipSide && !d.skirtButtons && d.zipCm > 0 && !d.bodice.wrap && !d.bodice.drape && !d.bodice.top && d.bodice.closure === 'back_zip' && !sleeve?.cut;

/**
 * The dress's guide with its shoulder, side and sleeve seams sewn as French seams, and its hems turned by what was cut.
 * `plainSides`: the side seams hold pockets or a slit, which a French seam cannot go round, so they stay plain; a sleeve
 * seam left open at the wrist for a vent or a tie cuff's slit stays plain for the same reason. `narrowHem`: the hems are cut 1 cm.
 */
export function withSheerDress(g: SewingGuide, seam: string, o: { plainSides: boolean; narrowHem: boolean }): SewingGuide {
  const plain = (title: string, text: string) => (title === 'Sew the side seams' && o.plainSides) || (title === 'Sew the sleeve seams' && / (vent|slit)\b/.test(text));
  let french = false;
  const steps = g.steps.map((st) => {
    if ((st.title === 'Sew the shoulders' || st.title === 'Sew the side seams' || st.title === 'Sew the sleeve seams') && !plain(st.title, st.text)) {
      french = true;
      return asFrenchSeam(st, seam);
    }
    if (o.narrowHem && (st.title === 'Hem' || st.title === 'Hem the sleeves')) return { ...st, text: st.text.replace(/ress up [\d.]+ cm( [^,.]*)?, then [\d.]+ cm more/, (_, where: string | undefined) => `ress up 0.5 cm${where ?? ''}, then 0.5 cm more`) };
    return st;
  });
  if (!french) return { ...g, steps };
  return {
    ...g,
    steps: steps.map((st) =>
      st.title === 'Neaten the edges'
        ? { ...st, text: 'Every seam shows through a sheer, so the seams sewn as French seams in the steps below need no neatening: they enclose their own edges. Neaten only the edges a French seam cannot be used on, the centre back edges either side of the zip and any seam the steps sew plain: overcast them by hand or with a narrow zigzag close to the edge. The waist seam is neatened once it is sewn.' }
        : st,
    ),
  };
}

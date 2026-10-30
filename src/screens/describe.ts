import { beltWords } from '../engine/belt';
import { PatternChoices, bodiceDetails, describeBodice, describeOuter, describeTee, describeTrousers, describeLingerie, isLingerie, isBodice, isDress, isOuter, isTee, isTrousers } from '../garments';
import { GROUPS, describe as describeSkirt } from '../skirtChoices';
import { buttonsOnSkirt, noSeamAllowed } from '../engine/dress';
import { wrapSkirtAllowed } from '../engine/wrapSkirt';

const SEAM_WORDS = { empire: 'empire-line', raised: 'high-waisted', natural: '', dropped: 'drop-waist', low: 'low-waisted' } as const;

/** A plain name for a saved pattern's style, such as "Knee A-line skirt". */
export function describePattern(c: PatternChoices) {
  if (isDress(c)) {
    // A sash or belt loops go at the end of the name, like pockets; a wrap ties already.
    const belted = c.bodice.closure === 'wrap' ? '' : beltWords(c.skirt.belt ?? 'none');
    // Cut in one from shoulder to hem: "Knee sheath dress with a boat neck and short sleeves".
    if (c.skirt.noSeam && noSeamAllowed(c.bodice)) {
      const len = c.skirt.lengthCm !== undefined ? `${Math.round(c.skirt.lengthCm)} cm` : GROUPS[2].options.find((o) => o[0] === c.skirt.length)![1];
      return `${len} ${c.fit === 'boxy' ? 'boxy ' : ''}${c.skirt.noSeam} dress with ${bodiceDetails(c.bodice)}${belted ? `, and ${belted}` : ''}`;
    }
    // "Knee A-line dress with knife pleats, a scoop neck and short sleeves". A hem named on the skirt
    // ("with a high-low hem") goes last: "... dress with a crew neck, and a high-low hem". The dress's
    // skirt has no waistband of its own; its pockets go at the end of the name too.
    const [skirt, tail = ''] = describeSkirt({ ...c.skirt, pockets: undefined, waist: undefined, belt: undefined }).split(/ with (.*)/);
    const parts = tail ? tail.split(' and ') : [];
    const hem = parts.find((t) => / hem$/.test(t));
    const details = parts.filter((t) => t !== hem);
    // Buttoned down the front from the neck to the skirt, it is a shirt dress; crossed over and tied, a wrap dress.
    // A seam dragged to its own height is named by which side of the waist it sits.
    const seam = c.waistSeamCm !== undefined ? (c.waistSeamCm < 0 ? 'raised' : c.waistSeamCm > 0 ? 'dropped' : 'natural') : c.waistSeam;
    const kind = c.bodice.closure === 'front_buttons' && buttonsOnSkirt(c.skirt) ? 'shirt dress' : c.bodice.closure === 'wrap' && wrapSkirtAllowed(c.skirt) ? 'wrap dress' : 'dress';
    const word = `${c.fit === 'boxy' ? 'boxy ' : ''}${seam && seam !== 'natural' ? `${SEAM_WORDS[seam]} ${kind}` : kind}`;
    const dress = /skirt/.test(skirt) ? skirt.replace('skirt', word) : `${skirt} ${word}`;
    const ends = [...(hem ? [hem] : []), ...(c.skirt.pockets === 'inseam' ? ['pockets'] : []), ...(belted ? [belted] : [])];
    return `${dress} with ${details.length ? `${details.join(' and ')}, ` : ''}${bodiceDetails(c.bodice)}${ends.length ? `, and ${ends.join(' and ')}` : ''}`;
  }
  if (isTrousers(c)) return describeTrousers(c);
  if (isTee(c)) return describeTee(c);
  if (isOuter(c)) return describeOuter(c);
  if (isLingerie(c)) return describeLingerie(c);
  return isBodice(c) ? describeBodice(c) : describeSkirt(c);
}

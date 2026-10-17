import { PatternChoices, bodiceDetails, describeBodice, describeTrousers, isBodice, isDress, isTrousers } from '../garments';
import { describe as describeSkirt } from './StyleScreen';

/** A plain name for a saved pattern's style, such as "Knee a-line skirt". */
export function describePattern(c: PatternChoices) {
  if (isDress(c)) {
    // The dress's skirt has no waistband of its own; its pockets go at the end of the name.
    const skirt = describeSkirt({ ...c.skirt, pockets: undefined, waist: undefined });
    return `${/skirt/.test(skirt) ? skirt.replace('skirt', 'dress') : `${skirt} dress`} with ${bodiceDetails(c.bodice)}${c.skirt.pockets === 'inseam' ? ', and pockets' : ''}`;
  }
  if (isTrousers(c)) return describeTrousers(c);
  return isBodice(c) ? describeBodice(c) : describeSkirt(c);
}

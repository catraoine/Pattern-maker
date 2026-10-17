import { PatternChoices, bodiceDetails, describeBodice, describeOuter, describeTrousers, isBodice, isDress, isOuter, isTrousers } from '../garments';
import { describe as describeSkirt } from './StyleScreen';

/** A plain name for a saved pattern's style, such as "Knee a-line skirt". */
export function describePattern(c: PatternChoices) {
  if (isDress(c)) {
    const skirt = describeSkirt(c.skirt);
    return `${/skirt/.test(skirt) ? skirt.replace('skirt', 'dress') : `${skirt} dress`} with ${bodiceDetails(c.bodice)}`;
  }
  if (isTrousers(c)) return describeTrousers(c);
  if (isOuter(c)) return describeOuter(c);
  return isBodice(c) ? describeBodice(c) : describeSkirt(c);
}

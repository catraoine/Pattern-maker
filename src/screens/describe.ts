import { PatternChoices, bodiceDetails, describeBodice, isBodice, isDress } from '../garments';
import { describe as describeSkirt } from './StyleScreen';

/** A plain name for a saved pattern's style, such as "Knee a-line skirt". */
export function describePattern(c: PatternChoices) {
  if (isDress(c)) {
    const skirt = describeSkirt(c.skirt);
    return `${/skirt/.test(skirt) ? skirt.replace('skirt', 'dress') : `${skirt} dress`} with ${bodiceDetails(c.bodice)}`;
  }
  return isBodice(c) ? describeBodice(c) : describeSkirt(c);
}

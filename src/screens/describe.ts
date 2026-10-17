import { PatternChoices, bodiceDetails, describeBodice, describeOuter, describeTrousers, isBodice, isDress, isOuter, isTrousers } from '../garments';
import { describe as describeSkirt } from './StyleScreen';

/** A plain name for a saved pattern's style, such as "Knee a-line skirt". */
export function describePattern(c: PatternChoices) {
  if (isDress(c)) {
    // "Knee a-line dress with knife pleats, a scoop neck and short sleeves". A hem named on the skirt
    // ("with a high-low hem") goes last: "... dress with a crew neck, and a high-low hem".
    const [skirt, tail = ''] = describeSkirt(c.skirt).split(/ with (.*)/);
    const parts = tail ? tail.split(' and ') : [];
    const hem = parts.find((t) => / hem$/.test(t));
    const details = parts.filter((t) => t !== hem);
    const dress = /skirt/.test(skirt) ? skirt.replace('skirt', 'dress') : `${skirt} dress`;
    return `${dress} with ${details.length ? `${details.join(' and ')}, ` : ''}${bodiceDetails(c.bodice)}${hem ? `, and ${hem}` : ''}`;
  }
  if (isTrousers(c)) return describeTrousers(c);
  if (isOuter(c)) return describeOuter(c);
  return isBodice(c) ? describeBodice(c) : describeSkirt(c);
}

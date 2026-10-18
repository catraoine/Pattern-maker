import { PatternChoices, bodiceDetails, describeBodice, describeOuter, describeTee, describeTrousers, describeLingerie, isLingerie, isBodice, isDress, isOuter, isTee, isTrousers } from '../garments';
import { describe as describeSkirt } from './StyleScreen';

/** A plain name for a saved pattern's style, such as "Knee a-line skirt". */
export function describePattern(c: PatternChoices) {
  if (isDress(c)) {
    // "Knee a-line dress with knife pleats, a scoop neck and short sleeves". A hem named on the skirt
    // ("with a high-low hem") goes last: "... dress with a crew neck, and a high-low hem". The dress's
    // skirt has no waistband of its own; its pockets go at the end of the name too.
    const [skirt, tail = ''] = describeSkirt({ ...c.skirt, pockets: undefined, waist: undefined }).split(/ with (.*)/);
    const parts = tail ? tail.split(' and ') : [];
    const hem = parts.find((t) => / hem$/.test(t));
    const details = parts.filter((t) => t !== hem);
    const dress = /skirt/.test(skirt) ? skirt.replace('skirt', 'dress') : `${skirt} dress`;
    const ends = [...(hem ? [hem] : []), ...(c.skirt.pockets === 'inseam' ? ['pockets'] : [])];
    return `${dress} with ${details.length ? `${details.join(' and ')}, ` : ''}${bodiceDetails(c.bodice)}${ends.length ? `, and ${ends.join(' and ')}` : ''}`;
  }
  if (isTrousers(c)) return describeTrousers(c);
  if (isTee(c)) return describeTee(c);
  if (isOuter(c)) return describeOuter(c);
  if (isLingerie(c)) return describeLingerie(c);
  return isBodice(c) ? describeBodice(c) : describeSkirt(c);
}

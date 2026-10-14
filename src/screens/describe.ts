import { PatternChoices, describeBodice, isBodice } from '../garments';
import { describe as describeSkirt } from './StyleScreen';

/** A plain name for a saved pattern's style, such as "Knee a-line skirt". */
export function describePattern(c: PatternChoices) {
  return isBodice(c) ? describeBodice(c) : describeSkirt(c);
}

// Swimwear and lingerie aren't drafted yet (Cat's L2, 2026-10-18): a described idea that names one gets a sign-up
// for the Swim and Intimates drop in place of the plain "Not yet". Read from the idea's short name, so it works
// whatever the note says.
const SWIM_INTIMATES = /\b(swim\w*|bathing|bikini|tankini|monokini|one[- ]piece|rash ?guard|lingerie|bra|bras|bralette|bralet|bustier|bodysuit|body suit|teddy|brief|briefs|knickers|panties|thong|underwear|undies|boxers?|chemise|babydoll|camisole set|negligee|intimates?)\b/i;

/** Whether a described idea is swimwear or lingerie, which the Swim and Intimates drop will cover. */
export const isSwimIntimates = (name: string): boolean => SWIM_INTIMATES.test(name);

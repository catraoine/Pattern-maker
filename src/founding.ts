// What a Founding Atelier member was promised (emails of Nov 12 2026; Cat's pick Nov 13: $35 a year, 250 places; lowered
// to $34 on Nov 16, so the one line strangers read, 30% off the $49 Premium, is true: $34 is 31% off), and
// when each part starts. The list itself is on the server (src/server/founding.ts); the app only asks for the
// signed-in person's place, through cloud().founding().

export type FoundingPlace = { n: number; kind: 'tester' | 'founding' | 'gift' };

/** Founding members come in two days before launch, from midnight on Mar 16 in Vancouver (7 am UTC: daylight time
 *  starts on Mar 14). Cat moved launch from Feb 11 to Mar 18, 2027 on Nov 25, 2026. */
export const EARLY_ACCESS_FROM = new Date('2027-03-16T07:00:00Z');
/** The fit testers' free year of Premium starts at launch, Mar 18 2027, and runs to Mar 18 2028. */
const TESTER_FREE_UNTIL = 'Mar 18, 2028';

const FOUNDING_PRICE = '$34 a year';

/** The one line a stranger reads about founding places, on the waitlist page, the joined page and the founding card
 *  (Cat's words, Nov 16 2026: "The first 250 lock in 30% off Premium - that's it"). */
export const FOUNDING_LINE = 'The first 250 lock in 30% off Premium.';

/** Whether founding members can come past the waitlist page yet. */
export const earlyAccessOpen = (now = new Date()) => now.getTime() >= EARLY_ACCESS_FROM.getTime();

/** The lines Your account shows a founding member, word for word as promised. */
export function foundingLines(p: FoundingPlace): string[] {
  // A gift place is never charged, so it is shown no price and no end date.
  if (p.kind === 'gift') return ['Premium is yours, free, for as long as you want to use it.'];
  const price = `Premium at ${FOUNDING_PRICE} instead of $49, locked in for as long as you stay`;
  return p.kind === 'tester'
    ? ['The app opens to you on Mar 16, two days before launch.', `A free first year of Premium from launch, until ${TESTER_FREE_UNTIL}. After that, ${price}.`, 'A vote on what we make next.']
    : ['Early access from Mar 16, before the public launch on Mar 18.', `${price}.`, 'First to be invited to the next fit round, and a say in what we draft next.'];
}

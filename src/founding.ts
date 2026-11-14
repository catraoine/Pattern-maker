// What a Founding Atelier member was promised (emails of Nov 12 2026; Cat's pick Nov 13: $35 a year, 250 places), and
// when each part starts. The list itself is on the server (src/server/founding.ts); the app only asks for the
// signed-in person's place, through cloud().founding().

export type FoundingPlace = { n: number; kind: 'tester' | 'founding' };

/** Founding members come in two days before launch, from midnight on Feb 9 in Vancouver (8 am UTC, before daylight time). */
export const EARLY_ACCESS_FROM = new Date('2027-02-09T08:00:00Z');
/** The fit testers' free year of Premium starts at launch, Feb 11 2027, and runs to Feb 11 2028. */
const TESTER_FREE_UNTIL = 'Feb 11, 2028';

const FOUNDING_PRICE = '$35 a year';

/** Whether founding members can come past the waitlist page yet. */
export const earlyAccessOpen = (now = new Date()) => now.getTime() >= EARLY_ACCESS_FROM.getTime();

/** The lines Your account shows a founding member, word for word as promised. */
export function foundingLines(p: FoundingPlace): string[] {
  const price = `Premium at ${FOUNDING_PRICE} instead of $49, locked in for as long as you stay`;
  return p.kind === 'tester'
    ? ['The app opens to you on Feb 9, two days before launch.', `A free first year of Premium from launch, until ${TESTER_FREE_UNTIL}. After that, ${price.charAt(0).toLowerCase()}${price.slice(1)}.`, 'A vote on what we make next.']
    : ['Early access from Feb 9, before the public launch on Feb 11.', `${price}.`, 'First to be invited to the next fit round, and a say in what we draft next.'];
}

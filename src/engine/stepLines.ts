// A sewing step's words as one action per line (Cat's A Tick list, Nov 21), split at each full stop so nothing is
// reworded: testers mid-round read the same words as their printed booklet, just laid out to tick off one at a time.

/** The step's sentences, in order. Joined back with a space they give the step's own words. */
export const stepLines = (text: string): string[] =>
  text
    .trim()
    .split(/(?<=[.!?]["’”)]?)\s+(?=[A-Z0-9"‘“(])/)
    .filter((s) => s.length > 0);

/** A line that says how things are rather than what to do ("The facing is left soft.", "Do not wash it.") has nothing
 *  to tick off, so it reads as a note (EA walk, Nov 21). */
export const isNote = (line: string) => /^(The|This|These|That|It|It's|Its|They|There|Your|Do not|Don't|Never|Note)\b/.test(line);

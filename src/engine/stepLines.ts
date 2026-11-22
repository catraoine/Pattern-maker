// A sewing step's words as one action per line (Cat's A Tick list, Nov 21), split at each full stop so nothing is
// reworded: testers mid-round read the same words as their printed booklet, just laid out to tick off one at a time.

/** The step's sentences, in order. Joined back with a space they give the step's own words. */
export const stepLines = (text: string): string[] =>
  text
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"‘“(])/)
    .filter((s) => s.length > 0);

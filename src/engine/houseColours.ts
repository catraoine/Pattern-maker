/** The house's own colours, named in a look's fabric words and not on the shop's list (SS27, 2026-11-05). */
export const HOUSE_COLOURS: [string, string][] = [['gold', '#C9962E'], ['ice', '#9CC3E6'], ['lavender', '#a796c4'], ['blue-grey', '#B9C3CF'], ['chocolate', '#3d2418']];

/** A fabric's colour in words, for the printed pattern and the tech pack. A house colour is stored as its swatch's code,
 *  which means nothing on paper ("Colour: #9CC3E6" on the Ice Peplum's steps; fit tester walk, Nov 14), so it is
 *  named; any other picked code is left out, as there is no word for it. */
export function colourWords(colour: string | undefined): string | undefined {
  const c = colour?.trim();
  if (!c) return undefined;
  if (!/^#[0-9a-f]{6}$/i.test(c)) return c;
  const name = HOUSE_COLOURS.find(([, hex]) => hex.toLowerCase() === c.toLowerCase())?.[0];
  return name && name[0].toUpperCase() + name.slice(1);
}

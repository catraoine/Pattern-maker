// Which garments are launched, and which are still in testing (Cat, 2026-10-20: lead with the dress, skirt and bodice
// until the stage 1 fit gate passes). Every garment stays usable; the others carry a quiet "In testing" tag, so one
// unproven garment can't hurt the launch garments' name. Move a garment here once sewists score it 4 of 5 or better.
import type { Garment } from './measurements';

export const LAUNCH_GARMENTS: Garment[] = ['skirt', 'bodice', 'dress'];

export const IN_TESTING = 'In testing';

/** True for a garment that hasn't passed its fit test yet. */
export const inTesting = (g: Garment | undefined) => !!g && !LAUNCH_GARMENTS.includes(g);

/** The one line that says which garments are still in testing, under the list of what to make (the aesthetic
 *  review, 2026-10-21: said once, not on every garment). */
export function testingNote(name: (g: Garment) => string, garments: readonly Garment[]): string | undefined {
  const names = garments.filter(inTesting).map(name);
  if (!names.length) return undefined;
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `${list[0].toUpperCase()}${list.slice(1)} ${names.length === 1 ? 'is' : 'are'} still in testing.`;
}

/** Every tool that carries the "In testing" tag, and what takes the tag off. One list, so nothing built stays tagged by
 *  accident (Cat, 2026-10-28): the Account page's "Still in testing" and docs/SHIP-LIST.md both read it, and
 *  launch.test.ts fails the build if a tag on any screen isn't here, an entry here is on no screen, or the ship list
 *  has drifted. Taking a tag off is deleting its entry and its tag; garments come off by moving to LAUNCH_GARMENTS. */
export type TestingTool =
  | 'draw_lines'
  | 'draw_round'
  | 'body_double'
  | 'prints'
  | 'any_colour'
  | 'exact_colour'
  | 'pro_files'
  | 'size_run'
  | 'check_file'
  | 'client_book'
  | 'collection'
  | 'projector'
  | 'new_details'
  | 'oversized'
  | 'low_peplum';

export const TESTING_TOOLS: Record<TestingTool, { name: string; where: string; proof: string }> = {
  draw_lines: { name: 'Draw your lines', where: 'Style, Draw on your form', proof: 'fit testers draw a hem, a neckline and a side and the pattern follows' },
  draw_round: { name: 'Draw on it all round', where: 'Draw your lines, the all round switch', proof: 'three testers draw a hem and a side on the turning garment and get the same pattern as drawn flat' },
  body_double: { name: 'Body Double', where: 'Account and the form page', proof: 'one padded form checked against its person' },
  prints: { name: 'Prints beyond checks', where: "What's the print?, About your fabric", proof: 'three testers cut a one-way or border print from the lay plan' },
  any_colour: { name: 'Any colour', where: 'the colour dots on the Fabric tab', proof: 'shop colourways match the picked colour on five fabrics' },
  exact_colour: { name: 'Exact colour', where: 'under Any colour', proof: 'the first custom-dyed order delivered and matched' },
  pro_files: { name: 'Pro files', where: 'More files on Print', proof: 'one factory or dressmaker cuts from the pack' },
  size_run: { name: 'Size run', where: 'Print, For production', proof: 'a graded run sewn in two sizes' },
  check_file: { name: 'Check any pattern file', where: 'Account', proof: 'five outside files walked with no false alarm' },
  client_book: { name: 'Client book', where: 'Account', proof: 'one dressmaker keeps three clients in it' },
  collection: { name: 'The collection and the Archive', where: 'the Collection heading', proof: 'drop 01 published' },
  // Cat broke the freeze for it (2026-10-28), modelled on the free Pattern Projector app.
  projector: { name: 'Projector mode', where: 'Print, Projector, and inside projector mode', proof: 'two sewists cut a garment with it on their own projectors' },
  // Cat broke the freeze for these too (2026-10-28), so a photo can name them.
  // Cat broke the freeze for the big shirt (2026-10-31), so the Parma Shirt can be cut oversized and long.
  // Cat broke the freeze for it too (2026-10-31), for the SS27 peplum top's longer, cinched look.
  low_peplum: { name: 'Lowered peplum', where: 'the Peplum chips on a top longer than the waist', proof: 'two testers sew a peplum lowered 6 to 9 cm and the waist stays nipped in above it' },
  oversized: { name: 'Oversized and long tops', where: 'the Oversized fit and Long length chips on the top', proof: 'two testers sew an oversized long shirt and it hangs straight, its sleeves lifting without pulling' },
  new_details: { name: 'Ruffles, ruching, cape and balloon hem', where: 'the chips for each on the Style screens', proof: 'three testers sew a ruffled hem, ruched sides and a cape and each hangs as drawn' },
};

/** What takes a garment's tag off: moving it to LAUNCH_GARMENTS once sewists score it at the fit gate. */
export const GARMENT_PROOF = 'sewists score it 4 of 5 or better at the fit gate';

/** Everything still tagged, for the Account page and the ship list: garments first, then tools. */
export function stillInTesting(name: (g: Garment) => string, garments: readonly Garment[]): { name: string; proof: string }[] {
  const gs = garments.filter(inTesting).map((g) => ({ name: `${name(g)[0].toUpperCase()}${name(g).slice(1)}`, proof: GARMENT_PROOF }));
  const ts = (Object.keys(TESTING_TOOLS) as TestingTool[]).map((k) => ({ name: TESTING_TOOLS[k].name, proof: TESTING_TOOLS[k].proof }));
  return [...gs, ...ts];
}

/** The style options under the new_details tool, by option group: their chips carry its In testing tag. */
const OPTIONS_IN_TESTING: Record<string, readonly string[]> = {
  volume: ['ruffle', 'balloon', 'ruched'],
  ruched: ['ruched'],
  collar: ['cape'],
  sleeveCuff: ['ruffle'],
};

export const optionInTesting = (group: string, id: string) => !!OPTIONS_IN_TESTING[group]?.includes(id);

/** The top's chips under the oversized tool. */
const OVERSIZED_OPTIONS: Record<string, readonly string[]> = { fit: ['oversized'], length: ['long'] };
export const oversizedInTesting = (group: string, id: string) => !!OVERSIZED_OPTIONS[group]?.includes(id);

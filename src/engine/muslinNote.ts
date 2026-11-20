// Sewing a test version in muslin (calico in the UK) first. The booklets are written for the look's own cloth (wool
// steamed at 150°C, a sheer cut between tissue paper and sewn in French seams, a peplum on horsehair braid), while
// the fit testers are asked to sew in muslin (pretend tester DM walk, Nov 19; Cat, Nov 20: "Add sewing in calico",
// called muslin first since that is the North American word, with calico beside it). One line says what changes.

import type { SewingGuide } from './instructions';

/** The things the steps ask for that a muslin test version can leave out, each with what to do in its place. */
const SKIPS: [RegExp, string][] = [
  [/tissue paper/i, 'the tissue paper (fold the muslin and cut pairs as the cutting step says)'],
  [/French seam/i, 'the French seams (sew plain seams and zigzag the edges)'],
  [/horsehair braid/i, 'the horsehair braid, so you need none (turn the hem up 0.5 cm, then 0.5 cm more, and stitch: muslin holds its shape)'],
  [/press cloth/i, 'the press cloth'],
  [/Microtex/i, 'the fine needle (a universal 80/12 is right)'],
];

/** What a tester may leave out of a muslin or sew as written, as she likes: none of it changes the fit (Cat, Nov 20:
 *  "can we make it optional? Like either way is good for testing"). Read off the step titles, so only what the booklet
 *  has. A whole lining is named by its own steps; a pocket's lining is part of the pocket. */
const OPTIONAL: [RegExp, string][] = [
  [/^(Make|Bag|Hem) the lining|^Line the/i, 'the lining (stitch round the neck and armholes on the seam line, press the allowance under along the stitching, and turn the hem up)'],
  [/welt pocket/i, 'the welt pockets (chalk where they go)'],
  [/rouleau loops/i, 'the rouleau loops and buttons (pin the back closed, centre back on centre back)'],
  [/belt loops/i, 'the belt loops'],
];

const and = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs[0]);

/** The muslin line for the booklet's fabric notes, or nothing when the fabric is muslin already. */
export function muslinLine(guide: SewingGuide, fabricLines: string[], isMuslin: boolean): string[] {
  if (isMuslin) return [];
  const all = [...fabricLines, ...guide.steps.map((st) => st.text)].join(' ');
  const skips = SKIPS.filter(([re]) => re.test(all)).map(([, words]) => words);
  const list = and(skips);
  const titles = guide.steps.map((st) => st.title);
  const may = OPTIONAL.filter(([re]) => titles.some((t) => re.test(t))).map(([, words]) => words);
  return [
    `Sewing in muslin (calico): for a test version, buy about the same length of muslin as the fabric above. Wash and dry it first, as it shrinks, even where the first step says not to wash the fabric above, and press it with a hot, steamy iron. The steps are written for the fabric above${list ? `; in muslin, leave out ${list}` : ''}. Sew everything else the same way, so the fit is the fit of the real one.${may.length ? ` If you like, you can also leave out ${and(may)}: either way is fine for the fit test.` : ''}`,
  ];
}

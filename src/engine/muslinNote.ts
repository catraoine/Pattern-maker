// Sewing a toile in muslin (calico in the UK) first. The booklets are written for the look's own cloth (wool
// steamed at 150°C, a sheer cut between tissue paper and sewn in French seams, a peplum on horsehair braid), while
// the fit testers are asked to sew in muslin (pretend tester DM walk, Nov 19; Cat, Nov 20: "Add sewing in calico",
// called muslin first since that is the North American word, with calico beside it). One line says what changes.

import type { SewingGuide } from './instructions';

/** The things the steps ask for that a muslin toile can leave out, each with what to do in its place. */
const SKIPS: [RegExp, string][] = [
  [/tissue paper/i, 'the tissue paper (fold the muslin and cut pairs as the cutting step says)'],
  [/French seam/i, 'the French seams (sew plain seams and zigzag the edges)'],
  // Halves, not lengths: 0.5 cm and 0.5 cm read 1/4 + 1/4 in on a 3/8 in allowance in an inch booklet (DO walk, Nov 20).
  [/horsehair braid/i, 'the horsehair braid, so you need none (turn the hem allowance up by half, then again, and stitch: muslin holds its shape)'],
  // Where a step presses through a damp cloth (the skirt's pleats), the note says what to do instead (DQ walk, Nov 20).
  [/press cloth/i, 'the press cloth (press the muslin directly, with steam)'],
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

/** The same, found in the steps' words rather than their titles: the interfacing and the zip (DO walk, Nov 20: the
 *  muslin line said nothing of either, so a tester could not tell whether to buy them). */
const OPTIONAL_WORDS: [RegExp, string][] = [
  // Each named only where the steps use it: the skirt and trouser were told to leave out stay tape they never had, and
  // the trouser's one button to "pin the fronts closed" (DQ walk, Nov 20).
  [/interfacing/i, 'the interfacing'],
  [/stay tape/i, 'the stay tape'],
  [/\bzip\b/i, 'the zip (pin or baste the opening closed along its stitching line to try it on)'],
  [/buttonholes/i, 'the buttonholes and buttons (pin the fronts closed, centre front on centre front)'],
  [/buttonhole\b(?!s)/i, 'the buttonhole and button (pin the opening closed where it buttons)'],
];

const and = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs[0]);

/** The muslin line for the booklet's fabric notes, or nothing when the fabric is muslin already. */
export function muslinLine(guide: SewingGuide, fabricLines: string[], isMuslin: boolean): string[] {
  if (isMuslin) return [];
  const all = [...fabricLines, ...guide.steps.map((st) => st.text)].join(' ');
  const skips = SKIPS.filter(([re]) => re.test(all)).map(([, words]) => words);
  const list = and(skips);
  const titles = guide.steps.map((st) => st.title);
  const steps = guide.steps.map((st) => st.text).join(' ');
  const words = OPTIONAL_WORDS.filter(([re]) => re.test(steps)).map(([, w]) => w);
  // Buttonholes, plural, say it all: the vest's "buttonhole twist" is not a second buttonhole.
  const buttons = words.filter((w) => w.startsWith('the buttonhole')).slice(1);
  const may = [...OPTIONAL.filter(([re]) => titles.some((t) => re.test(t))).map(([, w]) => w), ...words.filter((w) => !buttons.includes(w))];
  // Only where the steps say not to wash the cloth: the trouser's first step says wash it, and "even where the first
  // step says not to" read as a mistake there (DO walk, Nov 20).
  const unwashed = /\bnot (to )?wash\b|don't wash/i.test(all);
  // The steps say to try it on and take it in or let it out, while the fit testers are asked not to alter it, so the
  // fit report shows how the pattern itself fits (DU walk, Nov 21).
  const alter = /take (it )?in or let (it )?out/i.test(steps);
  return [
    `Sewing in muslin (calico): for a toile, buy about the same length of muslin as the fabric above. Wash and dry it first, as it shrinks${unwashed ? ', even where the first step says not to wash the fabric above' : ''}, and press it with a hot, steamy iron. The steps are written for the fabric above${list ? `; in muslin, leave out ${list}` : ''}. Sew everything else the same way, so the fit is the fit of the real one, with a long machine stitch so the seams unpick easily if the fit needs changing.${alter ? ' For the fit test, where a step says to take it in or let it out, try it on but leave the seams as they are, and note what you would change for your fit report.' : ''}${may.length ? ` If you like, you can also leave out ${and(may)}: either way is fine for the fit test.` : ''}`,
  ];
}

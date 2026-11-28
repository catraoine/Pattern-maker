// What each sewing step shows in Sewing mode (Cat's C, Nov 21): the garment's own pieces, with the edges being sewn
// drawn in as you watch, so every style gets its own pictures without filming. Read from the step's own words, so
// the steps themselves never change for a picture.
import type { Piece } from './piece';
import type { SewStep } from './instructions';
import type { DiagramId } from './diagrams';

export type StepPicture =
  /** Fabric straightened on the grain: the same for every garment. */
  | { kind: 'prep' }
  /** The test square on its page, with a ruler. */
  | { kind: 'print' }
  /** The cutting layout, with these pieces cut out as you watch (by name, as the layout names them). */
  | { kind: 'cut'; names: string[] }
  /** These pieces (by index), with these edges stitched as you watch, and their darts when `darts`. `around`: small
   *  pieces (a pocket, a loop) stitched all the way round. `edgesOn`: a piece's own edges in place of `edges`, where
   *  the two sides of a seam carry different tags (a bodice's lower edge, sewn to a peplum's waist). */
  | { kind: 'sew'; pieces: number[]; edges: string[]; darts: boolean; around?: number[]; edgesOn?: Record<number, string[]> }
  /** A close-up of the technique, from the step's own small drawing. */
  | { kind: 'diagram'; id: DiagramId }
  /** The finished garment, front and back. */
  | { kind: 'flat' };

/** Words in a step that name an edge, and the outline tags that edge carries. */
const EDGES: [RegExp, string[]][] = [
  // A sleeve's crown is tagged with the armhole it is sewn into.
  [/\bset (in )?the sleeves?\b|\bsleeves? in\b|\bsew in the (raglan )?sleeves\b|\braglan seams\b/, ['armhole']],
  [/\bsleeve seams?\b|\boverarm seams?\b/, ['sleeve-front', 'sleeve-back']],
  // A pleated skirt's side panels join along their panel seams, on the front and back as well as the side panels.
  [/\bpanel seams?\b|\bside panels?\b/, ['panel']],
  // A seam across the chest joins the yoke to the body below it.
  [/\bchest seams?\b|\byoke seams?\b/, ['yoke']],
  // Before the side seams: "Sew the princess seams" showed the centre back, from its words' "centre back" (EJ walk, Nov 27).
  [/\bprincess seams?\b/, ['princess']],
  [/\bside seams?\b|\bthe sides\b|\bthe side (and|edges)\b/, ['side']],
  [/\bshoulders?\b/, ['shoulder']],
  [/\bhem\b|\bhems\b/, ['hem']],
  [/\bcentre back\b|\bcentre front\b|\bzip\b|\bvent\b/, ['centre']],
  [/\bwaist(band)?\b/, ['waist']],
  [/\bneck(line|band)?\b|\bcollar\b/, ['neck']],
  [/\barmholes?\b/, ['armhole']],
  [/\binside legs?\b|\binseams?\b/, ['inseam']],
  [/\bcrotch\b/, ['crotch']],
];

/** Pieces a step can name, matched against the piece's own name or kind. A third `true` matches by name only and
 *  leaves out the pocket's own pieces: a welt is cut as a facing and a pocket bag as lining, but "the facings" and
 *  "the lining" of a sewing step mean the garment's. */
const NAMED: [RegExp, RegExp, boolean?][] = [
  [/\bwelts?\b/, /^welt\b/i],
  [/\bwaistband\b|\bband\b/, /waistband|\bband\b/i],
  [/\bneckband\b/, /neckband|mock neck/i],
  [/\bcollar\b/, /collar/i],
  [/\bcuffs?\b/, /cuff/i],
  [/\bpockets?\b/, /pocket/i],
  [/\bpeplum\b/, /peplum/i],
  [/\bruffle\b/, /ruffle/i],
  [/\bflounce\b/, /flounce/i],
  [/\bsleeves?\b/, /sleeve/i],
  [/\blining\b/, /lining/i, true],
  [/\bfacings?\b/, /facing/i, true],
  [/\bbelt loops?\b/, /loop/i],
  [/\bhood\b/, /hood/i],
  [/\btiers?\b/, /tier/i],
  [/\bgodets?\b/, /godet/i],
  [/\byoke\b/, /yoke/i],
  [/\bstraps?\b/, /strap/i],
  [/\b(side )?ties\b|\bsash\b/, /\btie\b|sash/i],
];

const isGarment = (pc: Piece) => !pc.kind || pc.kind === 'collar' || pc.kind === 'pocket';
const tagsOf = (pc: Piece) => new Set(pc.outline.tags);
/** A dart has two legs meeting at a point (or four, round a fish-eye). A piece's other inner lines (a roll line, a
 *  fold line, a button mark) are one straight stroke, and aren't sewn as darts. */
export const isDart = (ln: Piece['lines'][number]) => ln.segs.length >= 2;
const hasDarts = (pc: Piece) => pc.lines.some(isDart);

/** The picture for one step, from its title first, then its words. */
export function stepPicture(step: SewStep, pieces: Piece[]): StepPicture {
  const title = step.title.toLowerCase();
  const all = `${title} ${step.text.toLowerCase()}`;
  if (/prepare your fabric|pre-?wash/.test(title)) return { kind: 'prep' };
  if (/print and check|test square/.test(title)) return { kind: 'print' };
  const pocketPart = (pc: Piece) => /pocket|welt|flap|jet/i.test(pc.name);
  // Cutting the lining does cut the pocket bags from it, so the cut picture keeps them.
  const named = (words: string, cutting = false) =>
    NAMED.filter(([w]) => w.test(words)).flatMap(([, name, own]) =>
      pieces.map((pc, i) => (own && !cutting ? name.test(pc.name) && !pocketPart(pc) : name.test(pc.name) || (pc.kind && name.test(pc.kind))) ? i : -1).filter((i) => i >= 0),
    );
  if (/^cut\b/.test(title)) {
    const these = named(title, true);
    // "Cut out": the garment's own pieces; "Cut the lining" or "Cut the waistband": just those.
    const cut = these.length ? these : pieces.map((pc, i) => (isGarment(pc) ? i : -1)).filter((i) => i >= 0);
    return { kind: 'cut', names: [...new Set(cut.map((i) => pieces[i].name))] };
  }
  if (/\bdarts?\b/.test(title)) {
    const withDarts = pieces.map((pc, i) => (isGarment(pc) && hasDarts(pc) ? i : -1)).filter((i) => i >= 0);
    if (withDarts.length) return { kind: 'sew', pieces: withDarts, edges: [], darts: true };
  }
  // Marking, folding or stitching pleats: the pieces with their pleat lines, where the work is (EA walk, Nov 21: these
  // steps showed only the finished skirt).
  if (/\bpleats?\b/.test(title)) {
    const pleated = pieces.map((pc, i) => (isGarment(pc) && pc.lines.some((ln) => !isDart(ln)) ? i : -1)).filter((i) => i >= 0);
    if (pleated.length) return { kind: 'sew', pieces: pleated, edges: [], darts: false };
  }
  if (/^finish$|try it on|put it on|final press/.test(title)) return { kind: 'flat' };
  // The edges the title names, else the ones its words name.
  const edgesIn = (words: string) => [...new Set(EDGES.filter(([w]) => w.test(words)).flatMap(([, t]) => t))];
  const these = named(title);
  // Interfacing, pressing or marking a piece sews nothing: show just that piece, plain ("Interface the waistband" names
  // the waist, but the skirt's waist isn't stitched yet).
  if (/^(interface|fuse|press|mark|chalk|transfer|trace)\b/.test(title)) {
    if (these.length) return { kind: 'sew', pieces: these, edges: [], darts: false };
    return step.diagram ? { kind: 'diagram', id: step.diagram } : { kind: 'flat' };
  }
  // The peplum sewn on: the bodice's lower edge to the peplum's waist (EJ walk, Nov 27: only the peplum showed, with no
  // seam drawn).
  if (/^attach the peplum\b/.test(title)) {
    // The front half: the seam goes the same way round the back, and six pieces don't fit the picture.
    const front = (ids: number[]) => (ids.some((i) => /front/i.test(pieces[i].name)) ? ids.filter((i) => /front/i.test(pieces[i].name)) : ids);
    const bodice = front(pieces.map((pc, i) => (isGarment(pc) && !/peplum|sleeve|cuff|band/i.test(pc.name) && tagsOf(pc).has('hem') ? i : -1)).filter((i) => i >= 0));
    const peplum = front(these.filter((i) => tagsOf(pieces[i]).has('waist')));
    if (bodice.length && peplum.length)
      return { kind: 'sew', pieces: [...bodice, ...peplum], edges: [], darts: false, edgesOn: Object.fromEntries([...bodice.map((i) => [i, ['hem']]), ...peplum.map((i) => [i, ['waist']])]) };
  }
  let edges = edgesIn(title);
  // A step that only says "sew" or "neaten" in its title names its edges in its words. Others (press the creases)
  // don't stitch anything, so their words aren't searched for seams.
  if (!edges.length && !these.length && /^(sew|neaten|stitch|join|bind|stay|close|zigzag|overlock)\b/.test(title)) edges = edgesIn(all);
  // A step that sews onto the facings or the lining ("the upper collar to the facings") leaves the garment itself out.
  const inside = /\bto the (front |neck )?(facings?|lining)\b/.test(title);
  // A part sewn on later (a peplum, a ruffle) is shown only when the step names it: the bodice's side seams marked the
  // peplum's too, which are sewn later, in Make the peplum (EJ walk, Nov 27).
  const later = (pc: Piece) => /peplum|ruffle|flounce/i.test(pc.name);
  const carrying = inside ? [] : pieces.map((pc, i) => (isGarment(pc) && !later(pc) && edges.some((t) => tagsOf(pc).has(t)) ? i : -1)).filter((i) => i >= 0);
  const shown = [...new Set([...these, ...carrying])];
  // A small piece the step makes (a pocket, a loop, a tie) is sewn all the way round.
  const around = edges.length ? [] : these.filter((i) => /pocket|welt|loop|tie|sash|strap|flap|cuff|tab/i.test(pieces[i].name));
  if (shown.length) return { kind: 'sew', pieces: shown, edges, darts: false, ...(around.length ? { around } : {}) };
  if (step.diagram) return { kind: 'diagram', id: step.diagram };
  return { kind: 'flat' };
}

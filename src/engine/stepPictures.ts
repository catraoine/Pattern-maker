// What each sewing step shows in Sewing mode (Cat's C, Nov 21): the garment's own pieces, with the edges being sewn
// drawn in as you watch, so every style gets its own pictures without filming. Read from the step's own words, so
// the steps themselves never change for a picture.
import type { Piece } from './piece';
import type { SewStep } from './instructions';
import type { DiagramId } from './diagrams';
import { p, type P } from './geometry';
import { crossings } from './easeMap';
import { PLEAT_STITCH_CM, type PleatLine } from './trouserPleats';

/** A line a step draws on a piece, in the piece's own cm: where to fold, where the fold is brought to, a short run of
 *  stitching, or a crease to press. */
export interface StepLine {
  piece: number;
  pts: P[];
  as: 'fold' | 'place' | 'stitch' | 'press';
}

export type StepPicture =
  /** Fabric straightened on the grain: the same for every garment. */
  | { kind: 'prep' }
  /** The test square on its page, with a ruler. */
  | { kind: 'print' }
  /** The cutting layout, with these pieces cut out as you watch (by name, as the layout names them). `single`: opened
   *  out to one layer, as a sheer is cut. */
  | { kind: 'cut'; names: string[]; single?: boolean }
  /** These pieces (by index), with these edges stitched as you watch, and their darts when `darts`. `around`: small
   *  pieces (a pocket, a loop) stitched all the way round. `edgesOn`: a piece's own edges in place of `edges`, where
   *  the two sides of a seam carry different tags (a bodice's lower edge, sewn to a peplum's waist). `lines`: lines the
   *  step draws, in place of the pieces' own inner lines. `neaten`: the edges are zigzagged, not sewn to anything. */
  | { kind: 'sew'; pieces: number[]; edges: string[]; darts: boolean; around?: number[]; edgesOn?: Record<number, string[]>; lines?: StepLine[]; neaten?: boolean }
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
/** A part sewn on later (a peplum, a ruffle) is shown only when the step names it: the bodice's side seams marked the
 *  peplum's too, which are sewn later, in Make the peplum (EJ walk, Nov 27). */
const later = (pc: Piece) => /peplum|ruffle|flounce/i.test(pc.name);

/** Where a vertical line at x meets the piece's outline, top to bottom. */
const downAt = (pc: Piece, x: number) => crossings(pc.outline.points().map((q) => p(q.y, q.x)), x).sort((a, b) => a - b);
/** A trouser front's pleats, as cut (a skirt keeps its own pleats differently, in its inner lines). */
const pleatLines = (pc: Piece): PleatLine[] => (Array.isArray(pc.meta.pleats) ? (pc.meta.pleats as PleatLine[]).filter((l) => typeof l?.fold === 'number' && typeof l?.place === 'number') : []);
const balanceAt = (pc: Piece, label: string) => pc.balance?.find((b) => b.label === label)?.pts[0].y;

/** The picture for one step, from its title first, then its words. */
export function stepPicture(step: SewStep, pieces: Piece[]): StepPicture {
  const title = step.title.toLowerCase();
  const all = `${title} ${step.text.toLowerCase()}`;
  if (/prepare your fabric|pre-?wash/.test(title)) return { kind: 'prep' };
  if (/print and check|test square/.test(title)) return { kind: 'print' };
  const pocketPart = (pc: Piece) => /pocket|welt|flap|jet/i.test(pc.name);
  // Cutting the lining does cut the pocket bags from it, so the cut picture keeps them.
  // A sleeve band or cuff only where the step names it: "Sew the sleeve seams" and "Set in the sleeves" showed the
  // band beside the sleeve (EL walk, Nov 27).
  const banded = (pc: Piece, words: string) => /sleeve/i.test(pc.name) && /band|cuff/i.test(pc.name) && !/band|cuff/.test(words);
  const named = (words: string, cutting = false) =>
    [...new Set(NAMED.filter(([w]) => w.test(words)).flatMap(([, name, own]) =>
      pieces.map((pc, i) => (cutting || !banded(pc, words)) && (own && !cutting ? name.test(pc.name) && !pocketPart(pc) : name.test(pc.name) || (pc.kind && name.test(pc.kind))) ? i : -1).filter((i) => i >= 0),
    ))];
  if (/^cut\b/.test(title)) {
    const these = named(title, true);
    // "Cut out": the garment's own pieces; "Cut the lining" or "Cut the waistband": just those.
    const cut = these.length ? these : pieces.map((pc, i) => (isGarment(pc) ? i : -1)).filter((i) => i >= 0);
    const names = [...new Set(cut.map((i) => pieces[i].name))];
    // A sheer is cut single layer between tissue: the layout opened out, where it showed the folded one (EL walk, Nov 27).
    return /\bsingle layer\b/.test(step.text.toLowerCase()) ? { kind: 'cut', names, single: true } : { kind: 'cut', names };
  }
  if (/\bdarts?\b/.test(title)) {
    const withDarts = pieces.map((pc, i) => (isGarment(pc) && hasDarts(pc) ? i : -1)).filter((i) => i >= 0);
    if (withDarts.length) return { kind: 'sew', pieces: withDarts, edges: [], darts: true };
  }
  // Marking, folding or stitching pleats: the pieces with their pleat lines, where the work is (EA walk, Nov 21: these
  // steps showed only the finished skirt).
  if (/\bpleats?\b/.test(title)) {
    const pleated = pieces.map((pc, i) => (isGarment(pc) && pc.lines.some((ln) => !isDart(ln)) ? i : -1)).filter((i) => i >= 0);
    // A trouser's front pleat: its fold line, the placement line the fold is brought to, and the short run stitched down
    // from the waist. Its waist edge alone, drawn thick as if sewn, said nothing of the fold (EL walk, Nov 27).
    const fronts = pieces.map((pc, i) => (isGarment(pc) && pleatLines(pc).length ? i : -1)).filter((i) => i >= 0);
    if (fronts.length)
      return {
        kind: 'sew',
        pieces: fronts,
        edges: [],
        darts: false,
        lines: fronts.flatMap((i) => {
          const pc = pieces[i];
          return pleatLines(pc).flatMap((pl): StepLine[] => {
            const ys = downAt(pc, pl.fold);
            const [top, hem] = [ys[0], ys[ys.length - 1]];
            const place = pc.balance?.find((b) => b.label === 'PLACEMENT' && Math.abs(b.pts[0].x - pl.place) < 0.05);
            if (top === undefined || hem === undefined) return [];
            return [
              { piece: i, pts: [p(pl.fold, top), p(pl.fold, hem)], as: 'fold' },
              ...(place ? [{ piece: i, pts: place.pts, as: 'place' as const }] : []),
              { piece: i, pts: [p(pl.fold, top), p(pl.fold, top + PLEAT_STITCH_CM)], as: 'stitch' },
            ];
          });
        }),
      };
    if (pleated.length) return { kind: 'sew', pieces: pleated, edges: [], darts: false };
  }
  // Pressing the creases: the legs with their crease lines, not the finished garment (EK walk, Nov 27), on the back as
  // well as the front, from the hem as far up as the words say (EL walk, Nov 27: the front's ran to the waist, and the
  // back had none).
  if (/\bcreases?\b/.test(title)) {
    const legs = pieces.map((pc, i) => (isGarment(pc) && tagsOf(pc).has('inseam') ? i : -1)).filter((i) => i >= 0);
    const words = step.text.toLowerCase();
    const upTo = (pc: Piece): number | undefined => {
      const front = /front/i.test(pc.name);
      if (front && /to the dart on the front/.test(words)) return Math.max(...pc.lines.filter(isDart).map((ln) => Math.max(...ln.points().map((q) => q.y))));
      if (front && /to the hip line on the front/.test(words)) return balanceAt(pc, 'HIP LINE');
      if (!front && /to the crotch line on the back/.test(words)) return balanceAt(pc, 'CROTCH LINE');
      return /up to the knee/.test(words) ? balanceAt(pc, 'KNEE LINE') : undefined;
    };
    const lines = legs.flatMap((i): StepLine[] => {
      const pc = pieces[i];
      // A pleated front's crease is its first pleat's fold, as printed.
      const x = pleatLines(pc)[0]?.fold ?? (pc.meta.creaseX as number | undefined);
      const ys = x === undefined ? [] : downAt(pc, x);
      const top = upTo(pc);
      return x === undefined || !ys.length || top === undefined || !Number.isFinite(top) ? [] : [{ piece: i, pts: [p(x, top), p(x, ys[ys.length - 1])], as: 'press' }];
    });
    if (legs.length) return { kind: 'sew', pieces: legs, edges: [], darts: false, ...(lines.length ? { lines } : {}) };
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
  // A ruffle sewn on: the neckline and the ruffle's long edge, where it showed only the ruffle, the same as Make the
  // ruffle (EK walk, Nov 27).
  if (/^attach the ruffle\b/.test(title)) {
    const ruffle = these.filter((i) => tagsOf(pieces[i]).has('neck'));
    const necks = pieces.map((pc, i) => (isGarment(pc) && !later(pc) && pc.kind !== 'collar' && tagsOf(pc).has('neck') ? i : -1)).filter((i) => i >= 0);
    if (ruffle.length && necks.length) return { kind: 'sew', pieces: [...necks, ...ruffle], edges: ['neck'], darts: false };
  }
  // Sleeve bands go on the sleeve hems, gathered, and are joined into rings: the hems drawn in and the bands round.
  if (/^attach the (sleeve )?(bands?|cuffs?)\b/.test(title)) {
    const sleeves = pieces.map((pc, i) => (/sleeve/i.test(pc.name) && tagsOf(pc).has('hem') && !/band|cuff/i.test(pc.name) ? i : -1)).filter((i) => i >= 0);
    const bands = these.filter((i) => /band|cuff/i.test(pieces[i].name));
    if (sleeves.length && bands.length) return { kind: 'sew', pieces: [...sleeves, ...bands], edges: [], darts: false, around: bands, edgesOn: Object.fromEntries(sleeves.map((i) => [i, ['hem']])) };
  }
  // Easing the sleeve heads: the sleeve with its crown drawn in, not the bands (EK walk, Nov 27: the same picture as the
  // bands step before it).
  if (/\bsleeve heads?\b|\bcrowns?\b/.test(title)) {
    const sleeves = pieces.map((pc, i) => (/sleeve/i.test(pc.name) && tagsOf(pc).has('armhole') ? i : -1)).filter((i) => i >= 0);
    if (sleeves.length) return { kind: 'sew', pieces: sleeves, edges: ['armhole'], darts: false };
  }
  // Making the peplum sews its own side seams: drawn in, where none was (EK walk, Nov 27).
  if (/^make the peplum\b/.test(title) && these.length) return { kind: 'sew', pieces: these, edges: ['side'], darts: false };
  let edges = edgesIn(title);
  // A step that only says "sew" or "neaten" in its title names its edges in its words. Others (press the creases)
  // don't stitch anything, so their words aren't searched for seams.
  if (!edges.length && !these.length && /^(sew|neaten|stitch|join|bind|stay|staystitch|close|zigzag|overlock)\b/.test(title)) edges = edgesIn(all);
  // A step that sews onto the facings or the lining ("the upper collar to the facings") leaves the garment itself out.
  const inside = /\bto the (front |neck )?(facings?|lining)\b/.test(title);
  const carrying = inside ? [] : pieces.map((pc, i) => (isGarment(pc) && !later(pc) && edges.some((t) => tagsOf(pc).has(t)) ? i : -1)).filter((i) => i >= 0);
  const shown = [...new Set([...these, ...carrying])];
  // A small piece the step makes (a pocket, a loop, a tie) is sewn all the way round.
  const around = edges.length ? [] : these.filter((i) => /pocket|welt|loop|tie|sash|strap|flap|cuff|tab/i.test(pieces[i].name));
  // Zigzagged edges are neatened, not sewn to anything: the key said "sew this edge" (EL walk, Nov 27).
  const neaten = /^(neaten|zigzag|overlock)\b/.test(title) && edges.length > 0;
  if (shown.length) return { kind: 'sew', pieces: shown, edges, darts: false, ...(around.length ? { around } : {}), ...(neaten ? { neaten } : {}) };
  if (step.diagram) return { kind: 'diagram', id: step.diagram };
  return { kind: 'flat' };
}

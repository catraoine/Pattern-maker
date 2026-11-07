// The fit sweep on random bodies (Quality: Automated checks, check 2, Cat 2026-11-04): a random design of every garment
// drafted for each of many random bodies and held to the body the way a toile is: the finished sizes the pattern prints
// are the body plus the fit's ease, woven cloth is never cut smaller than the body, the pieces measure the hip that is
// printed, the hem lands where the length was asked for, and the armhole sits in the right place. The
// skirt, top and trousers sweeps in engine/fitSweep.test.ts walk a few chosen styles on 80 bodies; this walks every
// garment, any design, on 300.
import { EXAMPLE_BODY, MeasurementValues } from './measurements';
import { randomDesign } from './drapeSweep';
import { DEFAULT_TEE_CHOICES, DEFAULT_TROUSERS_CHOICES, TEE_GROUPS, TROUSER_GROUPS, TrousersChoices, trouserAllowed, validTrousers } from './garments';
import { PatternDesign, printedPattern } from './patternSweep';
import { FIT_EASE, LENGTHS, skirtFitOf } from './engine/skirt';
import { SLIP_HIP_EASE_LESS, validCut } from './engine/slip';
import { BODICE_FIT_EASE } from './engine/bodice';
import { TROUSER_EASE, trouserLength } from './engine/trousers';
import { OUTER_EASE } from './engine/outerwear';
import { BODY_RISE } from './engine/jumpsuit';
import { randomArms, randomBody, randomCrotch } from './engine/randomBodies';
import type { Piece } from './engine/piece';
import { widthAt } from './engine/easeMap';
import type { Saved } from './savedWork';
import { DEFAULT_HOODIE_CHOICES, DEFAULT_JUMPSUIT_CHOICES, DEFAULT_KNIT_DRESS_CHOICES, HOODIE_GROUPS, JUMPSUIT_GROUPS, KNIT_DRESS_GROUPS, type JumpsuitChoices, validJumpsuit } from './garmentRange';

type FitGarment = 'skirt' | 'bodice' | 'dress' | 'jacket' | 'coat' | 'trousers' | 'tee' | 'knit_dress' | 'hoodie' | 'jumpsuit';
// The Garment range (knit dress, hoodie, jumpsuit; 2026-11-07) is walked like the rest.
export const FIT_GARMENTS: FitGarment[] = ['skirt', 'bodice', 'dress', 'jacket', 'coat', 'trousers', 'tee', 'knit_dress', 'hoodie', 'jumpsuit'];

const pick = <T>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];

/** A random design of one garment, as a saved pattern keeps it. */
export function randomFitDesign(r: () => number, garment: FitGarment): Omit<PatternDesign, 'key'> {
  if (garment === 'trousers') {
    let c: TrousersChoices = { ...DEFAULT_TROUSERS_CHOICES };
    for (const g of TROUSER_GROUPS) {
      const ok = g.options.filter(([o]) => trouserAllowed(c, g.id, o));
      if (ok.length) c = { ...c, [g.id]: pick(r, ok)[0] };
    }
    return { garment, saved: { trousers: validTrousers(c) } };
  }
  if (garment === 'tee') {
    const c: Record<string, unknown> = { ...DEFAULT_TEE_CHOICES };
    for (const g of TEE_GROUPS) c[g.id] = pick(r, g.options)[0];
    return { garment, saved: { tee: c as unknown as Saved['tee'] } };
  }
  if (garment === 'knit_dress' || garment === 'hoodie' || garment === 'jumpsuit') {
    const [groups, start] = garment === 'knit_dress' ? [KNIT_DRESS_GROUPS, DEFAULT_KNIT_DRESS_CHOICES] : garment === 'hoodie' ? [HOODIE_GROUPS, DEFAULT_HOODIE_CHOICES] : [JUMPSUIT_GROUPS, DEFAULT_JUMPSUIT_CHOICES];
    const c: Record<string, unknown> = { ...start };
    for (const g of groups as { id: string; options: [string, string][] }[]) {
      const o = pick(r, g.options)[0];
      c[g.id] = o === 'true' ? true : o === 'false' ? false : o;
    }
    if (garment === 'jumpsuit') return { garment, saved: { jumpsuit: validJumpsuit(c as unknown as JumpsuitChoices) } };
    return { garment, saved: garment === 'hoodie' ? { hoodie: c as unknown as Saved['hoodie'] } : { knitDress: c as unknown as Saved['knitDress'] } };
  }
  // The skirt made valid as the style screen keeps it (a slip at least knee length, a diagonal hem only where it cuts).
  const saved = randomDesign(r, garment).saved;
  if (saved.choices) return { garment, saved: { ...saved, choices: validCut(saved.choices) } };
  if (saved.dress) {
    const skirt: Record<string, unknown> = validCut({ ...saved.dress.skirt, joinTo: 'dress' });
    delete skirt.joinTo;
    return { garment, saved: { ...saved, dress: { ...saved.dress, skirt: skirt as unknown as Saved['choices'] } } };
  }
  return { garment, saved };
}

/** A random body with arms and a crotch, as a tester measures it. */
export function randomValues(r: () => number): MeasurementValues {
  const b = randomBody(r);
  return { ...EXAMPLE_BODY, ...b, ...randomArms(b, r), ...randomCrotch(b, r), height: b.waist_to_floor / 0.615 } as unknown as MeasurementValues;
}

const r1 = (v: number) => Math.round(v * 10) / 10;

/** The design's fit, and the ease that fit promises at the bust (tops) and the hip (skirts and trousers). */
function promised(d: Omit<PatternDesign, 'key'>): { bust?: number; hip?: number } {
  const s = d.saved;
  switch (d.garment) {
    // Cut on the bias, a slip takes less hip ease: the cloth gives round the body.
    case 'skirt':
      return { hip: FIT_EASE[s.choices!.fit].hip - (s.choices!.silhouette === 'slip' ? SLIP_HIP_EASE_LESS : 0) };
    case 'bodice':
      return { bust: BODICE_FIT_EASE[s.bodice!.fit].bust };
    case 'dress':
      return { bust: BODICE_FIT_EASE[s.dress!.fit].bust, hip: FIT_EASE[skirtFitOf(s.dress!.fit)].hip - (s.dress!.skirt.silhouette === 'slip' ? SLIP_HIP_EASE_LESS : 0) };
    case 'trousers':
      return { hip: TROUSER_EASE[s.trousers!.fit].hip };
    case 'jumpsuit':
      return { bust: BODICE_FIT_EASE[s.jumpsuit!.fit].bust, hip: TROUSER_EASE[s.jumpsuit!.legFit].hip };
    case 'jacket':
    case 'coat': {
      const c = (s.coat ?? s.jacket)!;
      return { bust: OUTER_EASE[d.garment][c.fit] };
    }
    default:
      return {};
  }
}

/** How far the pieces can measure from the number printed on them, round the body. */
const PRINTED = 1.5;

const skirtChoicesOf = (d: Omit<PatternDesign, 'key'>) => (d.garment === 'skirt' ? d.saved.choices : d.garment === 'dress' ? d.saved.dress?.skirt : undefined);
const balanceY = (pc: Piece, label: string) => pc.balance?.find((b) => b.label === label)?.pts[0].y;

/** Everything about a design's fit on one body that's wrong, in words; empty when it fits as drafted. */
export function fitProblems(d: Omit<PatternDesign, 'key'>, values: MeasurementValues): string[] {
  const out: string[] = [];
  const { result, made } = printedPattern(d, values);
  const spec = made.spec;
  const row = (label: string) => spec.find((x) => x.label === label && typeof x.finished === 'number');
  const knit = d.garment === 'tee' || d.garment === 'knit_dress' || d.garment === 'hoodie';
  const s = d.saved;
  const bodiceChoices = s.bodice ?? s.dress?.bodice;
  // A dropped shoulder or a raglan moves the armhole seam off the armhole: it isn't held to the body's armhole.
  const setIn = !bodiceChoices || !(bodiceChoices as { sleeveCut?: string }).sleeveCut || (bodiceChoices as { sleeveCut?: string }).sleeveCut === 'set_in';
  const boned = !!bodiceChoices && ((bodiceChoices as { structure?: string }).structure === 'boned' || bodiceChoices.neckline === 'strapless');

  // 1. The table prints the finished size as the body plus its ease.
  for (const x of spec)
    if (typeof x.finished === 'number' && x.body !== undefined && x.ease !== undefined && Math.abs(x.finished - (x.body + x.ease)) > 0.15)
      out.push(`${x.label}: printed finished ${x.finished} is not the body ${x.body} plus the ease ${x.ease}`);

  // 2. The fit's ease at the bust and the hip, at least.
  const want = promised(d);
  const bust = row('Bust');
  const hip = row('Hip');
  if (want.bust !== undefined && bust?.ease !== undefined && bust.ease < want.bust - 1 && !boned) out.push(`Bust: ${r1(bust.ease)} cm of ease, the fit promises ${want.bust}`);
  if (want.hip !== undefined && hip?.ease !== undefined && hip.ease < want.hip - 1) out.push(`Hip: ${r1(hip.ease)} cm of ease, the fit promises ${want.hip}`);
  // Woven cloth doesn't stretch: no girth is cut smaller than the body (a boned top's waist is, on purpose).
  if (!knit)
    for (const x of spec)
      if (typeof x.finished === 'number' && x.body !== undefined && x.ease !== undefined && x.ease < 0 && /^(Bust|Hip|Armhole|Upper arm)/.test(x.label) && !(boned && x.label === 'Bust') && !(setIn === false && x.label === 'Armhole'))
        out.push(`${x.label}: cut ${r1(-x.ease)} cm smaller than the body`);

  // 3. The pieces measure what is printed on them: round the hip line of a skirt or trousers cut straight down (a
  // circle's or a bias slip's pieces don't lie level across the hip), every piece counted as often as it is cut.
  const legs = result.trousers ?? result.jumpsuit?.trousers;
  const lower = legs?.block ?? (result.skirt ?? result.dress?.skirt)?.block ?? (result.skirt ?? result.dress?.skirt)?.pieces;
  const straight = !!legs || ['pencil', 'straight', 'a_line', 'trumpet'].includes(skirtChoicesOf(d)?.silhouette ?? '');
  const hipLine = lower && lower[0] && balanceY(lower[0], 'HIP LINE');
  if (hip && lower && straight && hipLine !== undefined && !skirtChoicesOf(d)?.pleats) {
    const own = lower.filter((pc) => !pc.kind && /front|back/i.test(pc.name));
    const measured = own.reduce((t, pc) => t + (pc.meta.whole ? 1 : 2) * widthAt(pc, hipLine), 0);
    if (Number.isFinite(measured) && Math.abs(measured - (hip.finished as number)) > PRINTED) out.push(`Hip: printed finished ${hip.finished}, the pieces measure ${r1(measured)} round the hip line`);
  }

  // 4. The hem lands where the length was asked for.
  const skirtChoices = skirtChoicesOf(d);
  const skirt = result.skirt ?? result.dress?.skirt;
  // A high-low or diagonal hem is meant to land at two lengths.
  if (skirtChoices && skirt && skirtChoices.lengthCm === undefined && (skirtChoices.asymHem ?? 'none') === 'none') {
    const rise = (skirtChoices as { rise?: string }).rise ?? 'natural';
    const length = skirtChoices.length;
    const target = LENGTHS[length](values as never);
    // A low rise sits below the waist and a dropped seam moves the skirt's top down; the hem stays put.
    const off = skirt.lengthCm + (result.dress?.seamDrop ?? 0) - target;
    if (rise === 'natural' && Math.abs(off) > 1.5) out.push(`Hem: lands ${r1(Math.abs(off))} cm ${off > 0 ? 'below' : 'above'} the ${length.replace('_', ' ')} length`);
  }
  if ((d.garment === 'trousers' || d.garment === 'jumpsuit') && legs) {
    const c = s.trousers ?? s.jumpsuit!;
    // A jumpsuit's crotch is cut lower to sit in, and shorts keep at least 10 cm of leg below it.
    const own = trouserLength(values as never, { leg: c.leg, length: c.length });
    const target = d.garment === 'jumpsuit' && c.length === 'shorts' && c.leg !== 'culotte' ? Math.max(own, (values as unknown as { crotch_depth: number }).crotch_depth + BODY_RISE.depth + 10) : own;
    const off = legs.lengthCm - target;
    if (Math.abs(off) > 1.5) out.push(`Hem: the trousers' outside leg lands ${r1(Math.abs(off))} cm ${off > 0 ? 'below' : 'above'} the ${c.length} length`);
  }

  // 5. The armhole: room round it, and the underarm above the bust point with the side seam below it.
  const armhole = row('Armhole');
  if (setIn && armhole && armhole.body !== undefined && armhole.ease !== undefined && armhole.ease < (knit ? 0 : 2)) out.push(`Armhole: ${r1(armhole.ease)} cm round the arm`);
  const front = made.pieces.find((pc) => !pc.kind && /front/i.test(pc.name) && balanceY(pc, 'UNDERARM LINE') !== undefined);
  const apex = front?.draft?.points.find((q) => /^Bust point/.test(q.note))?.at;
  const under = front && balanceY(front, 'UNDERARM LINE');
  // (An oversized, boxy or relaxed cut, and any jacket or coat, drops its underarm on purpose.)
  const close = (d.garment === 'bodice' || d.garment === 'dress') && ['fitted', 'regular'].includes((s.dress?.fit ?? s.bodice?.fit) as string);
  // The bust line runs about level with the underarm; an underarm well below it cuts into the bust.
  if (close && setIn && apex && under !== undefined && under - apex.y > 2.5) out.push(`Armhole: the underarm ${r1(under - apex.y)} cm below the bust point`);
  return out;
}

/** A problem with its numbers taken out, so the same fault on two bodies counts as one kind. */
export const fitKind = (garment: string, p: string) => `${garment}: ${p.replace(/-?\d+(\.\d+)?/g, '#')}`;

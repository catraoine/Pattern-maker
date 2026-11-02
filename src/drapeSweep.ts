// The All round sweep: random designs, each drafted, sewn on the form by the drape engine and scored by its quality
// check, so a fault shows up on every design that shares the part that causes it rather than one look at a time
// (Cat, 2026-11-02). drapeSweep.test.ts runs a fixed set on every change and, with DRAPE_SWEEP set, a random batch
// nightly (.github/workflows/drape-sweep.yml), reporting the failures by the choices they share.
import { EXAMPLE_BODY, MeasurementValues } from './measurements';
import { GARMENT_DRAFTING, DraftInputs } from './garmentDrafts';
import { INITIAL, Saved } from './savedWork';
import { BODICE_GROUPS, BodiceChoices, DEFAULT_BODICE, DEFAULT_COAT_CHOICES, DEFAULT_JACKET_CHOICES, DRESS_FIT_GROUP, DressChoices, OuterChoices, WAIST_SEAM_GROUP, outerAllowed, outerGroups, validDetails } from './garments';
import { GROUPS, RISE_GROUP } from './skirtChoices';
import { roundBodice, roundDress, roundOuter, roundSkirt } from './engine/allRound';
import { DrapeJob, runDrape } from './engine/drape/run';
import type { Quality } from './engine/drape/quality';
import type { Fibre } from './engine/fabrics';
import type { RoundMeasurements } from './ui/allRoundShape';

export type SweepGarment = 'skirt' | 'bodice' | 'dress' | 'jacket' | 'coat';

/** One design to sew: the garment, its choices as a saved pattern keeps them, and the cloth. */
export interface SweepDesign {
  garment: SweepGarment;
  saved: Partial<Saved>;
  fibre: Fibre;
  crisp?: boolean;
}

interface SweepResult {
  design: SweepDesign;
  /** Its choices in words, "bodice fit=fitted neckline=v ...", for the report. */
  label: string;
  /** Undefined when the design doesn't draft (a combination the style screen wouldn't allow). */
  quality?: Quality;
  error?: string;
}

const FIBRES: Fibre[] = ['cotton', 'silk', 'wool', 'linen', 'viscose'];
const pick = <T>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length) % xs.length];

function randomSkirt(r: () => number): Saved['choices'] {
  const c: Record<string, unknown> = { ...INITIAL.choices };
  for (const g of GROUPS as readonly { id: string; options: readonly (readonly [string, string])[] }[]) c[g.id] = pick(r, g.options)[0];
  if (r() < 0.2) c.rise = pick(r, RISE_GROUP.options)[0];
  return c as unknown as Saved['choices'];
}

function randomBodice(r: () => number, garment: 'bodice' | 'dress' = 'bodice'): BodiceChoices {
  const c: Record<string, unknown> = { ...DEFAULT_BODICE };
  for (const g of BODICE_GROUPS as readonly { id: string; options: readonly (readonly [string, string])[] }[]) {
    // (The rarer details only now and then, so most designs are the common ones.)
    if (!['fit', 'neckline', 'length', 'sleeve', 'sleeveShape', 'collar', 'closure'].includes(g.id) && r() < 0.7) continue;
    c[g.id] = pick(r, g.options)[0];
  }
  return validDetails(c as unknown as BodiceChoices, garment);
}

function randomOuter(r: () => number, kind: 'jacket' | 'coat'): OuterChoices {
  let c: OuterChoices = { ...(kind === 'coat' ? DEFAULT_COAT_CHOICES : DEFAULT_JACKET_CHOICES) };
  for (const g of outerGroups(kind)) {
    const ok = g.options.filter(([o]) => outerAllowed(c, g.id, o));
    if (ok.length) c = { ...c, [g.id]: pick(r, ok)[0] };
  }
  return c;
}

/** A random design of one of the garments All round sews. */
export function randomDesign(r: () => number, garment: SweepGarment = pick(r, ['skirt', 'bodice', 'dress', 'jacket', 'coat'] as const)): SweepDesign {
  const fibre = pick(r, FIBRES);
  const crisp = r() < 0.25;
  if (garment === 'skirt') return { garment, saved: { choices: randomSkirt(r) }, fibre, crisp };
  if (garment === 'bodice') return { garment, saved: { bodice: randomBodice(r) }, fibre, crisp };
  if (garment === 'dress') {
    const dress: DressChoices = { garment: 'dress', fit: pick(r, DRESS_FIT_GROUP.options)[0], bodice: { ...randomBodice(r, 'dress'), length: 'waist' }, skirt: randomSkirt(r), waistSeam: pick(r, WAIST_SEAM_GROUP.options)[0] };
    return { garment, saved: { dress }, fibre, crisp };
  }
  return { garment, saved: garment === 'coat' ? { coat: randomOuter(r, 'coat') } : { jacket: randomOuter(r, 'jacket') }, fibre, crisp };
}

/** The design's choices in words, for the report. */
function designLabel(d: SweepDesign): string {
  const flat = (o: object, pre = ''): string[] =>
    Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v as object, `${k}.`) : v === undefined || k === 'garment' ? [] : [`${pre}${k}=${v}`]));
  const c = d.saved.choices ?? d.saved.bodice ?? d.saved.dress ?? d.saved.coat ?? d.saved.jacket ?? {};
  return [d.garment, ...flat(c), `fibre=${d.fibre}`, ...(d.crisp ? ['crisp'] : [])].join(' ');
}

/** Drafts the design on the example body, sews it on the form and scores the drawing. */
export function sewDesign(d: SweepDesign, values: MeasurementValues = EXAMPLE_BODY): SweepResult {
  const label = designLabel(d);
  const saved = { ...INITIAL, ...d.saved } as Saved;
  const inputs: DraftInputs = { saved, form: 'womenswear', fabric: { fibre: d.fibre, ...(d.crisp ? { drape: 'crisp' as const } : {}) } };
  try {
    const drafts = GARMENT_DRAFTING[d.garment].draft(values, inputs, undefined);
    const m = values as unknown as RoundMeasurements;
    let job: DrapeJob;
    if (drafts.outer) {
      const round = roundOuter(drafts.outer, values as never);
      const c = (d.saved.coat ?? d.saved.jacket)!;
      job = { kind: 'outer', draft: drafts.outer, boxy: c.shaping === 'boxy' || (c.fit as string) === 'oversized', m, armhole: round.armhole };
    } else if (drafts.dress) {
      const round = roundDress(drafts.dress, values as never, drafts.sleeve);
      job = { kind: 'dress', draft: drafts.dress, sleeve: drafts.sleeve, m, armhole: round.armhole };
    } else if (drafts.bodice) {
      const round = roundBodice(drafts.bodice, values as never, drafts.sleeve);
      job = { kind: 'bodice', draft: drafts.bodice, sleeve: drafts.sleeve, m, armhole: round.armhole };
    } else {
      const round = roundSkirt(drafts.skirt!);
      job = { kind: 'skirt', draft: drafts.skirt!, m, armhole: round.armhole };
    }
    const out = runDrape({ ...job, fibre: d.fibre, crisp: d.crisp });
    return { design: d, label, quality: out.quality };
  } catch (e) {
    return { design: d, label, error: String(e) };
  }
}

/** The report: how many passed, then each check's failures counted by the choices they share most. */
export function sweepReport(results: SweepResult[]): string {
  const sewn = results.filter((x) => x.quality);
  const failed = sewn.filter((x) => !x.quality!.ok);
  const lines = [`# All round sweep`, '', `${sewn.length} designs sewn (${results.length - sewn.length} didn't draft), ${sewn.length - failed.length} passed, ${failed.length} not usable.`, ''];
  // Which choices the failures share, against how often each turns up at all.
  const tally = (xs: SweepResult[]) => {
    const t = new Map<string, number>();
    for (const x of xs) for (const w of x.label.split(' ')) t.set(w, (t.get(w) ?? 0) + 1);
    return t;
  };
  const all = tally(sewn);
  const checks = [...new Set(failed.flatMap((x) => x.quality!.problems.map((p) => p.check)))];
  for (const check of checks) {
    const these = failed.filter((x) => x.quality!.problems.some((p) => p.check === check));
    const t = tally(these);
    const shared = [...t]
      .filter(([w, n]) => n >= 2 && n / these.length >= 0.4 && (all.get(w) ?? n) > 0)
      .map(([w, n]) => [w, n, n / (all.get(w) ?? n)] as const)
      .sort((a, b) => b[2] - a[2] || b[1] - a[1])
      .slice(0, 6);
    lines.push(`## ${check}: ${these.length}`, '');
    if (shared.length) lines.push(`Most often with: ${shared.map(([w, n, f]) => `${w} (${n}, ${Math.round(f * 100)}% of all with it)`).join(', ')}`, '');
    for (const x of these.slice(0, 8)) lines.push(`- ${x.label}: ${x.quality!.problems.filter((p) => p.check === check).map((p) => `${p.part} ${p.worst}`).join(', ')}`);
    lines.push('');
  }
  return lines.join('\n');
}

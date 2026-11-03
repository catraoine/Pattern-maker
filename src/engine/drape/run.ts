// One garment draped on the form from its own pattern pieces: what All round draws. The job carries the draft as
// drafted on the Style page, so it can be sent to a worker (structured clone drops the Path class, put back here).
import { Path } from '../geometry';
import type { BodiceDraft } from '../bodice';
import type { DressDraft } from '../dress';
import type { OuterDraft } from '../outerwear';
import type { SkirtDraft } from '../skirt';
import type { SleeveDraft } from '../sleeve';
import type { TrousersDraft } from '../trousers';
import type { Fibre } from '../fabrics';
import type { RoundGarment } from '../allRound';
import { placeOnForm, type RoundMeasurements } from '../../ui/allRoundShape';
import { widensForm } from './widen';
import { Quality, drapeQuality } from './quality';
import { DrapeOptions, Draped, drapeBodice, drapeDress, drapeOuter, drapeSkirt, drapeTrousers, isShell } from './garment';
import { makeSpace } from './space';

export type DrapeJob = { m: RoundMeasurements; armhole: RoundGarment['armhole']; fibre?: Fibre; crisp?: boolean } & (
  | { kind: 'skirt'; draft: SkirtDraft }
  | { kind: 'dress'; draft: DressDraft; sleeve?: SleeveDraft }
  | { kind: 'bodice'; draft: BodiceDraft; sleeve?: SleeveDraft }
  | { kind: 'outer'; draft: OuterDraft; boxy?: boolean }
  | { kind: 'trousers'; draft: TrousersDraft }
);

/** What the view needs of a draped garment: each panel's points and triangles, where it is cut from (for the print),
 *  the settled positions, the seams to draw and the buttons. Plain data, so it crosses from a worker. */
export interface DrapedLite {
  panels: { role: string; base: number; tris: number[][]; uv: number[]; hidden?: boolean; collar: boolean; /** Pressed pleats: drawn crisp, their faces' shading not softened away. */ pleated?: boolean; /** Points turned back over a fold (a lapel, a collar's fall). */ turned?: number[] }[];
  pos: Float64Array;
  /** The mirrored half's points, where they differ from `pos` (a slit up the left side seam only). */
  posMirror?: Float64Array;
  lines: { kind: string; ids: number[] }[];
  buttons: { at: [number, number, number]; r: number }[];
  /** Shadow inside pressed pleats, per point (0 to 1). */
  shade?: Float32Array;
  contrastCollar?: string;
  /** How good the drawing measured (see quality.ts): All round shows it turning only when it passed. */
  quality?: Quality;
}

/** How each cloth hangs: its thickness off the body and how it resists bending, by fibre. */
const TUNE: Partial<Record<Fibre, { thick: number; bendK: number }>> = {
  wool: { thick: 0.5, bendK: 0.12 },
  cotton: { thick: 0.35, bendK: 0.06 },
  linen: { thick: 0.35, bendK: 0.07 },
  silk: { thick: 0.25, bendK: 0.02 },
  viscose: { thick: 0.25, bendK: 0.02 },
  polyester: { thick: 0.3, bendK: 0.04 },
  blend: { thick: 0.3, bendK: 0.05 },
};

/** Puts back the Path class on every path in a cloned draft (a structured clone keeps the data, not the class). */
export function rehydrate<T>(v: T): T {
  const seen = new Set<object>();
  const walk = (o: unknown) => {
    if (!o || typeof o !== 'object' || seen.has(o)) return;
    seen.add(o);
    const r = o as Record<string, unknown>;
    if (Array.isArray(r.segs) && Array.isArray(r.tags) && 'start' in r && 'closed' in r && !(o instanceof Path)) Object.setPrototypeOf(o, Path.prototype);
    for (const k of Object.keys(r)) walk(r[k]);
  };
  walk(v);
  return v;
}

export function runDrape(job: DrapeJob): DrapedLite {
  const sp = makeSpace(placeOnForm({ armhole: job.armhole }, job.m), job.m, { widen: widensForm(job) });
  const t: DrapeOptions = { ...(TUNE[job.fibre ?? 'cotton'] ?? TUNE.cotton!) };
  if (job.crisp) t.crisp = 40;
  let d: Draped;
  switch (job.kind) {
    case 'outer':
      // Jackets and coats are cut in suiting and coating: a firm cloth whatever the swatch's fibre, or the lapels ripple.
      t.bendK = Math.max(t.bendK ?? 0, 0.3);
      t.thick = Math.max(t.thick ?? 0, 0.5);
      if (job.boxy) t.boxy = true;
      d = drapeOuter(sp, job.draft, t);
      break;
    case 'dress':
      // A side slit is drawn open (up the left side seam, as the pattern cuts it).
      d = drapeDress(sp, job.draft, job.sleeve, { ...t, openSlit: true });
      break;
    case 'bodice':
      d = drapeBodice(sp, job.draft, job.sleeve, t);
      break;
    case 'trousers':
      d = drapeTrousers(sp, job.draft, t);
      break;
    default:
      d = drapeSkirt(sp, job.draft, { ...t, openSlit: true });
  }
  const cc = job.kind === 'outer' ? (job.draft as { contrastCollar?: string }).contrastCollar : undefined;
  // (A skirt's hem, or a dress's, is cut level unless it is a high-low, a diagonal or a shaped hem.)
  const sk = job.kind === 'skirt' ? job.draft : job.kind === 'dress' ? job.draft.skirt : undefined;
  const quality = drapeQuality(d, sp, { seams: d.seams, levelHem: !!sk && !sk.asym && !sk.hem, legs: job.kind === 'trousers' });
  // A sleeve piece the drape left out (a raglan's back half) is cloth missing from the drawing, which no measure of the
  // cloth that is there can see: the eye check's oversized raglan jacket passed with its shoulders open (2026-11-02).
  const sleevePieces = (job.kind === 'outer' ? job.draft.pieces : job.kind === 'bodice' || job.kind === 'dress' ? (job.sleeve?.pieces ?? []) : []).filter((pc) => isShell(pc) && /sleeve/i.test(pc.name) && !/band|cuff|facing/i.test(pc.name));
  const sleevePanels = d.panels.filter((p) => p.role === 'sleeve' && !p.hidden).length;
  if (sleevePieces.length > sleevePanels) {
    for (const pc of sleevePieces.slice(sleevePanels)) quality.problems.push({ check: 'missing', part: pc.name, worst: sleevePieces.length - sleevePanels });
    quality.ok = false;
  }
  // A ruffle or a tie at the wrist the drawing leaves out: the sleeve reads plain, and the design's detail is lost (All
  // round quality, 2026-11-03: the long sleeve's check passing showed these drawn without their ruffle or tie).
  const drawn = new Set(d.panels.filter((p) => !p.hidden).map((p) => p.pc.name));
  const sleeveSet = job.kind === 'bodice' || job.kind === 'dress' ? (job.sleeve?.pieces ?? []) : [];
  for (const pc of sleeveSet.filter((pc) => /ruffle|tie cuff/i.test(pc.name) && !drawn.has(pc.name))) {
    quality.problems.push({ check: 'missing', part: pc.name, worst: 1 });
    quality.ok = false;
  }
  return {
    panels: d.panels.map((p) => ({
      role: p.role,
      base: p.base,
      tris: p.mesh.tris,
      uv: p.mesh.pts.flatMap((q) => [q.x, -q.y]),
      hidden: p.hidden,
      collar: p.role === 'collar',
      ...(p.pc.meta.pleatFolds ? { pleated: true } : {}),
      turned: p.turned.some(Boolean) ? p.turned.map((t) => (t ? 1 : 0)) : undefined,
    })),
    pos: d.pos,
    ...(d.posMirror ? { posMirror: d.posMirror } : {}),
    lines: d.lines,
    buttons: d.buttons.map((b) => ({ at: [b.at[0], b.at[1], b.at[2]], r: b.r })),
    ...(d.shade ? { shade: d.shade } : {}),
    contrastCollar: cc,
    quality,
  };
}

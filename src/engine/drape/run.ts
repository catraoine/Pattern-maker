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
import { DrapeOptions, Draped, drapeBodice, drapeDress, drapeOuter, drapeSkirt, drapeTrousers } from './garment';
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
  lines: { kind: string; ids: number[] }[];
  buttons: { at: [number, number, number]; r: number }[];
  /** Shadow inside pressed pleats, per point (0 to 1). */
  shade?: Float32Array;
  contrastCollar?: string;
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

/** Whether the garment has sleeves (a jacket or coat always does): it then hangs from the arm, on the form as it is. */
export function sleeved(job: Pick<DrapeJob, 'kind'> & { sleeve?: unknown }): boolean {
  return job.kind === 'outer' || !!job.sleeve;
}

export function runDrape(job: DrapeJob): DrapedLite {
  const sp = makeSpace(placeOnForm({ armhole: job.armhole }, job.m), job.m, { widen: !sleeved(job) });
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
      d = drapeDress(sp, job.draft, job.sleeve, t);
      break;
    case 'bodice':
      d = drapeBodice(sp, job.draft, job.sleeve, t);
      break;
    case 'trousers':
      d = drapeTrousers(sp, job.draft, t);
      break;
    default:
      d = drapeSkirt(sp, job.draft, t);
  }
  const cc = job.kind === 'outer' ? (job.draft as { contrastCollar?: string }).contrastCollar : undefined;
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
    lines: d.lines,
    buttons: d.buttons.map((b) => ({ at: [b.at[0], b.at[1], b.at[2]], r: b.r })),
    ...(d.shade ? { shade: d.shade } : {}),
    contrastCollar: cc,
  };
}

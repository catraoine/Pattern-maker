// One garment draped on the form from its own pattern pieces: what All round draws. The job carries the draft as
// drafted on the Style page, so it can be sent to a worker (structured clone drops the Path class, put back here).
import { Path } from '../geometry';
import type { BodiceDraft } from '../bodice';
import type { DressDraft } from '../dress';
import type { OuterDraft } from '../outerwear';
import type { SkirtDraft } from '../skirt';
import type { SleeveDraft } from '../sleeve';
import type { TrousersDraft } from '../trousers';
import type { TeeDraft } from '../tee';
import { drapeTee } from './tee';
import type { Fibre } from '../fabrics';
import { cardOf, type ClothCard } from './clothCard';
import type { RoundGarment } from '../allRound';
import { placeOnForm, type RoundMeasurements } from '../../ui/allRoundShape';
import { widensForm } from './widen';
import { Quality, drapeQuality } from './quality';
import { DrapeOptions, Draped, drapeBodice, drapeDress, drapeOuter, drapeSkirt, drapeTrousers, isShell } from './garment';
import { makeSpace } from './space';
import { closeSeams, hangScales } from './hang';
import { sideTie, type SideTieSpec } from './tie';
import { camiStraps } from './strap';
import { knob } from './knob';
import { fairDroppedSeam } from './seamFair';
import { BUST_Y, fitRoom, type FitPin } from './fitMap';
import { clearCollars } from './collarClear';
import { hugCollars, JACKET_HUG, openCollarEnds } from './collarHug';
import { fairBackCentre } from './fairFront';
import { layLapelFoot } from './lapelFoot';
import { fairStraps } from './strapFair';
import { fairCowl } from './cowlFair';

export type DrapeJob = { m: RoundMeasurements; armhole: RoundGarment['armhole']; fibre?: Fibre; crisp?: boolean; /** How the cloth behaves (clothCard.ts); without it, the card of the fibre and crisp fields. */ card?: ClothCard; /** A side tie knotted at the left side seam at the waist (belt.ts). */ sideTie?: SideTieSpec } & (
  | { kind: 'skirt'; draft: SkirtDraft }
  | { kind: 'dress'; draft: DressDraft; sleeve?: SleeveDraft }
  | { kind: 'bodice'; draft: BodiceDraft; sleeve?: SleeveDraft }
  | { kind: 'outer'; draft: OuterDraft; boxy?: boolean }
  | { kind: 'trousers'; draft: TrousersDraft }
  | { kind: 'tee'; draft: TeeDraft }
);

/** What the view needs of a draped garment: each panel's points and triangles, where it is cut from (for the print),
 *  the settled positions, the seams to draw and the buttons. Plain data, so it crosses from a worker. */
export interface DrapedLite {
  panels: { role: string; base: number; tris: number[][]; uv: number[]; hidden?: boolean; collar: boolean; /** Drawn once, on the wearer's left only (a side tie), not mirrored. */ single?: boolean; /** Pressed pleats: drawn crisp, their faces' shading not softened away. */ pleated?: boolean; /** Points turned back over a fold (a lapel, a collar's fall). */ turned?: number[]; /** Cut whole (a one-shoulder's front): both halves are its own points, nothing mirrored. */ whole?: boolean }[];
  pos: Float64Array;
  /** The mirrored half's points, where they differ from `pos` (a slit up the left side seam only). */
  posMirror?: Float64Array;
  /** The scale (cm per form unit) each point is drawn at where it differs from its level's own: cloth hanging clear of
   *  the body keeps the scale of where it last touched, so it hangs plumb on the form (see hang.ts). 0 = the level's. */
  hang?: Float32Array;
  lines: { kind: string; ids: number[] }[];
  buttons: { at: [number, number, number]; r: number }[];
  /** Shadow inside pressed pleats, per point (0 to 1). */
  shade?: Float32Array;
  contrastCollar?: string;
  /** How good the drawing measured (see quality.ts): All round shows it turning only when it passed. */
  quality?: Quality;
  /** The fit map: each panel point's room round the body, in cm (see fitMap.ts); NaN where it isn't read. */
  fit?: Float32Array;
  /** The fit map's labels: the pattern's own ease at the bust, waist and hip, each at the front of the cloth there. */
  fitTags?: { name: string; ease: number; at: [number, number, number] }[];
}

/** The pattern's own ease at the bust, waist and hip, where the draft gives a finished measurement there: what the fit
 *  map is pinned to (see fitMap.ts). */
function fitPins(job: DrapeJob, bustC: number): FitPin[] {
  type Finished = { finishedBust?: number; finishedWaist?: number; finishedHip?: number };
  const m = job.m;
  const top: Finished | undefined = job.kind === 'dress' ? (job.draft.bodice as Finished) : job.kind === 'bodice' || job.kind === 'outer' || job.kind === 'tee' ? (job.draft as Finished) : undefined;
  const below: Finished | undefined = job.kind === 'dress' ? (job.draft.skirt as Finished) : job.kind === 'skirt' || job.kind === 'trousers' ? (job.draft as Finished) : undefined;
  const pins: FitPin[] = [];
  const pin = (name: string, c: number, finished: number | undefined, body: number | undefined) => {
    if (typeof finished === 'number' && Number.isFinite(finished) && typeof body === 'number') pins.push({ name, c, ease: finished - body });
  };
  pin('Bust', bustC, top?.finishedBust, m.full_bust);
  // (A waist seam or a waistband reads both layers at once, and a top's edge only grazes the level: pinned a little
  // below it, where the waist's ease still holds.)
  pin('Waist', below ? 3 : 0, below?.finishedWaist ?? top?.finishedWaist, m.waist);
  pin('Hip', m.waist_to_hip ?? 20.5, below?.finishedHip ?? top?.finishedHip, m.full_hip);
  return pins;
}

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
  // (Every garment now follows its cloth. A jacket or coat is cut in a firm cloth whatever the swatch: its own cloth
  // moves that firmness 0.9 to 1.6 times (the square root of 0.81 to 2.56), and it lies at most 0.6 cm off the body.
  // Softer, a silk jacket's peak lapel stretched; thicker, a heavy wool shawl collar did, Fabric behaviour round 3.)
  const c = job.card ?? cardOf(job.fibre, job.crisp);
  // (Not on a dropped or low waist seam's skirt: given on the bias, its top stood out past the bodice again, the ledge
  // round the hip that fairDroppedSeam takes out, Fabric behaviour on release M.)
  const dropped = job.kind === 'dress' && (job.draft.seamDrop ?? 0) > 1;
  const outer = job.kind === 'outer';
  const t: DrapeOptions = { bendK: c.bendK, thick: outer ? Math.min(c.thick, 0.6) : c.thick, ...(c.crisp ? { crisp: c.crisp } : {}), ...(c.fall !== 1 ? { fall: c.fall } : {}), ...(c.skirtBend !== 1 ? { skirtBend: outer ? Math.min(2.56, Math.max(0.81, c.skirtBend)) : c.skirtBend } : {}), ...(c.stretch ? { stretch: c.stretch } : {}), ...(c.bias && !dropped ? { bias: c.bias } : {}) };
  let d: Draped;
  switch (job.kind) {
    case 'outer':
      // Jackets and coats are cut in suiting and coating: a firm cloth whatever the swatch's fibre, or the lapels ripple.
      t.bendK = Math.max(t.bendK ?? 0, 0.3);
      t.thick = Math.max(t.thick ?? 0, 0.5);
      if (job.boxy) t.boxy = true;
      // A stiff cloth that isn't crisp (a leather) holds a jacket's own shape as a crisp one does (standStiff): its own
      // bend, about 1 for a leather, reaches the whole jacket once it passes 0.5 (Cat: "every garment type able to
      // show stiffer fabric, including jackets", Fabric behaviour round 6). A crisp cloth, denim among them, takes the
      // crisp path in drapeOuter already.
      {
        const own = c.bendK * c.skirtBend;
        const k = knob('__outerStiffK') ?? 0.3 + Math.max(0, own - (knob('__outerStiffFrom') ?? 0.12)) * (knob('__outerStiffX') ?? 2.1);
        // (Below that, as round 3: a heavy wool at 0.38 stretched a peak collar.)
        if (!t.crisp && k > (knob('__outerStiffAt') ?? 0.5)) {
          t.stiffBend = k;
          delete t.skirtBend;
        }
      }
      d = drapeOuter(sp, job.draft, t);
      // Its back faired across the centre below the waist, so the hem doesn't flick out behind.
      if (!knob('__noFairBack')) fairBackCentre(d.panels, d.pos);
      // A lapel's foot folded right back at the break, not left poking out past the front's edge.
      if (job.draft.lapel && !knob('__noLapelFoot')) layLapelFoot(d.panels, d.pos, [job.draft.lapel.roll[0], job.draft.lapel.roll[1]]);
      break;
    case 'dress':
      // A side slit is drawn open (up the left side seam, as the pattern cuts it).
      d = drapeDress(sp, job.draft, job.sleeve, { ...t, openSlit: true, fallOn: 'skirt' });
      break;
    case 'bodice':
      d = drapeBodice(sp, job.draft, job.sleeve, t);
      break;
    case 'trousers':
      // (A trouser leg hangs by its cloth's fall, 5/3 as hard as a skirt's: Cat's B, Fabric behaviour round 4.)
      d = drapeTrousers(sp, job.draft, { ...t, fallOn: 'all' });
      break;
    case 'tee':
      d = drapeTee(sp, job.draft, t);
      break;
    default:
      d = drapeSkirt(sp, job.draft, { ...t, openSlit: true, fallOn: 'all' });
  }
  const cc = job.kind === 'outer' ? (job.draft as { contrastCollar?: string }).contrastCollar : undefined;
  // (A skirt's hem, or a dress's, is cut level unless it is a high-low, a diagonal or a shaped hem.)
  const sk = job.kind === 'skirt' ? job.draft : job.kind === 'dress' ? job.draft.skirt : undefined;
  // A collar's fall over the shoulders lifted out where the sim sank it into them.
  if (!knob('__noCollarClear')) clearCollars(d, sp);
  // A sleeveless shoulder's strap laid straight over the shoulder, not fanned out past its seam.
  if (job.kind === 'dress' || job.kind === 'bodice') fairStraps(d);
  if (job.kind === 'dress' || job.kind === 'bodice') fairCowl(d, sp);
  // A tailored collar leans in to hug the neck round the sides and back (collarHug.ts): a vest's from the Look 02 fixes,
  // a jacket's or coat's further round towards the gorge, where it stood off the neck as a funnel (Cat "move forward
  // with collar", Nov 11).
  if (job.kind === 'outer' && job.draft.lapel && !job.draft.sleeveless && !knob('__noCollarOpen')) openCollarEnds(d);
  if (job.kind === 'outer' && job.draft.lapel && !knob('__noCollarHug')) hugCollars(d, sp, job.draft.sleeveless ? undefined : JACKET_HUG);
  // A shawl's top collar is cut in one with its facing, so the gorge seam under it doesn't show: drawn, it read as a
  // notch where the collar meets the lapel (Cat "Collar, start more with clo", Nov 11).
  if (job.kind === 'outer' && job.draft.lapel?.shawl) d.lines = d.lines.filter((l) => l.kind !== 'gorge');
  const quality = drapeQuality(d, sp, { seams: d.seams, levelHem: !!sk && !sk.asym && !sk.hem, legs: job.kind === 'trousers' });
  // A sleeve piece the drape left out (a raglan's back half) is cloth missing from the drawing, which no measure of the
  // cloth that is there can see: the eye check's oversized raglan jacket passed with its shoulders open (2026-11-02).
  const sleevePieces = (job.kind === 'outer' ? job.draft.pieces : job.kind === 'tee' ? (job.draft.sleeveless ? [] : job.draft.sleeve.pieces) : job.kind === 'bodice' || job.kind === 'dress' ? (job.sleeve?.pieces ?? []) : []).filter((pc) => isShell(pc) && /sleeve/i.test(pc.name) && !/band|cuff|facing/i.test(pc.name));
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
  // A diagonal hem runs from short on one side to long on the other: drawn from one half of the skirt and its mirror,
  // it came out as a V point at the centre front, passing every check (Nov 8). Sewn whole (wholeSkirt.ts) it hangs as
  // cut; a skirt still sewn as a half shows the Front drawing instead.
  if ((sk?.asym as { kind?: string } | undefined)?.kind === 'diagonal' && d.panels.some((p) => /^Skirt/.test(p.pc.name) && !p.hidden && !p.pc.meta.whole) && !knob('__diagonalOk')) {
    quality.problems.push({ check: 'diagonal', part: 'Skirt front', worst: 1 });
    quality.ok = false;
  }
  // A dress's waist seam dropped onto the hip: run straight through, without the ledge the sim leaves there.
  if (job.kind === 'dress' && (job.draft.seamDrop ?? 0) > 1 && !knob('__noSeamFair')) fairDroppedSeam(d, sp);
  // The room is read from the cloth as it settled on the body, before it is drawn (closeSeams and the hang move it).
  const thickOf = new Float64Array(d.pos.length / 3);
  for (const p of d.panels) p.thick.forEach((t, i) => (thickOf[p.base + i] = t));
  const pins = fitPins(job, sp.cOf(BUST_Y));
  const fit = fitRoom(d, sp, (k) => thickOf[k], pins);
  // Each label at the front of the cloth at its level (the most forward point near the centre front there).
  const fitTags: NonNullable<DrapedLite['fitTags']> = [];
  for (const pin of pins) {
    let at: [number, number, number] | undefined;
    // (Within 3 cm of the centre front, or, where a plunge leaves it open, within 12: the bust label went missing.)
    for (const reach of [3, 12]) {
      for (const p of d.panels) {
        if (p.hidden || p.role === 'sleeve' || p.role === 'collar') continue;
        for (let i = 0; i < p.mesh.pts.length; i++) {
          const k = (p.base + i) * 3;
          if (Math.abs(d.pos[k]) < reach && Math.abs(d.pos[k + 1] - pin.c) < 1.5 && d.pos[k + 2] > 0 && (!at || d.pos[k + 2] > at[2])) at = [0, pin.c, d.pos[k + 2]];
        }
      }
      if (at) break;
    }
    if (at) fitTags.push({ name: pin.name, ease: Math.round(pin.ease * 2) / 2, at });
  }
  closeSeams(d);
  // (Trouser legs hang round the form's own legs, not the body's axis: measured against the body's round, the leg's
  // points read as touching and clear by turns down each leg, and were drawn at their scales by turns, a sawtooth.)
  let hang = job.kind === 'trousers' ? undefined : hangScales(d, sp);
  if (hang) closeSeams(d, hang);
  let pos = d.pos;
  let posMirror = d.posMirror;
  const extra: DrapedLite['panels'] = [];
  // More cloth drawn on the settled garment (a tie, a strap): its points added after the panels', its drawn scale
  // taken from the cloth point each hangs by.
  const append = (m: { pos: number[]; tris: number[][]; uv: number[]; ref: number[] }, role: string, single: boolean) => {
    const base = pos.length / 3;
    const join = (a: Float64Array) => {
      const j = new Float64Array(a.length + m.pos.length);
      j.set(a);
      j.set(m.pos, a.length);
      return j;
    };
    pos = join(pos);
    if (posMirror) posMirror = join(posMirror);
    if (hang) {
      const h = new Float32Array(base + m.ref.length);
      h.set(hang);
      m.ref.forEach((r, k) => (h[base + k] = hang![r]));
      hang = h;
    }
    extra.push({ role, base, tris: m.tris, uv: m.uv, collar: false, ...(single ? { single: true } : {}) });
  };
  const tie = job.sideTie && (job.kind === 'dress' || job.kind === 'skirt') ? sideTie(d, job.sideTie) : undefined;
  if (tie) append(tie, 'tie', true);
  // A cami's rouleau straps: given on the pattern as measurements, not pieces, so drawn here over each shoulder.
  const top = job.kind === 'bodice' ? job.draft.top : job.kind === 'dress' ? job.draft.bodice.top : undefined;
  if (top?.neckline === 'cami' && top.straps && top.strapAt) {
    const straps = camiStraps(d, sp, top.strapAt);
    if (straps) append(straps, 'strap', false);
    else {
      quality.problems.push({ check: 'missing', part: 'Straps', worst: 1 });
      quality.ok = false;
    }
  }
  return {
    panels: [...d.panels.map((p) => ({
      role: p.role,
      base: p.base,
      tris: p.mesh.tris,
      uv: p.mesh.pts.flatMap((q) => [q.x, -q.y]),
      hidden: p.hidden,
      collar: p.role === 'collar',
      ...(p.pc.meta.pleatFolds ? { pleated: true } : {}),
      ...(p.pc.meta.whole ? { whole: true } : {}),
      turned: p.turned.some(Boolean) ? p.turned.map((t) => (t ? 1 : 0)) : undefined,
    })), ...extra],
    pos,
    ...(posMirror ? { posMirror } : {}),
    ...(hang ? { hang } : {}),
    lines: d.lines,
    buttons: d.buttons.map((b) => ({ at: [b.at[0], b.at[1], b.at[2]], r: b.r })),
    ...(d.shade ? { shade: d.shade } : {}),
    contrastCollar: cc,
    quality,
    fit,
    fitTags,
  };
}

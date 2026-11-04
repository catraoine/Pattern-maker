// How good a draped garment's drawing is, measured rather than looked at: what All round checks before it shows a
// garment turning on the form (Cat, 2026-11-02: "users are going to design whatever they want, how do we ensure the
// all round displays properly"). Each check is one way a drawing has gone wrong on a look so far:
// - broken: a point flung off (not a number, or metres from the form);
// - stretched: cloth drawn much longer than it is cut (a spike, a sheet pulled between two places);
// - seam: two pieces sewn together drawn apart (a slit the form shows through);
// - jagged: an edge (a hem, a neckline, an armhole) running in a sawtooth rather than a line;
// - fin: the cloth folded back sharply on itself where nothing is pressed (a keel down a seam, a crumple);
// - inside: cloth drawn inside the form;
// - collar: a collar standing off what it should lie on;
// - hem: a level hem drawn far from level.
// A drawing that fails any check is not shown turning: the page keeps the flat drawing and says the turning view for
// that combination is still in testing (see AllRound).
import type { Draped } from './garment';
import type { Space } from './space';

// - missing: a piece the pattern has that the drawing left out (set in run.ts, where the draft is to hand).
type QualityCheck = 'broken' | 'stretched' | 'seam' | 'jagged' | 'fin' | 'inside' | 'collar' | 'hem' | 'missing';

export interface QualityProblem {
  check: QualityCheck;
  /** The piece it is on, by name ("Skirt back"). */
  part: string;
  /** How bad, in the check's own unit (cm, a ratio, or a count), for the sweep's report. */
  worst: number;
}

export interface Quality {
  ok: boolean;
  problems: QualityProblem[];
}

/** Where each check fails, tuned on the SS27 looks: every look Cat passed stays under them, every one she turned
 * back for these faults goes over. */
const LIMITS = {
  /** No point further than this from the form's axis or the waist, in cm. */
  far: 250,
  /** An edge drawn this many times as long as it is cut (1.8: the eye check of 2026-11-02 found no higher setting that
   *  kept a halter's front standing off as a wing out while letting a bishop sleeve's fullness through, so the sleeve
   *  waits)... */
  stretch: 1.8,
  /** ...on more than this share of a piece's edges. */
  stretchShare: 0.01,
  /** Sewn points this far apart, in cm (1.6: a tiered maxi's yoke seams at 1.3 to 1.5 cm read closed by eye; a wrap's at
   *  2.6 and a shirt dress's at 6.8 did not). */
  seamGap: 1.6,
  /** An edge point this far off the line through its neighbours (cm), and as a share of their distance apart... */
  jagCm: 0.6,
  jagShare: 0.3,
  /** ...at this many points along one edge. */
  jagCount: 3,
  /** Neighbouring faces turned this far from each other (degrees)... */
  finDeg: 120,
  /** ...along more than this many edges of one piece. */
  finCount: 12,
  /** Cloth this far inside the form (cm)... */
  insideCm: 0.6,
  /** ...at more than this share of a piece's points. */
  insideShare: 0.02,
  /** A collar's turned cloth this far off whatever it lies on, in cm (by its middle point). */
  collarCm: 2,
  /** A level hem's rise and fall all round, in cm. */
  hemCm: 5,
};

interface QualityOptions {
  /** The hem is cut level (not a high-low, a diagonal or a shaped hem): it should hang level. */
  levelHem?: boolean;
  /** Seams, as the drape sewed them. */
  seams?: { i: number; j: number; k: number; t: number }[];
  /** Trousers: the legs go below the form, where it has no body to be inside. */
  legs?: boolean;
}

export function drapeQuality(d: Draped, sp: Pick<Space, 'bodyR' | 'tip'>, o: QualityOptions = {}): Quality {
  const L = LIMITS;
  const pos = d.pos;
  const problems: QualityProblem[] = [];
  const add = (check: QualityCheck, part: string, worst: number) => {
    const had = problems.find((q) => q.check === check && q.part === part);
    if (had) had.worst = Math.max(had.worst, Math.round(worst * 100) / 100);
    else problems.push({ check, part, worst: Math.round(worst * 100) / 100 });
  };
  const P = (g: number): [number, number, number] => [pos[g * 3], pos[g * 3 + 1], pos[g * 3 + 2]];
  const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const shown = d.panels.filter((p) => !p.hidden);
  const sleeved = shown.some((p) => p.role === 'sleeve');
  const nameOf = new Map<number, string>();
  for (const p of d.panels) for (let i = 0; i < p.mesh.pts.length; i++) nameOf.set(p.base + i, p.pc.name);

  for (const p of shown) {
    const name = p.pc.name;
    const pts = p.mesh.pts;
    // Broken: a point that isn't a number, or flung far off.
    let broken = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x, c, z] = P(p.base + i);
      if (!Number.isFinite(x + c + z) || Math.hypot(x, z) > L.far || Math.abs(c) > L.far) broken++;
    }
    if (broken) {
      add('broken', name, broken);
      continue;
    }
    // Stretched, and fins: over the piece's triangles and the edges they share.
    const pleated = !!p.pc.meta.pleatFolds;
    const faces = new Map<string, [number, number, number][]>();
    let edges = 0;
    let long = 0;
    let worstS = 0;
    const normal = (t: [number, number, number]) => {
      const [a, b, c] = t.map((i) => P(p.base + i));
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const l = Math.hypot(n[0], n[1], n[2]) || 1;
      return n.map((q) => q / l);
    };
    // (The cloth just under the arm of a sleeved top is hidden by the sleeve and pulled by it as the arm hangs: a long
    // sleeve stretches it there while the drawing reads right, All round quality 2026-11-03. Fins skip it too, below.)
    const underArm = sleeved && p.role !== 'sleeve' ? (p.mesh.runs.armhole ?? []).flat().map((i) => pts[i]) : [];
    const hidden = (i: number) => underArm.some((q) => Math.hypot(q.x - pts[i].x, q.y - pts[i].y) < 5);
    for (const t of p.mesh.tris) {
      for (const [u, v] of [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]]) {
        const cut = Math.hypot(pts[u].x - pts[v].x, pts[u].y - pts[v].y);
        if (cut > 0.05 && !(hidden(u) && hidden(v))) {
          const r = dist(P(p.base + u), P(p.base + v)) / cut;
          edges++;
          if (r > L.stretch) long++;
          worstS = Math.max(worstS, r);
        }
        const k = u < v ? `${u},${v}` : `${v},${u}`;
        (faces.get(k) ?? faces.set(k, []).get(k)!).push(t);
      }
    }
    // (Gathered or pleated cloth is drawn narrower than it is cut, its fullness laid on as folds: not measured here.)
    const gathered = (((p.pc.meta.gatherShown ?? p.pc.meta.gathered) as number | undefined) ?? 1) > 1.05;
    if (edges && long / edges > L.stretchShare && !pleated && !gathered) add('stretched', name, worstS);
    // (Pleats are pressed folds and a collar or lapel turns over its roll line: their sharp turns are meant.)
    if (!pleated && p.role !== 'collar' && !p.turned.some(Boolean)) {
      // (A dart's intake is folded flat inside, along its legs: those folds are sewn, not fins.)
      const legs = p.mesh.darts.flatMap(([a, b]) => [...a, ...b]).map((i) => pts[i]);
      // (Nor the cloth under the arm, which the sleeve hides and the arm crowds.)
      const arm = (p.mesh.runs.armhole ?? []).flat().map((i) => pts[i]);
      const nearDart = (i: number) => legs.some((q) => Math.hypot(q.x - pts[i].x, q.y - pts[i].y) < 2) || (sleeved && arm.some((q) => Math.hypot(q.x - pts[i].x, q.y - pts[i].y) < 5));
      // (A shirt's cuff is a band folded in half along its length, round the wrist: that fold, within a mesh step, is meant.)
      const xs = pts.map((q) => q.x);
      const midX = (Math.min(...xs) + Math.max(...xs)) / 2;
      const onCuffFold = (k: string) => p.pc.name === 'Cuff' && k.split(',').every((i) => Math.abs(pts[Number(i)].x - midX) < 1.2);
      let fins = 0;
      const cosMax = Math.cos((L.finDeg * Math.PI) / 180);
      for (const [key, fs] of faces) {
        if (fs.length !== 2) continue;
        if (fs[0].some(nearDart) || onCuffFold(key)) continue;
        const a = normal(fs[0]);
        const b = normal(fs[1]);
        if (a[0] * b[0] + a[1] * b[1] + a[2] * b[2] < cosMax) fins++;
      }
      if (fins > L.finCount) add('fin', name, fins);
    }
    // Jagged edges: along each run of the outline (a pleat's intake and a dart are folded away, not edges).
    for (const [tag, runs] of Object.entries(p.mesh.runs)) {
      if (tag === 'pleat' || tag === 'dart' || tag === 'fold') continue;
      for (const run of runs) {
        if (run.length < 5) continue;
        let jag = 0;
        // (Each point's lean off the line through its neighbours, kept so a tooth can be told from a flute: a flute
        // on a full hem, a circle skirt's or a gathered one's, bends the same way for several points in a row, while
        // a sawtooth turns back at every point. Only a turn against the point before or after counts, All round
        // quality 2026-11-04: the half-circle and gathered skirts' flutes read as jagged and showed their drawing.)
        const lean: ([number, number, number] | undefined)[] = [];
        for (let k = 1; k < run.length - 1; k++) {
          const a = P(p.base + run[k - 1]);
          const b = P(p.base + run[k]);
          const c = P(p.base + run[k + 1]);
          // (Two points sewn to one spot, as a sleeve cap's two underarm ends are: a doubled point, not a tooth.)
          if (dist(a, b) < 0.05 || dist(b, c) < 0.05) {
            lean.push(undefined);
            continue;
          }
          const mid = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2];
          const off = dist(b, mid);
          // (Where the cut edge itself turns a corner, it may.)
          const cutTurn = Math.hypot(pts[run[k]].x - (pts[run[k - 1]].x + pts[run[k + 1]].x) / 2, pts[run[k]].y - (pts[run[k - 1]].y + pts[run[k + 1]].y) / 2);
          lean.push(off - cutTurn > L.jagCm && off > L.jagShare * dist(a, c) ? [b[0] - mid[0], b[1] - mid[1], b[2] - mid[2]] : undefined);
        }
        const against = (u: [number, number, number] | undefined, v: [number, number, number] | undefined) => !!u && !!v && u[0] * v[0] + u[1] * v[1] + u[2] * v[2] < 0;
        for (let k = 0; k < lean.length; k++) if (lean[k] && (against(lean[k], lean[k - 1]) || against(lean[k], lean[k + 1]))) jag++;
        if (jag >= L.jagCount) add('jagged', `${name} ${tag}`, jag);
      }
    }
    // Inside the form (trousers' legs hang below it, past the body the table knows; a sleeve hangs on the arm, beside it).
    if (!o.legs && p.role !== 'sleeve') {
      let inside = 0;
      let worstI = 0;
      for (let i = 0; i < pts.length; i++) {
        const [x, c, z] = P(p.base + i);
        if (c < sp.tip.c) continue;
        const under = sp.bodyR(Math.atan2(x, z), c) - Math.hypot(x, z);
        if (under > L.insideCm) {
          inside++;
          worstI = Math.max(worstI, under);
        }
      }
      if (inside / pts.length > L.insideShare) add('inside', name, worstI);
    }
  }

  // Seams drawn apart.
  for (const { i, j, k, t } of o.seams ?? []) {
    const a = P(i);
    const b = P(j);
    const c = P(k);
    const gap = dist(a, [b[0] * (1 - t) + c[0] * t, b[1] * (1 - t) + c[1] * t, b[2] * (1 - t) + c[2] * t]);
    if (gap > L.seamGap) add('seam', `${nameOf.get(i)} to ${nameOf.get(j)}`, gap);
  }

  // A collar standing off: each of its turned points against the nearest cloth that isn't collar.
  const collars = shown.filter((p) => p.role === 'collar');
  if (collars.length) {
    const under: number[][] = [];
    for (const p of shown) if (p.role !== 'collar') for (let i = 0; i < p.mesh.pts.length; i++) under.push(P(p.base + i));
    // (By the middle of its turned points: its fold edge stands a stand's height off, as it should.)
    for (const p of collars) {
      const gaps: number[] = [];
      p.turned.forEach((on, i) => {
        if (!on) return;
        const q = P(p.base + i);
        let best = Infinity;
        for (const u of under) best = Math.min(best, dist(q, u));
        gaps.push(best);
      });
      gaps.sort((a, b) => a - b);
      const mid = gaps[gaps.length >> 1] ?? 0;
      if (mid > L.collarCm) add('collar', p.pc.name, mid);
    }
  }

  // A level hem hanging far from level.
  if (o.levelHem) {
    // (Only the lowest hem: a tiered skirt's upper tiers have hems of their own, a tier's depth above it.)
    const byPanel = shown.filter((p) => /peplum/.test(p.role)).map((p) => (p.mesh.runs.hem ?? []).flat().map((i) => pos[(p.base + i) * 3 + 1])).filter((h) => h.length);
    const low = Math.max(...byPanel.map((h) => h.reduce((a, b) => a + b, 0) / h.length), -Infinity);
    const hem = byPanel.filter((h) => h.reduce((a, b) => a + b, 0) / h.length > low - 8).flat();
    if (hem.length) {
      const range = Math.max(...hem) - Math.min(...hem);
      if (range > L.hemCm) add('hem', 'Hem', range);
    }
  }

  return { ok: !problems.length, problems };
}

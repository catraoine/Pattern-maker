// The Garment range's technical flats (2026-11-07), front and back, drawn to scale from their drafts as the other
// garments' are: the knit dress and hoodie on the T-shirt's flat, the jumpsuit as the top's flat stood on the
// trousers' at the waist. The Style page lays each on the form (wornShapes), so what is drawn here is what the form shows.
import { P, add, lerp, p } from './geometry';
import { Flat, FlatView, arrange, bodiceFlat, teeFlat, trousersView } from './flat';
import type { KnitDressDraft } from './knitDress';
import type { HoodieDraft } from './hoodie';
import type { JumpsuitDraft } from './jumpsuit';
import type { TrousersMeasurements } from './trousers';

type RawView = Omit<FlatView, 'at' | 'origin'>;
type Line = FlatView['lines'][number];

/** A flat's views back in the pieces' own coordinates (the centre at x = 0), to draw more onto. */
function raw(flat: Flat): RawView[] {
  return flat.views.map((v) => {
    const own = (q: P) => p(q.x - v.origin.x, q.y - v.origin.y);
    return { label: v.label, shapes: v.shapes.map((s) => s.map(own)), lines: v.lines.map((l) => ({ ...l, pts: l.pts.map(own) })), sleeves: v.sleeves, ...(v.armless ? { armless: v.armless.map(own) } : {}) };
  });
}

const mirror = (pts: P[]) => pts.map((q) => p(-q.x, q.y));
const curve = (a: P, c: P, b: P, n = 16): P[] => Array.from({ length: n + 1 }, (_, i) => { const t = i / n; return p((1 - t) ** 2 * a.x + 2 * t * (1 - t) * c.x + t * t * b.x, (1 - t) ** 2 * a.y + 2 * t * (1 - t) * c.y + t * t * b.y); });
const rect = (x0: number, y0: number, x1: number, y1: number): P[] => [p(x0, y0), p(x1, y0), p(x1, y1), p(x0, y1)];
/** Half the body's width at level y, from its outline. */
function halfWidth(body: P[], y: number): number {
  let w = 0;
  for (let i = 0; i < body.length; i++) {
    const a = body[i];
    const b = body[(i + 1) % body.length];
    if ((a.y - y) * (b.y - y) <= 0 && a.y !== b.y) w = Math.max(w, Math.abs(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y)));
  }
  return w;
}
const bottomOf = (pts: P[]) => Math.max(...pts.map((q) => q.y));

/** A rib band across the body's hem, `depth` deep, ribs drawn as stitching. */
function hemBand(v: RawView, depth: number) {
  const body = v.shapes[0];
  // The band is as wide as the hem at the side seam and starts from the hem's corner there; a knit front's hem dips
  // a little at the centre for the bust, which the band covers.
  const low = body.filter((q) => q.y > bottomOf(body) - 6);
  const w = Math.max(...low.map((q) => Math.abs(q.x)));
  const y1 = Math.min(...low.filter((q) => Math.abs(q.x) > w - 0.3).map((q) => q.y));
  v.shapes.push(rect(-w, y1, w, y1 + depth));
  for (let x = -w + 1.2; x < w - 0.3; x += 1.2) v.lines.push({ pts: [p(x, y1 + 0.4), p(x, y1 + depth - 0.4)], kind: 'stitch' });
}

/** Rib cuffs at the end of each sleeve, `depth` long, set on past the sleeve's hem. */
function cuffs(v: RawView, depth: number) {
  for (const i of v.sleeves ?? []) {
    const s = v.shapes[i];
    // The hem is the sleeve's far edge: the two points furthest out along the arm.
    const far = (q: P) => Math.abs(q.x) * 0.6 + q.y;
    const a = [...s].sort((u, w) => far(w) - far(u))[0];
    const b = s.filter((q) => Math.hypot(q.x - a.x, q.y - a.y) > 4).sort((u, w) => far(w) - far(u))[0];
    if (!b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const L = Math.hypot(dx, dy);
    let nx = -dy / L;
    let ny = dx / L;
    const mid = lerp(a, b, 0.5);
    const cen = s.reduce((c, q) => add(c, p(q.x / s.length, q.y / s.length)), p(0, 0));
    // Out along the arm, away from the sleeve's middle.
    if ((cen.x - mid.x) * nx + (cen.y - mid.y) * ny > 0) [nx, ny] = [-nx, -ny];
    const off = (q: P) => p(q.x + nx * depth, q.y + ny * depth);
    v.sleeves = [...(v.sleeves ?? []), v.shapes.push([a, b, off(b), off(a)]) - 1];
    for (let t = 0.12; t < 0.95; t += 0.12) {
      const q = lerp(a, b, t);
      v.lines.push({ pts: [q, off(q)], kind: 'stitch' });
    }
  }
}

/** The knit dress: the T-shirt's flat at the dress's length; a skater's skirt flaring from the waist seam; rib cuffs and band. */
export function knitDressFlat(d: KnitDressDraft): Flat {
  const views = raw(teeFlat(d.tee));
  for (const v of views) {
    if (d.skater) {
      const body = v.shapes[0];
      const waistY = bottomOf(body);
      const w = halfWidth(body, waistY - 0.3);
      // Seen flat, a circle skirt spreads to about half its length past the waist each side, its hem curving down.
      const out = w + d.skater.length * 0.55;
      const hemY = waistY + d.skater.length;
      const half = [p(0, waistY), p(w, waistY), ...curve(p(w, waistY), p(w + (out - w) * 0.35, waistY + d.skater.length * 0.5), p(out, hemY - 2)), ...curve(p(out, hemY - 2), p(out * 0.5, hemY + 1.5), p(0, hemY + 1.5)).slice(1)];
      v.shapes.splice(1, 0, [...half, ...mirror(half).reverse()]);
      if (v.sleeves) v.sleeves = v.sleeves.map((i) => i + 1);
      v.lines.push({ pts: [p(-w, waistY), p(w, waistY)], kind: 'seam' });
      for (const at of [1.5, 2.1]) v.lines.push({ pts: curve(p(-out + 0.8, hemY - 2 - at), p(0, hemY + 1.5 - at), p(out - 0.8, hemY - 2 - at)), kind: 'stitch' });
    }
    if (d.style.ribbed) {
      hemBand(v, 6);
      cuffs(v, 7);
    }
  }
  return arrange(views);
}

/** The hood seen from the front, round the neck, its lining showing in the face opening; from the back, its centre seam. */
function hood(v: RawView, front: boolean, height: number, zipped: boolean) {
  const body = v.shapes[0];
  const top = Math.min(...body.map((q) => q.y));
  const neckW = halfWidth(body, top + 0.6) || 9;
  const neckFront = front ? Math.max(...body.filter((q) => Math.abs(q.x) < 0.8 && q.y < top + 20).map((q) => q.y)) : top + 2;
  const H = height;
  const W = Math.max(neckW + 4, H * 0.45);
  const half = (s: number): P[] => [
    p(0, neckFront),
    ...curve(p(0, neckFront), p(s * (neckW + 1), neckFront - 2), p(s * (neckW + 2.5), top - 4)),
    ...curve(p(s * (neckW + 2.5), top - 4), p(s * (W + 2), top - H * 0.55), p(s * W * 0.55, top - H)),
    ...curve(p(s * W * 0.55, top - H), p(0, top - H - 2), p(0, top - H - 1.8)),
  ];
  const outline = [...half(1), ...half(-1).reverse()];
  // The hood goes over the body (it is drawn last, above the neckline), but under the sleeves.
  v.shapes.push(outline);
  if (front) {
    const fo = (s: number) => [...curve(p(0, neckFront - (zipped ? 0 : 3)), p(s * (neckW - 0.5), neckFront - 6), p(s * (neckW - 0.5), top - 10)), ...curve(p(s * (neckW - 0.5), top - 10), p(s * (neckW - 1), top - H * 0.75), p(0, top - H + 5))];
    v.shapes.push([...fo(1), ...fo(-1).reverse()]);
    if (!zipped) for (const s of [1, -1]) v.lines.push({ pts: [p(s * 2.5, neckFront - 2), p(s * 3.2, neckFront + 12)], kind: 'seam' });
  } else v.lines.push({ pts: [p(0, top - H - 1.8), p(0, neckFront)], kind: 'seam' });
}

/** The kangaroo pocket (or a split pair beside a zip), on the front above the hem band. */
function pocket(v: RawView, kind: 'kangaroo' | 'split', hemY: number) {
  const y1 = hemY - 0.3;
  const y0 = y1 - 19;
  const wB = Math.min(15, halfWidth(v.shapes[0], y1 - 1) - 3);
  const wT = wB - 5;
  const side = (s: number) => curve(p(s * wT, y0), p(s * (wB - 4), y0 + 10), p(s * wB, y1 - 1));
  if (kind === 'kangaroo') {
    v.lines.push({ pts: [p(-wB, y1 - 1), ...side(-1).reverse().slice(1), ...side(1)], kind: 'seam' });
    v.lines.push({ pts: [p(-wT, y0), p(wT, y0)], kind: 'seam' });
    for (const s of [1, -1]) v.lines.push({ pts: side(s).map((q) => p(q.x - s * 0.7, q.y + 0.4)), kind: 'stitch' });
  } else for (const s of [1, -1]) v.lines.push({ pts: [p(s * 3, y0), ...side(s)], kind: 'seam' });
}

/** The hoodie: the T-shirt's flat without its neckband, the hood, the pocket, the zip, rib cuffs and band. */
export function hoodieFlat(d: HoodieDraft): Flat {
  const flat = teeFlat(d.tee);
  const views = raw(flat).map((v) => {
    // The neckband's two halves are the last shapes the tee flat draws: the hood sews to the neckline in its place.
    const sleeves = new Set(v.sleeves ?? []);
    const keep = v.shapes.map((_, i) => i).filter((i) => i === 0 || sleeves.has(i));
    return { ...v, shapes: keep.map((i) => v.shapes[i]), sleeves: keep.map((i, k) => (sleeves.has(i) ? k : -1)).filter((k) => k >= 0), lines: v.lines.filter((l) => l.kind !== 'seam' || l.pts.every((q) => q.y > 12)) };
  });
  const rib = d.bands;
  views.forEach((v, i) => {
    const front = i === 0;
    const body = v.shapes[0];
    const hemY = bottomOf(body);
    if (rib.hemBand) hemBand(v, d.style.length === 'long' ? 8 : d.style.length === 'cropped' ? 5 : 6);
    if (rib.cuff) cuffs(v, d.style.length === 'long' ? 9 : 6);
    if (front && d.style.pocket !== 'none') pocket(v, d.style.pocket, hemY);
    const top = Math.min(...body.filter((q) => Math.abs(q.x) < 1).map((q) => q.y));
    if (front && d.style.front === 'zip') v.lines.push({ pts: [p(0, top), p(0, hemY + (rib.hemBand ? (d.style.length === 'long' ? 8 : 6) : 0))], kind: 'zip' });
    if (front && d.style.front === 'half_zip') v.lines.push({ pts: [p(0, top), p(0, top + (d.zipCm ?? 18))], kind: 'zip' });
    hood(v, front, d.hood.height, front && d.style.front !== 'pullover');
  });
  return arrange(views);
}

/** The jumpsuit: the top's flat stood on the trousers' at the waist seam, the legs' waistband left off. */
export function jumpsuitFlat(d: JumpsuitDraft, m: Pick<TrousersMeasurements, 'waist_to_hip' | 'crotch_depth'>): Flat {
  const top = raw(bodiceFlat(d.bodice, 'binding', d.sleeve));
  const views = top.map((v, i) => {
    const body = v.shapes[0];
    const waistY = bottomOf(body);
    const legs = trousersView(d.trousers, m, i === 1);
    // The waistband is the shape that sits above the legs' waist: the bodice is sewn on in its place.
    const legShapes = legs.shapes.filter((s) => bottomOf(s) > 5).map((s) => s.map((q) => p(q.x, q.y + waistY)));
    const legLines: Line[] = legs.lines.filter((l) => Math.min(...l.pts.map((q) => q.y)) > 0.4).map((l) => ({ ...l, pts: l.pts.map((q) => p(q.x, q.y + waistY)) }));
    const w = Math.max(halfWidth(body, waistY - 0.3), ...legShapes.map((s) => halfWidth(s, waistY + 0.3)));
    const shift = legShapes.length;
    return {
      ...v,
      // The legs under the top, so the bodice's hem sits over their waist.
      shapes: [...legShapes, ...v.shapes],
      sleeves: v.sleeves?.map((k) => k + shift),
      ...(v.armless ? { armless: v.armless } : {}),
      lines: [...legLines, { pts: [p(-w, waistY), p(w, waistY)], kind: 'seam' as const }, ...v.lines],
    };
  });
  // wornShapes reads the first shape as the body for a kimono's armless outline: the jumpsuit has none.
  return arrange(views.map(({ armless: _a, ...v }) => v));
}

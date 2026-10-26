// The maker's fabric on All round (Cat, 2026-10-26: "I want the snakeskin on All round"): the garment's cloth,
// print and colour wrapped round the turning garment, the form staying in its long lines. The garment is laid as
// a mesh of small patches round the body, each taking the swatch at its true size in cm, front and back cut as
// their own panels (so a print breaks at the side seams, as cut cloth does), and lit from the front left so the
// garment reads round, not flat. The same paint as the style sketch (fabricPaint), so the two always agree.
import type { FabricPaint } from './FabricFill';

/** One patch of cloth: its four corners on the screen and on the cloth (in cm), how far toward you it sits,
 * and how much light it catches (0 dark to 1 lit). */
export interface ClothQuad {
  q: [number, number][];
  uv: [number, number][];
  z: number;
  lit: number;
  /** A glint, for cloth with a sheen (0 to 1). */
  shine: number;
  /** On the border band, along the hem. */
  border?: boolean;
}

/** The cloth's tiles, ready to paint: the body's and, for a border print, the band's. */
export interface ClothTiles {
  body: HTMLCanvasElement;
  bodySize: number;
  border?: HTMLCanvasElement;
  borderSize?: number;
  sheer: boolean;
  /** Satin, leather and velvet catch the light. */
  sheen?: 'gloss' | 'pile';
}

const T = 256;

const load = (href: string) =>
  new Promise<HTMLImageElement>((ok, no) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = no;
    img.src = href;
  });

/** The swatch greyed, then mapped through the colour table, as the sketch's SVG filter does. */
function tint(c: HTMLCanvasElement, table: [string, string, string]) {
  const g = c.getContext('2d')!;
  const im = g.getImageData(0, 0, c.width, c.height);
  const t = table.map((s) => s.split(' ').map(Number));
  const d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    const l = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
    for (let k = 0; k < 3; k++) d[i + k] = Math.round((t[k][0] + (t[k][1] - t[k][0]) * l) * 255);
  }
  g.putImageData(im, 0, 0);
}

const canvas = () => {
  const c = document.createElement('canvas');
  c.width = T;
  c.height = T;
  return c;
};

/** The tiles for a fabric: drawn checks, a tinted swatch, or plain colour. */
export async function clothTiles(p: FabricPaint): Promise<ClothTiles> {
  const body = canvas();
  const g = body.getContext('2d')!;
  if (p.drawn) {
    g.fillStyle = p.ground;
    g.fillRect(0, 0, T, T);
    g.fillStyle = p.tone;
    if (p.drawn === 'stripes') g.fillRect(0, 0, T * 0.42, T);
    else {
      g.fillRect(0, 0, T / 2, T / 2);
      g.fillStyle = p.half;
      g.fillRect(T / 2, 0, T / 2, T / 2);
      g.fillRect(0, T / 2, T / 2, T / 2);
    }
  } else if (p.href) {
    g.drawImage(await load(p.href), 0, 0, T, T);
    if (p.table) tint(body, p.table);
  } else {
    g.fillStyle = p.plain;
    g.fillRect(0, 0, T, T);
  }
  const s = p.look?.special;
  const out: ClothTiles = { body, bodySize: p.size, sheer: !!p.look?.sheer, sheen: s === 'satin' || s === 'leather' ? 'gloss' : s === 'velvet' ? 'pile' : undefined };
  const B = p.look?.border;
  if (B) {
    const b = canvas();
    b.getContext('2d')!.drawImage(await load(B.href), 0, 0, T, T);
    out.border = b;
    out.borderSize = B.size;
  }
  return out;
}

/** The light: from the front, high on the left, as on the style drawing. */
const L = (() => {
  const v = [-0.5, -0.42, 0.76];
  const n = Math.hypot(...v);
  return v.map((x) => x / n);
})();
const H = (() => {
  const v = [L[0], L[1], L[2] + 1];
  const n = Math.hypot(...v);
  return v.map((x) => x / n);
})();

/** How much light a patch catches, and its glint, from its normal (x right, y down, z toward you). */
export function lightOf(nx: number, ny: number, nz: number, sheen?: 'gloss' | 'pile'): { lit: number; shine: number } {
  const n = Math.hypot(nx, ny, nz) || 1;
  const [x, y, z] = [nx / n, ny / n, nz / n];
  // Seen from inside (the back of the garment through its neck): in shadow.
  if (z < 0) return { lit: 0.3, shine: 0 };
  const d = Math.max(0, x * L[0] + y * L[1] + z * L[2]);
  if (sheen === 'pile') return { lit: 0.22 + 0.7 * d * (0.4 + 0.6 * z), shine: 0.18 * Math.pow(1 - z, 3) };
  const lit = 0.4 + 0.6 * d;
  if (sheen !== 'gloss') return { lit, shine: 0 };
  const h = Math.max(0, x * H[0] + y * H[1] + z * H[2]);
  return { lit, shine: Math.pow(h, 18) * 0.75 };
}

/** The affine taking a triangle on the cloth (cm) to the screen. */
function affine(u: [number, number][], p: [number, number][]): DOMMatrix | undefined {
  const du1 = u[1][0] - u[0][0];
  const dv1 = u[1][1] - u[0][1];
  const du2 = u[2][0] - u[0][0];
  const dv2 = u[2][1] - u[0][1];
  const det = du1 * dv2 - du2 * dv1;
  if (Math.abs(det) < 1e-9) return undefined;
  const dx1 = p[1][0] - p[0][0];
  const dy1 = p[1][1] - p[0][1];
  const dx2 = p[2][0] - p[0][0];
  const dy2 = p[2][1] - p[0][1];
  const a = (dx1 * dv2 - dx2 * dv1) / det;
  const c = (dx2 * du1 - dx1 * du2) / det;
  const b = (dy1 * dv2 - dy2 * dv1) / det;
  const d = (dy2 * du1 - dy1 * du2) / det;
  return new DOMMatrix([a, b, c, d, p[0][0] - a * u[0][0] - c * u[0][1], p[0][1] - b * u[0][0] - d * u[0][1]]);
}

/** A polygon grown a little from its middle, so neighbouring patches overlap and no hairline shows between them. */
function grown(q: [number, number][], by: number): [number, number][] {
  const cx = q.reduce((t, p) => t + p[0], 0) / q.length;
  const cy = q.reduce((t, p) => t + p[1], 0) / q.length;
  return q.map(([x, y]) => {
    const l = Math.hypot(x - cx, y - cy) || 1;
    return [x + ((x - cx) / l) * by, y + ((y - cy) / l) * by];
  });
}

const path = (g: CanvasRenderingContext2D, q: [number, number][]) => {
  g.beginPath();
  q.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
};

/** Layers the cloth is painted on, the size of the view, kept between frames. */
export interface ClothLayers {
  cloth: HTMLCanvasElement;
  shade: HTMLCanvasElement;
  shine: HTMLCanvasElement;
  pats?: { body: CanvasPattern; border?: CanvasPattern; tiles: ClothTiles };
}

export const clothLayers = (): ClothLayers => ({ cloth: document.createElement('canvas'), shade: document.createElement('canvas'), shine: document.createElement('canvas') });

/** Paint the patches, far to near, onto `g`: the cloth, then its light multiplied over it, then any glint. */
export function paintCloth(g: CanvasRenderingContext2D, layers: ClothLayers, tiles: ClothTiles, quads: ClothQuad[], w: number, h: number, dpr: number) {
  const W = Math.round(w * dpr);
  const Hh = Math.round(h * dpr);
  const fit = (c: HTMLCanvasElement) => {
    if (c.width !== W || c.height !== Hh) {
      c.width = W;
      c.height = Hh;
    }
    const x = c.getContext('2d')!;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, W, Hh);
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    return x;
  };
  const cg = fit(layers.cloth);
  const sg = fit(layers.shade);
  const shiny = quads.some((q) => q.shine > 0.02);
  const hg = shiny ? fit(layers.shine) : undefined;
  if (layers.pats?.tiles !== tiles) {
    layers.pats = {
      tiles,
      body: cg.createPattern(tiles.body, 'repeat')!,
      border: tiles.border ? cg.createPattern(tiles.border, 'repeat-x') ?? undefined : undefined,
    };
  }
  const { body, border } = layers.pats;
  const kBody = tiles.bodySize / T;
  const kBorder = (tiles.borderSize ?? 1) / T;
  const order = [...quads].sort((a, b) => a.z - b.z);
  for (const qd of order) {
    const pat = qd.border ? border : body;
    if (!pat) continue;
    const k = qd.border ? kBorder : kBody;
    for (const [i, j, l] of [
      [0, 1, 2],
      [0, 2, 3],
    ]) {
      const m = affine([qd.uv[i], qd.uv[j], qd.uv[l]], [qd.q[i], qd.q[j], qd.q[l]]);
      if (!m) continue;
      pat.setTransform(m.scale(k));
      cg.fillStyle = pat;
      path(cg, grown([qd.q[i], qd.q[j], qd.q[l]], 0.6));
      cg.fill();
    }
    if (qd.border) continue;
    const v = Math.round(Math.min(1, qd.lit) * 255);
    sg.fillStyle = `rgb(${v},${v},${v})`;
    path(sg, grown(qd.q, 0.6));
    sg.fill();
    if (hg) {
      const s = Math.round(Math.min(1, qd.shine) * 255);
      hg.fillStyle = `rgb(${s},${s},${s})`;
      path(hg, grown(qd.q, 0.6));
      hg.fill();
    }
  }
  // The light, only where there is cloth (so no grey fringe at the edges), multiplied over it; the border band
  // takes the light of the patches under it. Then the glint, for cloth with a sheen.
  const keep = (x: CanvasRenderingContext2D) => {
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalCompositeOperation = 'destination-in';
    x.drawImage(layers.cloth, 0, 0);
    x.globalCompositeOperation = 'source-over';
  };
  keep(sg);
  if (hg) keep(hg);
  cg.setTransform(1, 0, 0, 1, 0, 0);
  cg.globalCompositeOperation = 'multiply';
  cg.drawImage(layers.shade, 0, 0);
  if (hg) {
    cg.globalCompositeOperation = 'screen';
    cg.drawImage(layers.shine, 0, 0);
  }
  cg.globalCompositeOperation = 'source-over';
  g.save();
  g.globalAlpha = tiles.sheer ? 0.6 : 1;
  g.drawImage(layers.cloth, 0, 0, w, h);
  g.restore();
}

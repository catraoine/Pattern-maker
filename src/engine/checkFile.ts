// Check any pattern: read a pattern someone already has, as a DXF (AAMA, as Gerber, Lectra and Optitex
// write it) or an SVG (traced or exported), find each piece and its edges, and walk the seams the way a
// pattern cutter does with a tape: edges that sew together should be the same length. A file carries no
// seam names, so edges are paired by length, the closest first, and anything left over is listed.
import { P, len, p, sub } from './geometry';

export interface FilePiece {
  name: string;
  /** The outline in cm, y down. */
  pts: P[];
  /** The stitching line, when the file has one (AAMA layer 14). */
  stitch?: P[];
}

export interface Edge {
  piece: number;
  index: number;
  pts: P[];
  length: number;
}

export interface SeamPair {
  a: Edge;
  b: Edge;
  /** Length difference in mm. */
  diffMm: number;
  ok: boolean;
}

export interface FileCheck {
  pieces: FilePiece[];
  edges: Edge[][];
  pairs: SeamPair[];
  unpaired: Edge[];
  /** Plain-language notes about what was read. */
  notes: string[];
}

// ---------- DXF ----------

interface Ent {
  type: string;
  layer: string;
  codes: [number, string][];
}

const UNITS_CM: Record<string, number> = { '1': 2.54, '4': 0.1, '5': 1, '6': 100 };

/** The DXF as group-code pairs, then entities, with blocks and their inserts placed. */
export function parseDxf(text: string): FilePiece[] {
  const lines = text.split(/\r?\n/);
  const pairs: [number, string][] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) pairs.push([Number(lines[i].trim()), lines[i + 1].trim()]);
  let scale = 0.1; // mm unless the header says otherwise
  const iu = pairs.findIndex(([c, v]) => c === 9 && v === '$INSUNITS');
  if (iu >= 0 && pairs[iu + 1] && UNITS_CM[pairs[iu + 1][1]]) scale = UNITS_CM[pairs[iu + 1][1]];

  // Split into entities at every group 0.
  const ents: Ent[] = [];
  for (const [c, v] of pairs) {
    if (c === 0) ents.push({ type: v, layer: '0', codes: [] });
    else if (ents.length) {
      const e = ents[ents.length - 1];
      if (c === 8) e.layer = v;
      e.codes.push([c, v]);
    }
  }
  const get = (e: Ent, code: number) => {
    const f = e.codes.find(([c]) => c === code);
    return f ? Number(f[1]) : undefined;
  };
  const str = (e: Ent, code: number) => e.codes.find(([c]) => c === code)?.[1];

  interface Shape {
    pts: P[];
    closed: boolean;
    layer: string;
  }
  interface Group {
    shapes: Shape[];
    texts: { at: P; text: string }[];
  }
  const blocks = new Map<string, Group>();
  const top: Group = { shapes: [], texts: [] };
  const inserts: { name: string; at: P; sx: number; sy: number; rot: number }[] = [];
  let section = '';
  let cur: Group = top;
  let poly: Shape | undefined;
  for (let i = 0; i < ents.length; i++) {
    const e = ents[i];
    if (e.type === 'SECTION') section = str(e, 2) ?? '';
    if (e.type === 'BLOCK') {
      cur = { shapes: [], texts: [] };
      blocks.set(str(e, 2) ?? `B${i}`, cur);
    } else if (e.type === 'ENDBLK') cur = top;
    else if (e.type === 'POLYLINE') poly = { pts: [], closed: ((get(e, 70) ?? 0) & 1) === 1, layer: e.layer };
    else if (e.type === 'VERTEX' && poly) poly.pts.push(p(get(e, 10) ?? 0, get(e, 20) ?? 0));
    else if (e.type === 'SEQEND' && poly) {
      cur.shapes.push(poly);
      poly = undefined;
    } else if (e.type === 'LWPOLYLINE') {
      const xs = e.codes.filter(([c]) => c === 10).map(([, v]) => Number(v));
      const ys = e.codes.filter(([c]) => c === 20).map(([, v]) => Number(v));
      cur.shapes.push({ pts: xs.map((x, k) => p(x, ys[k] ?? 0)), closed: ((get(e, 70) ?? 0) & 1) === 1, layer: e.layer });
    } else if (e.type === 'LINE') {
      cur.shapes.push({ pts: [p(get(e, 10) ?? 0, get(e, 20) ?? 0), p(get(e, 11) ?? 0, get(e, 21) ?? 0)], closed: false, layer: e.layer });
    } else if (e.type === 'TEXT' || e.type === 'MTEXT') {
      cur.texts.push({ at: p(get(e, 10) ?? 0, get(e, 20) ?? 0), text: str(e, 1) ?? '' });
    } else if (e.type === 'INSERT' && section === 'ENTITIES') {
      inserts.push({ name: str(e, 2) ?? '', at: p(get(e, 10) ?? 0, get(e, 20) ?? 0), sx: get(e, 41) ?? 1, sy: get(e, 42) ?? 1, rot: ((get(e, 50) ?? 0) * Math.PI) / 180 });
    }
  }
  const groups: Group[] = [];
  for (const ins of inserts) {
    const b = blocks.get(ins.name);
    if (!b) continue;
    const move = (q: P) => {
      const x = q.x * ins.sx;
      const y = q.y * ins.sy;
      return p(ins.at.x + x * Math.cos(ins.rot) - y * Math.sin(ins.rot), ins.at.y + x * Math.sin(ins.rot) + y * Math.cos(ins.rot));
    };
    groups.push({ shapes: b.shapes.map((s) => ({ ...s, pts: s.pts.map(move) })), texts: b.texts.map((t) => ({ ...t, at: move(t.at) })) });
  }
  if (top.shapes.length) groups.push({ shapes: [...top.shapes, ...chain(top.shapes.filter((s) => !s.closed && s.pts.length === 2))], texts: top.texts });

  const toCm = (q: P) => p(q.x * scale, -q.y * scale);
  const out: FilePiece[] = [];
  for (const g of groups) {
    const closed = g.shapes.filter((s) => s.closed || (s.pts.length > 3 && len(sub(s.pts[0], s.pts[s.pts.length - 1])) < 1e-3));
    const cut = closed.filter((s) => s.layer === '1');
    const outlines = (cut.length ? cut : closed.filter((s) => s.layer !== '14')).filter((s, _, all) => !all.some((o) => o !== s && area(o.pts) > area(s.pts) && inside(s.pts[0], o.pts)));
    for (const o of outlines) {
      const stitch = closed.find((s) => s.layer === '14' && inside(s.pts[0], o.pts));
      const named = g.texts.find((t) => /piece name/i.test(t.text) && inside(t.at, o.pts)) ?? g.texts.find((t) => /piece name/i.test(t.text));
      out.push({
        name: named ? named.text.replace(/^piece name:\s*/i, '') : `Piece ${out.length + 1}`,
        pts: open(o.pts).map(toCm),
        stitch: stitch ? open(stitch.pts).map(toCm) : undefined,
      });
    }
  }
  return out;
}

/** Loose lines joined end to end into closed outlines where they meet. */
function chain(lines: { pts: P[]; layer: string }[]): { pts: P[]; closed: boolean; layer: string }[] {
  const left = lines.map((l) => [...l.pts]);
  const out: { pts: P[]; closed: boolean; layer: string }[] = [];
  const near = (a: P, b: P) => len(sub(a, b)) < 0.01;
  while (left.length) {
    const run = left.shift()!;
    let grew = true;
    while (grew) {
      grew = false;
      for (let i = 0; i < left.length; i++) {
        const l = left[i];
        if (near(run[run.length - 1], l[0])) run.push(l[1]);
        else if (near(run[run.length - 1], l[1])) run.push(l[0]);
        else continue;
        left.splice(i, 1);
        grew = true;
        break;
      }
    }
    if (run.length > 3 && near(run[0], run[run.length - 1])) out.push({ pts: run, closed: true, layer: '0' });
  }
  return out;
}

// ---------- SVG ----------

const SVG_CM: Record<string, number> = { mm: 0.1, cm: 1, in: 2.54, pt: 2.54 / 72, px: 2.54 / 96, '': 2.54 / 96 };

/** The closed shapes of an SVG, in cm: paths, polygons and rects, sized from the width and viewBox. */
export function parseSvg(text: string): FilePiece[] {
  const svg = /<svg\b[^>]*>/i.exec(text)?.[0] ?? '';
  const attr = (tag: string, name: string) => new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(tag)?.[1];
  const vb = attr(svg, 'viewBox')?.split(/[\s,]+/).map(Number);
  const wAttr = attr(svg, 'width');
  let scale = SVG_CM.px;
  if (wAttr) {
    const m = /^([\d.]+)\s*(mm|cm|in|pt|px)?$/.exec(wAttr.trim());
    if (m) scale = (Number(m[1]) * SVG_CM[m[2] ?? '']) / (vb && vb[2] ? vb[2] : Number(m[1]));
  }
  const shapes: { pts: P[]; id?: string }[] = [];
  for (const m of text.matchAll(/<(path|polygon|polyline|rect)\b[^>]*>/gi)) {
    const tag = m[0];
    const kind = m[1].toLowerCase();
    const id = attr(tag, 'id') ?? attr(tag, 'inkscape:label') ?? undefined;
    if (kind === 'path') for (const sub0 of pathPoints(attr(tag, 'd') ?? '')) shapes.push({ pts: sub0, id });
    else if (kind === 'polygon' || (kind === 'polyline' && /\bclosed\b/.test(tag))) {
      const n = (attr(tag, 'points') ?? '').trim().split(/[\s,]+/).map(Number);
      const pts: P[] = [];
      for (let i = 0; i + 1 < n.length; i += 2) pts.push(p(n[i], n[i + 1]));
      shapes.push({ pts, id });
    } else if (kind === 'rect') {
      const [x, y, w, h] = ['x', 'y', 'width', 'height'].map((k) => Number(attr(tag, k) ?? 0));
      if (w > 0 && h > 0) shapes.push({ pts: [p(x, y), p(x + w, y), p(x + w, y + h), p(x, y + h)], id });
    }
  }
  const closed = shapes.filter((s) => s.pts.length > 2 && area(s.pts) > 0);
  // A sheet-sized rect (a page background) isn't a piece.
  const page = vb ? vb[2] * vb[3] : Infinity;
  const pieces = closed.filter((s) => area(s.pts) < page * 0.9).filter((s, _, all) => !all.some((o) => o !== s && area(o.pts) > area(s.pts) && inside(s.pts[0], o.pts)));
  return pieces.map((s, i) => ({ name: s.id && !/^(path|polygon|rect)\d*$/i.test(s.id) ? s.id : `Piece ${i + 1}`, pts: open(s.pts).map((q) => p(q.x * scale, q.y * scale)) }));
}

/** Closed subpaths of an SVG path, flattened: M, L, H, V, C, S, Q, T, Z, absolute and relative. Arcs as chords. */
export function pathPoints(d: string): P[][] {
  const toks = d.match(/[a-zA-Z]|-?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/g) ?? [];
  const out: P[][] = [];
  let pts: P[] = [];
  let cur = p(0, 0);
  let start = p(0, 0);
  let lastC: P | undefined;
  let cmd = '';
  let i = 0;
  const num = () => Number(toks[i++]);
  const cubic = (a: P, b: P, c: P, e: P) => {
    for (let k = 1; k <= 16; k++) {
      const t = k / 16;
      const m = 1 - t;
      pts.push(p(m ** 3 * a.x + 3 * m * m * t * b.x + 3 * m * t * t * c.x + t ** 3 * e.x, m ** 3 * a.y + 3 * m * m * t * b.y + 3 * m * t * t * c.y + t ** 3 * e.y));
    }
  };
  while (i < toks.length) {
    if (/[a-zA-Z]/.test(toks[i])) cmd = toks[i++];
    const rel = cmd === cmd.toLowerCase();
    const at = (x: number, y: number) => (rel ? p(cur.x + x, cur.y + y) : p(x, y));
    switch (cmd.toUpperCase()) {
      case 'M':
        if (pts.length > 2) out.push(pts);
        cur = at(num(), num());
        start = cur;
        pts = [cur];
        cmd = rel ? 'l' : 'L';
        lastC = undefined;
        break;
      case 'L':
        cur = at(num(), num());
        pts.push(cur);
        lastC = undefined;
        break;
      case 'H':
        cur = p(rel ? cur.x + num() : num(), cur.y);
        pts.push(cur);
        break;
      case 'V':
        cur = p(cur.x, rel ? cur.y + num() : num());
        pts.push(cur);
        break;
      case 'C': {
        const b = at(num(), num());
        const c = at(num(), num());
        const e = at(num(), num());
        cubic(cur, b, c, e);
        lastC = c;
        cur = e;
        break;
      }
      case 'S': {
        const b = lastC ? p(2 * cur.x - lastC.x, 2 * cur.y - lastC.y) : cur;
        const c = at(num(), num());
        const e = at(num(), num());
        cubic(cur, b, c, e);
        lastC = c;
        cur = e;
        break;
      }
      case 'Q':
      case 'T': {
        const q = cmd.toUpperCase() === 'Q' ? at(num(), num()) : lastC ? p(2 * cur.x - lastC.x, 2 * cur.y - lastC.y) : cur;
        const e = at(num(), num());
        cubic(cur, p(cur.x + (2 / 3) * (q.x - cur.x), cur.y + (2 / 3) * (q.y - cur.y)), p(e.x + (2 / 3) * (q.x - e.x), e.y + (2 / 3) * (q.y - e.y)), e);
        lastC = q;
        cur = e;
        break;
      }
      case 'A': {
        for (let k = 0; k < 5; k++) num();
        cur = at(num(), num());
        pts.push(cur);
        break;
      }
      case 'Z':
        cur = start;
        if (pts.length > 2) out.push(pts);
        pts = [];
        lastC = undefined;
        break;
      default:
        i++;
    }
  }
  return out;
}

// ---------- the check ----------

function area(pts: P[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const q = pts[i];
    const r = pts[(i + 1) % pts.length];
    a += q.x * r.y - r.x * q.y;
  }
  return Math.abs(a / 2);
}

function inside(q: P, pts: P[]): boolean {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (a.y > q.y !== b.y > q.y && q.x < ((b.x - a.x) * (q.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

/** Without the repeated closing point. */
function open(pts: P[]): P[] {
  return pts.length > 1 && len(sub(pts[0], pts[pts.length - 1])) < 1e-6 ? pts.slice(0, -1) : pts;
}

const polyLen = (pts: P[]) => pts.slice(1).reduce((t, q, i) => t + len(sub(q, pts[i])), 0);

/**
 * The outline split at its corners: where it turns by more than `angle` degrees over a short stretch
 * (a curve flattened into many short lines turns gradually, a corner turns at once).
 */
export function edgesOf(pts: P[], piece: number, angle = 28): Edge[] {
  const n = pts.length;
  if (n < 3) return [];
  // Resample every 0.5 cm so the turn is measured the same way whatever the file's point spacing.
  const ring = [...pts, pts[0]];
  const dense: { q: P; src: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = ring[i];
    const b = ring[i + 1];
    const k = Math.max(1, Math.ceil(len(sub(b, a)) / 0.5));
    for (let s = 0; s < k; s++) dense.push({ q: p(a.x + ((b.x - a.x) * s) / k, a.y + ((b.y - a.y) * s) / k), src: s === 0 ? i : -1 });
  }
  const m = dense.length;
  const w = 2; // 1 cm either side
  const turn = (i: number) => {
    const a = dense[(i - w + m) % m].q;
    const b = dense[i].q;
    const c = dense[(i + w) % m].q;
    const u = sub(b, a);
    const v = sub(c, b);
    return Math.abs((Math.atan2(u.x * v.y - u.y * v.x, u.x * v.x + u.y * v.y) * 180) / Math.PI);
  };
  const turns = dense.map((_, i) => turn(i));
  // Corners: points that turn sharply and turn the most of their neighbours.
  const corners: number[] = [];
  for (let i = 0; i < m; i++) {
    if (turns[i] < angle) continue;
    let peak = true;
    for (let k = -w; k <= w; k++) if (k && turns[(i + k + m) % m] > turns[i]) peak = false;
    if (peak && (!corners.length || i - corners[corners.length - 1] > w)) corners.push(i);
  }
  if (corners.length >= 2 && m - corners[corners.length - 1] + corners[0] <= w) corners.pop();
  if (!corners.length) return [{ piece, index: 0, pts: dense.map((d) => d.q), length: polyLen([...dense.map((d) => d.q), dense[0].q]) }];
  return corners.map((c, k) => {
    const next = corners[(k + 1) % corners.length];
    const run: P[] = [];
    for (let i = c; ; i = (i + 1) % m) {
      run.push(dense[i].q);
      if (i === next) break;
    }
    return { piece, index: k, pts: run, length: polyLen(run) };
  });
}

/**
 * Walk the pattern: edges paired by length, across pieces first and the closest pair first, each edge used once. Pairs within
 * 1 mm pass; up to 3 mm is flagged as close (often deliberate ease); edges under 3 cm (notch steps,
 * dart ends, corners) aren't paired.
 */
export function checkFile(pieces: FilePiece[], tolMm = 1): FileCheck {
  const usePieces = pieces.map((pc) => pc.stitch ?? pc.pts);
  const edges = usePieces.map((pts, i) => edgesOf(pts, i));
  const all = edges.flat().filter((e) => e.length >= 3);
  const cands: SeamPair[] = [];
  for (let i = 0; i < all.length; i++)
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i];
      const b = all[j];
      // An edge doesn't sew to its own neighbour on the same piece.
      if (a.piece === b.piece && Math.abs(a.index - b.index) <= 1) continue;
      const diffMm = Math.round(Math.abs(a.length - b.length) * 100) / 10;
      if (diffMm <= 3) cands.push({ a, b, diffMm, ok: diffMm <= tolMm });
    }
  // Seams join two pieces far more often than one piece to itself (a one-piece sleeve), so pieces are
  // paired with each other first.
  const cross = (c: SeamPair) => c.a.piece !== c.b.piece;
  cands.sort((x, y) => Number(cross(y)) - Number(cross(x)) || x.diffMm - y.diffMm || y.a.length - x.a.length);
  const used = new Set<Edge>();
  const pairs: SeamPair[] = [];
  for (const c of cands) {
    if (used.has(c.a) || used.has(c.b)) continue;
    used.add(c.a);
    used.add(c.b);
    pairs.push(c);
  }
  const notes: string[] = [];
  if (pieces.some((pc) => pc.stitch)) notes.push('Seams walked on the stitching lines.');
  else notes.push('No stitching lines in the file, so the seams are walked on the cutting lines: fine where the allowances match.');
  return { pieces, edges, pairs, unpaired: all.filter((e) => !used.has(e)), notes };
}

/** Read a pattern file by its name and text. */
export function readPatternFile(name: string, text: string): FilePiece[] {
  return /\.svg$/i.test(name) || /^\s*(<\?xml|<svg)/i.test(text) ? parseSvg(text) : parseDxf(text);
}

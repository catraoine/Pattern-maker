// Import a pattern from pro software: an AAMA/ASTM D6673 DXF as CLO 3D, Gerber AccuMark, Lectra
// Modaris, Optitex or Seamly2D writes it, read into the app's own pieces so every tool works on it:
// print tiling, the PDF, the tech pack, sewing steps and sending it to a dressmaker.
//
// The AAMA layers: 1 cut line (and the piece text), 4 notches, 6 fold, 7 grain, 8 internal lines,
// 13 drill holes, 14 stitching line. Each piece is usually a block placed by an INSERT; files with
// everything loose in the drawing are read too, each mark going to the piece it lies inside.
// Pieces come out in cm, y down, each moved so its cutting line starts at the origin.
import { P, Path, add, len, mul, p, sub, unit } from './geometry';
import { Piece, cutLine } from './piece';
import { dartsOf, drillHoles } from './marks';
import { checkFile } from './checkFile';
import type { SewingGuide, SewStep } from './instructions';

export interface ImportedPattern {
  pieces: Piece[];
  style?: string;
  size?: string;
  /** The program that wrote the file, when it says. */
  source?: string;
  units: 'mm' | 'cm' | 'in';
  /** Plain-language notes on what was read and what was left out. */
  notes: string[];
}

interface Shape {
  pts: P[];
  closed: boolean;
  layer: string;
}
interface Text {
  at: P;
  text: string;
}
interface Group {
  name: string;
  shapes: Shape[];
  texts: Text[];
  points: { at: P; layer: string }[];
}

// ---------- Reading the file ----------

type Code = [number, string];
interface Ent {
  type: string;
  layer: string;
  codes: Code[];
}

/** AAMA layers are numbers, but some programs write them as "L1" or "Layer 1". */
function layerOf(name: string): string {
  const m = name.trim().match(/^(?:l|layer[\s_-]*)?(\d+)$/i);
  return m ? String(Number(m[1])) : name.trim();
}

const UNITS: Record<string, ['mm' | 'cm' | 'in', number]> = { '1': ['in', 2.54], '4': ['mm', 0.1], '5': ['cm', 1] };

function entities(text: string): Ent[] {
  const lines = text.replace(/^﻿/, '').split(/\r\n|\r|\n/);
  const ents: Ent[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const c = Number(lines[i].trim());
    if (!Number.isFinite(c)) continue;
    const v = lines[i + 1].trim();
    if (c === 0) ents.push({ type: v, layer: '0', codes: [] });
    else if (ents.length) {
      const e = ents[ents.length - 1];
      if (c === 8) e.layer = layerOf(v);
      e.codes.push([c, v]);
    }
  }
  return ents;
}

const num = (e: Ent, code: number, dflt = 0) => {
  const f = e.codes.find(([c]) => c === code);
  return f ? Number(f[1]) : dflt;
};
const str = (e: Ent, code: number) => e.codes.find(([c]) => c === code)?.[1];

/** The points along an arc between two vertices, from the DXF bulge (tan of a quarter of the angle). */
function bulgeArc(a: P, b: P, bulge: number): P[] {
  if (Math.abs(bulge) < 1e-9) return [];
  const theta = 4 * Math.atan(bulge);
  const chord = len(sub(b, a));
  if (chord < 1e-9) return [];
  const r = chord / (2 * Math.sin(theta / 2));
  const mid = mul(add(a, b), 0.5);
  const u = unit(sub(b, a));
  const h = r * Math.cos(theta / 2);
  const c = add(mid, mul(p(-u.y, u.x), h));
  const a0 = Math.atan2(a.y - c.y, a.x - c.x);
  const steps = Math.max(2, Math.ceil(Math.abs(theta) / (Math.PI / 24)));
  const out: P[] = [];
  for (let k = 1; k < steps; k++) {
    const t = a0 + (theta * k) / steps;
    out.push(p(c.x + Math.abs(r) * Math.cos(t), c.y + Math.abs(r) * Math.sin(t)));
  }
  return out;
}

/** Vertices with their bulges, opened out into a plain polyline. */
function withArcs(vs: { at: P; bulge: number }[], closed: boolean): P[] {
  const out: P[] = [];
  vs.forEach((v, i) => {
    out.push(v.at);
    const next = vs[i + 1] ?? (closed ? vs[0] : undefined);
    if (next) out.push(...bulgeArc(v.at, next.at, v.bulge));
  });
  return out;
}

function arc(c: P, r: number, from: number, to: number): P[] {
  let sweep = to - from;
  while (sweep <= 0) sweep += 360;
  const steps = Math.max(2, Math.ceil(sweep / 7.5));
  return Array.from({ length: steps + 1 }, (_, k) => {
    const t = ((from + (sweep * k) / steps) * Math.PI) / 180;
    return p(c.x + r * Math.cos(t), c.y + r * Math.sin(t));
  });
}

/** Every block and the loose drawing, as shapes, text and points in file units (y up). */
function readGroups(ents: Ent[]): { groups: Group[]; header: Map<string, string> } {
  const header = new Map<string, string>();
  const blocks = new Map<string, Group>();
  const top: Group = { name: '', shapes: [], texts: [], points: [] };
  const inserts: { name: string; at: P; sx: number; sy: number; rot: number }[] = [];
  let section = '';
  let cur = top;
  let poly: { vs: { at: P; bulge: number }[]; closed: boolean; layer: string } | undefined;
  for (let i = 0; i < ents.length; i++) {
    const e = ents[i];
    switch (e.type) {
      case 'SECTION':
        section = str(e, 2) ?? '';
        if (section === 'HEADER') {
          // Header variables: 9 names one, the next code holds its value.
          for (let k = 0; k < e.codes.length - 1; k++) if (e.codes[k][0] === 9) header.set(e.codes[k][1], e.codes[k + 1][1]);
        }
        break;
      case 'BLOCK': {
        const name = str(e, 2) ?? `B${i}`;
        cur = { name, shapes: [], texts: [], points: [] };
        if (!name.startsWith('*')) blocks.set(name, cur);
        break;
      }
      case 'ENDBLK':
        cur = top;
        break;
      case 'POLYLINE':
        poly = { vs: [], closed: (num(e, 70) & 1) === 1, layer: e.layer };
        break;
      case 'VERTEX':
        if (poly) poly.vs.push({ at: p(num(e, 10), num(e, 20)), bulge: num(e, 42) });
        break;
      case 'SEQEND':
        if (poly) cur.shapes.push({ pts: withArcs(poly.vs, poly.closed), closed: poly.closed, layer: poly.layer });
        poly = undefined;
        break;
      case 'LWPOLYLINE': {
        const vs: { at: P; bulge: number }[] = [];
        let x: number | undefined;
        for (const [c, v] of e.codes) {
          if (c === 10) x = Number(v);
          else if (c === 20 && x !== undefined) vs.push({ at: p(x, Number(v)), bulge: 0 });
          else if (c === 42 && vs.length) vs[vs.length - 1].bulge = Number(v);
        }
        const closed = (num(e, 70) & 1) === 1;
        cur.shapes.push({ pts: withArcs(vs, closed), closed, layer: e.layer });
        break;
      }
      case 'LINE':
        cur.shapes.push({ pts: [p(num(e, 10), num(e, 20)), p(num(e, 11), num(e, 21))], closed: false, layer: e.layer });
        break;
      case 'ARC':
        cur.shapes.push({ pts: arc(p(num(e, 10), num(e, 20)), num(e, 40), num(e, 50), num(e, 51)), closed: false, layer: e.layer });
        break;
      case 'CIRCLE':
        // A small circle is a drill hole; anything bigger is drawn.
        if (num(e, 40) < 6 || e.layer === '13') cur.points.push({ at: p(num(e, 10), num(e, 20)), layer: e.layer === '13' ? '13' : e.layer });
        else cur.shapes.push({ pts: arc(p(num(e, 10), num(e, 20)), num(e, 40), 0, 360).slice(0, -1), closed: true, layer: e.layer });
        break;
      case 'SPLINE': {
        // AAMA files should not carry splines, but some do: follow the fit points, else the control points.
        const fit = e.codes.filter(([c]) => c === 11).map(([, v], k) => p(Number(v), Number(e.codes.filter(([c]) => c === 21)[k]?.[1] ?? 0)));
        const ctl = e.codes.filter(([c]) => c === 10).map(([, v], k) => p(Number(v), Number(e.codes.filter(([c]) => c === 20)[k]?.[1] ?? 0)));
        const pts = fit.length > 1 ? fit : ctl;
        if (pts.length > 1) cur.shapes.push({ pts, closed: (num(e, 70) & 1) === 1, layer: e.layer });
        break;
      }
      case 'POINT':
        cur.points.push({ at: p(num(e, 10), num(e, 20)), layer: e.layer });
        break;
      case 'TEXT':
      case 'ATTRIB':
        cur.texts.push({ at: p(num(e, 10), num(e, 20)), text: str(e, 1) ?? '' });
        break;
      case 'MTEXT': {
        // Long MTEXT is split over 3s then a 1; strip the formatting codes and keep each line.
        const raw = [...e.codes.filter(([c]) => c === 3).map(([, v]) => v), str(e, 1) ?? ''].join('');
        const at = p(num(e, 10), num(e, 20));
        raw
          .replace(/\\[A-Za-z][^;\\]*;/g, '')
          .replace(/[{}]/g, '')
          .split(/\\P|\n/)
          .forEach((t, k) => cur.texts.push({ at: p(at.x, at.y - k), text: t }));
        break;
      }
      case 'INSERT':
        if (section === 'ENTITIES') {
          inserts.push({ name: str(e, 2) ?? '', at: p(num(e, 10), num(e, 20)), sx: num(e, 41, 1), sy: num(e, 42, 1), rot: (num(e, 50) * Math.PI) / 180 });
        }
        break;
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
    // A mirrored insert reverses the winding, which is fine: offsets and areas work either way.
    groups.push({
      name: b.name,
      shapes: b.shapes.map((s) => ({ ...s, pts: s.pts.map(move) })),
      texts: b.texts.map((t) => ({ ...t, at: move(t.at) })),
      points: b.points.map((q) => ({ ...q, at: move(q.at) })),
    });
  }
  // Blocks that nothing places: some exporters write the pieces as blocks only.
  if (!groups.length) groups.push(...blocks.values());
  if (top.shapes.length || top.texts.length) groups.push(top);
  return { groups, header };
}

// ---------- Geometry helpers ----------

const near = (a: P, b: P, tol: number) => len(sub(a, b)) < tol;

function openRing(pts: P[]): P[] {
  return pts.length > 2 && near(pts[0], pts[pts.length - 1], 1e-6) ? pts.slice(0, -1) : pts;
}

function area(pts: P[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s / 2);
}

function inside(q: P, ring: P[]): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (a.y > q.y !== b.y > q.y && q.x < ((b.x - a.x) * (q.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

/** The nearest point on a closed ring, with the outward normal of the edge it lies on. */
function nearestOnRing(q: P, ring: P[]): { at: P; dist: number; normal: P } {
  let best = { at: ring[0], dist: Infinity, normal: p(0, -1) };
  let s = 0;
  for (let i = 0; i < ring.length; i++) s += ring[i].x * ring[(i + 1) % ring.length].y - ring[(i + 1) % ring.length].x * ring[i].y;
  const sign = s > 0 ? 1 : -1;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const ab = sub(b, a);
    const l2 = ab.x * ab.x + ab.y * ab.y;
    const t = l2 ? Math.max(0, Math.min(1, ((q.x - a.x) * ab.x + (q.y - a.y) * ab.y) / l2)) : 0;
    const at = add(a, mul(ab, t));
    const d = len(sub(q, at));
    if (d < best.dist) {
      const u = unit(ab);
      best = { at, dist: d, normal: mul(p(-u.y, u.x), -sign) };
    }
  }
  return best;
}

/** Joins loose two-point lines end to end into closed rings, for files that draw a piece as lines. */
function chain(lines: Shape[], tol: number): Shape[] {
  const left = lines.map((l) => [...l.pts]);
  const out: Shape[] = [];
  while (left.length) {
    const run = left.shift()!;
    const layer = lines[0].layer;
    let grew = true;
    while (grew) {
      grew = false;
      for (let i = 0; i < left.length; i++) {
        const l = left[i];
        if (near(run[run.length - 1], l[0], tol)) run.push(...l.slice(1));
        else if (near(run[run.length - 1], l[l.length - 1], tol)) run.push(...[...l].reverse().slice(1));
        else continue;
        left.splice(i, 1);
        grew = true;
        break;
      }
    }
    if (run.length > 3 && near(run[0], run[run.length - 1], tol)) out.push({ pts: run.slice(0, -1), closed: true, layer });
  }
  return out;
}

/** The two points of a shape farthest apart: the ends of a grain line, whatever arrowheads it has. */
function ends(pts: P[]): [P, P] {
  let best: [P, P] = [pts[0], pts[pts.length - 1]];
  let d = len(sub(best[1], best[0]));
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++) {
      const dd = len(sub(pts[j], pts[i]));
      if (dd > d + 1e-9) {
        d = dd;
        best = [pts[i], pts[j]];
      }
    }
  return best;
}

const pathOf = (pts: P[], closed: boolean): Path => {
  const path = new Path(pts[0]);
  pts.slice(1).forEach((q) => path.line(q));
  if (closed) {
    path.line(pts[0]);
    path.closed = true;
  }
  return path;
};

// ---------- Piece text ----------

const FIELD = /^\s*([A-Za-z][A-Za-z ]*?)\s*:\s*(.*)$/;

function fields(texts: Text[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const t of texts) {
    const m = t.text.match(FIELD);
    if (m && !out.has(m[1].toLowerCase())) out.set(m[1].toLowerCase(), m[2].trim());
  }
  return out;
}

/** A readable name from a block name such as P1_SKIRT_FRONT or FRONT-10. */
function nameFromBlock(name: string): string {
  const s = name.replace(/^P\d+_/, '').replace(/[_-]+/g, ' ').trim().toLowerCase();
  return s ? s[0].toUpperCase() + s.slice(1) : '';
}

const SOURCES: [RegExp, string][] = [
  [/\bCLO\b|Marvelous/i, 'CLO 3D'],
  [/Gerber|AccuMark/i, 'Gerber AccuMark'],
  [/Lectra|Modaris/i, 'Lectra Modaris'],
  [/Optitex/i, 'Optitex'],
  [/Seamly|Valentina/i, 'Seamly2D'],
  [/Maison Trac/i, 'Maison Tracé'],
  [/Tukatech/i, 'Tukatech'],
  [/StyleCAD/i, 'StyleCAD'],
];

// ---------- Building pieces ----------

const NOTCH_LAYERS = new Set(['4', '80', '81', '82', '83']);
const DRILL_LAYERS = new Set(['13', '84']);
const INTERNAL_LAYERS = new Set(['8', '11']);

/** Read an AAMA/ASTM DXF from pattern software into the app's own pieces. */
export function importDxf(text: string): ImportedPattern {
  const ents = entities(text);
  const { groups, header } = readGroups(ents);
  const notes: string[] = [];

  // Units: the header if it says, else the file's own "Units:" note, else millimetres (the AAMA default).
  const allTexts = groups.flatMap((g) => g.texts);
  const file = fields(allTexts);
  let units: ImportedPattern['units'] = 'mm';
  let scale = 0.1;
  const iu = header.get('$INSUNITS');
  if (iu && UNITS[iu]) [units, scale] = UNITS[iu];
  else if (/english|inch/i.test(file.get('units') ?? '') || header.get('$MEASUREMENT') === '0') [units, scale] = UNITS['1'];
  const toCm = (q: P) => p(q.x * scale, -q.y * scale);
  const tol = 0.05 / scale; // half a millimetre, in file units

  const comments = [...text.matchAll(/^\s*999\s*\r?\n(.*)$/gm)].map((m) => m[1]);
  const blob = [...comments, ...[...file.entries()].map(([k, v]) => `${k}: ${v}`)].join('\n');
  const source = SOURCES.find(([re]) => re.test(blob))?.[1];

  const pieces: Piece[] = [];
  let unnamed = 0;
  let skippedGrades = false;
  for (const g of groups) {
    let closed = g.shapes
      .filter((s) => s.pts.length > 2 && (s.closed || near(s.pts[0], s.pts[s.pts.length - 1], tol)))
      .map((s) => ({ ...s, pts: openRing(s.pts) }));
    const loose = g.shapes.filter((s) => s.layer === '1' && !closed.includes(s) && !s.closed);
    if (loose.length) closed = [...closed, ...chain(loose, tol)];
    const cutRings = closed.filter((s) => s.layer === '1');
    // Without layer 1 (a plain CAD drawing), every closed shape that is not a stitching line may be a piece.
    const candidates = cutRings.length ? cutRings : closed.filter((s) => s.layer !== '14' && !INTERNAL_LAYERS.has(s.layer));
    // Outermost rings only: a ring inside another is an internal cut-out or a nested size.
    const outlines = candidates.filter((s) => !candidates.some((o) => o !== s && area(o.pts) > area(s.pts) && inside(s.pts[0], o.pts)));
    if (candidates.some((s) => !outlines.includes(s) && s.layer === '1' && area(s.pts) > 0.5 * Math.max(...outlines.map((o) => area(o.pts))))) skippedGrades = true;

    // Each mark goes to the outline it lies inside, or the nearest one.
    const owner = (q: P) => {
      const i = outlines.findIndex((o) => inside(q, o.pts));
      if (i >= 0 || outlines.length < 2) return Math.max(i, 0);
      let best = 0;
      outlines.forEach((o, k) => {
        if (nearestOnRing(q, o.pts).dist < nearestOnRing(q, outlines[best].pts).dist) best = k;
      });
      return best;
    };
    const mid = (pts: P[]) => pts[Math.floor(pts.length / 2)];
    const single = outlines.length === 1;

    outlines.forEach((o, k) => {
      const mine = <T,>(items: T[], at: (t: T) => P) => (single ? items : items.filter((t) => owner(at(t)) === k));
      const shapes = mine(
        g.shapes.filter((s) => s !== o),
        (s) => mid(s.pts),
      );
      const texts = mine(g.texts, (t) => t.at);
      const points = mine(g.points, (q) => q.at);
      const f = fields(texts);

      const cut = o.pts.map(toCm);
      const stitchShape = closed.find((s) => s.layer === '14' && inside(s.pts[0], o.pts));
      const stitch = stitchShape ? stitchShape.pts.map(toCm) : undefined;
      const sewRing = stitch ?? cut;

      // Seam allowance: how far the cutting line stands off the stitching line, the most common distance.
      let sa = 0;
      if (stitch) {
        const ds = sewRing.map((q) => Math.round(nearestOnRing(q, cut).dist * 10) / 10);
        const counts = new Map<number, number>();
        ds.forEach((d) => counts.set(d, (counts.get(d) ?? 0) + 1));
        sa = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
      }

      const lines = shapes
        .filter((s) => INTERNAL_LAYERS.has(s.layer) && s.pts.length > 1)
        .map((s) => {
          const pts = (s.closed ? [...s.pts, s.pts[0]] : s.pts).map(toCm);
          return pathOf(pts, false);
        });
      const grainShape = shapes.find((s) => s.layer === '7' && s.pts.length > 1);
      const foldShape = shapes.find((s) => s.layer === '6' && s.pts.length > 1);

      // Notches: AAMA puts them on the cut line, as points or as short lines in from it. The app keeps
      // a notch as a point and the way out into the allowance, placed so the cut-line point comes back.
      const notchAt: P[] = [
        ...points.filter((q) => NOTCH_LAYERS.has(q.layer)).map((q) => toCm(q.at)),
        ...shapes
          .filter((s) => NOTCH_LAYERS.has(s.layer) && s.pts.length > 1)
          .map((s) => {
            const [a, b] = [toCm(s.pts[0]), toCm(s.pts[s.pts.length - 1])];
            return nearestOnRing(a, cut).dist <= nearestOnRing(b, cut).dist ? a : b;
          }),
      ];
      const notches: [P, P][] = notchAt.map((q) => {
        const n = nearestOnRing(q, cut);
        const out = n.normal;
        return [sub(q, mul(out, sa)), out];
      });

      const name = f.get('piece name') || nameFromBlock(g.name) || `Piece ${++unnamed}`;
      const qty = Number((f.get('quantity') ?? '').match(/\d+/)?.[0] ?? 1);
      const annotation = f.get('annotation');
      const cutText = annotation && /cut/i.test(annotation) ? annotation : `Cut ${qty}${f.get('category') && !/self/i.test(f.get('category')!) ? ` in ${f.get('category')!.toLowerCase()}` : ''}`;
      const category = f.get('category') ?? f.get('material');
      const fabric = category && !/^(self|main|fabric)$/i.test(category) ? category : undefined;

      // Move the piece so its cutting line starts at the origin.
      const xs = cut.map((q) => q.x);
      const ys = cut.map((q) => q.y);
      const o0 = p(Math.min(...xs), Math.min(...ys));
      const w = Math.max(...xs) - o0.x;
      const h = Math.max(...ys) - o0.y;
      const m = (q: P) => sub(q, o0);
      const mp = (path: Path) => pathOf(path.points().map(m), path.closed);

      const piece: Piece = {
        name,
        outline: pathOf(sewRing.map(m), true),
        lines: lines.map(mp),
        grain: grainShape ? (ends(grainShape.pts.map(toCm)).map(m) as [P, P]) : undefined,
        fold: foldShape ? (ends(foldShape.pts.map(toCm)).map(m) as [P, P]) : undefined,
        notches: notches.map(([q, d]) => [m(q), d]),
        labels: [
          { at: p(w * 0.5, h * 0.4), text: name.toUpperCase(), size: Math.min(1.6, Math.max(0.6, w / 14)) },
          { at: p(w * 0.5, h * 0.4 + 2), text: cutText, size: Math.min(1, Math.max(0.5, w / 22)) },
        ],
        cut: cutText,
        fabric,
        seamAllowance: sa,
        cutOutline: cut.map(m),
        allowances: {},
        meta: {
          imported: true,
          ...(f.get('size') ? { size: f.get('size') } : {}),
          ...(category ? { category } : {}),
          ...(g.name ? { block: g.name } : {}),
        },
      };
      // Drill holes the app would not already place at a dart point.
      const auto = drillHoles(piece);
      const drills = points.filter((q) => DRILL_LAYERS.has(q.layer)).map((q) => m(toCm(q.at)));
      const extra = drills.filter((d) => !auto.some((a) => near(a, d, 0.6)));
      if (extra.length) piece.meta.drills = extra;
      pieces.push(piece);
    });
  }

  if (!pieces.length) notes.push('No closed pattern pieces were found. Each piece needs a closed cutting line, on AAMA layer 1 or as a closed polyline.');
  else {
    const noSew = pieces.filter((pc) => pc.seamAllowance === 0).length;
    if (noSew === pieces.length) notes.push('The file has cutting lines only, so the stitching lines are taken to be the same: allowances are included in the pieces.');
    else if (noSew) notes.push(`${noSew} of ${pieces.length} pieces have no stitching line, so their allowances are included.`);
    if (!pieces.some((pc) => pc.grain)) notes.push('No grain lines were found (AAMA layer 7). Check the grain before cutting.');
  }
  if (skippedGrades) notes.push('The file holds more than one size of some pieces. The base size was read; pick the other sizes in your pattern software and export them one at a time.');
  if (!header.get('$INSUNITS') && !file.get('units')) notes.push('The file does not say its units, so millimetres were assumed. If the pieces look ten times too big or small, re-export in mm.');

  return {
    pieces,
    style: file.get('style name') || file.get('style') || undefined,
    size: file.get('sample size') || file.get('base size') || undefined,
    source,
    units,
    notes,
  };
}

// ---------- Sewing steps ----------

/**
 * Sewing steps for an imported pattern. The file says nothing about how the garment goes together, so
 * the steps cover what the pieces do show (how many to cut, folds, darts, drill holes), then the seams
 * found by walking the edges: edges of two pieces the same length are very likely sewn together.
 */
export function importedGuide(pieces: Piece[]): SewingGuide {
  const steps: SewStep[] = [
    {
      title: 'Print and check the size',
      text: 'Print the pattern at 100% (actual size). Measure the test square: it should be exactly 10 cm. Trim each page along the dashed line, then tape the pages together, matching the row letters and column numbers.',
    },
  ];
  const cutLines = pieces.map((pc) => {
    const where = pc.fold ? 'on the fold' : pc.cut.match(/cut\s+(\d+)/i)?.[1] === '2' ? 'as a pair (turn the pattern over for the second)' : '';
    return `${pc.name}: ${pc.cut.replace(/\.$/, '')}${where && !/fold|pair/i.test(pc.cut) ? `, ${where}` : ''}${pc.fabric ? ` (${pc.fabric.toLowerCase()})` : ''}.`;
  });
  steps.push({
    title: 'Cut out',
    text: `Keep each grain arrow parallel to the selvedge, cut along the solid outer line and snip the notches. ${cutLines.join(' ')}`,
  });
  const darted = pieces.filter((pc) => dartsOf(pc).length || drillHoles(pc).length);
  if (darted.length) {
    steps.push({
      title: 'Mark the darts and drill holes',
      text: `Chalk or tailor-tack the dart legs and drill holes on ${darted.map((pc) => pc.name.toLowerCase()).join(', ')}. Sew each dart from the wide end to the point, tie off the threads at the point, and press it toward the centre or down.`,
    });
  }
  const walked = checkFile(pieces.map((pc) => ({ name: pc.name, pts: cutLine(pc), stitch: pc.seamAllowance ? pc.outline.points() : undefined })));
  const seams = walked.pairs.filter((pr) => pr.a.piece !== pr.b.piece && pr.a.length >= 10);
  if (seams.length) {
    const cm = (v: number) => `${Math.round(v * 10) / 10} cm`;
    steps.push({
      title: 'Join the seams',
      text: `These edges are the same length, so they most likely sew together: ${seams
        .map((pr) => `${pieces[pr.a.piece].name.toLowerCase()} to ${pieces[pr.b.piece].name.toLowerCase()} (${cm(pr.a.length)})`)
        .join('; ')}. Pin at the notches, sew right sides together${pieces.some((pc) => pc.seamAllowance) ? ` on the stitching line` : ''}, and press each seam open. Check against the instructions that came with the pattern.`,
    });
  }
  steps.push({
    title: 'Finish',
    text: 'Finish the raw edges, then follow the pattern\'s own instructions for the closures, facings and hem. Press as you go.',
  });
  return { notions: ['Thread to match', 'Any closures the design needs (zip, buttons or hooks)'], steps };
}

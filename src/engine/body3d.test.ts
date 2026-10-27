import { describe, expect, it } from 'vitest';
import { EXAMPLE_VALUES } from '../measurements';
import { bodyHalf as R } from './body';
import { bodyMesh, buildBody, toObj } from './body3d';

/** Cut the mesh with a level plane and measure round the cut, as a tape would (round its convex hull). */
function tapeAt(mesh: ReturnType<typeof bodyMesh>, h: number) {
  const pts: [number, number][] = [];
  for (const f of mesh.faces)
    for (let e = 0; e < 3; e++) {
      const a = mesh.vertices[f[e]], b = mesh.vertices[f[(e + 1) % 3]];
      if ((a[1] - h) * (b[1] - h) > 0 || a[1] === b[1]) continue;
      const t = (h - a[1]) / (b[1] - a[1]);
      pts.push([a[0] + (b[0] - a[0]) * t, a[2] + (b[2] - a[2]) * t]);
    }
  pts.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: [number, number][]) => {
    const out: [number, number][] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    return out.slice(0, -1);
  };
  const hull = [...half(pts), ...half([...pts].reverse())];
  let sum = 0;
  for (let i = 0; i < hull.length; i++) {
    const [x0, z0] = hull[i], [x1, z1] = hull[(i + 1) % hull.length];
    sum += Math.hypot(x1 - x0, z1 - z0);
  }
  return sum;
}

const BODIES = {
  example: EXAMPLE_VALUES,
  smaller: { ...EXAMPLE_VALUES, full_bust: 80, high_bust: 78, waist: 62, full_hip: 88, neck: 32, shoulder_width: 35, high_hip: 80 },
  larger: { ...EXAMPLE_VALUES, full_bust: 128, high_bust: 112, waist: 112, full_hip: 136, neck: 41, shoulder_width: 42, waist_to_hip: 23 },
};

describe('3D body from measurements', () => {
  for (const [name, values] of Object.entries(BODIES)) {
    const body = buildBody(values);
    const mesh = bodyMesh(body);
    for (const mark of body.marks)
      it(`${name}: measures ${mark.label.toLowerCase()} where it was built`, () => {
        expect(Math.abs(tapeAt(mesh, mark.h) - mark.girth)).toBeLessThan(0.2);
      });

    it(`${name}: is a closed surface with its faces outward`, () => {
      const edges = new Map<string, number>();
      let volume = 0;
      for (const [a, b, c] of mesh.faces) {
        for (const [p, q] of [[a, b], [b, c], [c, a]]) edges.set(`${p},${q}`, (edges.get(`${p},${q}`) ?? 0) + 1);
        const [ax, ay, az] = mesh.vertices[a], [bx, by, bz] = mesh.vertices[b], [cx, cy, cz] = mesh.vertices[c];
        volume += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
      }
      // Every edge is used once each way: no holes, consistent winding.
      const bad = [...edges].filter(([k, n]) => {
        const [p, q] = k.split(',');
        return n !== 1 || edges.get(`${q},${p}`) !== 1;
      });
      expect(bad).toEqual([]);
      expect(volume).toBeGreaterThan(0);
    });

    it(`${name}: keeps bust above waist above hip, at the measured lengths`, () => {
      const h = Object.fromEntries(body.marks.map((k) => [k.id, k.h]));
      expect(h.full_bust).toBeGreaterThan(h.waist);
      expect(h.waist).toBeCloseTo(values.waist_to_floor!, 5);
      expect(h.waist - h.full_hip).toBeCloseTo(values.waist_to_hip!, 5);
    });
  }

  it("keeps the real body's outline: widest at bust and hip, narrowest at the waist, same neck and shoulders", () => {
    const body = buildBody(EXAMPLE_VALUES);
    // Front view: the form's own profile, sized to the person. Between the bust and the hip it matches R closely.
    const scale = body.rings.find((r) => Math.abs(r.y - 0.1) < 0.02)!.half / R(0.1);
    for (const r of body.rings.filter((r) => r.y > -1.4 && r.y < 1.2)) expect(Math.abs(r.half / scale / R(r.y) - 1)).toBeLessThan(0.25);
    const at = (y: number) => body.rings.reduce((best, r) => (Math.abs(r.y - y) < Math.abs(best.y - y) ? r : best));
    expect(at(-0.58).half).toBeGreaterThan(at(0.1).half);
    expect(at(0.82).half).toBeGreaterThan(at(0.1).half);
    expect(at(-1.6).half).toBeLessThan(at(-1.3).half / 2);
  });

  it('writes an OBJ in millimetres with the girths in its header', () => {
    const obj = toObj(EXAMPLE_VALUES, 'Example body');
    expect(obj).toMatch(/^# Example body/);
    expect(obj).toContain('Units: millimetres');
    expect(obj).toMatch(/#\s+Bust: 92\.0 at/);
    const ys = obj.split('\n').filter((l) => l.startsWith('v ')).map((l) => Number(l.split(' ')[2]));
    expect(Math.max(...ys)).toBeGreaterThan(1400);
    expect(Math.min(...ys)).toBeGreaterThan(700);
    expect(obj.split('\n').filter((l) => l.startsWith('f ')).length).toBeGreaterThan(20000);
  });
});

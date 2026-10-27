"""Builds src/engine/bodyShape.ts from the MakeHuman base body (CC0): the torso's cross-section at each height of the
app's form, read as the reach from the centre line at each angle round it, with the arms cut off at the armhole.

python3 -I build_table.py <base.obj> <out.ts> --target f:w ... [--json dump.json]
"""
import json
import math
import sys

import numpy as np

sys.path.insert(0, __file__.rsplit('/', 1)[0])
from slice_body import apply_target, read_obj, slice_at  # noqa: E402

# MakeHuman heights (dm) of the landmarks, and where they sit on the app's form (its own units, waist at 0.1).
LANDMARKS = [
    (5.72, -1.75),  # top of the neck column, just under the chin: top of the form's neck
    (5.37, -1.47),  # side neck point: where the neck column meets the trapezius slope
    (4.95, -1.34),  # shoulder tip
    (3.4, -0.58),  # bust apex
    (2.15, 0.1),  # waist (narrowest)
    (0.1, 0.82),  # full hip
    (-0.6, 1.3),  # below the hip: bottom of the form
]
# The example body's girths (cm) at the landmarks: each ring is scaled so its round measures these; between them the
# scale runs smoothly, so the real body's own shape carries from one to the next. The bust keeps today's form's
# half-width (0.61), which sets the form's scale (cm to a unit).
GIRTHS = {-1.62: 35.0, -0.58: 92.0, 0.1: 76.0, 0.82: 102.0}
SHOULDER_HALF_CM = 38 * 0.94 / 2
BUST_HALF = 0.61
# The torso's side at the armpit, and the acromion, in MakeHuman's dm: the arms are cut off beyond this.
ARMPIT_Y = 3.78
ARM_X = 1.5
ZC = 0.33
NA = 96


def mh_y(form_y):
    for (m0, f0), (m1, f1) in zip(LANDMARKS, LANDMARKS[1:]):
        if f0 <= form_y <= f1:
            return m0 + (form_y - f0) * (m1 - m0) / (f1 - f0)
    return LANDMARKS[0][0] if form_y < LANDMARKS[0][1] else LANDMARKS[-1][0]


def convex_ring(sym, angs):
    """The ring (0..180 degrees, mirrored) replaced by its convex hull, read along the same rays."""
    pts = [(r * math.sin(a), r * math.cos(a)) for r, a in zip(sym, angs)]
    full = pts + [(-x, z) for x, z in reversed(pts[1:-1])]
    full = sorted(set(full))
    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    def half_hull(ps):
        out = []
        for q in ps:
            while len(out) >= 2 and cross(out[-2], out[-1], q) <= 0:
                out.pop()
            out.append(q)
        return out[:-1]
    hull = half_hull(full) + half_hull(full[::-1])
    out = []
    for a in angs:
        dx, dz = math.sin(a), math.cos(a)
        best = 0
        for k in range(len(hull)):
            (x0, z0), (x1, z1) = hull[k], hull[(k + 1) % len(hull)]
            ex, ez = x1 - x0, z1 - z0
            den = dx * ez - dz * ex
            if abs(den) < 1e-12:
                continue
            t = (x0 * ez - z0 * ex) / den
            sgm = (x0 * dz - z0 * dx) / den
            if t > 0 and -1e-9 <= sgm <= 1 + 1e-9:
                best = max(best, t)
        out.append(best)
    return out


def reach_row(segs, angles):
    row = []
    for a in angles:
        dx, dz = math.sin(a), math.cos(a)
        best = None
        for (x0, z0), (x1, z1) in segs:
            ex, ez = x1 - x0, z1 - z0
            den = dx * ez - dz * ex
            if abs(den) < 1e-12:
                continue
            qx, qz = x0, z0 - ZC
            t = (qx * ez - qz * ex) / den
            s = (qx * dz - qz * dx) / den
            if t > 0 and 0 <= s <= 1 and (best is None or t < best):
                best = t
        row.append(best)
    return row


def main():
    args = sys.argv[1:]
    base, out = args[0], args[1]
    targets = []
    dump = None
    i = 2
    while i < len(args):
        if args[i] == '--target':
            f, w = args[i + 1].rsplit(':', 1)
            targets.append((f, float(w)))
            i += 2
        elif args[i] == '--json':
            dump = args[i + 1]
            i += 2
        else:
            i += 1
    verts, faces = read_obj(base)
    for f, w in targets:
        apply_target(verts, f, w)
    # Cut the arms off: any triangle with a vertex out past the armhole above the armpit.
    v = verts[faces]
    arm = ((np.abs(v[:, :, 0]) > ARM_X) & (v[:, :, 1] > ARMPIT_Y - 0.1)).any(axis=1)
    faces = faces[~arm]
    print('faces kept', len(faces))

    form_ys = [round(-1.75 + 0.05 * k, 3) for k in range(62)]  # -1.75 .. 1.3
    angles = [2 * math.pi * k / NA for k in range(NA)]
    half = NA // 2
    rows = []
    sides = []
    for fy in form_ys:
        y = mh_y(fy)
        segs = slice_at(verts, faces, y)
        row = reach_row(segs, angles)
        # Over the cut armhole the rays escape: the form has a flat plate there, its side straight down from the
        # armpit's width, so fill those angles from the plate (never wider than the nearest hits).
        xs = [r * abs(math.sin(a)) for r, a in zip(row, angles) if r is not None]
        filled = []
        for k, (r, a) in enumerate(zip(row, angles)):
            if r is None:
                s = abs(math.sin(a)) or 1e-9
                # nearest hit either way round
                lo = next((row[(k - j) % NA] for j in range(1, NA) if row[(k - j) % NA] is not None), 0)
                hi = next((row[(k + j) % NA] for j in range(1, NA) if row[(k + j) % NA] is not None), 0)
                r = min(ARM_X / s, max(lo, hi) * 1.02)
            filled.append(r)
        # Left and right averaged (the body is symmetric), kept as 0..180 degrees.
        sym = [(filled[k] + filled[(NA - k) % NA]) / 2 for k in range(half + 1)]
        # A dress form has no hollows: the cleavage, the cleft of the seat and the groove of the spine are filled, as a
        # tape (and cloth) bridges them. Each ring is its own convex hull, read again along the same rays.
        sym = convex_ring(sym, angles[: half + 1])
        side = max(r * math.sin(a) for r, a in zip(sym, angles[: half + 1]))
        rows.append(sym)
        sides.append(side)
        print(f'{fy:6.2f}  mh {y:6.2f}  side {side:6.3f}  front {sym[0]:6.3f}  back {sym[half]:6.3f}')

    # Each ring's round (MakeHuman's dm), for scaling it to a measured girth.
    def perimeter(row):
        pts = [(r * math.sin(a), r * math.cos(a)) for r, a in zip(row, angles[: half + 1])]
        full = pts + [(-x, z) for x, z in reversed(pts[1:-1])]
        return sum(math.hypot(full[(k + 1) % len(full)][0] - full[k][0], full[(k + 1) % len(full)][1] - full[k][1]) for k in range(len(full)))
    at = lambda f: min(range(len(form_ys)), key=lambda k: abs(form_ys[k] - f))
    bust = at(-0.58)
    # cm of girth to a dm of MakeHuman, at the bust; and the form's unit from the bust's half-width.
    unit = sides[bust] * (GIRTHS[-0.58] / perimeter(rows[bust])) / BUST_HALF  # cm per form unit
    print('cm per unit', unit)
    ks = sorted([(f, (g / perimeter(rows[at(f)])) / unit) for f, g in GIRTHS.items()] + [(-1.34, (SHOULDER_HALF_CM / sides[at(-1.34)]) / unit)])
    for f, k in ks:
        print(f'scale at {f}: {k:.4f}  (mh side {sides[at(f)]:.3f} -> {sides[at(f)] * k:.3f})')
    def scale(fy):
        if fy <= ks[0][0]:
            return ks[0][1]
        if fy >= ks[-1][0]:
            return ks[-1][1]
        for (f0, k0), (f1, k1) in zip(ks, ks[1:]):
            if f0 <= fy <= f1:
                u = (fy - f0) / (f1 - f0)
                u = u * u * (3 - 2 * u)
                return k0 + u * (k1 - k0)
    halfs = [s * scale(fy) for s, fy in zip(sides, form_ys)]
    shapes = [[r / s for r in row] for row, s in zip(rows, sides)]
    for fy, h in zip(form_ys, halfs):
        print(f'{fy:6.2f} half {h:6.3f}')
    if dump:
        json.dump({'ys': form_ys, 'half': halfs, 'shape': shapes}, open(dump, 'w'))
    fmt = lambda v: f'{v:.3f}'.replace('0.', '.') if abs(v) < 1 else f'{v:.3f}'
    lines = [
        '// The body\'s shape, read off MakeHuman\'s base body (CC0, makehumancommunity.org; the young female average,',
        '// arms cut off at the armhole), at each height of the app\'s form. Generated: do not edit by hand.',
        '// BODY_YS: heights in the form\'s own units (waist at 0.1). BODY_HALF: the body\'s half-width at each.',
        '// BODY_SHAPE: at each height, how far the surface reaches from the centre line at each angle round the body,',
        '// from straight ahead (0) to straight behind, as a share of the half-width there (1 at the side).',
        f'export const BODY_YS: number[] = [{", ".join(fmt(y) for y in form_ys)}];',
        f'export const BODY_HALF: number[] = [{", ".join(fmt(h) for h in halfs)}];',
        f'export const BODY_ANGLES = {half + 1};',
        'export const BODY_SHAPE: number[][] = [',
        *[f'  [{", ".join(fmt(v) for v in row)}],' for row in shapes],
        '];',
        '',
    ]
    open(out, 'w').write('\n'.join(lines))
    print('wrote', out)


if __name__ == '__main__':
    main()

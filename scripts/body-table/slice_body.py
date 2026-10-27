"""Reads the MakeHuman base mesh (CC0), applies targets, and slices the torso into level rings read from the body's
centre line: for each height, the reach of the body surface at each angle round it (0 = front).

python3 -I slice_body.py <base.obj> <out.json> [--target file:weight ...] [--plot out.png]
"""
import json
import math
import sys

import numpy as np


def read_obj(path):
    verts = []
    faces = []
    group = None
    for line in open(path):
        if line.startswith('v '):
            verts.append([float(v) for v in line.split()[1:4]])
        elif line.startswith('g '):
            group = line.split()[1]
        elif line.startswith('f ') and group == 'body':
            idx = [int(t.split('/')[0]) - 1 for t in line.split()[1:]]
            # Quads to two triangles.
            for k in range(1, len(idx) - 1):
                faces.append([idx[0], idx[k], idx[k + 1]])
    return np.array(verts), np.array(faces)


def apply_target(verts, path, w):
    for line in open(path):
        if line.startswith('#') or not line.strip():
            continue
        i, dx, dy, dz = line.split()[:4]
        verts[int(i)] += w * np.array([float(dx), float(dy), float(dz)])


def slice_at(verts, faces, y):
    """Segments of the mesh cut by the plane at height y: list of ((x,z),(x,z))."""
    v = verts[faces]  # (n,3,3)
    ys = v[:, :, 1]
    above = ys > y
    cut = (above.any(axis=1)) & (~above.all(axis=1))
    segs = []
    for tri in v[cut]:
        pts = []
        for a, b in ((0, 1), (1, 2), (2, 0)):
            pa, pb = tri[a], tri[b]
            if (pa[1] > y) != (pb[1] > y):
                t = (y - pa[1]) / (pb[1] - pa[1])
                p = pa + t * (pb - pa)
                pts.append((p[0], p[2]))
        if len(pts) == 2:
            segs.append(pts)
    return segs


def reach_table(verts, faces, ys, angles, zc):
    """For each height and angle, the nearest crossing of the body surface along the ray from (0, zc), going by the
    torso only: the first hit from the centre."""
    out = []
    for y in ys:
        segs = slice_at(verts, faces, y)
        row = []
        for a in angles:
            dx, dz = math.sin(a), math.cos(a)
            best = None
            for (x0, z0), (x1, z1) in segs:
                # Ray p = c + t d, segment q = p0 + s (p1 - p0)
                ex, ez = x1 - x0, z1 - z0
                den = dx * ez - dz * ex
                if abs(den) < 1e-12:
                    continue
                qx, qz = x0 - 0, z0 - zc
                t = (qx * ez - qz * ex) / den
                s = (qx * dz - qz * dx) / den
                if t > 0 and 0 <= s <= 1 and (best is None or t < best):
                    best = t
            row.append(best if best is not None else 0.0)
        out.append(row)
    return out


def main():
    args = sys.argv[1:]
    base, out = args[0], args[1]
    targets = []
    plot = None
    i = 2
    while i < len(args):
        if args[i] == '--target':
            f, w = args[i + 1].rsplit(':', 1)
            targets.append((f, float(w)))
            i += 2
        elif args[i] == '--plot':
            plot = args[i + 1]
            i += 2
        else:
            i += 1
    verts, faces = read_obj(base)
    for f, w in targets:
        apply_target(verts, f, w)
    used = np.unique(faces)
    body = verts[used]
    ymin, ymax = body[:, 1].min(), body[:, 1].max()
    print('body height', ymin, ymax, 'x', body[:, 0].min(), body[:, 0].max(), 'z', body[:, 2].min(), body[:, 2].max())
    # The centre line: x = 0, z at the middle of the body's depth at the waist (narrowest between chest and hip).
    # First a coarse scan for widths.
    N = 120
    ys = np.linspace(ymin, ymax, N)
    widths = []
    for y in ys:
        segs = slice_at(verts, faces, y)
        xs = [p[0] for s in segs for p in s]
        zs = [p[1] for s in segs for p in s]
        widths.append((y, (max(xs) if xs else 0), (min(zs) if zs else 0), (max(zs) if zs else 0)))
    for y, w, z0, z1 in widths:
        print(f'{y:7.3f}  halfwidth {w:6.3f}  z {z0:7.3f} {z1:7.3f}')
    json.dump({'scan': widths}, open(out, 'w'))


if __name__ == '__main__' and sys.argv[1] != 'polar':
    main()


def polar(base, targets, out, y0, y1, n, na, zc):
    verts, faces = read_obj(base)
    for f, w in targets:
        apply_target(verts, f, w)
    ys = list(np.linspace(y0, y1, n))
    angles = [math.pi * 2 * i / na for i in range(na)]
    table = reach_table(verts, faces, ys, angles, zc)
    json.dump({'ys': ys, 'angles': angles, 'zc': zc, 'reach': table}, open(out, 'w'))
    q = na // 4
    print('    y    front   side    back   side2')
    for y, row in zip(ys, table):
        k = max(range(len(row)), key=lambda i: row[i] * (1 if abs(angles[i]) < 1.2 else 0))
        print(f'{y:6.3f}  {row[0]:6.3f}  {row[q]:6.3f}  {row[2*q]:6.3f}  {row[3*q]:6.3f}   fwd-max {row[k]:6.3f} at {angles[k]*180/math.pi:5.1f}  at20 {row[4]:6.3f} at45 {row[9]:6.3f} at70 {row[14]:6.3f}')


if __name__ == '__main__' and sys.argv[1] == 'polar':
    a = sys.argv[2:]
    base, out = a[0], a[1]
    targets = []
    i = 2
    while i < len(a) and a[i] == '--target':
        f, w = a[i + 1].rsplit(':', 1)
        targets.append((f, float(w)))
        i += 2
    y0, y1, n, na, zc = float(a[i]), float(a[i + 1]), int(a[i + 2]), int(a[i + 3]), float(a[i + 4])
    polar(base, targets, out, y0, y1, n, na, zc)

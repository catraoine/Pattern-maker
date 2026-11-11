"""Poses MakeHuman's body (CC0) with its default skeleton and weights, then exports the legs and arms in the form's
units for the measuring tutorial. python3 -I pose.py <mh dir> <pose> <out.json>"""
import sys, json, math, numpy as np
sys.path.insert(0, '/home/user/app/scripts/body-table')
from slice_body import read_obj, apply_target
D, POSE, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
v, f = read_obj(f'{D}/base.obj')
for t, w in [('caucasian', .3334), ('african', .3333), ('asian', .3333)]: apply_target(v, f'{D}/{t}-female-young.target', w)
sk = json.load(open(f'{D}/default.mhskel'))
W = json.load(open(f'{D}/default_weights.mhw'))['weights']
J = {k: v[ids].mean(0) for k, ids in sk['joints'].items()}
bones = sk['bones']
head = {b: J[d['head']] for b, d in bones.items()}
tail = {b: J[d['tail']] for b, d in bones.items()}

def rot(axis, deg):
    a = np.asarray(axis, float); a /= np.linalg.norm(a); t = math.radians(deg)
    K = np.array([[0, -a[2], a[1]], [a[2], 0, -a[0]], [-a[1], a[0], 0]])
    return np.eye(3) + math.sin(t) * K + (1 - math.cos(t)) * K @ K

def hand_curl(side, deg):
    across = head[f'finger5-1.{side}'] - head[f'finger2-1.{side}']
    out = {}
    for fi in (2, 3, 4, 5):
        for j in (1, 2, 3):
            out[f'finger{fi}-{j}.{side}'] = (across, deg * (0.7 if j == 1 else 1))
    return out

S = 1 if head['upperarm01.L'][0] > 0 else -1  # x sign of the .L side
def arms(down_l, down_r, bend_l=12, bend_r=12, fwd_l=0, fwd_r=0, curl=28):
    p = {}
    for side, down, bend, fwd in (('L', down_l, bend_l, fwd_l), ('R', down_r, bend_r, fwd_r)):
        sx = S if side == 'L' else -S
        p[f'upperarm01.{side}'] = (np.array([0, 0, 1.0]) * sx, down)
        if fwd: p[f'upperarm02.{side}'] = (np.array([1.0, 0, 0]), fwd)
        p[f'lowerarm01.{side}'] = (np.array([1.0, 0, 0]), bend)
        p.update(hand_curl(side, curl))
    return p

POSES = {
    'rest': {},
    # P1 Poised: arms down close by the sides, elbows soft, hands relaxed; standing straight.
    'poised': arms(-36, -36),
    # P2 Weight shift: one knee eased forward and the foot turned out, the arms easy.
    'shift': {**arms(-38, -33, 10, 18), 'upperleg01.R': (np.array([1.0, 0, 0]), -9), 'lowerleg01.R': (np.array([1.0, 0, 0]), 17), 'foot.R': (np.array([0, 1.0, 0]), 14 * -S)},
    # P3 Editorial step: the free foot set a little in front of the other, one arm drawn slightly back.
    'step': {**arms(-38, -36, 8, 20, 0, -8), 'upperleg01.R': (np.array([1.0, 0, 0]), -14), 'upperleg02.R': (np.array([0, 0, 1.0]), -3 * -S), 'lowerleg01.R': (np.array([1.0, 0, 0]), 22), 'foot.R': (np.array([0, 1.0, 0]), 20 * -S)},
}
pose = POSES[POSE]

# Finger curl direction: toward the palm, read as bringing the fingertips nearer the base of the thumb.
for b, (ax, deg) in list(pose.items()):
    if b.startswith('finger'):
        side = b[-1]
        tip, base = tail[b], head[f'finger1-1.{side}']
        def d_after(s):
            R = rot(ax, s * deg); return np.linalg.norm(head[b] + R @ (tip - head[b]) - base)
        if d_after(-1) < d_after(1): pose[b] = (ax, -deg)

G = {}
def glob(b):
    if b in G: return G[b]
    par = bones[b]['parent']
    M = np.eye(4)
    if b in pose:
        R = rot(*pose[b]); h = head[b]
        L = np.eye(4); L[:3, :3] = R; L[:3, 3] = h - R @ h
        M = L
    G[b] = (glob(par) @ M) if par else M
    return G[b]
acc = np.zeros_like(v); wsum = np.zeros(len(v))
for b, lst in W.items():
    if b not in bones: continue
    M = glob(b)
    ids = np.array([i for i, _ in lst]); ws = np.array([w for _, w in lst])
    acc[ids] += ws[:, None] * (v[ids] @ M[:3, :3].T + M[:3, 3])
    wsum[ids] += ws
posed = v.copy()
m = wsum > 0
posed[m] = acc[m] / wsum[m][:, None]

ZC = 0.33
GAP = [(0.3, 3.1), (0.55, 2.9), (0.8, 2.8), (1.05, 2.6), (1.3, 2.6), (1.55, 2.55), (1.8, 2.35), (2.05, 2.2), (2.3, 2.05), (2.55, 1.95), (2.8, 1.85), (3.05, 1.8), (3.3, 1.65), (3.55, 1.58), (3.7, 1.5)]
def cutx(y):
    if y >= 3.7: return 1.5
    if y <= 0.3: return 3.1
    for (y0, x0), (y1, x1) in zip(GAP, GAP[1:]):
        if y0 <= y <= y1: return x0 + (x1 - x0) * (y - y0) / (y1 - y0)
c = v[f].mean(1)  # classified at rest
arm = np.array([abs(x) > cutx(y) and y > 0.2 for x, y, _ in c])
leg = (v[f][:, :, 1] < -0.45).all(1)
SX = 0.845 / 1.82; SY = 3.42 / 7.58; SA = 0.485
legmap = lambda p: (p[0] * SX, 1.3 + (-0.6 - p[1]) * SY, (p[2] - ZC) * SX)
def armmap(p):
    s = 1 if p[0] > 0 else -1
    return (s * (0.724 + (abs(p[0]) - 1.5) * SA), -1.34 + (4.95 - p[1]) * SA, (p[2] - ZC) * SA)
def pack(faces, mapf):
    ids = np.unique(faces); idx = {int(k): i for i, k in enumerate(ids)}
    return {'pos': [round(float(t), 4) for k in ids for t in mapf(posed[k])], 'idx': [idx[int(k)] for fc in faces for k in fc]}
json.dump({'legs': pack(f[leg], legmap), 'arms': pack(f[arm], armmap)}, open(OUT, 'w'))
print(POSE, 'ok')

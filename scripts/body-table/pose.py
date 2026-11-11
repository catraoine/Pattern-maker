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
def arms(down_l, down_r, bend_l=12, bend_r=12, fwd_l=0, fwd_r=0, curl=14):
    p = {}
    for side, down, bend, fwd in (('L', down_l, bend_l, fwd_l), ('R', down_r, bend_r, fwd_r)):
        sx = S if side == 'L' else -S
        p[f'upperarm01.{side}'] = (np.array([0, 0, 1.0]) * sx, down)
        if fwd: p[f'upperarm02.{side}'] = (np.array([1.0, 0, 0]), fwd)
        p[f'lowerarm01.{side}'] = (np.array([1.0, 0, 0]), bend)
        p.update(hand_curl(side, curl))
    return p

X = np.array([1.0, 0, 0]); Y = np.array([0, 1.0, 0]); Z = np.array([0, 0, 1.0])
POSES = {
    'rest': {},
    # P1 Poised: arms down close by the sides, elbows soft, hands relaxed; standing straight, feet together.
    'poised': {**arms(-33, -33, 8, 8, curl=14), 'upperleg01.L': (Z, -2.5 * S), 'upperleg01.R': (Z, 2.5 * S)},
    # P2 Contrapposto: the weight on one leg, the free knee bent forward and in, its heel lifted; one arm easy
    # forward.
    'shift': {**arms(-40, -34, 6, 30, 0, 10, curl=14), 'upperleg01.R': (X, -24), 'upperleg02.R': (Z, -6 * S), 'lowerleg01.R': (X, 44), 'foot.R': (X, -30), 'upperleg01.L': (Z, -2 * S)},
    # P3 Editorial: feet set apart, arms held a little out with the elbows bent, hands by the thighs.
    'step': {**arms(-26, -26, 28, 28, -6, -6, curl=14), 'upperleg01.L': (Z, 7 * S), 'upperleg01.R': (Z, -7 * S), 'foot.L': (Y, -10 * S), 'foot.R': (Y, 10 * S)},
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
SX = 0.845 / 1.82
SY = 3.42 / 7.58
LANDMARKS = [(5.72, -1.75), (5.37, -1.47), (4.95, -1.34), (3.4, -0.58), (2.15, 0.1), (0.1, 0.82), (-0.6, 1.3)]
def form_y(my):
    if my <= -0.6: return 1.3 + (-0.6 - my) * SY
    for (m0, f0), (m1, f1) in zip(LANDMARKS, LANDMARKS[1:]):
        if m1 <= my <= m0: return f0 + (my - m0) * (f1 - f0) / (m1 - m0)
    return -1.75 - (my - 5.72) * 0.8

# The whole body below the top of the neck, in one piece: torso, arms and legs (the app shapes each height of it to
# the form's own rings, measure3d.ts fitBody). Each point carries how much of it moves with an arm (the skin weights
# of the shoulder and arm bones), so the app can carry the arms out with the shoulders.
ARM_BONES = [b for b in bones if any(b.startswith(k) for k in ('shoulder01', 'upperarm', 'lowerarm', 'wrist', 'finger', 'metacarpal'))]
armw = np.zeros(len(v))
for b in ARM_BONES:
    for i, w in W.get(b, []):
        armw[i] += w
armw = np.clip(armw / np.maximum(wsum, 1e-9), 0, 1)
keep = (v[f][:, :, 1] < 5.95).all(1)
faces = f[keep]
ids = np.unique(faces)
idx = {int(k): i for i, k in enumerate(ids)}
pos = []
for k in ids:
    p = posed[k]
    pos += [round(float(p[0] * SX), 4), round(float(form_y(p[1])), 4), round(float((p[2] - ZC) * SX), 4)]
json.dump({'pos': pos, 'idx': [idx[int(k)] for fc in faces for k in fc], 'arm': [round(float(armw[k]), 3) for k in ids]}, open(OUT, 'w'))
print(POSE, 'ok', len(ids), 'verts')

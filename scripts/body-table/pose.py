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
    """A relaxed hand, as a mannequin's: the fingers brought in together (MakeHuman's rest hand has them spread wide),
    each curled a little more at the middle joint than the others, and the thumb laid in toward the index finger.
    Each bone's turn is returned as a matrix, already signed so the fingers close toward the palm."""
    wrist = head[f'wrist.{side}']
    across = head[f'finger5-1.{side}'] - head[f'finger2-1.{side}']
    along = head[f'finger3-1.{side}'] - wrist
    n = np.cross(along, across); n /= np.linalg.norm(n)
    def plane(d):
        d = d - n * (d @ n); return d / np.linalg.norm(d)
    mid = plane(tail[f'finger3-1.{side}'] - head[f'finger3-1.{side}'])
    def toward(d, target, share):
        # The turn about the palm's normal that takes direction d share of the way round to target.
        a = math.degrees(math.atan2(np.cross(d, target) @ n, d @ target))
        return rot(n, a * share)
    def closing(b, axis, deg, M=np.eye(3)):
        # Of the two ways to turn, the one that brings the finger's tip nearer the thumb's base: toward the palm.
        base = head[f'finger1-1.{side}']
        best = None
        for s_ in (1, -1):
            R = rot(axis, s_ * deg) @ M
            d = np.linalg.norm(head[b] + R @ (tail[b] - head[b]) - base)
            if best is None or d < best[0]: best = (d, R)
        return best[1]
    out = {}
    for fi in (2, 3, 4, 5):
        b1 = f'finger{fi}-1.{side}'
        S_ = toward(plane(tail[b1] - head[b1]), mid, 0.85) if fi != 3 else np.eye(3)
        for j, k in ((1, 0.8), (2, 1.6), (3, 1.1)):
            b = f'finger{fi}-{j}.{side}'
            out[b] = closing(b, across, deg * k, S_ if j == 1 else np.eye(3))
    t1 = f'finger1-1.{side}'
    idx = plane(tail[f'finger2-1.{side}'] - head[f'finger2-1.{side}'])
    out[t1] = toward(plane(tail[t1] - head[t1]), idx, 0.8)
    return out

S = 1 if head['upperarm01.L'][0] > 0 else -1  # x sign of the .L side
def arms(down_l, down_r, bend_l=12, bend_r=12, fwd_l=0, fwd_r=0, curl=14):
    p = {}
    for side, down, bend, fwd in (('L', down_l, bend_l, fwd_l), ('R', down_r, bend_r, fwd_r)):
        sx = S if side == 'L' else -S
        # The whole arm swings from the shoulder: down, then back (or forward) by fwd. (Turning the upper arm's
        # second bone instead put a kink halfway down the upper arm.)
        p[f'upperarm01.{side}'] = rot(np.array([1.0, 0, 0]), fwd) @ rot(np.array([0, 0, 1.0]) * sx, down)
        # The forearm in line with the upper arm (MakeHuman's rest arm is bent a little at the elbow), then bent by
        # bend.
        ua = tail[f'upperarm02.{side}'] - head[f'upperarm01.{side}']
        la = tail[f'lowerarm02.{side}'] - head[f'lowerarm01.{side}']
        ax_ = np.cross(la, ua)
        straight = rot(ax_, math.degrees(math.atan2(np.linalg.norm(ax_), la @ ua))) if np.linalg.norm(ax_) > 1e-9 else np.eye(3)
        p[f'lowerarm01.{side}'] = rot(np.array([1.0, 0, 0]), bend) @ straight
        # The hand hangs straight on from the forearm, loose, rather than held out at the wrist as MakeHuman's
        # rest hand is.
        fa = tail[f'lowerarm02.{side}'] - head[f'lowerarm01.{side}']
        hd = head[f'finger3-1.{side}'] - head[f'wrist.{side}']
        ax = np.cross(hd, fa)
        if np.linalg.norm(ax) > 1e-9:
            p[f'wrist.{side}'] = rot(ax, math.degrees(math.atan2(np.linalg.norm(ax), hd @ fa)))
        p.update(hand_curl(side, curl))
    return p

X = np.array([1.0, 0, 0]); Y = np.array([0, 1.0, 0]); Z = np.array([0, 0, 1.0])
POSES = {
    'rest': {},
    # P1 Poised: arms hanging loose close by the sides, a little back, elbows nearly straight, hands relaxed;
    # standing straight, feet together.
    'poised': {**arms(-30, -30, 3, 3, 4, 4, curl=7), 'upperleg01.L': (Z, -2.5 * S), 'upperleg01.R': (Z, 2.5 * S)},
    # P2 Contrapposto: the weight on one leg, the free knee bent forward and in, its heel lifted; one arm easy
    # forward.
    'shift': {**arms(-40, -34, 6, 30, 0, 10, curl=14), 'upperleg01.R': (X, -24), 'upperleg02.R': (Z, -6 * S), 'lowerleg01.R': (X, 44), 'foot.R': (X, -30), 'upperleg01.L': (Z, -2 * S)},
    # P3 Editorial: feet set apart, arms held a little out with the elbows bent, hands by the thighs.
    'step': {**arms(-26, -26, 28, 28, -6, -6, curl=14), 'upperleg01.L': (Z, 7 * S), 'upperleg01.R': (Z, -7 * S), 'foot.L': (Y, -10 * S), 'foot.R': (Y, 10 * S)},
}
pose = POSES[POSE]

G = {}
def glob(b):
    if b in G: return G[b]
    par = bones[b]['parent']
    M = np.eye(4)
    if b in pose:
        R = pose[b] if isinstance(pose[b], np.ndarray) else rot(*pose[b]); h = head[b]
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

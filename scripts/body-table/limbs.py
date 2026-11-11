"""Exports MakeHuman's legs and arms (CC0), mapped onto the app's form units, as JSON for the measuring tutorial."""
import sys, json, numpy as np
sys.path.insert(0,'/home/user/app/scripts/body-table')
from slice_body import read_obj, apply_target
base, out = sys.argv[1], sys.argv[2]
v,f=read_obj(base)
d = base.rsplit('/',1)[0]
for t,w in [('caucasian',.3334),('african',.3333),('asian',.3333)]: apply_target(v,f'{d}/{t}-female-young.target',w)
ZC=0.33
GAP=[(0.3,3.1),(0.55,2.9),(0.8,2.8),(1.05,2.6),(1.3,2.6),(1.55,2.55),(1.8,2.35),(2.05,2.2),(2.3,2.05),(2.55,1.95),(2.8,1.85),(3.05,1.8),(3.3,1.65),(3.55,1.58),(3.7,1.5)]
def cutx(y):
    if y>=3.7: return 1.5
    if y<=0.3: return 3.1
    for (y0,x0),(y1,x1) in zip(GAP,GAP[1:]):
        if y0<=y<=y1: return x0+(x1-x0)*(y-y0)/(y1-y0)
c=v[f].mean(1)
arm=np.array([abs(x)>cutx(y) and y>0.2 for x,y,_ in c])
leg=(v[f][:,:,1]< -0.45).all(1)
def pack(faces, mapf):
    ids=np.unique(faces); idx={int(k):i for i,k in enumerate(ids)}
    pos=[round(float(t),4) for k in ids for t in mapf(v[k])]
    tri=[idx[int(k)] for fc in faces for k in fc]
    return {'pos':pos,'idx':tri}
SX=0.845/1.82; SY=3.42/7.58; SA=0.485
legmap=lambda p:(p[0]*SX, 1.3+(-0.6-p[1])*SY, (p[2]-ZC)*SX)
def armmap(p):
    s=1 if p[0]>0 else -1
    return (s*(0.724+(abs(p[0])-1.5)*SA), -1.34+(4.95-p[1])*SA, (p[2]-ZC)*SA)
json.dump({'legs':pack(f[leg],legmap),'arms':pack(f[arm],armmap)}, open(out,'w'))
print('leg faces',leg.sum(),'arm faces',arm.sum())

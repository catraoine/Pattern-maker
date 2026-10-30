// Fable fit check sweep of the SS27 house looks: each look drafted for many random bodies and its
// pieces measured against the body the way a toile would be. Run: N=150 npx vite-node scripts/fable-sweep-ss27.ts
import { choicesFlat } from '../src/collection';
import { DEFAULT_BODICE, DEFAULT_COAT_CHOICES, DEFAULT_JACKET_CHOICES } from '../src/garments';
import { BODICE_FIT_EASE, draftBodice } from '../src/engine/bodice';
import { draftDress } from '../src/engine/dress';
import { FIT_EASE, draftSkirt, DraftError } from '../src/engine/skirt';
import { draftTrousers, TROUSER_EASE, TrousersMeasurements } from '../src/engine/trousers';
import { draftOuter, OUTER_EASE, FLARE_PER_40 } from '../src/engine/outerwear';
import { draftSleeve, SLEEVE_EASE } from '../src/engine/sleeve';
import { checkPattern } from '../src/engine/qc';
import { randomArms, randomBody, randomCrotch, rng } from '../src/engine/randomBodies';
import { taggedLength } from '../src/engine/geometry';
import type { Piece } from '../src/engine/piece';
import { validDetails } from '../src/garments';
import { EXAMPLE_BODY } from '../src/measurements';

const N = Number(process.env.N ?? 150);
const r1 = (v: number) => Math.round(v * 10) / 10;

function widthAt(pc: Piece, y: number): number {
  const pts = pc.outline.points(48);
  const xs: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) xs.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y));
  }
  return xs.length < 2 ? NaN : Math.max(...xs) - Math.min(...xs);
}
const pts = (pc: Piece) => pc.outline.points(48);
const minY = (pc: Piece) => Math.min(...pts(pc).map((q) => q.y));
const maxY = (pc: Piece) => Math.max(...pts(pc).map((q) => q.y));
const minX = (pc: Piece) => Math.min(...pts(pc).map((q) => q.x));
const maxX = (pc: Piece) => Math.max(...pts(pc).map((q) => q.x));
/** Half-width of a piece at level y, counting a whole piece as two halves. */
const halfW = (pcs: Piece[], y: number) => pcs.reduce((t, pc) => t + (widthAt(pc, y) || 0) / (pc.meta.whole ? 2 : 1), 0);

type Stat = { n: number; min: number; max: number; sum: number; worst: string; worstMin: string };
const stats = new Map<string, Stat>();
function stat(key: string, v: number, tag: string) {
  if (!Number.isFinite(v)) return;
  const s = stats.get(key) ?? { n: 0, min: Infinity, max: -Infinity, sum: 0, worst: '', worstMin: '' };
  s.n++;
  s.sum += v;
  if (v < s.min) { s.min = v; s.worstMin = tag; }
  if (v > s.max) { s.max = v; s.worst = tag; }
  stats.set(key, s);
}
const fails = new Map<string, string[]>();
function fail(key: string, msg: string) {
  const l = fails.get(key) ?? [];
  l.push(msg);
  fails.set(key, l);
}
// As the app's check screen does: the garment's own pieces, its collar and pockets; facings and lining follow them.
const qc = (key: string, pieces: Piece[], opts: { finishedWaist?: number }, tag: string) => {
  for (const c of checkPattern(pieces.filter((pc) => !pc.kind || pc.kind === 'collar' || pc.kind === 'pocket'), opts)) if (!c.ok) fail(`${key} qc: ${c.label}`, `${tag}: ${c.detail}`);
};
/** Round the body along a piece's drawn HIP LINE (a bent line on a slip whose dart is closed to the hem). */
const alongHipLine = (pcs: Piece[]) => pcs.reduce((t, pc) => { const b = pc.balance?.find((x) => x.label === 'HIP LINE'); if (!b) return t + NaN; let L = 0; for (let i = 1; i < b.pts.length; i++) L += Math.hypot(b.pts[i].x - b.pts[i - 1].x, b.pts[i].y - b.pts[i - 1].y); return t + L / (pc.meta.whole ? 2 : 1); }, 0);

// The SS27 house looks as in src/collection.ts on the Elevate branch (PR #224), copied so the sweep runs on any branch.
const skirtC = (c: object) => ({ fit: 'regular', silhouette: 'a_line', length: 'knee', ...c });
const bodiceC = (c: object) => ({ ...DEFAULT_BODICE, ...c });
const dressC = (fit: string, b: object, s: object) => ({ garment: 'dress', fit, bodice: bodiceC({ ...b, fit, length: 'waist' }), skirt: skirtC({ ...s, fit }) });
const COLLECTION = [
  { id: 'klein', name: 'Parma Shirt', garment: 'bodice', choices: bodiceC({ fit: 'relaxed', neckline: 'crew', collar: 'shirt', closure: 'front_buttons', sleeve: 'long', sleeveShape: 'straight', length: 'hip', darts: 'none' }) },
  { id: 'aqua-slip', name: 'Aqua Slip', garment: 'dress', choices: dressC('regular', { neckline: 'cami' }, { silhouette: 'slip', length: 'midi' }) },
  { id: 'red-jacket', name: 'Red Jacket', garment: 'jacket', choices: { ...DEFAULT_JACKET_CHOICES, fit: 'relaxed', shaping: 'boxy', pads: 'none', pockets: 'patch' } },
  { id: 'red-trouser', name: 'Red Trouser', garment: 'trousers', choices: { garment: 'trousers', fit: 'relaxed', leg: 'wide', length: 'full', closure: 'fly', pockets: 'slant' } },
  { id: 'olive-pleat', name: 'Olive Pleat', garment: 'skirt', choices: skirtC({ fit: 'regular', silhouette: 'straight', length: 'midi', pleats: 'knife' }) },
  { id: 'scoop-column', name: 'Scoop Column', garment: 'dress', choices: dressC('fitted', { neckline: 'scoop' }, { silhouette: 'straight', length: 'maxi' }) },
  { id: 'butter-shift', name: 'Butter Shift', garment: 'dress', choices: dressC('regular', { neckline: 'boat' }, { silhouette: 'straight', length: 'above_knee' }) },
  { id: 'tiny-top', name: 'Tiny Top', garment: 'bodice', choices: bodiceC({ fit: 'fitted', neckline: 'cami' }) },
  { id: 'sash-skirt', name: 'Sheer Sash Skirt', garment: 'skirt', choices: skirtC({ fit: 'regular', silhouette: 'gathered', length: 'maxi', belt: 'sash' }) },
  { id: 'long-coat', name: 'Long Coat', garment: 'coat', choices: { ...DEFAULT_COAT_CHOICES, fit: 'relaxed', front: 'double', flare: 'a_line', pads: 'soft' } },
] as const;
const look = (id: string) => COLLECTION.find((l) => l.id === id)! as never as { id: string; name: string; garment: string; choices: never };
const bodies = Array.from({ length: N }, (_, i) => {
  const r = rng(i + 1 + 31000);
  const b = randomBody(r);
  return { seed: i + 1, m: { ...b, ...randomArms(b, r), ...randomCrotch(b, r) } };
});
// Cat's example body too, first.
bodies.unshift({ seed: 0, m: EXAMPLE_BODY as never });

// ---------- every look drafts through the app's own path ----------
for (const { seed, m } of bodies) {
  for (const lk of COLLECTION) {
    const f = choicesFlat(lk.choices as never, m as never);
    if (!f) fail('look will not draft', `seed ${seed} ${lk.name}`);
  }
}

for (const { seed, m } of bodies) {
  const T = (s: string) => `seed ${seed} ${s}`;

  // ---------- 1 Parma Shirt: relaxed, shirt collar, buttons, hip length, no darts, long straight sleeves ----------
  {
    const c = validDetails(look('klein').choices as never);
    const tag = T('Parma Shirt');
    try {
      const d = draftBodice(m, c as never);
      const ease = BODICE_FIT_EASE.relaxed;
      if (d.warnings.length) fail('S1 warnings', `${tag}: ${d.warnings.join('; ')}`);
      const [bf, bb] = d.block ?? d.pieces;
      const sideBust = bf.draft!.points.find((q) => q.n === '6')!.at;
      const underF = bf.draft!.points.find((q) => q.n === '5')!.at;
      const bust = 2 * (widthAt(bf, sideBust.y + 0.2) + widthAt(bb, d.armholeDepth + (sideBust.y - underF.y) + 0.2));
      stat('S1 bust - (bust + 11)', bust - (m.full_bust + ease.bust), tag);
      if (bust < m.full_bust + ease.bust - 3) fail('S1 bust tight', `${tag}: ${r1(bust)} vs ${r1(m.full_bust + ease.bust)}`);
      // The hem sits at the hip: round there vs hip.
      const hemF = widthAt(bf, d.front.hemSide.y - 0.3);
      const hemB = widthAt(bb, d.back.hemSide.y - 0.3);
      stat('S1 hem at side level - hip', 2 * (hemF + hemB) - m.full_hip, tag);
      stat('S1 finishedHem - (hip + 11)', (d.finishedHem ?? NaN) - (m.full_hip + 11), tag);
      if ((d.finishedHem ?? 0) < m.full_hip + 8) fail('S1 hem tight', `${tag}: hem ${d.finishedHem} vs hip ${r1(m.full_hip)}`);
      // Waist: with no darts the body's waist is not drawn in; the round there is at least waist + ease.
      const wF = widthAt(bf, d.front.waistCentre.y - 0.2);
      const wB = widthAt(bb, d.back.waistCentre.y);
      stat('S1 waist round - (waist + 10)', 2 * (wF + wB) - (m.waist + ease.waist), tag);
      // No bust dart: the front hangs longer at the centre front. How much the hem drops at the CF vs the side.
      stat('S1 CF hem below side hem', d.front.hemCentre.y - d.front.hemSide.y, tag);
      stat('S1 side seam front - back', d.sideSeam.frontLessDart - d.sideSeam.back, tag);
      // Armhole and neck.
      const target = m.armscye! + 4 + ease.bust / 2;
      stat('S1 armhole - target', d.armhole - target, tag);
      if (Math.abs(d.armhole - target) > 1.5) fail('S1 armhole', `${tag}: ${d.armhole} vs ${r1(target)}`);
      stat('S1 neck - body neck', d.neck - m.neck, tag);
      if (d.neck < m.neck + 1.5) fail('S1 neck tight', `${tag}: ${d.neck} round a ${m.neck} neck`);
      // Collar: the stand's neck edge is the neckline plus the extension.
      const stand = d.pieces.find((pc) => /stand/i.test(pc.name));
      const collar = d.pieces.find((pc) => /^collar$/i.test(pc.name));
      if (!stand || !collar) fail('S1 no collar pieces', `${tag}: ${d.pieces.map((pc) => pc.name).join(', ')}`);
      // Buttons: first below the collar, last above the hem, spacing.
      if (d.buttons) {
        const foot = d.front.hemCentre.y;
        stat('S1 buttons count', d.buttons.count, tag);
        stat('S1 last button above hem', foot - d.buttons.at[d.buttons.at.length - 1], tag);
        const gaps = d.buttons.at.slice(1).map((y, i) => y - d.buttons!.at[i]);
        stat('S1 button gap max', Math.max(...gaps), tag);
        stat('S1 button gap min', Math.min(...gaps), tag);
        // A button level with the bust point.
        const nearBust = Math.min(...d.buttons.at.map((y) => Math.abs(y - d.front.apex.y)));
        stat('S1 nearest button to bust level', nearBust, tag);
      } else fail('S1 no buttons', tag);
      // Sleeve: long straight relaxed.
      const s = draftSleeve(d, m, { length: 'long', shape: 'straight', fit: 'relaxed', seamAllowance: 1.5, armholeAllowance: 1, hemAllowance: 2.5 });
      const se = SLEEVE_EASE.relaxed;
      if (s.warnings.length) fail('S1 sleeve warnings', `${tag}: ${s.warnings.join('; ')}`);
      stat('S1 sleeve bicep - (arm + 9)', s.bicep - (m.upper_arm + se.bicep), tag);
      stat('S1 sleeve crown ease', s.crownEase.front + s.crownEase.back, tag);
      stat('S1 sleeve length - arm_length', s.lengthCm - m.arm_length, tag);
      const hand = Math.max(19, (m.wrist ?? 15) * 1.3);
      stat('S1 sleeve hem - hand', s.hemCm - hand, tag);
      if (s.hemCm < hand + 1.5) fail('S1 sleeve hem hand', `${tag}: hem ${s.hemCm} hand ${r1(hand)}`);
      stat('S1 cap height / armhole depth', s.capHeight / d.armholeDepth, tag);
      qc('S1', [...d.pieces, ...s.pieces], {}, tag);
    } catch (e) {
      if (e instanceof DraftError) fail('S1 draft error', `${tag}: ${e.message}`);
      else throw e;
    }
  }

  // ---------- 2 Aqua Slip: regular cami bodice + bias slip skirt, midi ----------
  {
    const lk = look('aqua-slip');
    const c = lk.choices as never as { bodice: never; skirt: never; fit: 'regular' };
    const tag = T('Aqua Slip');
    try {
      const b = { ...validDetails(c.bodice, 'dress'), fit: c.fit, length: 'waist' as const };
      const d = draftDress(m, b, { ...(c.skirt as object), fit: c.fit } as never, {});
      const ease = BODICE_FIT_EASE.regular;
      if (d.warnings.length) fail('S2 warnings', `${tag}: ${d.warnings.join('; ')}`);
      const bf = d.pieces.find((pc) => /^Bodice front/.test(pc.name) && !pc.kind)!;
      const bb = d.pieces.find((pc) => /^Bodice back/.test(pc.name) && !pc.kind)!;
      // Bust: just above the bust dart on the front, at bust level.
      const apex = d.bodice.front.apex;
      const p6 = d.bodice.pieces[0].draft?.points.find((q) => q.n === '6')?.at;
      const p5 = d.bodice.pieces[0].draft?.points.find((q) => q.n === '5')?.at;
      const bust = p6 && p5 ? 2 * (widthAt(bf, p6.y + 0.2) + widthAt(bb, d.bodice.armholeDepth + (p6.y - p5.y) + 0.2)) : NaN;
      stat('S2 bust round - (bust + 7)', bust - (m.full_bust + ease.bust), tag);
      if (bust < m.full_bust + 3) fail('S2 bust tight', `${tag}: ${r1(bust)} vs ${r1(m.full_bust)}`);
      stat('S2 finishedWaist - (waist + 5)', d.finishedWaist - (m.waist + ease.waist), tag);
      // Top edge: how far above the bust point at the centre front and at the strap.
      const cfTop = bf.outline.start.y;
      stat('S2 cami CF edge above bust point', apex.y - cfTop, tag);
      if (apex.y - cfTop < 3) fail('S2 cami edge low', `${tag}: ${r1(apex.y - cfTop)} above the bust point`);
      stat('S2 top edge round - (bust + 7)', (d.bodice.top?.topEdge ?? NaN) - (m.full_bust + ease.bust), tag);
      stat('S2 strap length', d.bodice.top?.straps?.lengthCm ?? NaN, tag);
      if (!d.bodice.top?.straps) fail('S2 no straps', tag);
      // Skirt: bias slip, hip + 7 - 3.
      const sf = d.pieces.filter((pc) => /^Skirt front/.test(pc.name) && !pc.kind);
      const sb = d.pieces.filter((pc) => /^Skirt back/.test(pc.name) && !pc.kind);
      const hip = 2 * alongHipLine([...sf, ...sb]);
      stat('S2 slip hip - (hip + 4)', hip - (m.full_hip + FIT_EASE.regular.hip - 3), tag);
      if (Math.abs(hip - (m.full_hip + 4)) > 0.8) fail('S2 slip hip', `${tag}: ${r1(hip)} vs ${r1(m.full_hip + 4)}`);
      stat('S2 slip hem - hip', d.skirt.hemCm - m.full_hip, tag);
      stat('S2 skirt length - midi', d.skirt.lengthCm - (m.waist_to_knee + 0.4 * (m.waist_to_floor - m.waist_to_knee)), tag);
      // Zip: centre back, must pass the hips below it (bias gives a little, but the ring is checked plain).
      stat('S2 zipCm', d.zipCm, tag);
      stat('S2 zipBelowWaist', d.zipBelowWaist, tag);
      const ring = 2 * (halfW(sf, d.zipBelowWaist + 1) + halfW(sb, d.zipBelowWaist + 1));
      stat('S2 ring at zip end - hip', ring - m.full_hip, tag);
      if (d.overHead) {
        fail('S2 over the head', `${tag}: ring ${r1(ring)} hip ${r1(m.full_hip)} zip ${d.zipCm}`);
      } else if (ring < m.full_hip - 1.5) fail('S2 zip hips', `${tag}: ring ${r1(ring)} at ${d.zipBelowWaist} below the waist, hip ${r1(m.full_hip)}`);
      stat('S2 skirt opening', d.skirt.opening === 'centre_back' ? 1 : 0, tag);
      if (d.skirt.opening !== 'centre_back') fail('S2 skirt opening not CB', `${tag}: ${d.skirt.opening}`);
      qc('S2', d.pieces, { finishedWaist: d.finishedWaist }, tag);
    } catch (e) {
      if (e instanceof DraftError) fail('S2 draft error', `${tag}: ${e.message}`);
      else throw e;
    }
  }

  // ---------- 3 Red Jacket and 10 Long Coat ----------
  for (const [key, id] of [['S3', 'red-jacket'], ['S10', 'long-coat']] as const) {
    const lk = look(id);
    const c = lk.choices as never as { garment: 'jacket' | 'coat'; fit: 'relaxed'; shaping: string; pads: string; front: string; flare: string; pockets: string; length?: string };
    const tag = T(lk.name);
    try {
      const d = draftOuter(m, { ...(c as object), kind: c.garment } as never);
      const kind = c.garment;
      const bustEase = OUTER_EASE[kind][c.fit];
      if (d.warnings.length) fail(`${key} warnings`, `${tag}: ${d.warnings.join('; ')}`);
      const [bf, bb] = d.block;
      const base = d.base;
      const [basef] = base.block ?? base.pieces;
      const sideBust = basef.draft!.points.find((q) => q.n === '6')!.at;
      const underF = basef.draft!.points.find((q) => q.n === '5')!.at;
      const bust = 2 * (widthAt(bf, sideBust.y + 0.2) + widthAt(bb, base.armholeDepth + (sideBust.y - underF.y) + 0.2));
      stat(`${key} bust - (bust + ${bustEase})`, bust - (m.full_bust + bustEase), tag);
      if (bust < m.full_bust + bustEase - 3.5) fail(`${key} bust tight`, `${tag}: ${r1(bust)} vs ${r1(m.full_bust + bustEase)}`);
      stat(`${key} finishedBust - (bust + ease)`, d.finishedBust - (m.full_bust + bustEase), tag);
      // Waist round (block, darts open since boxy / seams) vs waist.
      const wy = base.front.waistCentre.y;
      const waist = 2 * (widthAt(bf, wy) + widthAt(bb, base.back.waistCentre.y));
      stat(`${key} waist round (darts open) - waist`, waist - m.waist, tag);
      stat(`${key} finishedWaist - waist`, d.finishedWaist - m.waist, tag);
      // Hip level: the jacket ends there; the coat passes it.
      const hipY = wy + m.waist_to_hip;
      const hipRound = 2 * ((widthAt(bf, Math.min(hipY, maxY(bf) - 0.3)) || 0) + (widthAt(bb, Math.min(base.back.waistCentre.y + m.waist_to_hip, maxY(bb) - 0.3)) || 0));
      stat(`${key} round at hip - hip`, hipRound - m.full_hip, tag);
      if (hipRound < m.full_hip + 8) fail(`${key} hip tight`, `${tag}: ${r1(hipRound)} at the hip vs ${r1(m.full_hip)}`);
      stat(`${key} finishedHem - hip`, d.finishedHem - m.full_hip, tag);
      stat(`${key} drop below waist`, d.drop, tag);
      stat(`${key} length CB`, d.lengthCm, tag);
      if (kind === 'coat') {
        stat('S10 drop - (knee + 3)', d.drop - (m.waist_to_knee + 3), tag);
        // Hem round for walking: the A-line below the hip.
        if (d.finishedHem < m.full_hip + 30) fail('S10 hem narrow for walking', `${tag}: hem ${r1(d.finishedHem)} hip ${r1(m.full_hip)}`);
        const extra = d.drop - base.drop;
        stat('S10 expected flare per seam', (FLARE_PER_40.a_line * extra) / 40, tag);
      } else {
        stat('S3 drop - waist_to_hip', d.drop - m.waist_to_hip, tag);
      }
      // Shoulders: pad.
      stat(`${key} pads cm`, d.pads, tag);
      // Armhole vs target with the pad.
      const target = m.armscye! + 4 + 0.5 * bustEase;
      stat(`${key} armhole - target(no pad)`, base.armhole - target, tag);
      stat(`${key} base.neck - body neck`, base.neck - m.neck, tag);
      // Buttons and the extension.
      stat(`${key} buttons count`, d.buttons.at.length, tag);
      stat(`${key} first button (break) below neck`, d.buttons.at[0] - bf.outline.start.y, tag);
      stat(`${key} break point above/below bust point (neg above)`, d.buttons.at[0] - base.front.apex.y, tag);
      const foot = Math.max(...bf.outline.points(4).filter((q) => Math.abs(q.x) < 1e-6).map((q) => q.y));
      stat(`${key} last button above hem`, foot - d.buttons.at[d.buttons.at.length - 1], tag);
      if (d.buttons.at.length > 1) {
        const gaps = d.buttons.at.slice(1).map((y, i) => y - d.buttons.at[i]);
        stat(`${key} button gap`, gaps[0], tag);
      }
      // Lapel: the gorge sits above the bust and below the shoulder.
      if (d.lapel) {
        stat(`${key} gorge below neck point`, d.lapel.gorge.y - d.lapel.neckPoint.y, tag);
        stat(`${key} lapel width at break (worn)`, Math.max(...d.lapel.worn.map((q) => q.x)) - 0, tag);
        stat(`${key} collar point y - neck y`, d.lapel.collarPoint.y - d.lapel.neckPoint.y, tag);
        if (d.lapel.gorge.y < d.lapel.neckPoint.y - 0.5) fail(`${key} gorge above the neck point`, `${tag}: gorge ${r1(d.lapel.gorge.y)} neck point ${r1(d.lapel.neckPoint.y)}`);
      }
      // Collar neck edge vs neckline.
      const collar = d.pieces.find((pc) => pc.name === 'Collar');
      if (collar) {
        const neckLen = taggedLength(collar.outline, 'neck');
        const fronts = d.pieces.filter((pc) => !pc.kind && /front/i.test(pc.name));
        const backs = d.pieces.filter((pc) => !pc.kind && /back/i.test(pc.name));
        const opened = fronts.find((pc) => pc.outline.tags.includes('gorge') || pc.outline.tags.includes('opening'))!;
        const bodyNeck = taggedLength(opened.outline, 'neck') + (backs.find((pc) => pc.fold)?.outline ? taggedLength(backs.find((pc) => pc.fold)!.outline, 'neck') : taggedLength(backs[0].outline, 'neck'));
        stat(`${key} collar neck - body neck seam (half)`, neckLen - bodyNeck, tag);
        if (Math.abs(neckLen - bodyNeck) > 0.3) fail(`${key} collar neck edge`, `${tag}: collar ${r1(neckLen)} vs neck seam ${r1(bodyNeck)}`);
      } else fail(`${key} no collar`, tag);
      // Sleeve.
      const s = d.sleeve;
      const se = { jacket: { relaxed: { bicep: 13, crown: 2.5 } }, coat: { relaxed: { bicep: 16, crown: 2.5 } } }[kind].relaxed;
      stat(`${key} sleeve bicep - (arm + ${se.bicep})`, s.bicep - (m.upper_arm + se.bicep), tag);
      if (s.bicep < m.upper_arm + se.bicep - 0.5) fail(`${key} sleeve narrowed`, `${tag}: ${s.bicep} vs ${r1(m.upper_arm + se.bicep)}`);
      stat(`${key} sleeve crown ease`, s.crownEase.front + s.crownEase.back, tag);
      if (s.crownEase.front + s.crownEase.back < 1 || s.crownEase.front + s.crownEase.back > 4.5) fail(`${key} crown ease`, `${tag}: ${JSON.stringify(s.crownEase)}`);
      stat(`${key} sleeve length - arm_length`, s.lengthCm - m.arm_length, tag);
      const hand = Math.max(19, (m.wrist ?? 15) * 1.3);
      stat(`${key} sleeve hem - hand`, s.hemCm - hand, tag);
      stat(`${key} cap height / armhole depth`, s.capHeight / base.armholeDepth, tag);
      stat(`${key} sleeve pieces`, s.pieces.length, tag);
      // Pocket inside the front, clear of the edge and the hem.
      if (d.pocket) {
        const carrier = d.pieces.filter((pc) => !pc.kind && /front/i.test(pc.name)).find((pc) => pc.lines.some((l) => l.points().some((q) => Math.abs(q.x - d.pocket!.x) < 1e-6 && Math.abs(q.y - d.pocket!.y) < 1e-6)));
        if (!carrier) fail(`${key} pocket not drawn on a front`, tag);
        else {
          const y = d.pocket.y + d.pocket.h / 2;
          const xs = pts(carrier).length ? (() => { const P = carrier.outline.points(48); const out: number[] = []; for (let i = 0; i < P.length - 1; i++) { const a = P[i], b2 = P[i + 1]; if ((a.y <= y && b2.y > y) || (b2.y <= y && a.y > y)) out.push(a.x + ((y - a.y) * (b2.x - a.x)) / (b2.y - a.y)); } return out; })() : [];
          const lo = Math.min(...xs);
          const hi = Math.max(...xs);
          stat(`${key} pocket clear of side seam`, hi - (d.pocket.x + d.pocket.w), tag);
          stat(`${key} pocket carrier usable width (hi - from)`, hi - Math.max(lo + 1.5, d.ext + 2), tag);
          stat(`${key} pocket clear of front edge/seam`, d.pocket.x - lo, tag);
          if (hi - (d.pocket.x + d.pocket.w) < 1.5) fail(`${key} pocket over side seam`, `${tag}: pocket to ${r1(d.pocket.x + d.pocket.w)}, front to ${r1(hi)} on ${carrier.name}`);
          if (d.pocket.x - lo < 1.5) fail(`${key} pocket over front edge`, `${tag}: pocket from ${r1(d.pocket.x)}, edge ${r1(lo)} on ${carrier.name}`);
          const bottom = maxY(carrier);
          stat(`${key} pocket bottom above hem`, bottom - (d.pocket.y + d.pocket.h), tag);
          stat(`${key} pocket top below waist`, d.pocket.y - wy, tag);
          // Clear of the buttons: the pocket's left edge past the outer button column + button.
          const col = Math.max(...d.buttons.columns);
          stat(`${key} pocket left - button column`, d.pocket.x - col, tag);
          if (d.pocket.x - col < d.buttons.sizeCm) fail(`${key} pocket under buttons`, `${tag}: pocket x ${r1(d.pocket.x)} column ${r1(col)}`);
        }
      }
      // Vent.
      if (d.vent) stat(`${key} vent length`, d.vent.length, tag);
      // Lining pieces present.
      const linings = d.pieces.filter((pc) => pc.kind === 'lining');
      stat(`${key} lining pieces`, linings.length, tag);
      // Width to cut: widest piece on 140 cm (half 70 cm with fold pieces).
      for (const pc of d.pieces) {
        const w = maxX(pc) - minX(pc) + 2 * pc.seamAllowance;
        const lim = pc.fold ? 70 : 140;
        if (w > lim) fail(`${key} piece too wide for 140 cm fabric`, `${tag}: ${pc.name} ${r1(w)} (${pc.fold ? 'on fold' : 'flat'})`);
      }
      qc(key, d.pieces, {}, tag);
    } catch (e) {
      if (e instanceof DraftError) fail(`${key} draft error`, `${tag}: ${e.message}`);
      else throw e;
    }
  }

  // ---------- 4 Red Trouser: relaxed wide full, fly, slant pockets ----------
  {
    const c = look('red-trouser').choices as never as object;
    const tag = T('Red Trouser');
    try {
      const mt: TrousersMeasurements = m as never;
      const d = draftTrousers(mt, c as never);
      const [front, back] = d.block;
      const ease = TROUSER_EASE.relaxed;
      const rise = d.riseCm ?? 0;
      const hipY = mt.waist_to_hip + rise;
      const hip = 2 * (widthAt(front, hipY) + widthAt(back, hipY));
      stat('S4 hip - (hip + ease)', hip - (mt.full_hip + ease.hip), tag);
      if (hip < mt.full_hip + ease.hip - 0.6 || hip > mt.full_hip + ease.hip + 2) fail('S4 hip', `${tag}: ${r1(hip)} vs ${r1(mt.full_hip + ease.hip)}`);
      const waist = 2 * (taggedLength(front.outline, 'waist') + taggedLength(back.outline, 'waist'));
      stat('S4 waist seam - finished', waist - d.finishedWaist, tag);
      stat('S4 finishedWaist - (waist + ease)', d.finishedWaist - (mt.waist + ease.waist), tag);
      if (d.crotchCapped) fail('S4 crotch capped', `${tag}: ${JSON.stringify(d.crotch)}`);
      const fork = front.meta.fork as { x: number; y: number };
      const bfork = back.meta.fork as { x: number; y: number };
      const thigh = widthAt(front, fork.y + 0.3) + widthAt(back, bfork.y + 0.3);
      stat('S4 thigh / hip', thigh / mt.full_hip, tag);
      stat('S4 hem round', d.hemCm, tag);
      stat('S4 knee round', d.kneeCm, tag);
      stat('S4 length - (floor - 3)', d.lengthCm - (mt.waist_to_floor - 3), tag);
      stat('S4 fly zip', d.zipCm, tag);
      // Pockets: the slant pocket's pieces exist and the front with its pocket still checks.
      const pocketPieces = d.pieces.filter((pc) => /pocket/i.test(pc.name));
      stat('S4 pocket pieces', pocketPieces.length, tag);
      if (pocketPieces.length === 0) fail('S4 no slant pocket', `${tag}: ${d.pieces.map((pc) => pc.name).join(', ')}`);
      const bagWide = pocketPieces.some((pc) => maxX(pc) - minX(pc) > 60);
      if (bagWide) fail('S4 pocket piece odd', tag);
      qc('S4', d.pieces, { finishedWaist: d.finishedWaist }, tag);
    } catch (e) {
      if (e instanceof DraftError) fail('S4 draft error', `${tag}: ${e.message}`);
      else throw e;
    }
  }

  // ---------- 5 Olive Pleat: regular straight midi, knife pleats ----------
  {
    const c = look('olive-pleat').choices as never as object;
    const tag = T('Olive Pleat');
    try {
      const d = draftSkirt(m, c as never);
      const ease = FIT_EASE.regular;
      const [bf, bb] = d.block ?? d.pieces;
      const hip = 2 * (widthAt(bf, m.waist_to_hip) + widthAt(bb, m.waist_to_hip));
      stat('S5 block hip - (hip + 7)', hip - (m.full_hip + ease.hip), tag);
      if (Math.abs(hip - (m.full_hip + ease.hip)) > 0.6) fail('S5 block hip', `${tag}: ${r1(hip)} vs ${r1(m.full_hip + ease.hip)}`);
      stat('S5 finishedWaist - (waist + 2)', d.finishedWaist - (m.waist + ease.waist), tag);
      // The pleated pieces: their waist runs (the parts that sew, not the pleat folds) add to the finished waist.
      const fronts = d.pieces.filter((pc) => /^Skirt front/.test(pc.name));
      const backs = d.pieces.filter((pc) => /^Skirt back/.test(pc.name));
      const waistRun = (pcs: Piece[]) => pcs.reduce((t, pc) => t + taggedLength(pc.outline, 'waist'), 0);
      stat('S5 pleated waist (faces) - finished/2', 2 * (waistRun(fronts) + waistRun(backs)) - d.finishedWaist * 2, tag);
      // Fully folded, the waist edge (waist + pleat) folded down equals the finished waist: the pleat intake.
      const edge = (pcs: Piece[]) => pcs.reduce((t, pc) => t + taggedLength(pc.outline, 'waist') + taggedLength(pc.outline, 'pleat'), 0);
      stat('S5 open waist edge (half) ', edge(fronts) + edge(backs), tag);
      stat('S5 open hem', d.volume?.pleats?.openHem ?? NaN, tag);
      stat('S5 pleat count', d.volume?.pleats?.count ?? NaN, tag);
      stat('S5 pleat face', d.volume?.pleats?.face ?? NaN, tag);
      stat('S5 pleat depth', d.volume?.pleats?.depth ?? NaN, tag);
      stat('S5 split', d.volume?.pleats?.split ? 1 : 0, tag);
      stat('S5 pieces', d.pieces.length, tag);
      stat('S5 length - midi', d.lengthCm - (m.waist_to_knee + 0.4 * (m.waist_to_floor - m.waist_to_knee)), tag);
      stat('S5 zipCm', d.zipCm, tag);
      if (d.slit) fail('S5 slit on a pleated skirt', `${tag}: ${JSON.stringify(d.slit)}`);
      for (const pc of d.pieces) {
        const w = maxX(pc) - minX(pc) + 2 * pc.seamAllowance;
        const lim = pc.fold ? 70 : 140;
        stat(`S5 width ${pc.fold ? 'fold' : 'flat'}`, w, tag);
        if (w > lim) fail('S5 piece too wide', `${tag}: ${pc.name} ${r1(w)}`);
      }
      // Below the zip, the pleated back must still pass the hips: it does, the round is 2x+. Check band.
      stat('S5 band length', (d.waistband as { lengthCm?: number }).lengthCm ?? NaN, tag);
      qc('S5', d.pieces, { finishedWaist: d.finishedWaist }, tag);
    } catch (e) {
      if (e instanceof DraftError) fail('S5 draft error', `${tag}: ${e.message}`);
      else throw e;
    }
  }

  // ---------- 6 Scoop Column, 7 Butter Shift: waist-seam dresses ----------
  for (const [key, id] of [['S6', 'scoop-column'], ['S7', 'butter-shift']] as const) {
    const lk = look(id);
    const c = lk.choices as never as { bodice: never; skirt: { silhouette: string; length: string; fit: string }; fit: 'fitted' | 'regular' };
    const tag = T(lk.name);
    try {
      const b = { ...validDetails(c.bodice, 'dress'), fit: c.fit, length: 'waist' as const };
      const d = draftDress(m, b, { ...c.skirt, fit: c.fit } as never, {});
      const bEase = BODICE_FIT_EASE[c.fit];
      const sEase = FIT_EASE[c.fit];
      if (d.warnings.length) fail(`${key} warnings`, `${tag}: ${d.warnings.join('; ')}`);
      const bf = d.pieces.find((pc) => /^Bodice front/.test(pc.name) && !pc.kind)!;
      const bb = d.pieces.find((pc) => /^Bodice back/.test(pc.name) && !pc.kind)!;
      const sideBust = d.bodice.pieces[0].draft!.points.find((q) => q.n === '6')!.at;
      const underF = d.bodice.pieces[0].draft!.points.find((q) => q.n === '5')!.at;
      const bust = 2 * (widthAt(bf, sideBust.y + 0.2) + widthAt(bb, d.bodice.armholeDepth + (sideBust.y - underF.y) + 0.2));
      stat(`${key} bust - (bust + ease)`, bust - (m.full_bust + bEase.bust), tag);
      if (Math.abs(bust - (m.full_bust + bEase.bust)) > 3) fail(`${key} bust`, `${tag}: ${r1(bust)} vs ${r1(m.full_bust + bEase.bust)}`);
      const w = 2 * (taggedLength(bf.outline, 'waist') + taggedLength(bb.outline, 'waist'));
      stat(`${key} waist seam - (waist + ease)`, w - (m.waist + bEase.waist), tag);
      const sf = d.pieces.filter((pc) => /^Skirt front/.test(pc.name) && !pc.kind);
      const sb = d.pieces.filter((pc) => /^Skirt back/.test(pc.name) && !pc.kind);
      const hip = 2 * (halfW(sf, m.waist_to_hip) + halfW(sb, m.waist_to_hip));
      stat(`${key} skirt hip - (hip + ease)`, hip - (m.full_hip + sEase.hip), tag);
      if (Math.abs(hip - (m.full_hip + sEase.hip)) > 0.6) fail(`${key} skirt hip`, `${tag}: ${r1(hip)} vs ${r1(m.full_hip + sEase.hip)}`);
      stat(`${key} hem - hip`, d.skirt.hemCm - m.full_hip, tag);
      const ring = 2 * (halfW(sf, d.zipBelowWaist + 1) + halfW(sb, d.zipBelowWaist + 1));
      stat(`${key} ring at zip end - hip`, ring - m.full_hip, tag);
      stat(`${key} zipCm`, d.zipCm, tag);
      stat(`${key} zipBelowWaist`, d.zipBelowWaist, tag);
      stat(`${key} overHead`, d.overHead ? 1 : 0, tag);
      if (d.overHead) {
        // Over the head: the ring must pass the shoulders/bust, and the neckline the head.
        if (ring < m.full_bust - 1.5) fail(`${key} over head but ring under bust`, `${tag}: ring ${r1(ring)} bust ${r1(m.full_bust)}`);
        fail(`${key} goes on over the head (note)`, `${tag}: ring ${r1(ring)} hip ${r1(m.full_hip)} zip ${d.zipCm}`);
      } else if (ring < m.full_hip - 1.5) fail(`${key} zip hips`, `${tag}: ring ${r1(ring)} hip ${r1(m.full_hip)} zip ${d.zipCm}`);
      // Neck.
      stat(`${key} neck - body neck`, d.bodice.neck - m.neck, tag);
      const cfNeck = bf.outline.start.y;
      stat(`${key} CF neck above bust point`, d.bodice.front.apex.y - cfNeck, tag);
      if (key === 'S6') {
        // Maxi straight: a walking slit.
        stat('S6 length - (floor - 7)', d.skirt.lengthCm - (m.waist_to_floor - 7), tag);
        stat('S6 slit cm', d.skirt.slit?.cm ?? 0, tag);
        if (!d.skirt.slit) fail('S6 no walking slit', `${tag}: hem ${d.skirt.hemCm} hip ${r1(m.full_hip)}`);
        else {
          // Stride: the round at the slit top must let the legs move: the hem above the slit is the hem.
          stat('S6 slit top above floor', d.skirt.slit.cm + 7, tag);
          if (d.skirt.slit.cm < 0.3 * (m.waist_to_floor - m.waist_to_knee) + 7) fail('S6 slit short for a column', `${tag}: slit ${d.skirt.slit.cm}, knee ${r1(m.waist_to_floor - m.waist_to_knee)} above floor`);
        }
      } else {
        stat('S7 length - 0.86 knee', d.skirt.lengthCm - 0.86 * m.waist_to_knee, tag);
        stat('S7 skirt slit', d.skirt.slit ? 1 : 0, tag);
        // Boat neck: the neck point moved along the shoulder; shoulder left.
        stat('S7 shoulder seam left', d.bodice.shoulder.front, tag);
        if (d.bodice.shoulder.front < 4.5) fail('S7 shoulder too short', `${tag}: ${d.bodice.shoulder.front}`);
      }
      qc(key, d.pieces, { finishedWaist: d.finishedWaist }, tag);
    } catch (e) {
      if (e instanceof DraftError) fail(`${key} draft error`, `${tag}: ${e.message}`);
      else throw e;
    }
  }
  // 7b: the Butter Shift as a true shift (no waist seam), for comparison.
  {
    const tag = T('Butter Shift as noSeam shift');
    try {
      const d = draftDress(m, { fit: 'regular', neckline: 'boat' }, { fit: 'regular', silhouette: 'straight', length: 'above_knee', noSeam: 'shift' }, {});
      const bf = d.pieces.find((pc) => /^Dress front/.test(pc.name) && !pc.kind)!;
      const bb = d.pieces.find((pc) => /^Dress back/.test(pc.name) && !pc.kind)!;
      const hip = 2 * (widthAt(bf, d.bodice.front.waistCentre.y + m.waist_to_hip) + widthAt(bb, d.bodice.back.waistCentre.y + m.waist_to_hip));
      stat('S7b shift hip - (hip + 7)', hip - (m.full_hip + 7), tag);
      const hem = 2 * (widthAt(bf, maxY(bf) - 0.3) + widthAt(bb, maxY(bb) - 0.3));
      stat('S7b shift hem - hip', hem - m.full_hip, tag);
      const ring = 2 * (widthAt(bf, d.bodice.front.waistCentre.y + d.zipBelowWaist + 1) + widthAt(bb, d.bodice.back.waistCentre.y + d.zipBelowWaist + 1));
      stat('S7b ring at zip end - hip', ring - m.full_hip, tag);
      if (d.overHead) fail('S7b shift over head', `${tag}: ring ${r1(ring)} hip ${r1(m.full_hip)}`);
      if (d.warnings.length) fail('S7b warnings', `${tag}: ${d.warnings.join('; ')}`);
      qc('S7b', d.pieces, {}, tag);
    } catch (e) {
      if (e instanceof DraftError) fail('S7b draft error', `${tag}: ${e.message}`);
      else throw e;
    }
  }

  // ---------- 8 Tiny Top: fitted cami, waist length ----------
  {
    const c = validDetails(look('tiny-top').choices as never);
    const tag = T('Tiny Top');
    try {
      const d = draftBodice(m, c as never);
      const ease = BODICE_FIT_EASE.fitted;
      if (d.warnings.length) fail('S8 warnings', `${tag}: ${d.warnings.join('; ')}`);
      const [bf, bb] = d.pieces;
      const apex = d.front.apex;
      const p6 = bf.draft?.points.find((q) => q.n === '6')?.at;
      const p5 = bf.draft?.points.find((q) => q.n === '5')?.at;
      const bust = p6 && p5 ? 2 * (widthAt(bf, p6.y + 0.2) + widthAt(bb, d.armholeDepth + (p6.y - p5.y) + 0.2)) : NaN;
      stat('S8 bust round - (bust + 4)', bust - (m.full_bust + ease.bust), tag);
      if (bust < m.full_bust + 1) fail('S8 bust tight', `${tag}: ${r1(bust)} vs ${r1(m.full_bust)}`);
      const w = 2 * (taggedLength(bf.outline, 'waist') + taggedLength(bb.outline, 'waist'));
      stat('S8 waist - (waist + 2.5)', w - (m.waist + ease.waist), tag);
      if (Math.abs(w - (m.waist + ease.waist)) > 1.5) fail('S8 waist', `${tag}: ${r1(w)} vs ${r1(m.waist + ease.waist)}`);
      stat('S8 cami CF edge above bust point', apex.y - bf.outline.start.y, tag);
      stat('S8 top edge - (bust + 4)', (d.top?.topEdge ?? NaN) - (m.full_bust + ease.bust), tag);
      stat('S8 strap length', d.top?.straps?.lengthCm ?? NaN, tag);
      // Zip: the opening from the back top to the waist, and the zip in it.
      const cbTop = d.back.neckCentre.y;
      const opening = d.back.waistCentre.y - cbTop;
      stat('S8 zipCm', d.zipCm, tag);
      stat('S8 zip opening (CB top to waist)', opening, tag);
      stat('S8 zip - opening', d.zipCm - opening, tag);
      if (d.zipCm > opening + 0.05) fail('S8 zip longer than the opening', `${tag}: zip ${d.zipCm} opening ${r1(opening)}`);
      // Getting it on: zip open from the top to the waist: step in over the hips? The waist+2.5 tube at the
      // waist is open at the back, so the opening is the whole back. Fine. Bust dart.
      stat('S8 bust dart', d.bustDart, tag);
      qc('S8', d.pieces, { finishedWaist: d.finishedWaist }, tag);
    } catch (e) {
      if (e instanceof DraftError) fail('S8 draft error', `${tag}: ${e.message}`);
      else throw e;
    }
  }

  // ---------- 9 Sheer Sash Skirt: regular gathered maxi, sash ----------
  {
    const c = look('sash-skirt').choices as never as object;
    const tag = T('Sheer Sash Skirt');
    try {
      const d = draftSkirt(m, c as never);
      const ease = FIT_EASE.regular;
      stat('S9 finishedWaist - (waist + 2)', d.finishedWaist - (m.waist + ease.waist), tag);
      stat('S9 round / waist', (d.gathers?.round ?? NaN) / (m.waist + ease.waist), tag);
      stat('S9 round - hip', (d.gathers?.round ?? NaN) - m.full_hip, tag);
      if ((d.gathers?.round ?? 0) < m.full_hip + 15) fail('S9 round tight over hips', `${tag}: ${d.gathers?.round} hip ${r1(m.full_hip)}`);
      stat('S9 hem', d.hemCm, tag);
      stat('S9 length - (floor - 7)', d.lengthCm - (m.waist_to_floor - 7), tag);
      stat('S9 zipCm', d.zipCm, tag);
      const [f, b] = d.pieces;
      stat('S9 quarter width + sa', maxX(f) - minX(f) + 2 * f.seamAllowance, tag);
      if (maxX(f) - minX(f) + f.seamAllowance > 70) fail('S9 front too wide for fold', `${tag}: ${r1(maxX(f) - minX(f))}`);
      stat('S9 back cut', b.fold ? 0 : 1, tag);
      qc('S9', d.pieces, { finishedWaist: d.finishedWaist }, tag);
    } catch (e) {
      if (e instanceof DraftError) fail('S9 draft error', `${tag}: ${e.message}`);
      else throw e;
    }
  }
}

console.log('\n=== STATS');
for (const [k, s] of [...stats.entries()].sort()) console.log(`${k.padEnd(58)} n=${s.n} min=${r1(s.min)} mean=${r1(s.sum / s.n)} max=${r1(s.max)}  worst: ${s.worst} | least: ${s.worstMin}`);
console.log('\n=== FAILURES');
for (const [k, l] of [...fails.entries()].sort()) {
  console.log(`\n${k}: ${l.length}`);
  for (const x of l.slice(0, 5)) console.log('  ' + x);
}

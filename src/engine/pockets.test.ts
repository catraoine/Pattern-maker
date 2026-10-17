import { describe, expect, it } from 'vitest';
import { P, len, sub, taggedLength } from './geometry';
import { Piece, cutLine } from './piece';
import { checkPattern } from './qc';
import { randomBody, randomCrotch, rng } from './randomBodies';
import { DraftError, Silhouette, draftSkirt, elasticFor } from './skirt';
import { Leg, TrousersMeasurements, draftTrousers, trousersWaistband } from './trousers';
import { draftDress } from './dress';
import { INSEAM, seamPoint } from './pockets';
import { layPlans } from './layplan';
import { waistbandPiece } from './finishing';
import { sewingGuide, dressGuide } from './instructions';
import { trousersGuide } from './trousersGuide';
import { toCouture } from './couture';
import { skirtFlat, trousersFlat } from './flat';
import { skirtSpec, trousersSpec } from './spec';

const m = { waist: 70, full_hip: 96, waist_to_hip: 20.5, waist_to_knee: 58, waist_to_floor: 104 };
const EX: TrousersMeasurements = { waist: 76, full_hip: 102, waist_to_hip: 20.5, waist_to_knee: 58, waist_to_floor: 104, crotch_depth: 27, crotch_length: 70 };
const SILS: Silhouette[] = ['straight', 'pencil', 'a_line', 'trumpet', 'half_circle', 'circle'];
const LEGS: Leg[] = ['straight', 'wide', 'tapered', 'culotte'];

function segmentsCross(a: P, b: P, c: P, d: P): boolean {
  const o = (p: P, q: P, s: P) => (q.x - p.x) * (s.y - p.y) - (q.y - p.y) * (s.x - p.x);
  return o(c, d, a) * o(c, d, b) < -1e-9 && o(a, b, c) * o(a, b, d) < -1e-9;
}

function isSimple(pts: P[]): boolean {
  const n = pts.length;
  for (let i = 0; i < n; i++)
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (segmentsCross(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) return false;
    }
  return true;
}

/** A piece that can be cut: finite, and neither line crossing itself. */
function problems(pc: Piece): string[] {
  const out: string[] = [];
  const line = pc.outline.points().slice(0, -1);
  const cut = cutLine(pc);
  if (![...line, ...cut].every((q) => Number.isFinite(q.x) && Number.isFinite(q.y))) out.push(`${pc.name}: non-finite`);
  if (!isSimple(line)) out.push(`${pc.name}: stitching line crosses itself`);
  if (!isSimple(cut)) out.push(`${pc.name}: cutting line crosses itself`);
  return out;
}

const failing = (pieces: Piece[], waist?: number) => checkPattern(pieces, { finishedWaist: waist }).filter((c) => !c.ok).map((c) => `${c.label} (${c.detail})`);
const named = (pcs: Piece[], name: string) => pcs.find((pc) => pc.name === name)!;
const notchesNear = (pc: Piece, q: P) => pc.notches.some(([n]) => len(sub(n, q)) < 0.05);

describe('in-seam pockets', () => {
  it('add a bag cut four times, its seam edge on the side seam and notched with it', () => {
    const d = draftSkirt(m, { silhouette: 'a_line', pockets: 'inseam' });
    expect(d.pieces.map((pc) => pc.name)).toEqual(['Skirt front', 'Skirt back', 'Pocket bag']);
    const [front, back, bag] = d.pieces;
    expect(bag.kind).toBe('pocket');
    expect(bag.cut).toBe('Cut 4 (2 pairs)');
    expect(bag.grain).toBeDefined();
    expect(d.pocket).toEqual([INSEAM.top, INSEAM.top + INSEAM.opening]);
    // The opening notches on the front, the back and the bag are the same distance down the seam.
    for (const at of d.pocket!) {
      const q = seamPoint(front, 'side', at)!.q;
      expect(notchesNear(front, q)).toBe(true);
      expect(notchesNear(back, seamPoint(back, 'side', at)!.q)).toBe(true);
      expect(notchesNear(bag, q)).toBe(true);
    }
    expect(bag.labels.map((l) => l.text)).toEqual(expect.arrayContaining(['POCKET BAG', 'Cut 4 (2 pairs)', 'POCKET']));
    expect(failing(d.pieces, d.finishedWaist)).toEqual([]);
    expect(checkPattern(d.pieces).map((c) => c.label)).toContain('Pocket bag to the side seam');
    // The garment's own seams are untouched.
    const plain = draftSkirt(m, { silhouette: 'a_line' });
    expect(taggedLength(front.outline, 'side')).toBeCloseTo(taggedLength(plain.pieces[0].outline, 'side'), 6);
  });

  it('lays four bags in the cutting layout and adds a little fabric', () => {
    const plain = draftSkirt(m, { silhouette: 'straight' });
    const d = draftSkirt(m, { silhouette: 'straight', pockets: 'inseam' });
    const lay = layPlans([...d.pieces, waistbandPiece(d, 1.5)], 140)[0];
    // Folded fabric: two placements of the bag, each cutting a pair.
    expect(lay.placements.filter((pl) => pl.name === 'Pocket bag')).toHaveLength(2);
    expect(lay.metres).toBeGreaterThanOrEqual(layPlans([...plain.pieces, waistbandPiece(plain, 1.5)], 140)[0].metres);
  });

  it('shorten to fit a short skirt, and are left off one too short for a hand', () => {
    const short = draftSkirt(m, { silhouette: 'straight', lengthCm: 30, pockets: 'inseam' });
    const bag = named(short.pieces, 'Pocket bag');
    const bottom = Math.max(...bag.outline.points().map((q) => q.y));
    expect(bottom).toBeLessThan(30 - 4);
    expect(short.pocket![1] - short.pocket![0]).toBeGreaterThanOrEqual(10);
    expect(draftSkirt(m, { silhouette: 'straight', lengthCm: 27, pockets: 'inseam' }).pocket).toBeUndefined();
  });

  it('go in a dress skirt and its sewing steps', () => {
    const body = { ...randomBody(rng(5)) };
    const d = draftDress(body, { fit: 'regular' }, { fit: 'regular', silhouette: 'a_line', length: 'knee', pockets: 'inseam' });
    expect(d.pieces.some((pc) => pc.name === 'Pocket bag')).toBe(true);
    expect(failing(d.pieces, d.finishedWaist)).toEqual([]);
    const g = dressGuide(d, { silhouette: 'a_line', length: 'knee' }, 2.4, 1);
    const titles = g.steps.map((s) => s.title);
    expect(titles).toContain('Sew on the pocket bags');
    expect(titles.indexOf('Sew on the pocket bags')).toBeLessThan(titles.indexOf('Sew the side seams'));
    expect(g.steps.find((s) => s.title === 'Sew the side seams')!.text).toMatch(/pocket/);
  });

  it('pass every check on 300 random bodies, every skirt shape, with and without an elastic waist', () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= 300; seed++) {
      const body = randomBody(rng(seed + 31000));
      const silhouette = SILS[seed % 6];
      const length = (['mini', 'knee', 'midi', 'maxi'] as const)[(seed >> 1) % 4];
      const fit = (['fitted', 'regular', 'relaxed'] as const)[seed % 3];
      for (const waist of ['band', 'elastic'] as const) {
        let d;
        try {
          d = draftSkirt(body, { silhouette, length, fit, waist, pockets: 'inseam' });
        } catch (e) {
          if (e instanceof DraftError && (silhouette === 'trumpet' || (silhouette === 'pencil' && waist === 'elastic'))) continue;
          throw e;
        }
        const tag = `seed ${seed} ${silhouette} ${length} ${fit} ${waist}`;
        for (const pc of d.pieces) problems(pc).forEach((p) => failures.push(`${tag}: ${p}`));
        failing(d.pieces, d.finishedWaist).forEach((f) => failures.push(`${tag}: ${f}`));
        if (length !== 'mini' && !d.pocket) failures.push(`${tag}: no pocket`);
      }
    }
    expect(failures.slice(0, 10)).toEqual([]);
  });
});

describe('elastic waists', () => {
  it('cut the skirt waist to pass the hips, with no darts or zip, the back on the fold', () => {
    const d = draftSkirt(m, { silhouette: 'a_line', waist: 'elastic' });
    expect(d.finishedWaist).toBeGreaterThanOrEqual(m.full_hip + 6);
    expect(d.finishedWaist).toBe(d.finishedHip);
    expect(d.dartsPerSide).toEqual({ front: 0, back: 0 });
    expect(d.zipCm).toBe(0);
    expect(d.pieces[1].cut).toBe('Cut 1 on fold');
    expect(d.pieces[1].labels.some((l) => l.text === 'ZIP ENDS')).toBe(false);
    const waistSeam = 2 * (taggedLength(d.pieces[0].outline, 'waist') + taggedLength(d.pieces[1].outline, 'waist'));
    expect(waistSeam).toBeGreaterThan(m.full_hip);
    expect(failing(d.pieces, d.finishedWaist)).toEqual([]);
  });

  it('use elastic the waist less 6 cm, plus 2 cm to overlap, unless the hips need it longer', () => {
    expect(elasticFor(70, 103)).toEqual({ widthCm: 2.5, finishedCm: 64, cutCm: 66, forHips: false });
    const curvy = elasticFor(60, 120);
    expect(curvy.finishedCm).toBeCloseTo(120 / 1.8, 0);
    expect(curvy.forHips).toBe(true);
    expect(draftSkirt(m, { waist: 'elastic' }).elastic?.cutCm).toBe(66);
  });

  it('refuse a pencil skirt, and leave a dress skirt joined to its bodice', () => {
    expect(() => draftSkirt(m, { silhouette: 'pencil', waist: 'elastic' })).toThrow(DraftError);
    const body = randomBody(rng(8));
    const d = draftDress(body, {}, { silhouette: 'a_line', waist: 'elastic' });
    expect(d.skirt.elastic).toBeUndefined();
    expect(d.skirt.zipCm).toBeGreaterThan(0);
  });

  it('make a casing waistband the length of the waist, and its own sewing steps', () => {
    const d = draftSkirt(m, { silhouette: 'a_line', waist: 'elastic', pockets: 'inseam' });
    const band = waistbandPiece(d, 1.5);
    expect(band.meta.lengthCm).toBeCloseTo(d.finishedWaist, 1);
    expect(band.labels.some((l) => l.text === 'ELASTIC CASING')).toBe(true);
    expect(band.fabric).toBeUndefined();
    const g = sewingGuide(d, { silhouette: 'a_line', length: 'knee' }, 1.4);
    const titles = g.steps.map((s) => s.title);
    expect(titles).not.toContain('Put in the zip');
    expect(titles).not.toContain('Interface the waistband');
    expect(titles).toContain('Thread the elastic');
    expect(titles).toContain('Sew on the pocket bags');
    expect(g.notions.join(' ')).toMatch(/66 cm of 2.5 cm wide elastic/);
    expect(g.notions.join(' ')).not.toMatch(/zip|Hook/);
    for (const s of g.steps) expect(s.text).toMatch(/^[\x20-\x7e]*$/);
    // The couture route sews the same skirt.
    const c = toCouture(g, { garment: 'skirt', cloth: 'silk', lined: false, traced: true, zipCm: 0 });
    const ct = c.steps.map((s) => s.title);
    expect(ct).toContain('Thread the elastic');
    expect(ct).not.toContain('Hand-pick the zip');
    expect(c.steps.find((s) => s.title === 'Sew the side seams')!.text).toMatch(/pocket/);
    expect(c.notions.join(' ')).not.toMatch(/zip/);
    expect(skirtSpec(m, d).map((r) => r.label)).toContain('Elastic, 2.5 cm wide');
    const flat = skirtFlat(d);
    expect(flat.views[0].lines.some((l) => l.kind === 'stitch')).toBe(true);
  });
});

describe('trouser pockets and elastic waists', () => {
  it('cut slant pockets from the front, with a lining and a facing that make it whole again', () => {
    const plain = draftTrousers(EX);
    const d = draftTrousers(EX, { pockets: 'slant' });
    expect(d.pockets).toBe('slant');
    expect(d.pieces.map((pc) => pc.name)).toEqual(['Trousers front', 'Trousers back', 'Fly facing', 'Fly shield', 'Pocket lining', 'Pocket facing']);
    const front = d.pieces[0];
    const facing = named(d.pieces, 'Pocket facing');
    const lining = named(d.pieces, 'Pocket lining');
    // The front plus its facing has the plain front's waist and side seam.
    for (const tag of ['waist', 'side'])
      expect(taggedLength(front.outline, tag) + taggedLength(facing.outline, tag)).toBeCloseTo(taggedLength(plain.pieces[0].outline, tag), 1);
    expect(taggedLength(lining.outline, 'pocket-edge')).toBeCloseTo(taggedLength(front.outline, 'pocket-edge'), 3);
    expect(taggedLength(front.outline, 'pocket-edge')).toBeGreaterThan(15);
    const labels = checkPattern(d.pieces, { finishedWaist: d.finishedWaist }).map((c) => c.label);
    expect(labels).toEqual(expect.arrayContaining(['Pocket lining to the pocket opening', 'Pocket facing to the side seam', 'Side seams']));
    expect(failing(d.pieces, d.finishedWaist)).toEqual([]);
    // The waistband still spans the whole waist.
    expect(trousersWaistband(d, 1.5).meta.lengthCm).toBeCloseTo(trousersWaistband(plain, 1.5).meta.lengthCm as number, 1);
  });

  it('put an in-seam pocket on the right only beside a side zip, and no slant pocket', () => {
    const side = draftTrousers(EX, { closure: 'side_zip', pockets: 'inseam' });
    expect(side.pocketSides).toBe('right');
    expect(named(side.pieces, 'Pocket bag').cut).toBe('Cut 2 (1 pair)');
    expect(side.pieces[0].labels.some((l) => l.text === 'RIGHT POCKET')).toBe(true);
    expect(draftTrousers(EX, { closure: 'side_zip', pockets: 'slant' }).pockets).toBe('none');
  });

  it('pull on with an elastic waist: no zip or darts, the waist past the hips', () => {
    const d = draftTrousers(EX, { waist: 'elastic', pockets: 'slant' });
    expect(d.closure).toBe('none');
    expect(d.zipCm).toBe(0);
    expect(d.dartsPerSide).toEqual({ front: 0, back: 0 });
    expect(d.pieces.some((pc) => /Fly/.test(pc.name))).toBe(false);
    expect(d.finishedWaist).toBeGreaterThanOrEqual(EX.full_hip + 6);
    expect(d.elastic!.cutCm).toBe(EX.waist - 6 + 2);
    const band = trousersWaistband(d, 1.5);
    expect(band.meta.casing).toBe(true);
    expect(failing(d.pieces, d.finishedWaist)).toEqual([]);
    const g = trousersGuide(d, 2);
    const titles = g.steps.map((s) => s.title);
    expect(titles).toEqual(expect.arrayContaining(['Make the slant pockets', 'Thread the elastic']));
    expect(titles.some((t) => /zip/.test(t))).toBe(false);
    for (const s of g.steps) expect(s.text).toMatch(/^[\x20-\x7e]*$/);
    expect(new Set(titles).size).toBe(titles.length);
    expect(g.notions.join(' ')).toMatch(/72 cm of 2.5 cm wide elastic/);
    expect(trousersSpec(EX, d).some((r) => /zip/i.test(r.label))).toBe(false);
    expect(trousersFlat(d, EX).views[0].lines.length).toBeGreaterThan(trousersFlat(draftTrousers(EX, { waist: 'elastic' }), EX).views[0].lines.length);
  });

  it('pass every check for random bodies in every leg, pocket, opening and waist', () => {
    const failures: string[] = [];
    const r = rng(4242);
    for (let i = 0; i < 30; i++) {
      const b = randomBody(r);
      const tm: TrousersMeasurements = { ...b, ...randomCrotch(b, r) };
      for (const pockets of ['inseam', 'slant'] as const)
        for (const [closure, waist] of [['fly', 'band'], ['side_zip', 'band'], ['fly', 'elastic']] as const) {
          const leg = LEGS[Math.floor(r() * 4)];
          const fit = (['fitted', 'regular', 'relaxed'] as const)[Math.floor(r() * 3)];
          const tag = `${i} ${leg} ${fit} ${pockets} ${closure} ${waist}`;
          const d = draftTrousers(tm, { leg, fit, closure, waist, pockets });
          if (d.pockets === 'none' && !(pockets === 'slant' && closure === 'side_zip')) failures.push(`${tag}: pocket left off`);
          for (const pc of d.pieces) problems(pc).forEach((p) => failures.push(`${tag}: ${p}`));
          failing(d.pieces, d.finishedWaist).forEach((f) => failures.push(`${tag}: ${f}`));
          const g = trousersGuide(d, 2);
          if (new Set(g.steps.map((s) => s.title)).size !== g.steps.length) failures.push(`${tag}: a step twice`);
        }
    }
    expect(failures.slice(0, 10)).toEqual([]);
  });
});

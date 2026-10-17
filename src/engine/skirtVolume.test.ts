import { describe, expect, it } from 'vitest';
import { taggedLength } from './geometry';
import { checkPattern } from './qc';
import { randomArms, randomBody, rng } from './randomBodies';
import { DraftError, Fit, Length, Silhouette, draftSkirt } from './skirt';
import { draftDress } from './dress';
import { dressGuide, hasSlit, sewingGuide } from './instructions';
import { toCouture } from './couture';
import { dressFlat, skirtFlat } from './flat';
import { skirtSpec } from './spec';
import { layPlan } from './layplan';
import { validCut } from './slip';
import { waistPieces, waistbandPiece } from './finishing';
import { drillHoles, dartsOf } from './marks';
import { skirtFabrics, checkFabric } from './fabrics';
import { GodetCount, VolumeKind, layoutExtras, setVolume, volumeAllowed, volumeOf } from './skirtVolume';
import { describe as describeSkirt } from '../screens/StyleScreen';
import { describePattern } from '../screens/describe';
import type { SewingGuide } from './instructions';

const m = { waist: 70, full_hip: 96, waist_to_hip: 20.5, waist_to_knee: 58, waist_to_floor: 104 };
const FITS: Fit[] = ['fitted', 'regular', 'relaxed'];
const BLOCKS: Silhouette[] = ['straight', 'pencil', 'a_line'];
const LENGTHS: Length[] = ['mini', 'above_knee', 'knee', 'midi', 'maxi'];
const KINDS: VolumeKind[] = ['knife', 'box', 'inverted', 'godets', 'hem_flounce', 'tiers'];
const style = (kind: VolumeKind, godets: GodetCount = 6) => setVolume({}, kind, godets);
const titles = (g: SewingGuide) => g.steps.map((s) => s.title);

/** Plain ASCII (the PDF's font), no double full stops, and no step twice. */
function sound(g: SewingGuide): string[] {
  const out: string[] = [];
  for (const s of g.steps) {
    if (/[^\x20-\x7e]/.test(s.title + s.text)) out.push(`${s.title}: not plain ASCII`);
    if (/\.\.|undefined|NaN/.test(s.text)) out.push(`${s.title}: ${s.text.slice(0, 80)}`);
  }
  if (new Set(titles(g)).size !== g.steps.length) out.push(`a step appears twice: ${titles(g).join(', ')}`);
  return out;
}

describe('skirt volume', () => {
  it('drafts knife pleats from the block: darts into the pleats, the waist unchanged, folds and placement lines marked', () => {
    const plain = draftSkirt(m, { silhouette: 'straight', length: 'knee' });
    const d = draftSkirt(m, { silhouette: 'straight', length: 'knee', pleats: 'knife' });
    expect(d.volume?.kind).toBe('knife');
    expect(d.finishedWaist).toBe(plain.finishedWaist);
    expect(d.waistband).toEqual(plain.waistband);
    expect(d.dartsPerSide).toEqual({ front: 0, back: 0 });
    // The waist seam, pleats closed, is the block's to the millimetre, front and back.
    for (const i of [0, 1]) expect(Math.abs(taggedLength(d.pieces[i].outline, 'waist') - taggedLength(plain.pieces[i].outline, 'waist'))).toBeLessThan(0.01);
    const p = d.volume!.pleats!;
    expect(p.face).toBeGreaterThanOrEqual(4);
    expect(p.face).toBeLessThanOrEqual(6.5);
    expect(p.depth).toBeGreaterThanOrEqual(2.5);
    expect(p.depth).toBeLessThanOrEqual(4);
    expect(p.openHem).toBeGreaterThan(2 * d.finishedHip);
    // No darts: every line is a fold, a stitching line or an arrow, never three points.
    for (const pc of d.pieces) expect(dartsOf(pc)).toHaveLength(0);
    expect(d.pieces[0].balance!.filter((b) => b.label === 'PLACEMENT').length).toBeGreaterThan(2);
    expect(d.block).toHaveLength(2);
    expect(checkPattern(d.pieces, { finishedWaist: d.finishedWaist }).filter((c) => !c.ok)).toEqual([]);
    expect(hasSlit({ silhouette: 'straight', length: 'midi', pleats: 'knife' })).toBe(false);
  });

  it('keeps the darts with inverted pleats, one on the front fold and one below the zip', () => {
    const d = draftSkirt(m, { silhouette: 'straight', length: 'midi', pleats: 'inverted' });
    const plain = draftSkirt(m, { silhouette: 'straight', length: 'midi' });
    expect(d.dartsPerSide).toEqual(plain.dartsPerSide);
    expect(d.volume?.inverted?.backFrom).toBeGreaterThan(plain.zipCm);
    expect(Math.min(...d.pieces[0].outline.points().map((q) => q.x))).toBeLessThan(-7);
    expect(d.pieces[0].fold![0].x).toBeLessThan(-7);
    expect(checkPattern(d.pieces, { finishedWaist: d.finishedWaist }).filter((c) => !c.ok)).toEqual([]);
  });

  it('cuts godets as sectors to the length of their slashes, the points drilled', () => {
    for (const n of [4, 6, 8] as const) {
      const d = draftSkirt(m, { silhouette: 'a_line', length: 'midi', godets: n });
      const g = d.pieces.find((pc) => pc.name === 'Skirt godet')!;
      expect(g.cut).toBe(`Cut ${n}`);
      expect(d.volume?.godets?.count).toBe(n);
      expect(drillHoles(d.pieces[0]).length).toBeGreaterThan(dartsOf(d.pieces[0]).length);
      expect(d.hemCm).toBeGreaterThan(draftSkirt(m, { silhouette: 'a_line', length: 'midi' }).hemCm);
      const checks = checkPattern(d.pieces, { finishedWaist: d.finishedWaist });
      expect(checks.map((c) => c.label)).toContain('Godets to their slashes');
      expect(checks.filter((c) => !c.ok)).toEqual([]);
      // Every godet is laid out for cutting.
      expect(layoutExtras(d).filter((pc) => pc.name === 'Skirt godet').length).toBe(n / 2);
    }
  });

  it('sews a circular flounce to the shortened skirt, its seam edge exactly the skirt hem', () => {
    const d = draftSkirt(m, { silhouette: 'pencil', length: 'midi', flounce: 'hem_flounce' });
    expect(d.pieces.map((pc) => pc.name)).toEqual(['Skirt front', 'Skirt back', 'Flounce front', 'Flounce back']);
    const plain = draftSkirt(m, { silhouette: 'pencil', length: 'midi' });
    expect(d.lengthCm).toBe(plain.lengthCm);
    for (const side of [0, 1]) expect(Math.abs(taggedLength(d.pieces[side].outline, 'flounce') - taggedLength(d.pieces[side + 2].outline, 'flounce'))).toBeLessThan(0.01);
    const checks = checkPattern(d.pieces, { finishedWaist: d.finishedWaist });
    expect(checks.map((c) => c.label)).toEqual(expect.arrayContaining(['Flounce front to skirt front', 'Flounce back to skirt back']));
    expect(checks.filter((c) => !c.ok)).toEqual([]);
  });

  it('gathers two or three tiers below a yoke, each wider than the one above, given as measurements', () => {
    const knee = draftSkirt(m, { silhouette: 'straight', length: 'knee', flounce: 'tiers' });
    const maxi = draftSkirt(m, { silhouette: 'straight', length: 'maxi', flounce: 'tiers' });
    expect(knee.volume?.tiers?.bands).toHaveLength(2);
    expect(maxi.volume?.tiers?.bands).toHaveLength(3);
    for (const d of [knee, maxi]) {
      const bands = d.volume!.tiers!.bands;
      bands.forEach((b, i) => {
        expect(b.ratio).toBeGreaterThanOrEqual(1.5);
        expect(b.ratio).toBeLessThanOrEqual(2);
        if (i) expect(b.gatheredTo).toBeCloseTo(bands[i - 1].round, 0);
        expect(b.panels % 2).toBe(0);
      });
      const yoke = d.volume!.tiers!.yoke;
      expect(Math.abs(yoke + bands.reduce((t, b) => t + b.depth, 0) - d.lengthCm)).toBeLessThan(0.3);
      expect(yoke).toBeGreaterThan(d.zipCm);
      expect(checkPattern(d.pieces, { finishedWaist: d.finishedWaist }).filter((c) => !c.ok)).toEqual([]);
      expect(layPlan([...d.pieces, ...layoutExtras(d), waistbandPiece(d, 1.5)], 140)).toBeDefined();
    }
  });

  it('falls back to a plain skirt where the detail does not suit the shape or length', () => {
    expect(volumeAllowed({ silhouette: 'circle', length: 'knee' }, 'knife')).toBe(false);
    expect(volumeAllowed({ silhouette: 'a_line', length: 'mini' }, 'godets')).toBe(false);
    expect(volumeOf({ silhouette: 'trumpet', length: 'midi', pleats: 'box' })).toBe('none');
    const circle = draftSkirt(m, { silhouette: 'circle', length: 'knee', pleats: 'knife' });
    expect(circle.volume).toBeUndefined();
    const mini = draftSkirt(m, { silhouette: 'a_line', length: 'mini', godets: 8 });
    expect(mini.volume).toBeUndefined();
    // One detail at a time: setting one clears the others.
    expect(setVolume({ pleats: 'knife' as const, godets: 6 as const }, 'hem_flounce')).toEqual({ flounce: 'hem_flounce' });
  });

  it('keeps a bias slip and a diagonal hem plain, and allows only godets under a high-low hem', () => {
    for (const kind of KINDS) {
      expect(volumeAllowed({ silhouette: 'slip', length: 'midi' }, kind)).toBe(false);
      expect(volumeAllowed({ silhouette: 'a_line', length: 'midi', asymHem: 'diagonal' }, kind)).toBe(false);
      expect(volumeAllowed({ silhouette: 'a_line', length: 'midi', asymHem: 'high_low' }, kind)).toBe(kind === 'godets');
    }
    const slip = draftSkirt(m, { silhouette: 'slip', length: 'midi', pleats: 'knife' });
    expect(slip.volume).toBeUndefined();
    expect(slip.bias).toBe(true);
    const diagonal = draftSkirt(m, { silhouette: 'a_line', length: 'midi', asymHem: 'diagonal', flounce: 'tiers' });
    expect(diagonal.volume).toBeUndefined();
    expect(diagonal.asym?.kind).toBe('diagonal');
    const pleatedHighLow = draftSkirt(m, { silhouette: 'straight', length: 'midi', asymHem: 'high_low', pleats: 'box' });
    expect(pleatedHighLow.volume).toBeUndefined();
    expect(pleatedHighLow.asym?.kind).toBe('high_low');
    // Godets follow a high-low hem: every slash is the same length, its point clear of the hip line.
    const g = draftSkirt(m, { silhouette: 'a_line', length: 'midi', asymHem: 'high_low', godets: 8 });
    expect(g.volume?.kind).toBe('godets');
    expect(g.asym?.kind).toBe('high_low');
    const slashes = g.volume!.slashes!.flat();
    expect(slashes).toHaveLength(4);
    const lengths = slashes.map(([top, hem]) => Math.hypot(hem.x - top.x, hem.y - top.y));
    for (const l of lengths) expect(l).toBeCloseTo(lengths[0], 1);
    for (const [top] of slashes) expect(top.y).toBeGreaterThan(m.waist_to_hip + 5.9);
    expect(checkPattern(g.pieces, { finishedWaist: g.finishedWaist }).filter((c) => !c.ok)).toEqual([]);
    expect(describeSkirt({ fit: 'regular', silhouette: 'a_line', length: 'midi', asymHem: 'high_low', godets: 8 })).toBe('Midi a-line skirt with 8 godets and a high-low hem');
    expect(describeSkirt({ fit: 'regular', silhouette: 'a_line', length: 'midi', asymHem: 'high_low', pleats: 'knife' })).toBe('Midi a-line skirt with a high-low hem');
    const dress = describePattern({ garment: 'dress', fit: 'regular', bodice: { garment: 'bodice', fit: 'regular', neckline: 'scoop', length: 'waist', darts: 'bust_waist' }, skirt: { fit: 'regular', silhouette: 'a_line', length: 'midi', asymHem: 'high_low', godets: 6 } });
    expect(dress).toBe('Midi a-line dress with 6 godets, a scoop neck, and a high-low hem');
  });

  it('passes every check for 12 random bodies with every detail on a slip, a high-low and a diagonal hem', () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= 12; seed++) {
      const body = randomBody(rng(seed + 9400));
      for (const fit of FITS)
        for (const silhouette of [...BLOCKS, 'slip'] as Silhouette[])
          for (const asymHem of ['none', 'high_low', 'diagonal'] as const)
            for (const kind of KINDS) {
              if (silhouette !== 'slip' && asymHem === 'none') continue; // covered above
              const length = (['knee', 'midi', 'maxi', 'above_knee'] as const)[(seed + KINDS.indexOf(kind)) % 4];
              const st = { fit, silhouette, length, asymHem, ...style(kind, ([4, 6, 8] as const)[seed % 3]) };
              let d;
              try {
                d = draftSkirt(body, st);
              } catch (e) {
                if (e instanceof DraftError) continue;
                throw e;
              }
              const tag = `seed ${seed} ${fit} ${silhouette} ${length} ${asymHem} ${kind}`;
              // A diagonal hem falls back to level where it can't be cut (a pencil, or a walking slit).
              const ok = volumeAllowed(validCut(st), kind);
              const wanted = ok && kind !== 'godets';
              if (d.volume && !ok) failures.push(`${tag}: drafted a detail it should not take`);
              if (wanted && !d.volume) failures.push(`${tag}: no ${kind}`);
              for (const c of checkPattern(d.pieces, { finishedWaist: d.finishedWaist })) if (!c.ok) failures.push(`${tag}: ${c.label} (${c.detail})`);
              // The plain slips and diagonal hems are laid out in their own tests.
              const all = [...d.pieces, ...layoutExtras(d), ...waistPieces(d, 1.5)];
              if (d.volume && !layPlan(all, 140)) failures.push(`${tag}: does not lay out`);
            }
    }
    expect(failures.slice(0, 10)).toEqual([]);
  });

  it('names each style, and advises fabric for it', () => {
    expect(describeSkirt({ fit: 'regular', silhouette: 'a_line', length: 'knee', pleats: 'knife' })).toBe('Knee a-line skirt with knife pleats');
    expect(describeSkirt({ fit: 'regular', silhouette: 'straight', length: 'midi', godets: 8 })).toBe('Midi straight skirt with 8 godets');
    expect(describeSkirt({ fit: 'regular', silhouette: 'circle', length: 'midi', pleats: 'box' })).toBe('Midi full circle skirt');
    const dress = describePattern({ garment: 'dress', fit: 'regular', bodice: { garment: 'bodice', fit: 'regular', neckline: 'scoop', length: 'waist', darts: 'bust_waist' }, skirt: { fit: 'regular', silhouette: 'a_line', length: 'knee', flounce: 'hem_flounce' } });
    expect(dress).toBe('Knee a-line dress with a hem flounce, a scoop neck');
    const pleats = skirtFabrics({ silhouette: 'straight', length: 'knee', pleats: 'knife' });
    expect(pleats.style).toBe('a knee-length straight skirt with knife pleats');
    expect(pleats.picks.every((p) => p.drape === 'crisp')).toBe(true);
    expect(checkFabric({ garment: 'skirt', silhouette: 'straight', length: 'knee', pleats: 'box' }, { drape: 'fluid', weight: 'light' }).some((n) => /crease/.test(n.text))).toBe(true);
    expect(skirtFabrics({ silhouette: 'a_line', length: 'midi', flounce: 'tiers' }).picks.every((p) => p.weight[0] === 'light')).toBe(true);
  });

  it('writes the sewing steps for each detail, quick and couture, skirt and dress', () => {
    const r = rng(41);
    const body = { ...randomBody(r), ...randomArms(randomBody(r), r) };
    const problems: string[] = [];
    for (const kind of KINDS) {
      const st = { silhouette: 'a_line' as const, length: 'midi' as const, ...style(kind) };
      const d = draftSkirt(body, st);
      const g = sewingGuide(d, st, 2);
      problems.push(...sound(g).map((x) => `${kind}: ${x}`));
      problems.push(...sound(toCouture(g, { garment: 'skirt', cloth: 'wool', lined: false, traced: true, zipCm: d.zipCm })).map((x) => `${kind} couture: ${x}`));
      const t = titles(g);
      if (kind === 'knife' || kind === 'box') {
        expect(t.indexOf('Hem the skirt')).toBeLessThan(t.indexOf('Fold and press the pleats'));
        expect(t.indexOf('Stitch the pleats down')).toBeLessThan(t.indexOf('Attach the waistband'));
        expect(t).not.toContain('Hem');
      }
      if (kind === 'godets') expect(t.indexOf('Set in the godets')).toBeLessThan(t.indexOf('Hem'));
      if (kind === 'hem_flounce') expect(t.indexOf('Sew on the flounce')).toBeLessThan(t.indexOf('Hem'));
      if (kind === 'tiers') expect(t).toEqual(expect.arrayContaining(['Cut the tiers', 'Gather the tiers', 'Sew on the tiers']));
      if (kind === 'inverted') expect(t).toContain('Make the front pleat');
      const dd = draftDress(body, { fit: 'regular' }, { fit: 'regular', ...st });
      const dg = dressGuide(dd, st, 2.5, 0.8);
      problems.push(...sound(dg).map((x) => `${kind} dress: ${x}`));
      problems.push(...sound(toCouture(dg, { garment: 'dress', cloth: 'silk', lined: false, traced: false, zipCm: dd.zipCm })).map((x) => `${kind} dress couture: ${x}`));
      const dt = titles(dg);
      if (kind === 'knife' || kind === 'box') expect(dt.indexOf('Stitch the pleats down')).toBeLessThan(dt.indexOf('Join the bodice to the skirt'));
      if (kind === 'inverted') expect(dt.indexOf('Make the front pleat')).toBeLessThan(dt.indexOf('Join the bodice to the skirt'));
      // The flat and the spec table.
      const flat = skirtFlat(d);
      expect(flat.views).toHaveLength(2);
      for (const v of [...flat.views, ...dressFlat(dd).views]) for (const q of [...v.shapes.flat(), ...v.lines.flatMap((l) => l.pts)]) expect(Number.isFinite(q.x + q.y)).toBe(true);
      expect(skirtSpec(body, d).length).toBeGreaterThan(skirtSpec(body, draftSkirt(body, { silhouette: 'a_line', length: 'midi' })).length);
    }
    expect(problems).toEqual([]);
  });

  it('passes every check for 120 random bodies, every detail, block shape, length and fit', () => {
    const failures: string[] = [];
    let drafted = 0;
    for (let seed = 1; seed <= 120; seed++) {
      const body = randomBody(rng(seed + 9100));
      for (const fit of FITS)
        for (const silhouette of BLOCKS)
          for (const kind of KINDS) {
            const length = LENGTHS[(seed + KINDS.indexOf(kind) + BLOCKS.indexOf(silhouette)) % LENGTHS.length];
            const st = { fit, silhouette, length, ...style(kind, ([4, 6, 8] as const)[seed % 3]) };
            let d;
            try {
              d = draftSkirt(body, st);
            } catch (e) {
              if (e instanceof DraftError) continue;
              throw e;
            }
            drafted++;
            const tag = `seed ${seed} ${fit} ${silhouette} ${length} ${kind}`;
            if (volumeAllowed(st, kind) && !d.volume && !(kind === 'godets' || kind === 'tiers' || kind === 'hem_flounce')) failures.push(`${tag}: no ${kind}`);
            for (const c of checkPattern(d.pieces, { finishedWaist: d.finishedWaist })) if (!c.ok) failures.push(`${tag}: ${c.label} (${c.detail})`);
            // Every piece cuts from 140 cm fabric: folded, or opened out.
            if (!layPlan([...d.pieces, ...layoutExtras(d), waistbandPiece(d, 1.5)], 140)) failures.push(`${tag}: does not lay out on 140 cm fabric`);
          }
    }
    expect(failures.slice(0, 10)).toEqual([]);
    expect(drafted).toBeGreaterThan(5000);
  });

  it('passes every check on the dress for 50 random bodies with every detail', () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= 50; seed++) {
      const body = randomBody(rng(seed + 9700));
      for (const silhouette of BLOCKS)
        for (const kind of KINDS) {
          const fit = FITS[(seed + KINDS.indexOf(kind)) % 3];
          const length = (['knee', 'midi', 'maxi'] as const)[seed % 3];
          let d;
          try {
            d = draftDress(body, { fit }, { fit, silhouette, length, ...(seed % 4 === 0 ? { asymHem: 'high_low' as const } : {}), ...style(kind) });
          } catch (e) {
            if (e instanceof DraftError) continue;
            throw e;
          }
          const want = seed % 4 !== 0 || kind === 'godets';
          if (want && !d.skirt.volume) failures.push(`${seed} ${silhouette} ${kind}: no detail`);
          if (!want && d.skirt.volume) failures.push(`${seed} ${silhouette} ${kind}: a detail under a high-low hem`);
          for (const c of checkPattern(d.pieces, { finishedWaist: d.finishedWaist })) if (!c.ok) failures.push(`${seed} ${fit} ${silhouette} ${length} ${kind}: ${c.label} ${c.detail}`);
        }
    }
    expect(failures.slice(0, 10)).toEqual([]);
  });
});

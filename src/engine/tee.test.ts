import { describe, expect, it } from 'vitest';
import { taggedLength } from './geometry';
import { checkPattern } from './qc';
import { randomArms, randomBody, rng } from './randomBodies';
import { DEFAULT_TEE, NECKBAND_RATIO, Stretch, TEE_EASE, TeeFit, TeeLength, TeeNeck, TeeSleeve, draftTee } from './tee';
import { teeGuide } from './teeGuide';
import { teeFlat } from './flat';
import { teeSpec } from './spec';
import { layPlans, layWords } from './layplan';
import { adviceFor, checkFabric } from './fabrics';
import { withKnitFabric } from './knits';
import { toTechPack } from './techpack';
import { DEFAULT_TEE_CHOICES, PatternChoices, describeTee, isTee } from '../garments';
import { describePattern } from '../screens/describe';
import { sameChoices } from '../account';
import { garmentKind } from '../fit';
import { EXAMPLE_VALUES, isComplete } from '../measurements';
import { extrasFor, missingFor } from '../measureFlow';

const EX = { full_bust: 92, waist: 76, full_hip: 102, waist_to_hip: 20.5, neck: 35, shoulder_width: 38, nape_to_waist: 41, armscye: 40, arm_length: 59, upper_arm: 29, wrist: 16 };
const FITS: TeeFit[] = ['fitted', 'regular', 'relaxed'];
const STRETCHES: Stretch[] = ['low', 'medium', 'high'];
const NECKS: TeeNeck[] = ['crew', 'scoop', 'v'];
const SLEEVES: TeeSleeve[] = ['short', 'elbow', 'long'];
const LENGTHS: TeeLength[] = ['cropped', 'hip', 'tunic'];

describe('knit T-shirt', () => {
  it('sets the bust ease from the fit and the stretch: negative for fitted, none for regular medium', () => {
    for (const fit of FITS)
      for (const stretch of STRETCHES) {
        const d = draftTee(EX, { ...DEFAULT_TEE, fit, stretch });
        expect(d.finishedBust).toBeCloseTo(EX.full_bust * (1 + TEE_EASE[fit][stretch]), 0);
      }
    expect(draftTee(EX, { fit: 'fitted', stretch: 'high' }).finishedBust).toBeLessThan(EX.full_bust - 5);
    expect(draftTee(EX, { fit: 'regular', stretch: 'medium' }).finishedBust).toBeCloseTo(EX.full_bust, 0);
    // Stretchier knits get less room at every fit.
    for (const fit of FITS) {
      const [low, med, high] = STRETCHES.map((stretch) => draftTee(EX, { fit, stretch }).finishedBust);
      expect(low).toBeGreaterThan(med);
      expect(med).toBeGreaterThan(high);
    }
  });

  it('cuts the neckband shorter than the neckline by the stretch, on the fold, with its stretch along it', () => {
    for (const stretch of STRETCHES)
      for (const neckline of NECKS) {
        const d = draftTee(EX, { stretch, neckline });
        const band = d.pieces.find((pc) => pc.name === 'Neckband')!;
        expect(band.cut).toMatch(/fold/);
        const length = 2 * taggedLength(band.outline, 'band') / 2;
        expect(length / d.necklineCm).toBeCloseTo(NECKBAND_RATIO[stretch], 2);
        expect(NECKBAND_RATIO[stretch]).toBeGreaterThanOrEqual(0.85);
        expect(NECKBAND_RATIO[stretch]).toBeLessThanOrEqual(0.9);
        // Laid long across the fabric, the grain line running across the band.
        const [a, b] = band.grain!;
        expect(Math.abs(a.x - b.x)).toBeLessThan(0.01);
      }
    const scoop = draftTee(EX, { neckline: 'scoop' });
    expect(scoop.necklineCm).toBeGreaterThan(draftTee(EX, { neckline: 'crew' }).necklineCm + 8);
  });

  it('cuts a crew neck that goes over the head: about 48 cm on an average body, under 25% of stretch for a 56 cm head', () => {
    const HEAD = 56;
    for (const [neck, lo, hi] of [[31.8, 46, 50], [35, 48, 52]] as const) {
      const d = draftTee({ ...EX, neck }, { neckline: 'crew' });
      expect(d.necklineCm).toBeGreaterThanOrEqual(lo);
      expect(d.necklineCm).toBeLessThanOrEqual(hi);
      expect(HEAD / d.necklineCm - 1).toBeLessThanOrEqual(0.25);
      // The band pulls the edge in, but never so far that it has to stretch past the knit's class (medium: 30 to 50%).
      expect(HEAD / d.neckband.length - 1).toBeLessThanOrEqual(0.4);
    }
    // Scoop and V stay larger than the crew, in that order of depth.
    const [crew, scoop, v] = NECKS.map((neckline) => draftTee(EX, { neckline }).necklineCm);
    expect(scoop).toBeGreaterThan(v);
    expect(v).toBeGreaterThan(crew + 8);
  });

  it('has no darts, knit seam allowances, and lengths and sleeves in order', () => {
    const d = draftTee(EX);
    expect(d.pieces.map((pc) => pc.name)).toEqual(['Tee front', 'Tee back', 'Sleeve', 'Neckband']);
    for (const pc of d.pieces) {
      // No darts on an average cup (the fuller bust's small dart is tested below).
      expect(pc.lines.filter((l) => l.points().length >= 3)).toEqual([]);
      expect(pc.seamAllowance).toBe(1);
    }
    expect(d.pieces[0].allowances.hem).toBe(2.5);
    const [crop, hip, tunic] = LENGTHS.map((length) => draftTee(EX, { length }).backLength);
    expect(crop).toBeLessThan(hip - 15);
    expect(tunic).toBeGreaterThan(hip + 10);
    const [short, elbow, long] = SLEEVES.map((sleeve) => draftTee(EX, { sleeve }).sleeve.lengthCm);
    expect(short).toBeLessThan(elbow);
    expect(elbow).toBeLessThan(long);
    expect(long).toBeGreaterThan(EX.arm_length - 1);
  });

  it('passes every check for 120 random bodies, every fit, stretch, neckline, sleeve and length', () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= 120; seed++) {
      const r = rng(seed + 31000);
      const b = randomBody(r);
      const body = { ...b, ...randomArms(b, r), ...(seed % 4 === 0 ? { armscye: undefined } : {}) };
      for (const fit of FITS)
        for (const stretch of STRETCHES) {
          const style = { fit, stretch, neckline: NECKS[(seed + STRETCHES.indexOf(stretch)) % 3], sleeve: SLEEVES[(seed >> 1) % 3], length: LENGTHS[(seed + FITS.indexOf(fit)) % 3] };
          const d = draftTee(body, style);
          const checks = checkPattern(d.pieces);
          for (const c of checks) if (!c.ok) failures.push(`seed ${seed} ${JSON.stringify(style)}: ${c.label} (${c.detail})`);
          const labels = checks.map((c) => c.label);
          if (!labels.includes('Side seams') || !labels.includes('Sleeve crown ease')) failures.push(`seed ${seed}: checks missing`);
        }
    }
    expect(failures.slice(0, 10)).toEqual([]);
  });

  it('makes a guide, flat, spec, knit lay and tech pack, and advises knits only', async () => {
    for (const neckline of NECKS) {
      const d = draftTee(EX, { neckline, sleeve: 'long' });
      const lays = layPlans(d.pieces, 150, false, false, true);
      expect(lays).toHaveLength(1);
      expect(lays[0].metres).toBeGreaterThan(0.9);
      expect(lays[0].metres).toBeLessThan(2.2);
      expect(layWords(lays[0])).toMatch(/along the ribs/);
      const g = withKnitFabric(teeGuide(d, lays[0].metres), { name: 'navy cotton jersey', fibre: 'cotton', weight: 'heavy' });
      const titles = g.steps.map((st) => st.title);
      expect(new Set(titles).size).toBe(titles.length);
      expect(titles[0]).toBe('Prepare your fabric');
      expect(titles).toContain('Sew on the neckband');
      for (const st of g.steps) expect(st.text).toMatch(/^[\x20-\x7e]*$/);
      expect(g.steps.map((st) => st.text).join(' ')).toMatch(/zigzag/);
      expect(g.notions[0]).toMatch(/^[\d.]+ m of navy cotton jersey/);
      expect(g.fabric?.some((l) => /^Ease:/.test(l))).toBe(false);
      const flat = teeFlat(d);
      expect(flat.views).toHaveLength(2);
      expect(flat.width).toBeGreaterThan(80);
      const spec = teeSpec(EX, d);
      expect(spec.find((r) => r.label === 'Bust')?.finished).toBe(d.finishedBust);
      const pdf = await toTechPack({ title: describeTee({ ...DEFAULT_TEE_CHOICES, neckline }), profile: 'Cat', fit: 'regular', date: '2026-10-17', pieces: d.pieces, measurements: spec, notes: [], guide: g });
      expect(pdf.length).toBeGreaterThan(1000);
    }
    const advice = adviceFor({ garment: 'tee', fit: 'fitted', stretch: 'high', neckline: 'crew' });
    expect(advice.picks.every((pk) => /jersey|knit|interlock/i.test(pk.name))).toBe(true);
    expect(advice.avoid).toMatch(/^Woven/);
    expect(checkFabric({ garment: 'tee', fit: 'fitted', stretch: 'high', neckline: 'crew' }, { drape: 'fluid' })[0].level).toBe('warn');
    // The woven garments still rule knits out.
    expect(adviceFor({ garment: 'bodice', fit: 'regular', neckline: 'crew' }).avoid).toMatch(/knits/);
  });

  it('asks only for measurements the bodice and sleeves already use, and keeps older saves loading', () => {
    expect(isComplete(EXAMPLE_VALUES, 'tee')).toBe(true);
    expect(extrasFor('tee').map((f) => f.id).sort()).toEqual(['arm_length', 'nape_to_waist', 'neck', 'shoulder_width', 'upper_arm', 'waist_to_hip']);
    expect(missingFor('tee', EXAMPLE_VALUES)).toEqual([]);
    const tee = { ...DEFAULT_TEE_CHOICES, fit: 'fitted' as const, neckline: 'v' as const, sleeve: 'long' as const };
    expect(describePattern(tee)).toBe('Fitted V-neck T-shirt with long sleeves');
    expect(garmentKind(tee)).toBe('tee');
    // A skirt saved before any garment field, and a bodice, are not mistaken for a tee.
    const oldSkirt = { fit: 'regular', silhouette: 'a_line', length: 'knee' } as PatternChoices;
    const bodice = { garment: 'bodice', fit: 'regular', neckline: 'crew', length: 'waist', darts: 'bust_waist' } as PatternChoices;
    expect(isTee(oldSkirt) || isTee(bodice)).toBe(false);
    expect(sameChoices(oldSkirt, tee)).toBe(false);
    expect(sameChoices(tee, { ...tee })).toBe(true);
    expect(sameChoices(tee, { ...tee, stretch: 'high' })).toBe(false);
  });
});

describe('knit T-shirt bust shaping', () => {
  const BIG = { ...EX, full_bust: 120, high_bust: 108, waist: 100, full_hip: 124 };
  const piecesOf = (d: ReturnType<typeof draftTee>) => [d.pieces[0], d.pieces[1]];
  const lowest = (pc: ReturnType<typeof draftTee>['pieces'][number]) => Math.max(...pc.outline.points().map((q) => q.y));

  it('gives a fuller bust a wider, longer front, keeping the total round the bust', () => {
    for (const fit of FITS)
      for (const length of LENGTHS) {
        const d = draftTee(BIG, { fit, length });
        const [front, back] = piecesOf(d);
        expect(d.frontBust - d.backBust).toBeGreaterThan(4);
        expect(d.finishedBust).toBeCloseTo(BIG.full_bust * (1 + TEE_EASE[fit].medium), 0);
        expect(2 * (d.frontBust + d.backBust)).toBeCloseTo(d.finishedBust, 0);
        // The side seams sew together exactly, and the front's centre hangs lower than the back's.
        expect(Math.abs(taggedLength(front.outline, 'side') - taggedLength(back.outline, 'side'))).toBeLessThan(0.01);
        expect(d.frontExtra).toBeGreaterThan(3);
        expect(d.frontExtra).toBeLessThanOrEqual(5);
        expect(lowest(front) - lowest(back)).toBeCloseTo(d.frontExtra, 0);
        // The front hem is a gentle curve: only a little longer than straight from the side to the centre.
        const segs = front.outline.segs;
        const corner = segs[front.outline.tags.indexOf('hem') - 1].to;
        const centre = segs[front.outline.tags.indexOf('hem')].to;
        const chord = Math.hypot(corner.x - centre.x, corner.y - centre.y);
        const hem = taggedLength(front.outline, 'hem');
        expect(hem).toBeGreaterThanOrEqual(chord - 0.01);
        expect(hem).toBeLessThan(chord + 1);
        // The side corner moves under a cm to keep the side seams matched.
        expect(Math.abs(centre.y - corner.y - d.frontExtra)).toBeLessThan(1);
        expect(checkPattern(d.pieces).filter((c) => !c.ok)).toEqual([]);
      }
    expect(teeGuide(draftTee(BIG), 1.5).steps.find((st) => st.title === 'Hem')!.text).toMatch(/lower at the centre/);
  });

  it('cuts a small cup, a measured flat chest and the menswear form front and back alike', () => {
    const before = { ...EX, high_bust: EX.full_bust };
    const flat = draftTee(before);
    expect(flat.frontBust).toBe(flat.backBust);
    expect(flat.frontExtra).toBe(0);
    // The menswear form: no shaping, however full the bust.
    const mens = draftTee(BIG, { flatFront: true });
    expect(mens.frontBust).toBe(mens.backBust);
    expect(mens.frontExtra).toBe(0);
    expect(teeGuide(mens, 1.5).steps.find((st) => st.title === 'Hem')!.text).not.toMatch(/lower at the centre/);
    // A B cup (5 cm) is close to the unshaped tee: under a cm moved, about a cm of length.
    const small = draftTee({ ...EX, high_bust: EX.full_bust - 5 });
    expect(small.frontBust - small.backBust).toBeLessThan(1.5);
    expect(small.frontExtra).toBeLessThanOrEqual(1);
    expect(small.finishedBust).toBe(flat.finishedBust);
    expect(Math.abs(small.backLength - flat.backLength)).toBeLessThan(0.05);
    // Without a high bust it's estimated from the bust, mildly.
    const guessed = draftTee(EX);
    expect(guessed.frontBust - guessed.backBust).toBeLessThan(1);
  });

  it('keeps matching side seams for random bodies', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const r = rng(seed + 52000);
      const b = randomBody(r);
      const body = { ...b, ...randomArms(b, r) };
      const d = draftTee(body, { fit: FITS[seed % 3], length: LENGTHS[(seed >> 1) % 3] });
      const [front, back] = piecesOf(d);
      expect(Math.abs(taggedLength(front.outline, 'side') - taggedLength(back.outline, 'side'))).toBeLessThan(0.01);
      expect(d.frontBust).toBeGreaterThanOrEqual(d.backBust);
    }
  });
});

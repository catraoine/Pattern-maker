import { describe, expect, it } from 'vitest';
import { BodiceDraft, BodiceStyle, draftBodice } from './bodice';
import { draftDress } from './dress';
import { bodiceFlat } from './flat';
import { bodiceGuide, dressGuide } from './instructions';
import { layPlan } from './layplan';
import { dartsOf } from './marks';
import type { Piece } from './piece';
import { checkPattern } from './qc';
import { randomBody, rng } from './randomBodies';
import { DraftError } from './skirt';
import { DEFAULT_BODICE, bodiceDetails, describeBodice, detailAllowed, seamBlocked, validDetails } from '../garments';

const garment = (pcs: Piece[]) => pcs.filter((pc) => !pc.kind);
const names = (d: { pieces: Piece[] }) => garment(d.pieces).map((pc) => pc.name);

/** Everything that should hold for a bodice with a style seam: it is cut where asked, the seams walk
 * and the notches match, and it lays out on the fabric. */
function problems(d: BodiceDraft, tag: string): string[] {
  const out: string[] = [];
  if (!d.styleSeams?.length) out.push(`${tag} has no style seam: ${d.warnings.join('; ')}`);
  for (const c of checkPattern(garment(d.pieces), { finishedWaist: d.finishedWaist })) if (!c.ok) out.push(`${tag} ${c.label}: ${c.detail}`);
  if (!layPlan(d.pieces, 150)) out.push(`${tag} does not lay out on 150 cm fabric`);
  return out;
}

const STYLES: Partial<BodiceStyle>[] = [
  { yoke: { front: 12, back: 12 } },
  { yoke: { front: 8 } },
  { yoke: { back: 20 } },
  { empire: 5 },
  { empire: 10 },
  { empire: 16 },
  { panel: { at: 0.45 } },
  { panel: { at: 0.75 } },
];
const FITS = [
  { fit: 'fitted', darts: 'bust_waist' },
  { fit: 'regular', darts: 'bust_waist' },
  { fit: 'regular', darts: 'bust' },
  { fit: 'relaxed', darts: 'none' },
] as const;

describe('style seams', () => {
  it('cut, walk and lay out on many bodies, as bodices and dresses', () => {
    const out: string[] = [];
    for (const st of STYLES)
      for (const f of FITS)
        for (let s = 1; s <= 6; s++) {
          const tag = `${JSON.stringify(st)} ${f.fit} ${f.darts} body ${s}`;
          const m = randomBody(rng(s));
          try {
            out.push(...problems(draftBodice(m, { ...f, ...st }), tag));
          } catch (e) {
            if (!(e instanceof DraftError)) throw e;
          }
          if (s > 3) continue;
          try {
            const dr = draftDress(m, { ...f, ...st }, { silhouette: 'a_line', length: 'knee' });
            for (const c of checkPattern(garment(dr.pieces), { finishedWaist: dr.finishedWaist })) if (!c.ok) out.push(`dress ${tag} ${c.label}: ${c.detail}`);
          } catch (e) {
            if (!(e instanceof DraftError)) throw e;
          }
        }
    expect(out).toEqual([]);
  });

  it('a yoke cuts the top off the front and back, with the bust dart in the front yoke seam', () => {
    const m = randomBody(rng(2));
    const d = draftBodice(m, { fit: 'regular', yoke: { front: 12, back: 12 } });
    expect(names(d)).toEqual(['Bodice front', 'Bodice back', 'Bodice front yoke', 'Bodice back yoke']);
    const [front, , fy, by] = d.pieces;
    expect(fy.cut).toMatch(/on fold/);
    expect(by.cut).toMatch(/pair/);
    // The bust dart opens on the yoke seam, above the bust point, and none is left in the side.
    const bust = dartsOf(front).find((dt) => dt.tip.y < d.front.waistCentre.y - 5 && dt.near.y < dt.tip.y);
    expect(bust).toBeDefined();
    expect(Math.abs(bust!.tip.x - d.front.apex.x)).toBeLessThan(3);
    const labels = checkPattern(garment(d.pieces)).map((c) => c.label);
    expect(labels).toContain('Front yoke seam');
    expect(labels).toContain('Back yoke seam');
    // Only a back yoke leaves the front whole.
    expect(names(draftBodice(m, { fit: 'regular', yoke: { back: 14 } }))).toEqual(['Bodice front', 'Bodice back', 'Bodice back yoke']);
  });

  it('an empire seam takes the darts into the upper bodice and a midriff band to the waist', () => {
    const d = draftBodice(randomBody(rng(3)), { fit: 'fitted', empire: 8 });
    expect(names(d)).toEqual(['Bodice front', 'Bodice back', 'Bodice midriff front', 'Bodice midriff back']);
    const [front, back, mf, mb] = d.pieces;
    // The upper bodice's darts open down onto the empire seam; the band's open onto the waist.
    for (const pc of [front, back]) for (const dt of dartsOf(pc)) expect(dt.near.y).toBeGreaterThan(dt.tip.y);
    expect(dartsOf(mf).length).toBe(1);
    expect(dartsOf(mb).length).toBe(1);
    // The front and back seams sit at one height at the side.
    const sideTop = (pc: Piece) => Math.min(...pc.outline.points(8).filter((q) => q.x > 5).map((q) => q.y));
    expect(Math.abs(sideTop(mf) - d.front.waistCentre.y - (sideTop(mb) - d.back.waistCentre.y))).toBeLessThan(1.5);
    expect(checkPattern(garment(d.pieces)).map((c) => c.label)).toContain('Front empire seam');
  });

  it('side panels run from the armhole to the waist, clear of the bust', () => {
    const d = draftBodice(randomBody(rng(4)), { fit: 'regular', panel: { at: 0.6 } });
    expect(names(d)).toEqual(['Bodice centre front', 'Bodice side front', 'Bodice centre back', 'Bodice side back']);
    const seam = d.styleSeams!.find((sm) => sm.side === 'front')!.pts;
    const apex = d.front.apex;
    expect(Math.min(...seam.map((q) => Math.hypot(q.x - apex.x, q.y - apex.y)))).toBeGreaterThan(3);
    // The side fronts carry no darts: the bust dart has gone into the centre front's waist dart.
    expect(dartsOf(d.pieces[1]).length).toBe(0);
    expect(checkPattern(garment(d.pieces)).some((c) => /panel/i.test(c.label))).toBe(true);
  });

  it('give sewing steps for the seam, after the darts', () => {
    const m = randomBody(rng(5));
    const titles = (st: Partial<BodiceStyle>) => bodiceGuide(draftBodice(m, { fit: 'regular', ...st }), { length: 'waist' }, 1, 1).steps.map((s) => s.title);
    const yoke = titles({ yoke: { front: 12, back: 12 } });
    expect(yoke.indexOf('Join the yokes')).toBe(yoke.indexOf('Sew the bust and waist darts') + 1);
    expect(titles({ yoke: { back: 12 } })).toContain('Join the back yokes');
    const empire = titles({ empire: 8 });
    expect(empire.indexOf('Join the midriff band')).toBe(empire.indexOf('Sew the darts') + 1);
    const panel = titles({ panel: { at: 0.6 } });
    expect(panel).toContain('Sew the panel seams');
    expect(panel).not.toContain('Sew the princess seams');
    const yokeDarts = bodiceGuide(draftBodice(m, { fit: 'regular', yoke: { front: 12 } }), { length: 'waist' }, 1, 1).steps.find((s) => /darts$/.test(s.title))!;
    expect(yokeDarts.text).toMatch(/from the yoke edge to the point/);
    const dress = dressGuide(draftDress(m, { fit: 'regular', empire: 8 }, { silhouette: 'a_line', length: 'knee' }), { silhouette: 'a_line', length: 'knee' }, 2, 1).steps.map((s) => s.title);
    expect(dress.indexOf('Join the midriff band')).toBeGreaterThan(-1);
    expect(dress.indexOf('Join the midriff band')).toBeLessThan(dress.indexOf('Join the bodice to the skirt'));
  });

  it('show on the flat as seam lines', () => {
    const m = randomBody(rng(6));
    const seams = (st: Partial<BodiceStyle>) => bodiceFlat(draftBodice(m, { fit: 'regular', ...st })).views.map((v) => v.lines.filter((l) => l.kind === 'seam').length);
    const plain = seams({});
    for (const st of STYLES.slice(0, 1).concat([{ empire: 8 }, { panel: { at: 0.6 } }])) {
      const styled = seams(st);
      expect(styled[0]).toBeGreaterThan(plain[0]);
      expect(styled[1]).toBeGreaterThan(plain[1]);
    }
  });

  it('are left out with princess seams, an uneven shoulder or below the waist', () => {
    const m = randomBody(rng(1));
    expect(draftBodice(m, { fit: 'regular', princess: 'shoulder', empire: 8 }).styleSeams).toBeUndefined();
    const low = draftBodice(m, { fit: 'regular', yoke: { front: 12 }, fitting: { lowShoulder: { side: 'left', cm: 1.2 } } } as Partial<BodiceStyle>);
    expect(low.styleSeams).toBeUndefined();
    expect(low.warnings.join(' ')).toMatch(/yoke/);
    const hip = draftBodice(m, { fit: 'regular', length: 'hip', empire: 8 });
    expect(hip.styleSeams).toBeUndefined();
    expect(hip.warnings.join(' ')).toMatch(/waist-length/);
    // A yoke goes on any length.
    expect(draftBodice(m, { fit: 'regular', length: 'hip', yoke: { front: 12 } }).styleSeams?.length).toBe(1);
  });
});

describe('style seam choices', () => {
  const c = { ...DEFAULT_BODICE };
  it('say why a seam cannot go with the rest', () => {
    expect(seamBlocked(c, 'yoke')).toBeUndefined();
    expect(seamBlocked(c, 'empire')).toBeUndefined();
    expect(seamBlocked({ ...c, princess: 'shoulder' }, 'panel')).toMatch(/princess/);
    expect(seamBlocked({ ...c, neckline: 'cowl' }, 'empire')).toMatch(/draped/);
    expect(seamBlocked({ ...c, neckline: 'strapless' }, 'yoke')).toMatch(/strapless/);
    expect(seamBlocked({ ...c, neckline: 'v' }, 'yoke', 'bodice', 'front')).toMatch(/high neckline/);
    expect(seamBlocked({ ...c, neckline: 'v' }, 'yoke', 'bodice', 'back')).toBeUndefined();
    expect(seamBlocked({ ...c, closure: 'front_buttons' }, 'empire')).toMatch(/button/);
    expect(seamBlocked({ ...c, closure: 'front_buttons' }, 'panel')).toBeUndefined();
    expect(seamBlocked({ ...c, length: 'hip' }, 'panel')).toMatch(/waist-length/);
    expect(seamBlocked({ ...c, length: 'hip' }, 'panel', 'dress')).toBeUndefined();
    expect(seamBlocked({ ...c, peplum: 'flared' }, 'empire')).toMatch(/peplum/);
    expect(seamBlocked({ ...c, bustDart: 'shoulder' }, 'empire')).toMatch(/bust dart/);
    expect(detailAllowed(c, 'empire', 'on')).toBe(true);
    expect(detailAllowed({ ...c, princess: 'armhole' }, 'panel', 'on')).toBe(false);
  });

  it('keep one seam, and only what the rest allows', () => {
    expect(validDetails({ ...c, empire: 8, panel: { at: 0.6 }, yoke: { front: 10 } })).toMatchObject({ empire: 8 });
    expect(validDetails({ ...c, empire: 8, panel: { at: 0.6 } }).panel).toBeUndefined();
    expect(validDetails({ ...c, neckline: 'scoop', yoke: { front: 10, back: 12 } }).yoke).toEqual({ back: 12 });
    expect(validDetails({ ...c, neckline: 'scoop', yoke: { front: 10 } }).yoke).toBeUndefined();
    expect(validDetails({ ...c, peplum: 'gathered', empire: 8 }).empire).toBeUndefined();
  });

  it('name the bodice and the dress by its seam', () => {
    expect(describeBodice({ ...c, empire: 8 })).toBe('waist-length crew neck empire-waist bodice');
    expect(describeBodice({ ...c, panel: { at: 0.6 } })).toBe('waist-length crew neck side-panel bodice');
    expect(describeBodice({ ...c, yoke: { front: 10, back: 12 } })).toBe('waist-length crew neck yoked bodice');
    expect(describeBodice({ ...c, yoke: { back: 12 }, sleeve: 'short' })).toBe('waist-length crew neck back-yoke bodice with short sleeves');
    expect(bodiceDetails({ ...c, empire: 8 })).toBe('a crew neck and an empire waist');
    expect(bodiceDetails({ ...c, yoke: { front: 10 }, sleeve: 'short' })).toBe('a crew neck, a front yoke and short sleeves');
  });
});

describe('style seams with the other new shapes', () => {
  const m = randomBody(rng(2));
  const uneven = { depth: 12, x: -4, left: 0.6, right: 0.6 };

  it('keeps a back yoke under an uneven neckline, and drops a front yoke or empire seam', () => {
    const d = draftBodice(m, { fit: 'regular', unevenNeck: uneven, yoke: { front: 12, back: 14 } });
    expect(problems(d, 'uneven + back yoke')).toEqual([]);
    expect(d.styleSeams?.every((sm) => sm.side === 'back')).toBe(true);
    expect(draftBodice(m, { fit: 'regular', unevenNeck: uneven, empire: 8 }).styleSeams ?? []).toEqual([]);
    expect(seamBlocked({ ...DEFAULT_BODICE, unevenNeck: uneven }, 'empire')).toMatch(/uneven/);
  });

  it('takes a yoke and a shaped hem on a hip-length bodice', () => {
    const hem = { front: [4, 4, 3.5, 3, 2.5, 2, 1, 0.5, 0], back: [0, 0, 0, 0, 0, 0, 0, 0, 0] };
    const d = draftBodice(m, { fit: 'regular', length: 'hip', yoke: { front: 12, back: 12 }, hem });
    expect(problems(d, 'yoke + shaped hem')).toEqual([]);
  });
});

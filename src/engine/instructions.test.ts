import { describe, expect, it } from 'vitest';
import { draftSkirt } from './skirt';
import { draftBodice } from './bodice';
import { draftOuter } from './outerwear';
import { draftTrousers, TrousersMeasurements } from './trousers';
import { bodiceGuide, sewingGuide } from './instructions';
import { outerGuide } from './outerGuide';
import { trousersGuide } from './trousersGuide';
import { randomArms, randomBody, rng } from './randomBodies';
import { draftSleeve } from './sleeve';
import { EXAMPLE_VALUES } from '../measurements';

const m = { waist: 70, full_hip: 96, waist_to_hip: 20.5, waist_to_knee: 58, waist_to_floor: 104 };
const T: TrousersMeasurements = { waist: 76, full_hip: 102, waist_to_hip: 20.5, waist_to_knee: 58, waist_to_floor: 104, crotch_depth: 27, crotch_length: 70 };
const O = EXAMPLE_VALUES as Parameters<typeof draftOuter>[0];

const step = (g: { steps: { title: string; text: string }[] }, title: string) => g.steps.find((s) => s.title === title)?.text ?? '';
const titles = (g: { steps: { title: string }[] }) => g.steps.map((s) => s.title);

describe('the lined skirt steps follow the lining pieces', () => {
  it('sews a half-circle lining with its centre front seam and no darts', () => {
    const style = { silhouette: 'half_circle', length: 'midi' } as const;
    const d = draftSkirt(m, style);
    expect(d.pieces[0].fold).toBeUndefined();
    expect(d.dartsPerSide).toEqual({ front: 0, back: 0 });
    const t = step(sewingGuide(d, style, 2.4, { liningM: 2.4 }), 'Make the lining');
    expect(t).not.toMatch(/tucks/);
    expect(t).toMatch(/centre front seam/);
    expect(t).toMatch(/centre back seam from the ZIP ENDS notch down/);
  });

  it('keeps the tucks on a darted lining, and on the plain lining under pleats', () => {
    const a = draftSkirt(m, { silhouette: 'a_line', length: 'knee' });
    expect(step(sewingGuide(a, { silhouette: 'a_line', length: 'knee' }, 1.4, { liningM: 1 }), 'Make the lining')).toMatch(/^Sew the lining darts as tucks/);
    const pl = draftSkirt(m, { silhouette: 'straight', length: 'knee', pleats: 'knife' });
    expect(pl.dartsPerSide).toEqual({ front: 0, back: 0 });
    const t = step(sewingGuide(pl, { silhouette: 'straight', length: 'knee', pleats: 'knife' }, 2, { liningM: 1 }), 'Make the lining');
    expect(t).toMatch(/tucks/);
    expect(t).not.toMatch(/centre front seam/);
  });

  it('sews only the side seams of a pull-on lining cut on the fold', () => {
    const d = draftSkirt(m, { silhouette: 'straight', length: 'knee', waist: 'elastic' });
    expect(d.pieces[1].fold).toBeDefined();
    const t = step(sewingGuide(d, { silhouette: 'straight', length: 'knee' }, 1.4, { liningM: 1.3 }), 'Make the lining');
    expect(t).toMatch(/^Sew the lining side seams, /);
    expect(t).not.toMatch(/centre back|tucks/);
  });
});

describe('a button front with a collar stand', () => {
  const r = rng(5);
  const body = randomBody(r);
  const shirt = draftBodice(body, { fit: 'regular', collar: 'shirt', closure: 'front_buttons' });
  const sleeve = draftSleeve(shirt, { ...body, ...randomArms(body, r) }, { length: 'short', shape: 'straight', fit: 'regular', seamAllowance: 1.5, armholeAllowance: 1, hemAllowance: 2.5 });

  it('counts the stand button in the notions', () => {
    const g = bodiceGuide(shirt, { length: 'waist' }, 1.5, 1, { edges: 'facings' });
    expect(step(g, 'Make the buttonholes')).toMatch(/one across the stand/);
    expect(g.notions).toContain(`${shirt.buttons!.count + 1} buttons, ${shirt.buttons!.sizeCm} cm`);
    const plain = draftBodice(body, { fit: 'regular', closure: 'front_buttons' });
    expect(bodiceGuide(plain, { length: 'waist' }, 1.5, 1, { edges: 'facings' }).notions).toContain(`${plain.buttons!.count} buttons, ${plain.buttons!.sizeCm} cm`);
  });

  it("catches a lined bodice's lining neck in the stand seam", () => {
    const g = bodiceGuide(shirt, { length: 'waist' }, 1.5, 1, { edges: 'lined', sleeve });
    const t = titles(g);
    expect(t.indexOf('Make the lining')).toBeLessThan(t.indexOf('Attach the front facings'));
    expect(step(g, 'Attach the front facings')).toMatch(/baste the facings and the lining to the neckline/);
    expect(step(g, 'Attach the stand')).toBeTruthy();
    expect(t).not.toContain('Line the neckline');
  });

  it('makes a lined sleeveless button front whole and closes its armholes by hand', () => {
    for (const d of [shirt, draftBodice(body, { fit: 'regular', closure: 'front_buttons' })]) {
      const g = bodiceGuide(d, { length: 'waist' }, 1.5, 1, { edges: 'lined' });
      const t = titles(g);
      expect(t).toContain('Sew the shoulders');
      expect(t).toContain('Line the armholes');
      expect(t).not.toContain('Line the neck and armholes');
      expect(step(g, 'Make the lining')).toMatch(/darts, shoulders and side seams/);
      expect(t.indexOf('Make the lining')).toBeLessThan(t.indexOf('Attach the front facings'));
      expect(new Set(t).size).toBe(t.length);
    }
    // Without a stand, the lining's neck edge goes over the back neck facing.
    const plain = bodiceGuide(draftBodice(body, { fit: 'regular', closure: 'front_buttons' }), { length: 'waist' }, 1.5, 1, { edges: 'lined' });
    expect(step(plain, 'Finish the lining at the front and neck')).toMatch(/back neck facing/);
    expect(step(bodiceGuide(shirt, { length: 'waist' }, 1.5, 1, { edges: 'lined' }), 'Finish the lining at the front')).toBeTruthy();
  });
});

describe('the coat lining follows its pieces', () => {
  it('cuts and sews the side front and side back linings of a princess coat', () => {
    const d = draftOuter(O, { kind: 'coat', shaping: 'princess' });
    expect(d.pieces.map((pc) => pc.name)).toEqual(expect.arrayContaining(['Side front lining', 'Side back lining']));
    // The centre front panel is all facing, so there is no front lining piece to sew the side front lining to.
    expect(d.pieces.map((pc) => pc.name)).not.toContain('Front lining');
    const g = outerGuide(d, 3);
    expect(step(g, 'Cut the lining')).toMatch(/side front linings/);
    expect(step(g, 'Cut the lining')).toMatch(/side back linings/);
    expect(step(g, 'Make the lining')).toMatch(/^Sew each side back lining to its back lining along the princess seam/);
    expect(step(g, 'Make the lining')).toMatch(/Sew each side front lining to its front facing along the princess seam/);
    const darted = outerGuide(draftOuter(O, { kind: 'jacket', shaping: 'darts' }), 2);
    expect(step(darted, 'Cut the lining')).not.toMatch(/side front/);
    expect(step(darted, 'Make the lining')).not.toMatch(/princess/);
  });

  it("joins the lining's back neck to the collar it has, or to the shell without one", () => {
    const stand = outerGuide(draftOuter(O, { kind: 'jacket', collar: 'stand' }), 2);
    expect(step(stand, 'Sew the stand collar')).toMatch(/sewn to the lining's back neck later/);
    expect(step(stand, 'Make the lining')).toMatch(/inner collar to the lining's back neck/);
    const none = outerGuide(draftOuter(O, { kind: 'jacket', collar: 'collarless' }), 2);
    expect(step(none, 'Face the neck and front')).toMatch(/as far as the shoulder seam/);
    expect(step(none, 'Make the lining')).toMatch(/its back neck to the jacket's back neck/);
  });
});

describe('the trousers steps follow their options', () => {
  it('presses an elastic-waist front crease to the hip line, there being no dart', () => {
    const d = draftTrousers(T, { waist: 'elastic' });
    expect(d.dartsPerSide.front).toBe(0);
    expect(step(trousersGuide(d, 2), 'Press the creases')).toMatch(/to the hip line on the front/);
    expect(step(trousersGuide(draftTrousers(T), 2), 'Press the creases')).toMatch(/to the dart on the front/);
  });

  it('does not close a side-zip seam twice', () => {
    const g = trousersGuide(draftTrousers(T, { closure: 'side_zip' }), 2);
    expect(step(g, 'Sew the side seams')).toMatch(/LEFT ZIP ENDS notch, and sew from there to the hem/);
    expect(step(g, 'Put in the side zip')).not.toMatch(/Close the last few cm/);
  });

  it('hems ankle-length trousers above the ankle, full-length ones at the shoe', () => {
    const d = draftTrousers(T, { length: 'ankle' });
    expect(step(trousersGuide(d, 2, { length: 'ankle' }), 'Hem')).toMatch(/ankle bone/);
    expect(step(trousersGuide(d, 2, { length: 'ankle' }), 'Hem')).not.toMatch(/top of the shoe/);
    expect(step(trousersGuide(draftTrousers(T), 2, { length: 'full' }), 'Hem')).not.toMatch(/ankle/);
    // Without the length, both are described.
    expect(step(trousersGuide(d, 2), 'Hem')).toMatch(/top of the shoe.*ankle bone/);
  });
});

describe('guide text that follows the draft', () => {

  it('treats a princess front facing as the whole centre front panel when there is no front lining piece', () => {
    const d = draftOuter(O, { kind: 'coat', shaping: 'princess' });
    const panel = { ...d, pieces: d.pieces.filter((pc) => pc.name !== 'Front lining') };
    const g = outerGuide(panel, 3);
    expect(step(g, 'Cut the lining')).toMatch(/^Cut the side front linings, /);
    expect(step(g, 'Cut the lining')).toMatch(/no front lining: the front facing is the whole centre front panel, cut to the princess seam/);
    expect(step(g, 'Make the lining')).toMatch(/^Sew each side back lining to its back lining along the princess seam/);
    expect(step(g, 'Make the lining')).toMatch(/Sew each side front lining to its front facing along the princess seam/);
    expect(step(g, 'Make the lining')).not.toMatch(/inner edges of the front facings/);
    // With a front lining piece, the facing keeps its old line and the front lining is sewn as before.
    const sideFront = d.pieces.find((pc) => pc.name === 'Side front lining')!;
    const old = outerGuide({ ...d, pieces: [...d.pieces, { ...sideFront, name: 'Front lining' }] }, 3);
    expect(step(old, 'Cut the lining')).toMatch(/^Cut the front linings, side front linings, /);
    expect(step(old, 'Make the lining')).toMatch(/inner edges of the front facings/);
  });

  it("hems a skirt by its own hem allowance", () => {
    const a = draftSkirt(m, { silhouette: 'a_line', length: 'knee' });
    const hem = a.pieces[0].allowances.hem;
    expect(step(sewingGuide(a, { silhouette: 'a_line', length: 'knee' }, 1.4), 'Hem')).toContain(`Press up 1 cm, then ${hem - 1} cm more.`);
    const narrow = { ...a, pieces: a.pieces.map((pc) => ({ ...pc, allowances: { ...pc.allowances, hem: 2.5 } })) };
    expect(step(sewingGuide(narrow, { silhouette: 'a_line', length: 'knee' }, 1.4), 'Hem')).toContain('Press up 1 cm, then 1.5 cm more.');
  });

  it('says when the side bust dart is capped and the waist dart carries the rest of the bust shaping', () => {
    const b = draftBodice(randomBody(rng(3)), { fit: 'regular' });
    expect(step(bodiceGuide(b, { length: 'waist' }, 1.5, 1), 'Sew the bust and waist darts')).not.toMatch(/rest of the bust shaping/);
    const capped = { ...b, bustDart: 6, bustToWaist: 1.4 };
    expect(step(bodiceGuide(capped, { length: 'waist' }, 1.5, 1), 'Sew the bust and waist darts')).toMatch(/side bust dart is 6 cm wide; the rest of the bust shaping is carried in the waist dart/);
    expect(step(bodiceGuide(b, { length: 'waist' }, 1.5, 1), 'Sew the bust and waist darts')).toMatch(/from the waist edge to the point/);
  });
});

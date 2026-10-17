import { describe, expect, it } from 'vitest';
import { SPECIALS, SPECIAL_IDS, checksExtra, checksLines, hideSqFt, needsNap, specialLines, specialWarnings, withSpecialAllowances } from './specialFabrics';
import { checkFabric, clothFor, describeFabric, fabricEase, fabricLines, withFabric } from './fabrics';
import { draftSkirt } from './skirt';
import { withAllowances } from './allowances';
import { EXAMPLE_VALUES } from '../measurements';

const ascii = (s: string) => /^[\x20-\x7e]*$/.test(s);
const guide = { notions: ['1.5 m woven fabric'], steps: [{ title: 'Sew the darts', text: 'Sew them.' }] } as unknown as Parameters<typeof withFabric>[0];

describe('special fabrics', () => {
  it('keeps every word to plain ASCII for the PDF', () => {
    for (const id of SPECIAL_IDS) {
      const s = SPECIALS[id];
      for (const t of [s.label, s.prewash, s.press, s.cut, s.need, s.added ?? '', s.sew ?? '', s.lining ?? '']) expect(ascii(t)).toBe(true);
    }
    for (const l of checksLines({ repeat: 8 }, 'dress')) expect(ascii(l)).toBe(true);
  });

  it('names the cloth and lists what changes', () => {
    expect(describeFabric({ special: 'denim', weight: 'heavy', drape: 'crisp', fibre: 'cotton' })).toBe('heavy, crisp denim');
    expect(specialLines('leather').map((l) => l.label)).toEqual(['Added for you', 'Cut', 'Sew', "You'll need"]);
    const lines = fabricLines({ special: 'velvet' }, 'skirt');
    expect(lines).toContain('Cloth: velvet');
    expect(lines.some((l) => l.startsWith('Press: Never press it flat'))).toBe(true);
  });

  it('gives thick cloth the heavy-cloth ease', () => {
    expect(fabricEase({ special: 'denim' }, 'skirt').hip).toBe(1);
    expect(fabricEase({ special: 'leather', weight: 'medium' }, 'bodice').bust).toBe(1);
    expect(fabricEase({ special: 'satin' }, 'skirt').hip).toBe(0);
    expect(fabricEase({ special: 'denim', matchEase: false }, 'skirt').hip).toBe(0);
  });

  it('warns when the cloth does not suit the shape', () => {
    expect(specialWarnings('leather', { silhouette: 'circle' })).toHaveLength(1);
    expect(specialWarnings('leather', { silhouette: 'pencil' })).toHaveLength(0);
    expect(specialWarnings('denim', { leg: 'wide' })).toHaveLength(1);
    const notes = checkFabric({ garment: 'skirt', silhouette: 'circle', length: 'knee' }, { special: 'leather' });
    expect(notes[0].level).toBe('warn');
    expect(notes[notes.length - 1].text).toBe(SPECIALS.leather.prewash);
  });

  it('cuts pile, sheen and motifs one way', () => {
    for (const id of ['velvet', 'corduroy', 'satin', 'lace', 'sequins'] as const) expect(needsNap(id)).toBe(true);
    expect(needsNap('denim')).toBe(false);
    expect(needsNap(undefined)).toBe(false);
  });

  it('gives leather 1 cm seams, lace no hem and sheers a narrow hem, but leaves lining alone', () => {
    const pc = withAllowances(draftSkirt(EXAMPLE_VALUES as never, { silhouette: 'straight', length: 'knee' }).pieces[0], 'home');
    const leather = withSpecialAllowances(pc, 'leather');
    expect(leather.seamAllowance).toBe(1);
    expect(leather.allowances.hem).toBe(3);
    expect(withSpecialAllowances(pc, 'lace').allowances.hem).toBe(0);
    expect(withSpecialAllowances(pc, 'sheer').allowances.hem).toBe(1);
    expect(withSpecialAllowances(pc, 'denim')).toBe(pc);
    expect(withSpecialAllowances({ ...pc, kind: 'lining' }, 'leather').seamAllowance).toBe(pc.seamAllowance);
  });

  it('works out extra fabric for checks and hide for leather', () => {
    expect(checksExtra({}, 'skirt')).toBe(0.2);
    expect(checksExtra({ repeat: 15 }, 'dress')).toBe(0.6);
    expect(hideSqFt({ metres: 1.4, width: 140, efficiency: 0.47 })).toBe(14);
  });

  it('adds a cutting step after preparing the cloth, and follows it for the couture cloth', () => {
    const g = withFabric(guide, { special: 'leather', checks: { repeat: 10 } }, 'skirt');
    expect(g.steps.map((s) => s.title)).toEqual(['Prepare your fabric', 'Cut the leather', 'Sew the darts']);
    expect(g.steps[0].text).not.toMatch(/straighten the grain/);
    expect(g.steps[1].text).toMatch(/check line/);
    expect(withFabric(guide, { checks: {} }, 'skirt').steps[1].title).toBe('Match the checks');
    expect(withFabric(guide, { fibre: 'linen' }, 'skirt').steps).toHaveLength(2);
    expect(clothFor({ special: 'sheer' }, 'wool')).toBe('silk');
  });
});

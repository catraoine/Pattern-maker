import { describe, expect, it } from 'vitest';
import { EXAMPLE_BODY } from '../measurements';
import { draftTrousers } from './trousers';
import { trousersGuide } from './trousersGuide';
import { TROUSER_LINING_SHORTER, liningStyle, trouserLiningPieces, withTrouserLining } from './trouserLining';
import { checkPattern } from './qc';

// The trouser lining (Gold Python Bermuda, Nov 12): the same legs drafted plain and a little shorter, put in under the
// waistband and hemmed apart.
const m = EXAMPLE_BODY as never;
const bermuda = { fit: 'relaxed' as const, leg: 'wide' as const, length: 'knee' as const, lengthCm: 68, closure: 'fly' as const, pockets: 'slant' as const, pleats: 'double' as const, loops: 'loops' as const, backPockets: 'welt' as const, rise: 'low' as const, legCm: { knee: 66, hem: 66 } };

describe('trouser lining', () => {
  const t = draftTrousers(m, bermuda);
  const lining = draftTrousers(m, liningStyle(bermuda, t.lengthCm));
  const pieces = trouserLiningPieces(lining);

  it('is a front and back with no pockets or loops, cut from lining, shorter than the trousers by the set amount', () => {
    expect(pieces.map((pc) => pc.name)).toEqual(['Lining front', 'Lining back']);
    expect(pieces.every((pc) => pc.kind === 'lining' && pc.fabric === 'Lining')).toBe(true);
    expect(lining.pleats).toEqual(t.pleats);
    expect(lining.loops).toBeUndefined();
    expect(lining.backWelt).toBeFalsy();
    expect(t.lengthCm - lining.lengthCm).toBeCloseTo(TROUSER_LINING_SHORTER, 5);
    for (const pc of pieces) expect(checkPattern([pc]).filter((c) => !c.ok)).toEqual([]);
  });

  it('fits the trousers at the waist and keeps their hip room, so it goes in under the same band and never pulls', () => {
    expect(lining.finishedWaist).toBeCloseTo(t.finishedWaist, 1);
    expect(lining.finishedHip).toBeCloseTo(t.finishedHip, 0);
  });

  it('lets its steps into the guide in sewing order', () => {
    const g = withTrouserLining(trousersGuide(t, 2), t, { metres: 1.4, width: 140, seam: '1.5 cm' });
    const titles = g.steps.map((s) => s.title);
    const at = (x: string) => titles.indexOf(x);
    expect(at('Cut the lining')).toBe(at('Cut out') + 1);
    expect(at('Put in the lining')).toBe(at('Make the lining') + 1);
    expect(at('Put in the lining')).toBeLessThan(at('Make the belt loops'));
    expect(at('Hem the lining')).toBe(at('Hem') + 1);
    expect(g.notions.join(' ')).toContain('1.4 m of lining');
  });
});

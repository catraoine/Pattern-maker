import { describe, expect, it } from 'vitest';
import { KNITS, KNIT_IDS, knitStretchWarning } from './knitFabrics';
import { checkFabric, describeFabric, fabricLines } from './fabrics';
import { pickFabric, flatId, fabricLabel } from '../ui/FabricFill';
import { DEFAULT_FINISH } from '../savedWork';
import { existsSync } from 'node:fs';

describe('knit swatches for the T-shirt', () => {
  it('has a tile for every knit', () => {
    for (const id of KNIT_IDS) expect(existsSync(`public/fabrics/flat/${id}.jpg`)).toBe(true);
  });

  it('picking a knit fills in its fibre, weight and drape, and shows its tile', () => {
    const f = pickFabric(DEFAULT_FINISH, 'rib').fabric!;
    expect(f).toMatchObject({ knit: 'rib', fibre: 'cotton', weight: 'medium', drape: 'soft' });
    expect(flatId(f)).toBe('rib');
    expect(fabricLabel(f)).toBe('Rib');
    expect(describeFabric(f)).toBe('medium, soft rib knit');
    expect(fabricLines(f, 'tee')).toContain('Knit: rib knit');
  });

  it('tapping the picked knit again, or None, clears it', () => {
    const on = pickFabric(DEFAULT_FINISH, 'jersey');
    expect(pickFabric(on, 'jersey').fabric?.knit).toBeUndefined();
    expect(pickFabric(on, undefined).fabric?.knit).toBeUndefined();
  });

  it('a woven pick leaves the knit behind', () => {
    const on = pickFabric(DEFAULT_FINISH, 'jersey');
    expect(flatId(pickFabric(on, 'linen').fabric)).toBe('linen');
  });

  it('warns when the knit usually stretches less than the stretch chosen', () => {
    expect(knitStretchWarning('interlock', 'high')).toMatch(/Interlock usually has low stretch/);
    expect(knitStretchWarning('rib', 'high')).toBeUndefined();
    const f = pickFabric(DEFAULT_FINISH, 'terry').fabric!;
    const notes = checkFabric({ garment: 'tee', fit: 'regular', stretch: 'medium', neckline: 'crew' }, f);
    expect(notes.some((n) => n.level === 'warn' && /Terry usually/.test(n.text))).toBe(true);
  });

  it('keeps every knit word plain ASCII for the PDF', () => {
    for (const k of Object.values(KNITS)) expect(/^[\x20-\x7e]*$/.test(k.words + k.label)).toBe(true);
  });
});

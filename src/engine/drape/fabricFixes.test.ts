import { afterEach, describe, expect, it } from 'vitest';
import { optionDesigns, sewDesign } from '../../drapeSweep';
import type { Fibre } from '../fabrics';
import { setKnob } from './knob';

const sew = (key: string, fibre: Fibre) => {
  const o = optionDesigns().find((x) => x.key === key)!;
  return sewDesign({ ...o.design, fibre });
};

// Three designs All round showed as their flat drawing instead of turning (2026-11-07), each now drawn clean.
describe('All round: designs that fell back to the flat drawing', () => {
  afterEach(() => {
    setKnob('__noCollarClear', undefined);
    setKnob('__noBalloonClose', undefined);
  });

  // An open polo's fall sank into the shoulders ("the collar sinks into the form") in every cloth: eased back out.
  it.each(['cotton', 'silk', 'linen'] as const)('an open polo collar in %s lies on the shoulders', (fibre) => {
    expect(sew('bodice collar=polo', fibre).quality?.problems ?? []).toEqual([]);
    setKnob('__noCollarClear', 1);
    expect((sew('bodice collar=polo', fibre).quality?.problems ?? []).map((p) => p.check)).toContain('inside');
  }, 240_000);

  // A balloon peplum's hem stood 1.6 cm off the underskirt's round the side seams in wool: closed.
  it('a balloon peplum in wool has its hem sewn shut', () => {
    expect(sew('bodice peplum=balloon', 'wool').quality?.problems ?? []).toEqual([]);
    setKnob('__noBalloonClose', 1);
    expect((sew('bodice peplum=balloon', 'wool').quality?.problems ?? []).map((p) => p.check)).toContain('seam');
  }, 240_000);

  // A relaxed T-shirt in silk or viscose: its sleeve drawn in close as a woven silk's bunched at its hem. A knit holds its
  // round.
  it.each(['silk', 'viscose'] as const)('a relaxed T-shirt in %s has clean sleeve edges', (fibre) => {
    expect(sew('tee fit=relaxed', fibre).quality?.problems ?? []).toEqual([]);
  }, 120_000);
});

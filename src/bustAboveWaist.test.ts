import { describe, expect, it } from 'vitest';
import { withEstimates } from './estimate';
import { ESTIMATED, EXAMPLE_VALUES, type MeasurementValues } from './measurements';
import { patternDesigns, printedPattern } from './patternSweep';
import { MIN_BUST_TO_WAIST, draftBodice, type BodiceMeasurements } from './engine/bodice';
import { bodiceFlat } from './engine/flat';
import { DEFAULT_BODICE } from './garments';
import { DraftError } from './engine/skirt';

// A bust point at or below the waist froze the app (engineering review, Nov 10): the top's Front drawing walked an edge
// with a point at infinity in endless steps. Only typed bust depth and front length were checked against each other, but
// usually one or both are the app's own estimates. Now the estimates keep the bust point above the waist, the drafting
// turns such a body away with a message, and the drawing can never walk an edge endlessly.
const essentials = (v: MeasurementValues) => Object.fromEntries(Object.entries(v).filter(([id]) => !ESTIMATED.includes(id as never))) as MeasurementValues;
// The two bodies the review froze the app with: a short back length beside a long waist to floor (107 mistyped as 137),
// and a believable body with its bust depth typed long.
const SHORT_BACK = { ...essentials(EXAMPLE_VALUES), height: undefined, nape_to_waist: 29, waist_to_floor: 137 };
const LONG_BUST_DEPTH = { ...essentials(EXAMPLE_VALUES), full_bust: 118, high_bust: undefined, nape_to_waist: 40, bust_depth: 45 };
const tops = () => patternDesigns().filter((d) => d.garment === 'bodice' || d.garment === 'dress');

describe('the bust point stays above the waist', () => {
  it('estimates never put the bust point at or below the waist, and never change a typed value', () => {
    for (const v of [SHORT_BACK, LONG_BUST_DEPTH]) {
      const e = withEstimates(v);
      expect(e.front_hps_to_waist! - e.bust_depth!).toBeGreaterThanOrEqual(MIN_BUST_TO_WAIST);
    }
    expect(withEstimates(LONG_BUST_DEPTH).bust_depth).toBe(45);
    expect(withEstimates({ ...SHORT_BACK, front_hps_to_waist: 33 }).front_hps_to_waist).toBe(33);
    // An everyday body's estimates are as they were.
    expect(withEstimates(essentials(EXAMPLE_VALUES))).toMatchObject({ bust_depth: 26.6, front_hps_to_waist: 45.9 });
  });

  it('draws every top and dress for both bodies, or turns them away with a message', () => {
    for (const v of [SHORT_BACK, LONG_BUST_DEPTH])
      for (const d of tops()) {
        try {
          printedPattern(d, withEstimates(v));
        } catch (e) {
          expect(e, d.key).toBeInstanceOf(DraftError);
        }
      }
  }, 120_000);

  it('turns away a bust point at the waist with what to check, rather than drawing it', () => {
    const v = { ...EXAMPLE_VALUES, front_hps_to_waist: 44, bust_depth: 43 } as BodiceMeasurements;
    expect(() => draftBodice(v, { ...DEFAULT_BODICE, darts: 'bust' })).toThrow(DraftError);
    expect(() => draftBodice(v, { ...DEFAULT_BODICE, darts: 'bust' })).toThrow(/can't be drafted.*bust depth.*front length/);
    // A short bust-to-waist that still drafts cleanly is drawn.
    const ok = draftBodice({ ...v, bust_depth: 44 - MIN_BUST_TO_WAIST } as BodiceMeasurements, { ...DEFAULT_BODICE, darts: 'bust' });
    for (const x of bodiceFlat(ok).views.flatMap((w) => w.shapes.flat())) expect(Number.isFinite(x.x) && Number.isFinite(x.y)).toBe(true);
  });
});

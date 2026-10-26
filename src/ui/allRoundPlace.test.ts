import { describe, expect, it } from 'vitest';
import { roundBodice, roundDress, roundOuter, roundTee } from '../engine/allRound';
import { draftBodice } from '../engine/bodice';
import { draftDress } from '../engine/dress';
import { draftOuter } from '../engine/outerwear';
import { draftTee } from '../engine/tee';
import { EXAMPLE_BODY, EXAMPLE_VALUES } from '../measurements';
import { NECK_Y, SHOULDER_Y, placeOnForm } from './AllRound';

const HALF = Math.PI / 2;

// Cat, 2026-10-26: the shoulders on All round sat too low. A top's shoulder tip is on the form's shoulder tip and its
// neck point at the base of the form's neck, on every top and on the test body as well as the slim example body.
describe('all round places tops on the form', () => {
  for (const [body, m] of [
    ['test body', EXAMPLE_VALUES],
    ['example body', { ...EXAMPLE_VALUES, ...EXAMPLE_BODY }],
  ] as const) {
    const full = m as never;
    const tops = {
      tee: roundTee(draftTee(full), full),
      bodice: roundBodice(draftBodice(full), full),
      dress: roundDress(draftDress(full), full),
      jacket: roundOuter(draftOuter(full, { kind: 'jacket' }), full),
      coat: roundOuter(draftOuter(full, { kind: 'coat' }), full),
    };
    for (const [name, r] of Object.entries(tops)) {
      it(`${name} on the ${body}`, () => {
        const yOf = placeOnForm(r, m);
        expect(yOf(r.armhole!.shoulderCm)).toBeCloseTo(SHOULDER_Y, 5);
        // The neck point at the side: at the base of the neck, never up on it or down on the shoulder.
        const hps = yOf(r.topAt(HALF));
        expect(hps).toBeGreaterThan(NECK_Y - 0.04);
        expect(hps).toBeLessThan(SHOULDER_Y - 0.05);
        // The underarm stays below the shoulder and above the bust line.
        const under = yOf(r.armhole!.underarmCm);
        expect(under).toBeGreaterThan(SHOULDER_Y + 0.3);
        expect(under).toBeLessThan(-0.45);
      });
    }
  }
});

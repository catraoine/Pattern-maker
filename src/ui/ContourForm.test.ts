import { describe, expect, it } from 'vitest';
import { FIELDS } from '../measurements';
import { formLandmarks, hasDemo, ON_FORM } from './ContourForm';

// The measuring pages draw each tape where that measurement is taken. These pin every tape to the form's own
// shape, so a later change to the drawing or the tape heights fails here instead of showing the wrong place.
describe('measuring tapes on the dress form', () => {
  const marks = formLandmarks();
  // 0.03 is about 5 px on a phone: inside the tape's own glow.
  for (const id of ['full_bust', 'waist', 'full_hip'] as const) {
    it(`draws the ${id} tape at its landmark`, () => {
      expect(Math.abs(ON_FORM[id]! - marks[id])).toBeLessThan(0.03);
    });
  }

  it('keeps bust above waist above hip', () => {
    expect(marks.full_bust).toBeLessThan(marks.waist);
    expect(marks.waist).toBeLessThan(marks.full_hip);
  });
});

// Every measuring page shows its own measurement: a page without a drawing used to fall back to the waist tape
// (the arm and crotch pages did), so each garment's pages are checked here.
describe('a drawing for every measuring page', () => {
  const ids = [...new Set(Object.values(FIELDS).flatMap((fields) => fields.map((f) => f.id)))];
  for (const id of ids) it(`draws ${id}`, () => expect(hasDemo(id)).toBe(true));
});

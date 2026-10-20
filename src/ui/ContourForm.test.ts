import { describe, expect, it } from 'vitest';
import { FIELDS } from '../measurements';
import { FORM_FLOOR, formLandmarks, HEAD_TOP, hasDemo, ON_FORM, tapeView } from './ContourForm';

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

// Each tape is framed whole by the camera, and the measurements taken at the back turn the figure round
// (Cat, 2026-10-20). A new measurement without a view or a tape fails here.
describe('a camera view and a tape for every measuring page', () => {
  const ids = [...new Set(Object.values(FIELDS).flatMap((fields) => fields.map((f) => f.id)))];
  for (const id of ids)
    it(`frames ${id}`, () => {
      const t = tapeView(id);
      expect(t).toBeDefined();
      const [top, bottom] = t!.view;
      expect(top).toBeLessThan(bottom);
      expect(top).toBeGreaterThanOrEqual(HEAD_TOP - 0.2);
      expect(bottom).toBeLessThanOrEqual(FORM_FLOOR + 0.2);
    });

  it('turns to the back for the back measurements, and only those', () => {
    const back = ['across_back', 'nape_to_waist', 'back_waist_to_hip', 'back_shoulder_slope', 'shoulder_width'] as const;
    for (const id of back) expect(tapeView(id)?.back).toBe(true);
    for (const id of ['full_hip', 'waist', 'front_waist_to_hip', 'front_shoulder_slope', 'height'] as const) expect(tapeView(id)?.back).toBe(false);
  });

  it('shows the floor for height and the lengths to the floor', () => {
    for (const id of ['height', 'waist_to_floor'] as const) expect(tapeView(id)!.view[1]).toBeGreaterThan(FORM_FLOOR);
    expect(tapeView('height')!.view[0]).toBeLessThan(HEAD_TOP);
  });
});

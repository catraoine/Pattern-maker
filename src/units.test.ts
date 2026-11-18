import { describe, expect, it } from 'vitest';
import { fmtLength, fmtMeasure, inInches, toFeetInches, toInches, toYards, typedLength } from './units';

describe('inches', () => {
  it('rounds to the nearest eighth', () => {
    expect(toInches(2.54)).toBe('1 in');
    expect(toInches(1.5)).toBe('⅝ in');
    expect(toInches(1)).toBe('⅜ in');
    expect(toInches(12)).toBe('4¾ in');
    expect(toInches(0)).toBe('0 in');
    expect(toInches(90)).toBe('35⅜ in');
  });
  it('rounds fabric up to the next eighth of a yard', () => {
    expect(toYards(0.9144)).toBe('1 yd');
    expect(toYards(1.5)).toBe('1¾ yd');
    expect(toYards(2)).toBe('2¼ yd');
  });
  it('formats in the chosen unit', () => {
    expect(fmtLength(12, 'cm')).toBe('12 cm');
    expect(fmtLength(12, 'in')).toBe('4¾ in');
  });
  it('rewrites prose, pairs and metres', () => {
    expect(inInches('Press a 1.5 cm hem, then cut a 30 × 20 cm pocket bag from 1.6 m of cloth.')).toBe('Press a ⅝ in hem, then cut a 11¾ × 7⅞ in pocket bag from 1¾ yd of cloth.');
    expect(inInches('Measure the test square: it should be exactly 10 cm.')).toBe('Measure the test square: it should be exactly 10 cm (3.94 in).');
    expect(inInches('measure the 10 cm test square on page A2')).toBe('measure the 10 cm (3.94 in) test square on page A2');
    expect(inInches('10 CM')).toBe('10 CM · 3.94 IN');
    // Seam labels on the pieces are in capitals (Nov 17: they stayed in cm in an inch PDF).
    expect(inInches('SHOULDER · 1.5 CM ALLOWANCE')).toBe('SHOULDER · ⅝ IN ALLOWANCE');
    expect(inInches('HEM · 4 CM ALLOWANCE')).toBe('HEM · 1⅝ IN ALLOWANCE');
    // A bracket that isn't the length's own inches doesn't stop it ("neckline 19.5 cm (half)" stayed in cm), and the
    // cover's capital metres turn into yards.
    expect(inInches('collar 18 cm, neckline 19.5 cm (half), identical')).toBe('collar 7⅛ in, neckline 7⅝ in (half), identical');
    expect(inInches('2.4 M OF 140 CM FABRIC')).toBe('2⅝ YD OF 55⅛ IN FABRIC');
    // Millimetres go to sixteenths, and "1 cm in" doesn't read "3/8 in in".
    expect(inInches('Trim 3 mm off, then edge-stitch 2 mm from its edge, within 1 mm and 5 mm.')).toBe('Trim ⅛ in off, then edge-stitch 1/16 in from its edge, within 1/16 in and 3/16 in.');
    expect(inInches('stitch the sides 1 cm in. Turn it')).toBe('stitch the sides ⅜ in from the edge. Turn it');
    expect(inInches('a casing 1.5 cm in from the seam line')).toBe('a casing ⅝ in from the seam line');
    expect(inInches('stay-stitch 1 cm in as soon as they are cut')).toBe('stay-stitch ⅜ in from the edge as soon as they are cut');
    expect(inInches('trim to 1 cm in length')).toBe('trim to ⅜ in in length');
    expect(inInches('10 cm (3.94 in) test square')).toBe('10 cm (3.94 in) test square');
    expect(inInches('cm or in')).toBe('cm or in');
    expect(inInches('Page 2 of 4')).toBe('Page 2 of 4');
  });
});

describe('heights in feet and inches', () => {
  it('reads a height back the way people know it', () => {
    expect(toFeetInches(165)).toBe('5 ft 5 in');
    expect(toFeetInches(182.9)).toBe('6 ft 0 in');
    expect(fmtMeasure('height', 165, 'in')).toBe('5 ft 5 in');
    expect(fmtMeasure('height', 165, 'cm')).toBe('165 cm');
    expect(fmtMeasure('waist', 76, 'in')).toBe('29.9 in');
  });
});

// Pasted or typed lengths (bug hunt's paste check, Nov 15): the unit written wins, and a tape's fractions count.
describe('typedLength', () => {
  it('reads the number in the screen unit when no unit is written', () => {
    expect(typedLength('84', 'cm')).toBe(84);
    expect(typedLength(' 84,5 \n', 'cm')).toBe(84.5);
    expect(typedLength('33', 'in')).toBeCloseTo(83.82);
  });

  it('takes the unit someone writes over the screen unit', () => {
    expect(typedLength('33 in', 'cm')).toBeCloseTo(83.82);
    expect(typedLength('33"', 'cm')).toBeCloseTo(83.82);
    expect(typedLength('33 inches', 'cm')).toBeCloseTo(83.82);
    expect(typedLength('84.5cm', 'in')).toBe(84.5);
    expect(typedLength('845 mm', 'in')).toBe(84.5);
  });

  it('counts a tape fraction', () => {
    expect(typedLength('33 1/2', 'in')).toBeCloseTo(85.09);
    expect(typedLength('33½ in', 'cm')).toBeCloseTo(85.09);
    expect(typedLength('12/2', 'cm')).toBe(6);
    expect(typedLength('33-1/2', 'in')).toBeCloseTo(85.09);
    expect(typedLength('33 in.', 'cm')).toBeCloseTo(83.82);
    expect(typedLength('84,5 cm,', 'in')).toBe(84.5);
  });

  it('gives NaN when there is no number, and keeps reading a number followed by other words', () => {
    expect(typedLength('', 'cm')).toBeNaN();
    expect(typedLength('abc', 'cm')).toBeNaN();
    expect(typedLength('1/0', 'cm')).toBeNaN();
    expect(typedLength('84 about', 'cm')).toBe(84);
  });
});

describe('the finished measurement marks in inches (pretend tester, Nov 17)', () => {
  it('rewrites the note under each mark, not only its title', () => {
    expect(inInches('YOU 99.1 CM · EASE +2.5 CM')).toBe('YOU 39 IN · EASE +1 IN');
  });
  it('keeps a typed inch length when it is kept to the hundredth of a cm', () => {
    expect(toInches(Math.round(typedLength('20', 'in') * 100) / 100)).toBe('20 in');
    expect(toInches(Math.round(typedLength('20 1/2', 'in') * 100) / 100)).toBe('20½ in');
  });
});

// The inch Print page told testers the square "must measure 3⅞ in" while the PDF says 3.94 in (pretend-tester walk,
// Nov 17): the square's line on screen keeps the exact figure, like the PDF.
describe('the test square on screen in inches', () => {
  it('reads 3.94 in, never 3⅞', () => {
    for (const t of ['The test square on page A2 must measure exactly 10 cm before you cut.', 'Lay a ruler across the square. Each side should be exactly 10 cm.']) {
      expect(inInches(t)).toContain('10 cm (3.94 in)');
      expect(inInches(t)).not.toContain('⅞');
    }
  });
});

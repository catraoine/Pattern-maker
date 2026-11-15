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
    expect(inInches('measure the 10 cm test square on page A1')).toBe('measure the 10 cm (3.94 in) test square on page A1');
    expect(inInches('10 CM')).toBe('10 CM · 3.94 IN');
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
  });

  it('gives NaN when there is no number, and keeps reading a number followed by other words', () => {
    expect(typedLength('', 'cm')).toBeNaN();
    expect(typedLength('abc', 'cm')).toBeNaN();
    expect(typedLength('1/0', 'cm')).toBeNaN();
    expect(typedLength('84 about', 'cm')).toBe(84);
  });
});

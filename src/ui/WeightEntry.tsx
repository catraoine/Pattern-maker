import { useState } from 'react';
import type { Unit } from '../measurements';

// Weight, on its own optional page after the five basics (Cat, 2026-10-20): it only ever double-checks the
// girths against the height, so a slipped tape or a wrong unit is caught before anything is drafted. It is not
// drafted from, shown on a pattern, exported or sent anywhere, and the page says so.

type WeightUnit = 'kg' | 'lb';
/** Weight follows the tape's unit: kilograms with centimetres, pounds with inches. */
export const weightUnitOf = (unit: Unit): WeightUnit => (unit === 'cm' ? 'kg' : 'lb');
const LB = 0.45359237;
export const fromKg = (kg: number, u: WeightUnit) => (u === 'kg' ? Math.round(kg * 10) / 10 : Math.round((kg / LB) * 10) / 10);
const toKg = (x: number, u: WeightUnit) => Math.round((u === 'kg' ? x : x * LB) * 10) / 10;

/** Weights that can't be right, in kg: outside this it is nearly always the other unit or a slipped digit. */
export const WEIGHT_HARD: [number, number] = [25, 350];

export function WeightEntry({ unit, helper, weight, onWeight, note = true }: { unit: Unit; helper: boolean; weight?: number; onWeight: (kg: number | undefined) => void; note?: boolean }) {
  const u = weightUnitOf(unit);
  const [text, setText] = useState<string | null>(null);
  const [wu, setWu] = useState<WeightUnit>(u);
  const whose = helper ? 'their' : 'your';
  const wrong = weight !== undefined && (weight < WEIGHT_HARD[0] || weight > WEIGHT_HARD[1]);
  const type = (t: string) => {
    setText(t);
    const n = parseFloat(t.replace(',', '.'));
    onWeight(Number.isNaN(n) ? undefined : toKg(n, wu));
  };
  return (
    <div className="weight-entry">
      <div className={wrong ? 'entry-box error' : 'entry-box'}>
        <label htmlFor="step-weight" className={note ? undefined : 'visually-hidden'}>
          Weight
        </label>
        <div className="entry-row">
          <input
            id="step-weight"
            inputMode="decimal"
            autoComplete="off"
            value={text ?? (weight === undefined ? '' : String(fromKg(weight, wu)))}
            aria-invalid={wrong ? true : undefined}
            aria-describedby={note ? 'weight-note' : undefined}
            onChange={(e) => type(e.target.value)}
          />
          <span className="unit-switch" role="group" aria-label="Weight units">
            {(['kg', 'lb'] as WeightUnit[]).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={wu === k}
                aria-label={k === 'kg' ? 'Kilograms' : 'Pounds'}
                className={wu === k ? 'on' : ''}
                onClick={() => {
                  setText(null);
                  setWu(k);
                }}
              >
                {k}
              </button>
            ))}
          </span>
        </div>
      </div>
      {wrong && (
        <p className="msg error" role="alert">
          Weight should be between {fromKg(WEIGHT_HARD[0], wu)} and {fromKg(WEIGHT_HARD[1], wu)} {wu}. Is the unit right?
        </p>
      )}
      {note && (
        <p id="weight-note" className="muted small weight-note">
          Only used to double-check {whose} measurements against {whose} height. Never drafted from, shown on a pattern or sent anywhere.
        </p>
      )}
    </div>
  );
}

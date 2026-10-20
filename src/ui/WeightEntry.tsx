import { useState } from 'react';
import type { Unit } from '../measurements';

// Weight, offered on the height page and never asked for: it only ever double-checks the girths against the
// height, so a slipped tape or a wrong unit is caught before anything is drafted. It is not drafted from,
// shown on a pattern, exported or sent anywhere, and the page says so. Behind a link so the page stays one
// number, and the weight stays optional.

export type WeightUnit = 'kg' | 'lb';
/** Weight follows the tape's unit: kilograms with centimetres, pounds with inches. */
export const weightUnitOf = (unit: Unit): WeightUnit => (unit === 'cm' ? 'kg' : 'lb');
const LB = 0.45359237;
export const fromKg = (kg: number, u: WeightUnit) => (u === 'kg' ? Math.round(kg * 10) / 10 : Math.round((kg / LB) * 10) / 10);
export const toKg = (x: number, u: WeightUnit) => Math.round((u === 'kg' ? x : x * LB) * 10) / 10;

/** Weights that can't be right, in kg: outside this it is nearly always the other unit or a slipped digit. */
export const WEIGHT_HARD: [number, number] = [25, 350];

/** The link that opens the weight box, beside "How to do it" so the page stays the same height. */
export function WeightLink({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" className="link quiet weight-link" onClick={onOpen}>
      Add weight (optional)
    </button>
  );
}

export function WeightEntry({ unit, helper, weight, onWeight }: { unit: Unit; helper: boolean; weight?: number; onWeight: (kg: number | undefined) => void }) {
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
        <label htmlFor="step-weight">Weight (optional)</label>
        <div className="entry-row">
          <input
            id="step-weight"
            inputMode="decimal"
            autoComplete="off"
            value={text ?? (weight === undefined ? '' : String(fromKg(weight, wu)))}
            aria-invalid={wrong ? true : undefined}
            aria-describedby="weight-note"
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
      <p id="weight-note" className="muted small weight-note">
        Only used to double-check {whose} measurements against {whose} height. Never drafted from, shown on a pattern or sent anywhere.
      </p>
    </div>
  );
}

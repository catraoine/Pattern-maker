import { createContext, useContext, useEffect, useRef, useState, type FormEvent } from 'react';
import type { Unit } from '../measurements';
import { fmtLength, inInches, toInches, typedLength } from '../units';

// A length typed instead of dragged. Testers tried to type their length into the label beside the hem dot, and
// nothing happened (testers, Nov 17; Cat applied "drag the dot, or tap the length to type it"). Tapping that label now
// opens a small box under the drawing; the length goes through the same rules as a drag.

/** What a tapped length label asks for: a length in cm from where it is measured, kept between min and max. */
export interface LengthAsk {
  /** Read out and shown over the box, such as "Skirt length". */
  name: string;
  /** Where it is measured from, such as "from the waist". */
  from: string;
  cm: number;
  min: number;
  max: number;
  onCm: (cm: number) => void;
  /** What hangs on below the length typed, and how far: a peplum below its seam. */
  below?: { what: string; cm: number };
}

/** Opens the box; given by the Style layout, so every drawing's length label can offer it. */
export const TypeLength = createContext<((ask: LengthAsk) => void) | undefined>(undefined);

/** The sewist's unit, given by the app: the box takes and shows lengths in it. */
export const UnitNow = createContext<Unit>('cm');

/** A drawing's spoken value in the sewist's unit. The words on screen are rewritten into inches, but a handle's spoken
 *  value is not on screen, so it still said "92 cm" to an inch tester (pretend tester, Nov 18). */
export function useSaid() {
  const unit = useContext(UnitNow);
  return (text: string) => (unit === 'in' ? inInches(text) : text);
}

const half = (v: number) => Math.round(v * 2) / 2;
/** In the sewist's unit, as she would type it: cm to the millimetre, inches to the eighth ("20⅞"). A dragged 53.8 cm
 *  opened as 54, against the 53.8 on the label and in the table (pretend tester DO walk, Nov 20). */
const shown = (cm: number, unit: Unit) => (unit === 'in' ? toInches(cm).replace(/ in$/, '') : String(Math.round(cm * 10) / 10));
const word = (unit: Unit) => (unit === 'in' ? 'in' : 'cm');

/** The length label's tap area, laid over the label's words on the drawing. Width and height are the words' own. */
export function LengthTap({ x, y, width, height, ask }: { x: number; y: number; width: number; height: number; ask: LengthAsk }) {
  return (
    <TypeLength.Consumer>
      {(open) =>
        open && (
          <rect
            // A little bigger than the words, for a finger: the target was about 74 by 9 px on a phone (pretend
            // tester, Nov 18). The dot's own hit area is drawn over it, so a drag still starts on the dot.
            x={x - height * 0.4}
            y={y - height * 0.4}
            width={width + height * 0.8}
            height={height * 1.8}
            className="len-type"
            fill="transparent"
            role="button"
            aria-label={`Type the ${ask.name.toLowerCase()}`}
            tabIndex={0}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => open(ask)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                open(ask);
              }
            }}
          />
        )
      }
    </TypeLength.Consumer>
  );
}

/** The box itself, under the drawing. The words are written in the sewist's unit here, so the page's inch rewriting
 *  leaves them alone (data-keep-cm). */
export function LengthBox({ ask, unit, onClose }: { ask: LengthAsk; unit: Unit; onClose: () => void }) {
  const [text, setText] = useState(shown(ask.cm, unit));
  const [wrong, setWrong] = useState<string>();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);
  // "From the top of the skirt, 5 cm below your waist" in the sewist's unit.
  const from = unit === 'in' ? inInches(ask.from) : ask.from;
  const range = `${fmtLength(half(ask.min), unit)} to ${fmtLength(half(ask.max), unit)} ${from}`;
  const set = (e: FormEvent) => {
    e.preventDefault();
    // Set with the number as it opened leaves the length alone: the box opens rounded (49 for 49.1, 23⅝ for a knee at
    // 23½), and Set alone moved it (pretend tester DK walk, Nov 19).
    if (text === shown(ask.cm, unit)) return onClose();
    const cm = typedLength(text, unit);
    if (!Number.isFinite(cm) || cm <= 0) return setWrong(`Type a number, ${range}.`);
    if (cm < ask.min - 0.25 || cm > ask.max + 0.25) return setWrong(`This one goes ${range}.`);
    // Inches are kept as typed: rounded to the half cm, 20 in came back as 20⅛ (pretend tester, Nov 17).
    ask.onCm(Math.min(ask.max, Math.max(ask.min, unit === 'in' ? Math.round(cm * 100) / 100 : half(cm))));
    onClose();
  };
  return (
    <form className="length-box" data-keep-cm onSubmit={set} aria-label={ask.name}>
      <label htmlFor="length-box-input">
        {ask.name}, {from}
      </label>
      <div className="length-box-row">
        <input
          id="length-box-input"
          ref={input}
          inputMode="decimal"
          autoComplete="off"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setWrong(undefined);
          }}
          aria-describedby="length-box-note"
          aria-invalid={!!wrong}
        />
        <span className="length-box-unit">{word(unit)}</span>
        <button type="submit" className="primary">
          Set
        </button>
        <button type="button" className="later" onClick={onClose}>
          Cancel
        </button>
      </div>
      <p id="length-box-note" className={wrong ? 'length-box-note wrong' : 'length-box-note'} role={wrong ? 'alert' : undefined}>
        {wrong ?? `Any length ${range}.`}
        {ask.below && ` ${ask.below.what} hangs about ${fmtLength(half(ask.below.cm), unit)} below it.`}
      </p>
    </form>
  );
}

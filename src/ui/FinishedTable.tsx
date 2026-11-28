import { useContext, type ReactNode } from 'react';
import type { SpecRow } from '../engine/techpack';
import { easeLevel } from '../engine/easeMap';
import { isWaistRow } from '../engine/spec';
import { toInches } from '../units';
import { UnitNow } from './LengthEntry';

// The finished measurements up front (F1 Table Up Front, Cat, 2026-10-28): size charts hide the ease, so
// every garment shows what the pattern measures against you, the ease between, and a plain fit word.

/** The rounds a fit word reads true for: the body's girths. An arm or a crotch has its own scale. */
const GIRTH = /^(Bust|Waist|Hip|High hip|Underbust|Top edge)\b/;
/** The few lengths worth seeing beside them; the rest stays on the printed spec sheet. */
const LENGTH = /^(Length|Nape to hem|Centre back length|Outside leg|Hem circumference|Hem, round|Hem, \d)/;

interface FinishedLine {
  label: string;
  body?: number;
  finished: number;
  ease?: number;
  /** Close, Comfy, Roomy, Held in; "Stretches on" for a knit. */
  fit?: string;
}

/** The upper arm's word. An arm needs less room than a body to feel the same, so its steps are smaller: a set-in sleeve
 *  with about 5 cm over the arm is an ordinary, comfortable sleeve. The row showed "+5" with no word beside the bust's
 *  "+7 Comfy" and read as missing (cold read EK, Nov 27). */
const armLevel = (ease: number) => (ease < 0 ? 'Held in' : ease < 4 ? 'Close' : ease < 9 ? 'Comfy' : 'Roomy');

/**
 * The rows the table shows, from the garment's spec: its girths against you with the ease, then its
 * lengths. A knit's negative ease is the cloth stretching on; an elastic waist is read at the elastic.
 */
export function finishedLines(rows: SpecRow[], opts: { knit?: boolean; elasticCm?: number } = {}): FinishedLine[] {
  const out: FinishedLine[] = [];
  for (const r of rows) {
    if (typeof r.finished !== 'number') continue;
    const girth = r.body !== undefined && (GIRTH.test(r.label) || /^Upper arm/.test(r.label));
    if (!girth && !LENGTH.test(r.label)) continue;
    if (opts.elasticCm !== undefined && isWaistRow(r.label) && r.body !== undefined) {
      out.push({ label: 'Waist, on elastic', body: r.body, finished: opts.elasticCm, ease: Math.round((opts.elasticCm - r.body) * 10) / 10, fit: 'Snug' });
      continue;
    }
    const arm = /^Upper arm/.test(r.label);
    const fit =
      r.ease === undefined || !(GIRTH.test(r.label) || arm) ? undefined : opts.knit && r.ease < 0 ? 'Stretches on' : arm ? armLevel(r.ease) : easeLevel(r.ease).label;
    out.push({ label: r.label.replace(/ \(hem\)$/, ', at the hem'), body: r.body, finished: r.finished, ease: r.ease, fit });
  }
  // The girths first, then the lengths; a dress is read nape to hem, not by its bodice and skirt apart.
  const whole = out.some((l) => l.label === 'Length, nape to hem');
  // The waist to hem stays beside it: a dress's length is typed from the waist, and a tester checking a typed 57.5 found only
  // the 98.5 from the neck (pretend tester, Nov 18).
  const shown = whole ? out.filter((l) => l.label !== 'Centre back length') : out;
  return [...shown.filter((l) => l.body !== undefined), ...shown.filter((l) => l.body === undefined)];
}

/** The table's plainer names for two rows; the printed spec sheet keeps the pattern cutter's words. */
const PLAIN: Record<string, string> = { 'Hem circumference': 'Hem, all the way round', 'Length, nape to hem': 'Length, back of neck to hem' };

// The numbers carry no unit of their own, so the page's inch rewrite (units.ts) passed them by and an inch tester read
// centimetres under an "All in cm" note (pretend-tester walk, Nov 17): they are written in the sewist's unit here,
// inches to the nearest eighth like the rest of the app.
const fmtIn = (unit: 'cm' | 'in') => (v: number) => (unit === 'cm' ? `${Math.round(v * 10) / 10}` : toInches(v).replace(/ in$/, ''));

/** The fit word as it reads after the ease: "close fit", "comfy", "stretches on". */
const fitWords = (fit: string) => (fit === 'Close' ? 'Close fit' : fit);

/** The finished measurements table: You, the garment, and the ease with its fit word. */
export function FinishedTable({ lines, noun, children }: { lines: FinishedLine[]; noun: string; children?: ReactNode }) {
  const unit = useContext(UnitNow);
  if (!lines.length) return null;
  const fmt = fmtIn(unit);
  // In inches the ease is the finished size less yours, each as shown to the eighth, so the row adds up: rounded on its
  // own, the inch skirt read 43⅞ + ¾ = 44¾ (DU tester walk, Nov 21). It moves by an eighth at most.
  const eighth = 2.54 / 8;
  const shownEase = (l: FinishedLine) => (unit === 'in' && l.body !== undefined ? (Math.round(l.finished / eighth) - Math.round(l.body / eighth)) * eighth : l.ease!);
  const signed = (v: number) => (fmt(v) === '0' || fmt(-v) === '0' ? '0' : v > 0 ? `+${fmt(v)}` : `−${fmt(-v)}`);
  return (
    <section className="finished" aria-labelledby="finished-h">
      <p className="eyebrow" id="finished-h">
        Finished measurements
      </p>
      <table className="finished-table">
        <thead>
          <tr>
            <th scope="col">
              <span className="visually-hidden">Measurement</span>
            </th>
            <th scope="col">You</th>
            <th scope="col">{noun}</th>
            <th scope="col">Ease</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.label}>
              <th scope="row">{PLAIN[l.label] ?? l.label}</th>
              <td>{l.body !== undefined ? fmt(l.body) : ''}</td>
              <td className="fin">{fmt(l.finished)}</td>
              <td className="ease">
                {l.ease !== undefined && signed(shownEase(l))}
                {/* Plain words after the number, not a filled tag (clarity review A2, Nov 22: CLOSE read as a button to close the row). */}
                {l.fit && <span className={`fitword fit-${l.fit.split(' ')[0].toLowerCase()}`}>{fitWords(l.fit)}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small">All in {unit === 'cm' ? 'cm' : 'inches'}. Ease is the room the pattern adds over your body.</p>
      {children}
    </section>
  );
}

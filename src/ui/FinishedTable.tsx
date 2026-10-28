import type { ReactNode } from 'react';
import type { SpecRow } from '../engine/techpack';
import { easeLevel } from '../engine/easeMap';

// The finished measurements up front (F1 Table Up Front, Cat, 2026-10-28): size charts hide the ease, so
// every garment shows what the pattern measures against you, the ease between, and a plain fit word.

/** The rounds a fit word reads true for: the body's girths. An arm or a crotch has its own scale. */
const GIRTH = /^(Bust|Waist|Hip|High hip|Underbust)\b/;
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
    if (opts.elasticCm !== undefined && r.label === 'Waist' && r.body !== undefined) {
      out.push({ label: 'Waist, on elastic', body: r.body, finished: opts.elasticCm, ease: Math.round((opts.elasticCm - r.body) * 10) / 10, fit: 'Snug' });
      continue;
    }
    const fit =
      r.ease === undefined || !GIRTH.test(r.label) ? undefined : opts.knit && r.ease < 0 ? 'Stretches on' : easeLevel(r.ease).label;
    out.push({ label: r.label.replace(/ \(hem\)$/, ', at the hem'), body: r.body, finished: r.finished, ease: r.ease, fit });
  }
  // The girths first, then the lengths; a dress is read nape to hem, not by its bodice and skirt apart.
  const whole = out.some((l) => l.label === 'Length, nape to hem');
  const shown = whole ? out.filter((l) => l.label !== 'Centre back length' && l.label !== 'Length, waist to hem') : out;
  return [...shown.filter((l) => l.body !== undefined), ...shown.filter((l) => l.body === undefined)];
}

const fmt = (v: number) => `${Math.round(v * 10) / 10}`;
const signed = (v: number) => (v > 0 ? `+${fmt(v)}` : v < 0 ? `−${fmt(-v)}` : '0');

/** The finished measurements table: You, the garment, and the ease with its fit word. */
export function FinishedTable({ lines, noun, children }: { lines: FinishedLine[]; noun: string; children?: ReactNode }) {
  if (!lines.length) return null;
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
              <th scope="row">{l.label}</th>
              <td>{l.body !== undefined ? fmt(l.body) : ''}</td>
              <td className="fin">{fmt(l.finished)}</td>
              <td className="ease">
                {l.ease !== undefined && signed(l.ease)}
                {l.fit && <span className={`fitword fit-${l.fit.split(' ')[0].toLowerCase()}`}>{l.fit}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small">All in cm. Ease is the room the pattern adds over your body.</p>
      {children}
    </section>
  );
}

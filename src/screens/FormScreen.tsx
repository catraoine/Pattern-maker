import { useMemo, useState } from 'react';
import { buildBody } from '../engine/body3d';
import { CHECK_TOLERANCE, coverMissing, formCheck, padMap, type PadId } from '../engine/formCover';
import type { MeasurementValues, Unit } from '../measurements';
import { TestingTag } from '../ui/TestingTag';

interface Props {
  /** Measurements with estimates filled in, which the form is built from. */
  values: MeasurementValues;
  /** What was actually measured, to say what's still needed. */
  measured: MeasurementValues;
  unit: Unit;
  /** Whose form it is, as the screen names them. */
  profile: string;
  onPrint: () => void;
  /** Take the measurements the form is built from. */
  onMeasure: () => void;
}

const NAMES: Partial<Record<string, string>> = {
  full_bust: 'bust',
  waist: 'waist',
  full_hip: 'hip',
  waist_to_hip: 'waist to hip',
  nape_to_waist: 'back length',
  shoulder_width: 'shoulder width',
  waist_to_knee: 'waist to knee',
};

const show = (cm: number, unit: Unit) => (unit === 'cm' ? `${Math.round(cm * 10) / 10} cm` : `${Math.round((cm / 2.54) * 10) / 10} in`);
const fromUnit = (v: number, unit: Unit) => (unit === 'cm' ? v : v * 2.54);

/** The person's own form, front on, in the app's fine contour lines, with the padding bands on it. */
function PadForm({ values, bands }: { values: MeasurementValues; bands: { h: number; label: string }[] }) {
  const body = useMemo(() => buildBody(values), [values]);
  const top = body.rings[0].h, bottom = body.rings[body.rings.length - 1].h;
  const widest = Math.max(...body.rings.map((r) => r.half));
  const H = 300, s = H / (top - bottom), cx = widest * s + 4;
  // Room on the right for the band labels.
  const W = cx + widest * s + 104;
  const Y = (h: number) => 10 + (top - h) * s;
  const lines = 11;
  const paths = Array.from({ length: lines }, (_, k) => {
    const f = -1 + (2 * k) / (lines - 1);
    return {
      f,
      d: body.rings.map((r, i) => `${i ? 'L' : 'M'}${(cx + f * r.half * s).toFixed(1)},${Y(r.h).toFixed(1)}`).join(''),
    };
  });
  const halfAt = (h: number) => {
    const r = body.rings.reduce((a, b) => (Math.abs(b.h - h) < Math.abs(a.h - h) ? b : a));
    return r.half * s;
  };
  return (
    <svg viewBox={`0 0 ${W} ${H + 40}`} role="img" aria-label="Your form, with where to pad it">
      {paths.map(({ f, d }) => (
        <path key={f} d={d} fill="none" style={{ stroke: 'var(--gild)' }} strokeOpacity={0.35 + 0.65 * (1 - Math.abs(f))} strokeWidth={0.9 * (1 - 0.35 * Math.abs(f))} />
      ))}
      <line x1={cx} x2={cx} y1={Y(bottom)} y2={Y(bottom) + 26} style={{ stroke: 'var(--guide)' }} strokeWidth={1.2} />
      {bands.map((b) => (
        <g key={b.label}>
          <line x1={cx - halfAt(b.h)} x2={cx + halfAt(b.h)} y1={Y(b.h)} y2={Y(b.h)} style={{ stroke: 'var(--gild)' }} strokeWidth={1.4 * 1.3} />
          <text x={cx + widest * s + 10} y={Y(b.h) + 3} fontSize="9" style={{ fill: 'var(--muted)', fontFamily: 'var(--mono)', letterSpacing: '0.12em' }}>
            {b.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

/**
 * Body Double (Cat's picks B1 Cover Pattern, B2 Pad Map and B5 Form Check): which store form to buy, how
 * much to pad it, the cover pattern to put over it, and a check once it's padded.
 */
export function FormScreen({ values, measured: taken, unit, profile, onPrint, onMeasure }: Props) {
  const missing = coverMissing(taken);
  const map = useMemo(() => padMap(values), [values]);
  const [measured, setMeasured] = useState<Partial<Record<PadId, string>>>({});
  const rows = useMemo(
    () => formCheck(values, Object.fromEntries(Object.entries(measured).map(([k, v]) => [k, fromUnit(parseFloat(v ?? ''), unit)]))),
    [values, measured, unit],
  );
  const who = profile === 'Me' ? 'you' : profile;

  if (missing.length) {
    return (
      <div className="stack wide">
        <section className="card" aria-labelledby="formtitle">
          <p className="eyebrow">Body Double <TestingTag /></p>
          <h1 id="formtitle">A dress form in your shape</h1>
          <p className="muted">
            The form is built from your own measurements. It still needs your {missing.map((id) => NAMES[id] ?? id.replace(/_/g, ' ')).join(', ')}.
          </p>
          <button type="button" className="primary" onClick={onMeasure}>
            Take {missing.length === 1 ? 'it' : 'them'}
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="stack wide">
      <section className="card" aria-labelledby="formtitle">
        <p className="eyebrow">Body Double <TestingTag /></p>
        <h1 id="formtitle">A dress form in your shape</h1>
        <p className="muted">
          Pad a store form out to {who === 'you' ? 'your' : `${who}'s`} measurements, then pull on a cover drafted to the same body. Everything you fit on it fits
          {who === 'you' ? ' you' : ` ${who}`}.
        </p>
        <div className="padform">
          <PadForm values={values} bands={map.pads.filter((p) => p.layers > 0).map((p) => ({ h: p.h, label: `${p.label.toUpperCase()} +${p.thick.toFixed(1)} CM` }))} />
        </div>
        <h2>{map.size ? `Buy a size ${map.size} form` : 'Buy the smallest form you can find'}</h2>
        <div className="padtable" role="table" aria-label="Padding to add">
          <span className="head" role="columnheader">Where</span>
          <span className="head num" role="columnheader">You</span>
          <span className="head num" role="columnheader">Pad</span>
          {map.pads.map((p) => (
            <div key={p.id} role="row" style={{ display: 'contents' }}>
              <span role="cell">{p.label}</span>
              <span role="cell" className="num">{show(p.you, unit)}</span>
              <span role="cell" className="num">{p.layers ? `${p.layers} ${p.layers === 1 ? 'layer' : 'layers'}` : 'none'}</span>
            </div>
          ))}
        </div>
        <p className="muted small">
          {map.size
            ? 'From a typical store form chart. Check your form’s own label: it must be no bigger than you at bust, waist and hip, because padding only adds.'
            : 'You are smaller than a size 4 form somewhere, so the cover would sit loose there. Look for a petite or adjustable form.'}{' '}
          A layer is thin 2 oz wadding, about 3 mm pressed.
        </p>
        <button type="button" className="primary" onClick={onPrint}>
          Get the cover pattern
        </button>
      </section>

      <section className="card" aria-labelledby="checktitle">
        <p className="eyebrow">Once it’s padded</p>
        <h2 id="checktitle">Check the form</h2>
        <p className="muted">With the cover on, measure the form and type in what you get.</p>
        <div className="formcheck">
          {(['full_bust', 'waist', 'full_hip'] as PadId[]).map((id) => (
            <label key={id}>
              <span className="eyebrow">{NAMES[id]} · {unit}</span>
              <input
                id={`formcheck-${id}`}
                inputMode="decimal"
                value={measured[id] ?? ''}
                onChange={(e) => setMeasured({ ...measured, [id]: e.target.value })}
              />
            </label>
          ))}
        </div>
        {rows.length > 0 && (
          <ul>
            {rows.map((r) => (
              <li key={r.id}>
                <strong>{r.label}</strong>{' '}
                {r.fix ? r.fix : `${show(r.measured, unit)}: right, within ${show(CHECK_TOLERANCE, unit)}.`}
              </li>
            ))}
          </ul>
        )}
        {rows.length === 3 && rows.every((r) => !r.fix) && <p className="msg">The form measures {who === 'you' ? 'you' : who}. It’s ready to fit on.</p>}
      </section>
    </div>
  );
}

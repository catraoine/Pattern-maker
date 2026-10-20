import { useMemo, useState } from 'react';
import type { Piece } from '../engine/piece';
import type { P } from '../engine/geometry';
import { GradeStep, allSizes, gradeRun, gradedNest, rulesFor } from '../engine/grading';
import { FIELDS, Garment, MeasurementValues } from '../measurements';
import { FabricWidth, layPlan } from '../engine/layplan';
import { TestingTag } from './TestingTag';

interface Props {
  garment: Garment;
  values: MeasurementValues;
  /** The pattern's pieces, with allowances, drafted to a set of measurements. */
  draftAt: (m: MeasurementValues) => Piece[];
  title: string;
  fileBase: string;
  width: FabricWidth;
  nap: boolean;
  download: (data: BlobPart, type: string, name: string) => void;
}

const today = () => new Date().toISOString().slice(0, 10);

/**
 * The pattern graded into a run of sizes for production: the grade rules, the graded nest, and a
 * full-scale marker with every size in one lay, as a plotter PDF or a DXF.
 */
export function SizeRun({ garment, values, draftAt, title, fileBase, width, nap, download }: Props) {
  const [step, setStep] = useState<GradeStep>(4);
  const [down, setDown] = useState(2);
  const [up, setUp] = useState(2);
  const [busy, setBusy] = useState(false);
  const run = useMemo(() => gradeRun(values, draftAt, { down, up, step }), [values, draftAt, down, up, step]);
  const nest = useMemo(() => gradedNest(run), [run]);
  const rules = rulesFor(values, step).filter((r) => FIELDS[garment].some((f) => f.id === r.id));
  const label = (id: string) => FIELDS[garment].find((f) => f.id === id)?.label ?? id;
  const failed = run.filter((s) => s.error);
  const marker = () => layPlan(allSizes(run), width, 'self', nap);

  const markerPdf = async () => {
    setBusy(true);
    try {
      const lay = marker();
      if (!lay) return;
      const { markerPdf } = await import('../engine/marker');
      download(await markerPdf(lay, `${title}, sizes ${run[0].label} to ${run[run.length - 1].label}`), 'application/pdf', `${fileBase}-marker.pdf`);
    } finally {
      setBusy(false);
    }
  };
  const markerDxf = async () => {
    const lay = marker();
    if (!lay) return;
    const { markerDxf } = await import('../engine/marker');
    download(markerDxf(lay, { style: title, date: today() }), 'application/dxf', `${fileBase}-marker.dxf`);
  };
  const nestDxf = async () => {
    const { toDxf } = await import('../engine/dxf');
    download(toDxf(allSizes(run), { style: title, size: 'graded', date: today() }), 'application/dxf', `${fileBase}-graded.dxf`);
  };
  const count = (n: number, set: (v: number) => void, aria: string) => (
    <div className="stepper" role="group" aria-label={aria}>
      <button type="button" aria-label="Fewer" onClick={() => set(Math.max(0, n - 1))} disabled={n <= 0}>
        −
      </button>
      <span>{n}</span>
      <button type="button" aria-label="More" onClick={() => set(Math.min(4, n + 1))} disabled={n >= 4}>
        +
      </button>
    </div>
  );

  return (
    <section className="card" aria-labelledby="gradetitle">
      <p className="eyebrow">For production <TestingTag /></p>
      <h2 id="gradetitle">Grade it into a size run</h2>
      <p className="muted">
        Your pattern is the base size. Each size up or down moves every measurement by its grade rule, and every size is drafted from
        its own measurements, so each one passes the same seam check. The nest lines the sizes up on their starting points.
      </p>
      <div className="row wrap">
        <div className="seg" role="group" aria-label="Size step">
          {([4, 5] as GradeStep[]).map((s) => (
            <button key={s} type="button" className={step === s ? 'on' : ''} aria-pressed={step === s} onClick={() => setStep(s)}>
              {s} cm steps
            </button>
          ))}
        </div>
        <span className="small">Sizes down</span>
        {count(down, setDown, 'Sizes down')}
        <span className="small">up</span>
        {count(up, setUp, 'Sizes up')}
      </div>
      <div className="nests">
        {nest.map((n) => (
          <NestView key={n.name} name={n.name} sizes={n.sizes} />
        ))}
      </div>
      {failed.length > 0 && <p className="msg small">{failed.map((s) => `Size ${s.label}: ${s.error}`).join(' ')}</p>}
      <details>
        <summary className="small">Grade rules, per size</summary>
        <div className="sumgrid rules">
          {rules.map((r) => (
            <span key={r.id} className="small">
              {label(r.id)}: {r.perSize} cm
            </span>
          ))}
        </div>
      </details>
      <div className="row wrap">
        <button type="button" className="secondary" onClick={nestDxf}>
          Graded pattern (DXF)
        </button>
        <button type="button" className="secondary" onClick={markerPdf} disabled={busy}>
          {busy ? 'Laying the marker…' : `Marker, ${width} cm (plotter PDF)`}
        </button>
        <button type="button" className="secondary" onClick={markerDxf}>
          Marker (DXF)
        </button>
      </div>
      <p className="muted small">The marker lays one of every size on {width} cm fabric at full scale, in panels up to 4.8 m long.</p>
    </section>
  );
}

function NestView({ name, sizes }: { name: string; sizes: { offset: number; label: string; pts: P[] }[] }) {
  const all = sizes.flatMap((s) => s.pts);
  const x0 = Math.min(...all.map((q) => q.x)) - 1;
  const y0 = Math.min(...all.map((q) => q.y)) - 1;
  const w = Math.max(...all.map((q) => q.x)) + 1 - x0;
  const h = Math.max(...all.map((q) => q.y)) + 1 - y0;
  const max = Math.max(...sizes.map((s) => Math.abs(s.offset)), 1);
  return (
    <figure className="nest">
      <svg viewBox={`${x0} ${y0} ${w} ${h}`} role="img" aria-label={`${name}, graded nest`}>
        {sizes.map((s) => (
          <polygon
            key={s.offset}
            points={s.pts.map((q) => `${q.x.toFixed(2)},${q.y.toFixed(2)}`).join(' ')}
            className={s.offset === 0 ? 'nest-base' : 'nest-size'}
            style={{ opacity: s.offset === 0 ? 1 : 0.35 + 0.5 * (1 - Math.abs(s.offset) / (max + 1)) }}
          />
        ))}
      </svg>
      <figcaption className="small">{name}</figcaption>
    </figure>
  );
}

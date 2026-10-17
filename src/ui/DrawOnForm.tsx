// Draw on your form: a dress form built from your measurements, in fine contour lines, with the
// bodice's neckline, seams and hem drawn on it like a draper's style tape. Draw a new line with a
// finger and the pattern follows it (see drawOnForm.ts for how each line is read).
import { PointerEvent, useMemo, useRef, useState } from 'react';
import type { P } from '../engine/geometry';
import type { BodiceDraft } from '../engine/bodice';
import { bodyOutline, spline } from './bodyOutline';
import { worn } from './BodiceShape';
import { FormLine, landmarks } from './drawOnForm';
import type { SkirtMeasurements } from '../engine/skirt';

interface Props {
  draft: BodiceDraft;
  m: { full_bust: number; waist: number; full_hip?: number; waist_to_hip?: number; waist_to_knee?: number; waist_to_floor?: number };
  /** The bodice alone, or a dress, whose hem is the skirt's, drawn on the legs. */
  garment: 'bodice' | 'dress';
  /** Where the hem sits now and how far down a hem can go, in cm below the waist. */
  hem: number;
  hemMax: number;
  /** Read a finished line and apply it; returns what it was read as, in words. */
  onLine: (kind: FormLine, stroke: P[]) => string;
  onDone: () => void;
  onCancel: () => void;
}

const LINES: [FormLine, string][] = [
  ['neckline', 'Neckline'],
  ['seam', 'Seam'],
  ['hem', 'Hem'],
];

const HELP: Record<FormLine, string> = {
  neckline: 'Draw the neckline from the shoulder down to where you want it. Both sides match.',
  seam: 'Draw from the shoulder or armhole through the bust to the waist for princess seams, or from any edge to the bust for a dart.',
  hem: 'Draw across the body where you want the hem to fall.',
};

const f = (n: number) => n.toFixed(2);
const path = (pts: P[]) => pts.map((q, i) => `${i ? 'L' : 'M'}${f(q.x)} ${f(q.y)}`).join(' ');

/** Half the form's width at each height: the neck, a rounded shoulder, then bust, waist and hip. */
export function formWidth(draft: BodiceDraft, m: Props['m']) {
  const { neckPoint, shoulderTip, apex, waistY } = landmarks(draft);
  const neck = neckPoint.x * 0.85;
  const bust = m.full_bust / 4;
  const hip = m.full_hip && m.waist_to_hip ? { at: waistY + m.waist_to_hip, half: m.full_hip / 4 } : undefined;
  const body = spline([
    [shoulderTip.y, shoulderTip.x],
    [(shoulderTip.y + apex.y) / 2, bust * 0.96],
    [apex.y, bust],
    [waistY, m.waist / 4],
    ...(hip
      ? ([[waistY + (hip.at - waistY) / 2, (m.waist / 4 + hip.half) / 2 + 0.4], [hip.at, hip.half], [hip.at + 8, hip.half * 0.97]] as [number, number][])
      : ([[waistY + 8, (m.waist / 4) * 1.08]] as [number, number][])),
  ]);
  const bottom = hip ? hip.at + 8 : waistY + 8;
  const width = (y: number) => {
    if (y <= neckPoint.y) return neck;
    if (y <= shoulderTip.y) {
      const t = (y - neckPoint.y) / Math.max(0.1, shoulderTip.y - neckPoint.y);
      return neck + (shoulderTip.x - neck) * (1 - (1 - t) ** 2);
    }
    return body(Math.min(y, bottom));
  };
  return { width, top: neckPoint.y - 7, bottom };
}

export function DrawOnForm({ draft, m, garment, hem, hemMax, onLine, onDone, onCancel }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const [kind, setKind] = useState<FormLine>('neckline');
  const [stroke, setStroke] = useState<P[]>();
  const [said, setSaid] = useState<string>();
  const { waistY } = landmarks(draft);
  const form = useMemo(() => formWidth(draft, m), [draft, m]);
  const legs = garment === 'dress' && m.waist_to_knee && m.waist_to_floor && m.full_hip && m.waist_to_hip;

  const frame = useMemo(() => {
    const half = Math.max(m.full_bust, m.full_hip ?? 0) / 4 + 7;
    return { half, top: form.top - 2, bottom: Math.max(form.bottom + 12, waistY + hemMax + 4) };
  }, [m, form, waistY, hemMax]);
  const cx = frame.half;

  // The form in contour lines, as on the welcome screen: each line a fixed fraction of the way round.
  const contours = useMemo(() => {
    const n = 15;
    const ys = Array.from({ length: 121 }, (_, i) => form.top + ((form.bottom - form.top) * i) / 120);
    return Array.from({ length: n }, (_, i) => {
      const u = Math.sin(-Math.PI / 2 + (Math.PI * i) / (n - 1));
      return { d: path(ys.map((y) => ({ x: cx + u * form.width(y), y }))), edge: Math.abs(u) > 0.98, u };
    });
  }, [form, cx]);

  // The bodice's lines as they stand, mirrored onto both halves.
  const front = useMemo(() => worn(draft, 'front'), [draft]);
  const both = (pts: P[]) => path(pts.map((q) => ({ x: cx + q.x, y: q.y }))) + ' ' + path(pts.map((q) => ({ x: cx - q.x, y: q.y })));
  const neckPts = front.top.pts.filter((_, i) => front.top.tags[i] === 'neck');
  const seams = draft.styleLines ? draft.styleLines.front.map((l) => both(l.pts)).join(' ') : front.darts(cx);
  const hemY = waistY + hem;
  const hemHalf = hemY <= form.bottom ? form.width(hemY) + 1 : (m.full_hip ?? m.waist) / 4 + 2;
  const current: Record<FormLine, string> = {
    neckline: both(neckPts),
    seam: seams,
    hem: `M${f(cx - hemHalf)} ${f(hemY)} L${f(cx + hemHalf)} ${f(hemY)}`,
  };

  const toSvg = (e: PointerEvent): P => {
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.current!.getScreenCTM()!.inverse());
    return { x: pt.x, y: pt.y };
  };
  const end = () => {
    if (!stroke) return;
    if (stroke.length > 2) setSaid(onLine(kind, stroke.map((q) => ({ x: q.x - cx, y: q.y }))));
    setStroke(undefined);
  };

  return (
    <div className="form-draw">
      <div className="screen-head">
        <div>
          <p className="eyebrow">Drape · Your form</p>
          <h1>Draw your lines</h1>
        </div>
        <button type="button" className="link" onClick={onCancel}>
          Cancel
        </button>
      </div>
      <section className="card" aria-label="Your dress form">
        <div className="preview">
          <svg
            ref={svg}
            viewBox={`0 ${f(frame.top)} ${f(2 * cx)} ${f(frame.bottom - frame.top)}`}
            role="img"
            aria-label={`Your dress form, built from your measurements. ${HELP[kind]}`}
            className="preview-svg sketch shape drawing form-svg"
            onPointerDown={(e) => {
              (e.target as Element).setPointerCapture?.(e.pointerId);
              setStroke([toSvg(e)]);
            }}
            onPointerMove={(e) => stroke && setStroke([...stroke, toSvg(e)])}
            onPointerUp={end}
            onPointerCancel={() => setStroke(undefined)}
          >
            {legs && (
              <g transform={`translate(0 ${f(waistY)})`}>
                <path d={bodyOutline(m as SkirtMeasurements, cx)} className="form-legs" fill="none" strokeWidth={0.18} />
              </g>
            )}
            {!legs && (
              <path
                d={`M${f(cx)} ${f(form.bottom)} L${f(cx)} ${f(frame.bottom - 2)} M${f(cx - 8)} ${f(frame.bottom - 2)} L${f(cx + 8)} ${f(frame.bottom - 2)}`}
                className="form-stand"
                fill="none"
                strokeWidth={0.2}
              />
            )}
            {contours.map((c, i) => (
              <path key={i} d={c.d} className="form-line" fill="none" strokeWidth={c.edge ? 0.22 : 0.12} opacity={c.edge ? 0.9 : 0.25 + 0.2 * (1 - Math.abs(c.u))} />
            ))}
            {LINES.map(([id]) => (
              <path key={id} d={current[id]} className={id === kind ? 'tape on' : 'tape'} fill="none" strokeWidth={id === kind ? 0.42 : 0.22} strokeLinecap="round" />
            ))}
            {stroke && <polyline points={stroke.map((q) => `${f(q.x)},${f(q.y)}`).join(' ')} className="stroke" strokeWidth={0.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
          </svg>
        </div>
        <div className="chips" role="group" aria-label="What you are drawing">
          {LINES.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={kind === id ? 'chip on' : 'chip'}
              aria-pressed={kind === id}
              onClick={() => {
                setKind(id);
                setSaid(undefined);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="muted small form-said" role="status">
          {said ?? HELP[kind]}
        </p>
        <button type="button" className="primary" onClick={onDone}>
          Make the pattern
        </button>
      </section>
    </div>
  );
}

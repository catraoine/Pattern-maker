import { DIAGRAMS, keyFor, type Diagram, type DiagramId } from '../engine/diagrams';

/** A sewing step's small drawing, in fine champagne lines: one of the step diagrams by name, or a close-up drawing. */
export function StepDiagram(props: { id: DiagramId } | { dg: Diagram }) {
  const dg = 'dg' in props ? props.dg : DIAGRAMS[props.id];
  return (
    <svg viewBox={`-1 -1 ${dg.w + 2} ${dg.h + 2}`} className="stepdg" role="img" aria-label={dg.caption}>
      {dg.parts.map((pt, i) => (
        <path key={i} d={pt.pts.map((q, j) => `${j ? 'L' : 'M'}${q.x.toFixed(2)},${q.y.toFixed(2)}`).join('') + (pt.closed ? 'Z' : '')} className={`dg-${pt.kind}`} />
      ))}
      {dg.notes?.map((n, i) => (
        <text key={i} x={n.at.x} y={n.at.y} textAnchor={n.end ? 'end' : n.mid ? 'middle' : 'start'} className="dg-note">
          {n.text}
        </text>
      ))}
    </svg>
  );
}

/** A one-line key under a drawing, or under a row of close-ups, for the dashed, grey and shaded lines. */
export function DiagramKey({ dgs }: { dgs: Diagram[] }) {
  const key = keyFor(...dgs);
  if (!key.length) return null;
  return (
    <ul className="dg-key">
      {key.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

import { DIAGRAMS, DiagramId } from '../engine/diagrams';

/** A sewing step's small drawing, in fine champagne lines. */
export function StepDiagram({ id }: { id: DiagramId }) {
  const dg = DIAGRAMS[id];
  return (
    <svg viewBox={`-1 -1 ${dg.w + 2} ${dg.h + 2}`} className="stepdg" role="img" aria-label={dg.caption}>
      {dg.parts.map((pt, i) => (
        <path key={i} d={pt.pts.map((q, j) => `${j ? 'L' : 'M'}${q.x.toFixed(2)},${q.y.toFixed(2)}`).join('') + (pt.closed ? 'Z' : '')} className={`dg-${pt.kind}`} />
      ))}
    </svg>
  );
}

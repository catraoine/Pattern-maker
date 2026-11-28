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

/** A one-line key under a drawing, or above a list of them, for the dashed, grey, dotted and shaded lines. With `now`,
 *  the key is for all of `dgs` but shows only the entries `now` uses: the rest keep their room, so the drawing above
 *  keeps its size as Sewing mode moves through a step, and no entry names a line that isn't drawn (EL cold read). */
export function DiagramKey({ dgs, now }: { dgs: Diagram[]; now?: Diagram }) {
  const key = keyFor(...dgs);
  if (!key.length) return null;
  const shown = now ? keyFor(now) : key;
  // Always in the same order, so the key wraps the same way, and keeps one height, on every drawing of the step.
  return (
    <ul className="dg-key">
      {key.map((t) => (
        <li key={t} className={shown.includes(t) ? undefined : 'off'} aria-hidden={shown.includes(t) ? undefined : true}>
          {t}
        </li>
      ))}
    </ul>
  );
}

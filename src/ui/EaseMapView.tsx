import { useState } from 'react';
import { EASE_LEVELS, EaseView, easeLevel } from '../engine/easeMap';

interface Props {
  views: EaseView[];
  label: string;
}

const GAP = 7;

/** One row of pieces side by side, each filled level by level with the colour of its ease. */
function Row({ views, title, onPick }: { views: EaseView[]; title: string; onPick: (v: EaseView, i: number) => void }) {
  let x = 0;
  const placed = views.map((v) => {
    const xs = v.outline.map((q) => q.x);
    const x0 = Math.min(...xs);
    const at = x - x0;
    x += Math.max(...xs) - x0 + GAP;
    return { v, dx: at };
  });
  const ys = views.flatMap((v) => v.outline.map((q) => q.y));
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const w = Math.max(1, x - GAP);
  // One garment's pieces go by their own names (front, back); a dress keeps bodice and skirt apart.
  const short = new Set(views.map((v) => v.name.split(' ')[0])).size === 1;
  return (
    <figure className="easerow">
      <figcaption className="eyebrow">{title}</figcaption>
      <svg viewBox={`${-1} ${y0 - 1} ${w + 2} ${y1 - y0 + 6}`} role="img" aria-label={`${title}: ${views.map((v) => v.name).join(', ')}`}>
        {placed.map(({ v, dx }, k) => {
          const id = `ease-${title}-${k}`.replace(/\W/g, '');
          const pts = v.outline.map((q) => `${q.x + dx},${q.y}`).join(' ');
          const xs = v.outline.map((q) => q.x + dx);
          const left = Math.min(...xs);
          const right = Math.max(...xs);
          return (
            <g key={v.name}>
              <clipPath id={id}>
                <polygon points={pts} />
              </clipPath>
              <g clipPath={`url(#${id})`} className="easebands">
                {v.bands.map((b, i) => (
                  <rect key={i} x={left} y={b.y0} width={right - left} height={b.y1 - b.y0 + 0.05} className={`easeband ${easeLevel(b.ease).cls}`} onClick={() => onPick(v, i)}>
                    <title>{`${b.ease} cm of room`}</title>
                  </rect>
                ))}
              </g>
              <polygon points={pts} className="easeline" />
              <text x={(left + right) / 2} y={y1 + 4} className="easename" textAnchor="middle">
                {short ? v.name.replace(/^\S+ /, '') : v.name}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

/**
 * The fit shown on the pattern pieces: each level shaded by the room it leaves over the body, darker
 * where it's closer. Tap a level to read it in cm.
 */
export function EaseMapView({ views, label }: Props) {
  const [pick, setPick] = useState<{ name: string; i: number }>();
  const front = views.filter((v) => !/back/i.test(v.name));
  const back = views.filter((v) => /back/i.test(v.name));
  const picked = pick && views.find((v) => v.name === pick.name);
  const band = picked?.bands[pick!.i];
  const top = picked ? Math.min(...picked.outline.map((q) => q.y)) : 0;
  const onPick = (v: EaseView, i: number) => setPick({ name: v.name, i });
  // The key names only the levels this garment has: "Held in" shows on boned styles alone.
  const shown = EASE_LEVELS.filter((l) => views.some((v) => v.bands.some((b) => easeLevel(b.ease) === l)));
  const held = shown.includes(EASE_LEVELS[0]);
  return (
    <div className="easemap" aria-label={label}>
      <div className="easerows paper-sheet">
        {/* A front and a back alone sit side by side, so the fit fits on a phone screen. */}
        {front.length === 1 && back.length === 1 ? (
          <Row views={[...front, ...back]} title="Front and back" onPick={onPick} />
        ) : (
          <>
            {front.length > 0 && <Row views={front} title="Front" onPick={onPick} />}
            {back.length > 0 && <Row views={back} title="Back" onPick={onPick} />}
          </>
        )}
      </div>
      <ul className="easelegend" aria-label="Key">
        {shown.map((l) => (
          <li key={l.label}>
            <span className={`swatch ${l.cls}`} />
            {l.label}
          </li>
        ))}
      </ul>
      {held && (
        <p className="muted small">
          <strong>Held in:</strong> cut smaller than you on purpose, so the boning holds you.
        </p>
      )}
      <p className="muted small" role="status">
        {band && picked
          ? `${picked.name}, ${Math.round(band.y0 - top)} cm down: ${band.ease} cm of room, ${easeLevel(band.ease).label.toLowerCase()}.`
          : 'Darker where it fits closer. Tap any level for the room in cm.'}
      </p>
    </div>
  );
}

import { useId } from 'react';
import type { Lay } from '../engine/layplan';
import { PrintKind, printImage, printTileCm } from '../engine/prints';
import { tileUrl } from './FabricFill';

/** One fabric tile, in cm, as on the style sketch. */
const TILE = 16;

/**
 * A cutting layout: the fabric drawn lengthwise, the fold (or a selvedge) along the top, each piece's
 * cutting line where it is cut. In cm, scaled to fit. The fabric is drawn in the maker's cloth with its
 * grain running along the length, and the pieces lie on it as pattern paper (Cat's P4 Paper on Fabric).
 * With a print chosen, the print is drawn instead, at its own scale (Cat's P4 Place the Motifs): big
 * motifs are lined up so one sits in the middle of the front, and a border runs along the selvedge.
 */
export function LayPlanView({ lay, cloth = 'default', print }: { lay: Lay; cloth?: string; print?: { kind: PrintKind; repeat?: number; stripes?: boolean; gingham?: boolean } }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const L = lay.length + 4;
  const H = lay.across;
  const pts = (ps: { x: number; y: number }[]) => ps.map((q) => `${(q.y + 2).toFixed(2)},${q.x.toFixed(2)}`).join(' ');
  const size = Math.max(1.6, Math.min(2.4, L / 60));
  const shown = print && print.kind !== 'plain' ? print : undefined;
  const printTile = shown ? printTileCm(shown.kind, shown.repeat, shown.stripes) : TILE;
  // A motif in the middle of the front: the first front piece cut, else the first piece.
  const front = lay.placements.find((pl) => /front/i.test(pl.name)) ?? lay.placements[0];
  const centre = shown?.kind === 'motif' && front ? { x: front.at.y + 2, y: front.at.x } : undefined;
  const borderDepth = printTile * 0.42;
  return (
    <svg viewBox={`0 ${-size * 2.2} ${L} ${H + size * 4.4}`} className={shown ? 'layplan lay-printed' : 'layplan'} role="img" aria-label={`Cutting layout on ${lay.width} cm fabric, ${lay.metres.toFixed(1)} metres`}>
      <defs>
        <pattern id={`cloth${uid}`} patternUnits="userSpaceOnUse" width={TILE} height={TILE} patternTransform="rotate(90)">
          <image href={tileUrl(cloth)} width={TILE} height={TILE} preserveAspectRatio="none" />
        </pattern>
        {shown && (
          <pattern
            id={`print${uid}`}
            patternUnits="userSpaceOnUse"
            x={centre ? -printTile / 2 : 0}
            y={shown.kind === 'border' ? H - printTile : centre ? -printTile / 2 : 0}
            width={printTile}
            height={printTile}
            patternTransform={shown.kind === 'border' ? undefined : centre ? `translate(${centre.x} ${centre.y}) rotate(90)` : 'rotate(90)'}
          >
            <image href={printImage(shown.kind, import.meta.env.BASE_URL, shown.stripes, shown.gingham)} width={printTile} height={printTile} preserveAspectRatio="none" />
          </pattern>
        )}
        <pattern id={`dots${uid}`} patternUnits="userSpaceOnUse" width={2} height={2}>
          <circle cx={1} cy={1} r={0.12} className="lay-dot" />
        </pattern>
      </defs>
      {shown?.kind === 'border' ? (
        <>
          <rect x={0} y={0} width={L} height={H} className="lay-fabric lay-border-ground" />
          <rect x={0} y={H - borderDepth} width={L} height={borderDepth} fill={`url(#print${uid})`} />
        </>
      ) : (
        <rect x={0} y={0} width={L} height={H} className="lay-fabric" fill={shown ? `url(#print${uid})` : `url(#cloth${uid})`} />
      )}
      <line x1={0} y1={0} x2={L} y2={0} className={lay.folded ? 'lay-fold' : 'lay-edge'} />
      <text x={0} y={-size * 0.7} fontSize={size} className="lay-note">
        {lay.folded ? 'FOLD' : 'SELVEDGE'}
      </text>
      <text x={0} y={H + size * 1.6} fontSize={size} className="lay-note">
        {lay.folded ? 'SELVEDGES' : 'SELVEDGE'}
      </text>
      <text x={L} y={H + size * 1.6} fontSize={size} textAnchor="end" className="lay-note">
        {`${lay.metres.toFixed(1)} M  ·  ${lay.width} CM WIDE`}
      </text>
      {lay.placements.map((pl, i) => {
        const name = nameFit(pl.name.toUpperCase(), pl.pts, size * 0.8);
        const x = pl.at.y + 2;
        const y = pl.at.x;
        return (
          <g key={i}>
            <polygon points={pts(pl.pts)} className="lay-piece" />
            <polygon points={pts(pl.pts)} className="lay-paper-dots" fill={`url(#dots${uid})`} />
            <text x={x} y={y} fontSize={name.size} textAnchor="middle" className="lay-name" transform={name.turn ? `rotate(-90 ${x} ${y})` : undefined}>
              {name.lines.length === 1 ? name.lines[0] : name.lines.map((l, j) => (
                <tspan key={j} x={x} dy={j ? name.size * 1.15 : (-(name.lines.length - 1) * name.size * 1.15) / 2}>
                  {l}
                </tspan>
              ))}
            </text>
            {pl.single && (
              <text x={x} y={y + size} fontSize={size * 0.65} textAnchor="middle" className="lay-name lay-sub">
                1 LAYER
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** About how wide a line of the layout's small caps runs, in the drawing's cm (the mono face with its 0.12em tracking). */
const lineWidth = (text: string, size: number) => text.length * size * 0.74;

/**
 * A piece's name sized to its piece (Cat, Nov 11 sweep: on narrow and small pieces it ran past their edges, the two
 * collars' names into each other and Pocket facing into the welt). Across the piece if it fits; else along a tall,
 * narrow piece; else on two lines; else a size smaller until it fits, never under half.
 */
function nameFit(name: string, pts: { x: number; y: number }[], size: number): { lines: string[]; size: number; turn: boolean } {
  // On the drawing the piece's y runs across the page and its x down it.
  const wide = Math.max(...pts.map((q) => q.y)) - Math.min(...pts.map((q) => q.y));
  const tall = Math.max(...pts.map((q) => q.x)) - Math.min(...pts.map((q) => q.x));
  const room = (w: number) => w * 0.88;
  if (lineWidth(name, size) <= room(wide)) return { lines: [name], size, turn: false };
  if (tall > wide && lineWidth(name, size) <= room(tall)) return { lines: [name], size, turn: true };
  const words = name.split(' ');
  const cut = words.length > 1 ? Math.ceil(words.length / 2) : 0;
  const two = cut ? [words.slice(0, cut).join(' '), words.slice(cut).join(' ')] : [name];
  const turn = tall > wide;
  const span = turn ? tall : wide;
  const longest = Math.max(...two.map((l) => l.length));
  if (two.length > 1 && longest * size * 0.74 <= room(span) && size * 2.3 <= (turn ? wide : tall)) return { lines: two, size, turn };
  const fit = Math.max(size * 0.5, (room(span) / (longest * 0.74)) * 0.98);
  return { lines: two, size: Math.min(size, fit), turn };
}

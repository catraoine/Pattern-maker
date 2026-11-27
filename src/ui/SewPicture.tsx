import { ReactNode, useId } from 'react';
import type { P } from '../engine/geometry';
import type { Piece } from '../engine/piece';
import type { Lay } from '../engine/layplan';
import { type StepPicture, isDart } from '../engine/stepPictures';
import { StepDiagram } from './StepDiagram';

// A sewing step's picture (Cat's C, Nov 21), on its own so Print can show one without loading the whole of Sewing mode.

const W = 160;
const H = 100;

interface Placed {
  pc: Piece;
  /** Added to the piece's own cm to put it in its place along the row. */
  dx: number;
  dy: number;
  /** Where it starts along the row, and its size, in cm. */
  x: number;
  w: number;
  h: number;
}

/** The pieces laid side by side, tops level, a little apart, in their own cm. */
function arrange(shown: Piece[]): Placed[] {
  const gap = 8;
  let x = 0;
  return shown.map((pc) => {
    const pts = pc.outline.points(12);
    const xs = pts.map((q) => q.x);
    const ys = pts.map((q) => q.y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const at = { pc, dx: x - x0, dy: -y0, x, w: x1 - x0, h: y1 - y0 };
    x += x1 - x0 + gap;
    return at;
  });
}

/** A line of machine stitches along `d`, sewn in from its start as you watch: the stitches show through a line that
 *  draws itself, so they read as stitching, not as the piece's own edge. */
function Stitch({ d, delay }: { d: string; delay: number }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <g>
      <mask id={`sew${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
        <path d={d} className="sp-sew sp-reveal" pathLength={1} style={{ animationDelay: `${delay}s` }} />
      </mask>
      <path d={d} className="sp-seam" />
      <path d={d} className="sp-stitch" mask={`url(#sew${id})`} />
    </g>
  );
}

const line = (pts: P[]) => pts.map((q, i) => `${i ? 'L' : 'M'}${q.x.toFixed(2)},${q.y.toFixed(2)}`).join('');

/** The runs of an outline whose edges carry one of `tags`, as separate lines. */
function runs(pc: Piece, tags: string[]): P[][] {
  const { pts, tags: t } = pc.outline.taggedPoints(16);
  const out: P[][] = [];
  let cur: P[] | undefined;
  t.forEach((tag, i) => {
    if (tags.includes(tag)) {
      if (!cur) {
        cur = [pts[i]];
        out.push(cur);
      }
      cur.push(pts[i + 1] ?? pts[0]);
    } else cur = undefined;
  });
  return out;
}

/** One step's picture, ink on chalk. `still` draws it finished, for the small pictures along the foot. */
export function SewPicture({ picture, pieces, lays, flat, label, still }: { picture: StepPicture; pieces: Piece[]; lays: Lay[]; flat: ReactNode; label?: string; still?: boolean }) {
  const cls = still ? 'sewpic still' : 'sewpic';
  // A pattern with no flat drawing (one read from a file) shows its pieces instead.
  if (picture.kind === 'flat' && !flat) picture = { kind: 'sew', pieces: pieces.map((_, i) => i), edges: [], darts: false };
  if (picture.kind === 'diagram') return <div className={`${cls} sewpic-diagram`}><StepDiagram id={picture.id} /></div>;
  if (picture.kind === 'flat') return <div className={`${cls} sewpic-flat`}>{flat}</div>;
  if (picture.kind === 'prep')
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className={cls} role="img" aria-label={label ?? 'Fabric straightened on the grain'}>
        <rect x="8" y="18" width="144" height="64" className="sp-cloth" />
        <path d="M8 18H152M8 82H152" className="sp-selvedge" />
        <text x="10" y="13">SELVEDGE</text>
        <text x="10" y="92">SELVEDGE</text>
        <path d="M30 18V82" className="sp-sew" pathLength={1} />
        <text x="34" y="51">PULL A THREAD</text>
        <path d="M140 30l8-6m0 0h-3.5m3.5 0v3.5M140 70l8 6m0 0h-3.5m3.5 0v-3.5" className="sp-edge sp-come" />
        <text x="138" y="52" textAnchor="end">ON THE BIAS</text>
      </svg>
    );
  if (picture.kind === 'print')
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className={cls} role="img" aria-label={label ?? 'The 10 cm test square, measured with a ruler'}>
        <rect x="48" y="6" width="64" height="88" className="sp-paper" />
        <path d="M52 6V94M48 10H112" className="sp-ghost" />
        <rect x="62" y="28" width="36" height="36" className="sp-edge" />
        <text x="80" y="48" textAnchor="middle">10 CM</text>
        <g className="sp-come">
          <rect x="58" y="70" width="44" height="7" className="sp-ruler" />
          {Array.from({ length: 21 }, (_, i) => (
            <path key={i} d={`M${62 + (i * 36) / 20} 70v${i % 10 ? 1.8 : 3.4}`} className="sp-tick" />
          ))}
        </g>
      </svg>
    );
  if (picture.kind === 'cut') {
    // The layout these pieces are cut from: the fabric's, or the lining's for the lining.
    const names = picture.names;
    const lay = [...lays].sort((a, b) => b.placements.filter((pl) => names.includes(pl.name)).length - a.placements.filter((pl) => names.includes(pl.name)).length)[0];
    if (!lay) return <div className={`${cls} sewpic-flat`}>{flat}</div>;
    // The layout as on Print, turned so the fabric runs across: the fold along the top.
    const L = lay.length + 4;
    const A = lay.across;
    const s = Math.min((W - 8) / L, (H - 16) / A);
    const ox = (W - L * s) / 2;
    const oy = 9;
    const pts = (ps: P[]) => ps.map((q) => ({ x: ox + (q.y + 2) * s, y: oy + q.x * s }));
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className={cls} role="img" aria-label={label ?? 'Cutting layout'}>
        <rect x={ox} y={oy} width={L * s} height={A * s} className="sp-fabric" />
        <path d={`M${ox} ${oy}H${ox + L * s}`} className="sp-ghost" />
        <text x={ox} y={oy - 2.5}>{lay.folded ? 'FOLD' : 'SELVEDGE'}</text>
        <text x={ox} y={oy + A * s + 5}>SELVEDGES</text>
        {lay.placements.map((pl, i) => {
          const on = picture.names.includes(pl.name);
          const d = line(pts(pl.pts)) + 'Z';
          return (
            <g key={i}>
              <path d={d} className={on ? 'sp-cloth' : 'sp-faint'} />
              {on && <path d={d} className="sp-sew" pathLength={1} style={{ animationDelay: `${(i % 4) * 0.25}s` }} />}
            </g>
          );
        })}
      </svg>
    );
  }
  // Sewing: the pieces in play, side by side, the edges being sewn drawn in.
  const shown = picture.pieces.map((i) => pieces[i]).slice(0, 5);
  const placed = arrange(shown);
  const tall = Math.max(...placed.map((a) => a.h), 1);
  const wide = Math.max(...placed.map((a) => a.x + a.w), 1);
  // Each piece's name under it, without the word they all share ("BODICE"), a word a line: four princess panels side by
  // side ran their names into each other (EJ walk, Nov 27).
  const words = shown.map((pc) => pc.name.toUpperCase().split(' '));
  const shared = words.length > 1 && words.every((w) => w.length > 1 && w[0] === words[0][0]) ? 1 : 0;
  const names = words.map((w) => (w.length - shared > 1 && placed.length > 2 ? w.slice(shared) : [w.slice(shared).join(' ')]));
  // Each extra line of a name takes its room from the drawing, so the names sit below the pieces, not over their hems.
  const extra = (Math.max(...names.map((n) => n.length), 1) - 1) * 4.2;
  const s = Math.min((W - 16) / wide, (H - 14 - extra) / tall);
  const ox = (W - wide * s) / 2;
  const oy = (H - extra - tall * s) / 2;
  const to = (a: Placed) => (ps: P[]) => ps.map((q) => ({ x: ox + (q.x + a.dx) * s, y: oy + (q.y + a.dy) * s }));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cls} role="img" aria-label={label ?? 'The pieces for this step'}>
      {placed.map((a, k) => {
        const f = to(a);
        const outline = line(f(a.pc.outline.points(16))) + 'Z';
        const fold = a.pc.fold ? line(f(a.pc.fold)) : undefined;
        return (
          <g key={k}>
            <path d={outline} className="sp-cloth" />
            {fold && <path d={fold} className="sp-ghost" />}
            {!picture.darts && a.pc.lines.map((ln, j) => <path key={j} d={line(f(ln.points(8)))} className="sp-mark" />)}
            {picture.darts && a.pc.lines.map((ln, j) => (isDart(ln) ? <Stitch key={j} d={line(f(ln.points(8)))} delay={j * 0.2} /> : <path key={j} d={line(f(ln.points(8)))} className="sp-mark" />))}
            {picture.around?.includes(picture.pieces[k]) && <Stitch d={outline} delay={k * 0.3} />}
            {runs(a.pc, picture.edgesOn?.[picture.pieces[k]] ?? picture.edges).map((r, j) => (
              <Stitch key={j} d={line(f(r))} delay={k * 0.3} />
            ))}
            <text x={ox + (a.x + a.w / 2) * s} y={Math.min(H - 1.5 - (names[k].length - 1) * 4.2, oy + a.h * s + 5)} textAnchor="middle">
              {names[k].map((w, j) => (
                <tspan key={j} x={ox + (a.x + a.w / 2) * s} dy={j ? 4.2 : 0}>
                  {w}
                </tspan>
              ))}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

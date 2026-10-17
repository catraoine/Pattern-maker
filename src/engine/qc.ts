// Pattern quality checks, the way a pattern cutter walks a pattern before it is cut: seams that join
// are the same length, curves blend across seams, centre lines are square and dart legs are trued.
import { P, len, sub, taggedLength } from './geometry';
import { dartsOf } from './marks';
import { Piece } from './piece';

export interface Check {
  group: 'Seams' | 'Corners' | 'Darts';
  label: string;
  detail: string;
  ok: boolean;
}

/** Seams walked to within 1 mm, corners to within a degree (two where curves meet across a seam). */
export const SEAM_TOLERANCE = 0.1;
const SQUARE_TOLERANCE = 1;
const BLEND_TOLERANCE = 2;

const cm = (v: number) => `${(Math.round(v * 10) / 10).toFixed(1)} cm`;
const deg = (v: number) => `${Math.round(v * 10) / 10}°`;

interface Corner {
  a: string;
  b: string;
  angle: number; // interior angle in degrees
  /** Where it is, so the two sides of a piece cut whole can be told apart. */
  at?: P;
}

/** Interior angle at every point where one edge tag gives way to another. */
export function corners(pc: Piece): Corner[] {
  let { pts, tags } = pc.outline.taggedPoints(256);
  if (len(sub(pts[0], pts[pts.length - 1])) < 1e-6) pts = pts.slice(0, -1);
  // Drop zero-length edges so every direction is well defined.
  const P2: P[] = [];
  const T2: string[] = [];
  pts.forEach((q, i) => {
    const next = pts[(i + 1) % pts.length];
    if (len(sub(next, q)) > 1e-6) {
      P2.push(q);
      T2.push(tags[i] ?? tags[tags.length - 1]);
    }
  });
  const n = P2.length;
  const turn = (i: number) => {
    const d1 = sub(P2[i], P2[(i - 1 + n) % n]);
    const d2 = sub(P2[(i + 1) % n], P2[i]);
    return Math.atan2(d1.x * d2.y - d1.y * d2.x, d1.x * d2.x + d1.y * d2.y);
  };
  let total = 0;
  for (let i = 0; i < n; i++) total += turn(i);
  const sgn = Math.sign(total) || 1;
  const out: Corner[] = [];
  for (let i = 0; i < n; i++) {
    const a = T2[(i - 1 + n) % n];
    const b = T2[i];
    if (a !== b) out.push({ a, b, angle: 180 - (sgn * turn(i) * 180) / Math.PI, at: P2[i] });
  }
  return out;
}

const NAMES: Record<string, string> = {
  waist: 'waist',
  hem: 'hem',
  side: 'side seam',
  shoulder: 'shoulder',
  neck: 'neckline',
  armhole: 'armhole',
  crotch: 'crotch seam',
};

const isFront = (pc: Piece) => /front/i.test(pc.name);
/** The garment a piece belongs to, from its first word: Bodice, Skirt. */
const garmentOf = (pc: Piece) => pc.name.split(' ')[0];
/** A seam's length on one side of the body: a piece cut whole (single layer, both halves) has it twice. */
const halfLength = (pc: Piece, tag: string) => taggedLength(pc.outline, tag) / (pc.meta.whole ? 2 : 1);
const sum = (pcs: Piece[], tag: string) => pcs.reduce((t, pc) => t + halfLength(pc, tag), 0);
const bothWhole = (a: Piece, b: Piece) => !!a.meta.whole && !!b.meta.whole;

/** The length of each separate run of edges carrying `tag`, in order round the outline. */
function runLengths(pc: Piece, tag: string): number[] {
  const { pts, tags } = pc.outline.taggedPoints(48);
  const out: number[] = [];
  tags.forEach((t, i) => {
    if (t !== tag) return;
    const d = len(sub(pts[i + 1], pts[i]));
    if (i > 0 && tags[i - 1] === tag) out[out.length - 1] += d;
    else out.push(d);
  });
  return out;
}
const isBack = (pc: Piece) => /back/i.test(pc.name);

/** Front and back pieces paired by the word before "front" or "back": the bodice's, the skirt's. */
function pairs(pieces: Piece[]): { group: string; front: Piece; back: Piece }[] {
  const groupOf = (pc: Piece) => pc.name.replace(/\s*(front|back)\b.*$/i, '');
  const out: { group: string; front: Piece; back: Piece }[] = [];
  for (const front of pieces.filter(isFront)) {
    const back = pieces.find((pc) => isBack(pc) && groupOf(pc) === groupOf(front));
    if (back) out.push({ group: groupOf(front), front, back });
  }
  return out;
}

/** Run every check that applies to a set of pieces. Front and back pieces are paired by name; a
 * dress's bodice and skirt are each walked as a pair, and their waist seams against each other. */
export function checkPattern(pieces: Piece[], opts: { finishedWaist?: number } = {}): Check[] {
  const checks: Check[] = [];
  const front = pieces.find(isFront);
  const back = pieces.find(isBack);
  const all = pairs(pieces);
  const named = all.length > 1;

  for (const { group, front, back } of all) {
    const which = (label: string) => (named ? `${group}${/ (centre|side)$/i.test(group) ? ' panel' : ''} ${label[0].toLowerCase()}${label.slice(1)}` : label);
    // Seams that sew together.
    for (const seam of ['side', 'shoulder', 'inseam']) {
      const f = halfLength(front, seam);
      const b = halfLength(back, seam);
      if (!f || !b) continue;
      if (seam === 'shoulder') {
        // The back shoulder is drafted 1 cm longer and eased in over the shoulder blade (half of it
        // into each panel when a princess line splits the shoulder).
        const ease = b - f;
        const want = (back.meta.shoulderEase as number | undefined) ?? 1;
        checks.push({
          group: 'Seams',
          label: which('Shoulder seams'),
          detail: `front ${cm(f)}, back ${cm(b)}: ${cm(ease)} of back shoulder ease, as drafted`,
          ok: Math.abs(ease - want) <= SEAM_TOLERANCE,
        });
      } else if (bothWhole(front, back)) {
        // Cut whole, the two sides can differ (a diagonal hem): each side seam is walked on its own,
        // the front's +x side (the wearer's left) against the back's -x side.
        const [fl, fr] = runLengths(front, seam);
        const [br, bl] = runLengths(back, seam);
        for (const [side, a, b2] of [['Left', fl, bl], ['Right', fr, br]] as const)
          checks.push({
            group: 'Seams',
            label: which(`${side} side seams`),
            detail: `front ${cm(a)}, back ${cm(b2)}, ${Math.abs(a - b2) < 0.05 ? 'identical' : `${cm(Math.abs(a - b2))} apart`}`,
            ok: Math.abs(a - b2) <= SEAM_TOLERANCE,
          });
      } else {
        checks.push({
          group: 'Seams',
          label: which(seam === 'inseam' ? 'Inside leg seams' : 'Side seams'),
          detail: `front ${cm(f)}, back ${cm(b)}, ${Math.abs(f - b) < 0.05 ? 'identical' : `${cm(Math.abs(f - b))} apart`}`,
          ok: Math.abs(f - b) <= SEAM_TOLERANCE,
        });
      }
      // Curves meeting across the seam must blend: the two corners add up to a straight line. On pieces
      // cut whole, each corner meets the one on the same side of the body.
      const whole = bothWhole(front, back);
      const fc = corners(front).filter((c) => (c.a === seam || c.b === seam) && c.a !== 'dart' && c.b !== 'dart');
      for (const c of fc) {
        const other = c.a === seam ? c.b : c.a;
        const bc = corners(back).find((k) => ((k.a === seam && k.b === other) || (k.b === seam && k.a === other)) && (!whole || Math.sign(k.at!.x) === -Math.sign(c.at!.x)));
        if (!bc || !NAMES[other]) continue;
        const sum = c.angle + bc.angle;
        const sideWord = whole ? `${c.at!.x > 0 ? 'left' : 'right'} ` : '';
        checks.push({
          group: 'Corners',
          label: which(`${cap(NAMES[other])} blends across the ${sideWord}${seam === 'inseam' ? 'inside leg' : NAMES[seam]}`),
          detail: `front ${deg(c.angle)} + back ${deg(bc.angle)} = ${deg(sum)}`,
          ok: Math.abs(sum - 180) <= BLEND_TOLERANCE,
        });
      }
    }
  }

  // The waist seam round the body, each garment's pieces together (two panels or one piece a side).
  const garments = [...new Set(all.map((g) => garmentOf(g.front)))];
  if (opts.finishedWaist)
    for (const g of garments) {
      const fronts = pieces.filter((pc) => isFront(pc) && garmentOf(pc) === g);
      const backs = pieces.filter((pc) => isBack(pc) && garmentOf(pc) === g);
      const f = sum(fronts, 'waist');
      if (!(f > 0)) continue;
      // Two of each piece (a pair, or a piece cut on the fold that is half the front).
      const seam = 2 * (f + sum(backs, 'waist'));
      checks.push({
        group: 'Seams',
        label: garments.length > 1 || all.length > 1 ? `${g} waist seam to finished waist` : 'Waist seam to finished waist',
        detail: `${cm(seam)} with darts closed, finished ${cm(opts.finishedWaist)}`,
        // Up to 1.5 cm eases into a waistband or a matching seam without showing.
        ok: Math.abs(seam - opts.finishedWaist) <= 1.5,
      });
    }

  // Trousers: the crotch seam, front curve and back, against the person's crotch length with ease.
  for (const { front, back } of all) {
    const target = front.meta.crotchTarget as number | undefined;
    if (!target) continue;
    const c = taggedLength(front.outline, 'crotch') + taggedLength(back.outline, 'crotch');
    checks.push({
      group: 'Seams',
      label: 'Crotch seam to your crotch length',
      detail: `front ${cm(taggedLength(front.outline, 'crotch'))} + back ${cm(taggedLength(back.outline, 'crotch'))} = ${cm(c)}, drafted to ${cm(target)} with ease`,
      ok: Math.abs(c - target) <= 0.5,
    });
  }

  // Princess seams: each centre panel against its side panel.
  for (const c of pieces.filter((pc) => /centre (front|back)/i.test(pc.name) && taggedLength(pc.outline, 'princess') > 0)) {
    const sidePc = pieces.find((pc) => pc.name === c.name.replace(/centre/i, 'side'));
    if (!sidePc) continue;
    const a = taggedLength(c.outline, 'princess');
    const b = taggedLength(sidePc.outline, 'princess');
    checks.push({
      group: 'Seams',
      label: `${cap(c.name.replace(/^Bodice centre /i, ''))} princess seams`,
      detail: `centre ${cm(a)}, side ${cm(b)}, ${Math.abs(a - b) < 0.05 ? 'identical' : `${cm(Math.abs(a - b))} apart`}`,
      ok: Math.abs(a - b) <= SEAM_TOLERANCE,
    });
  }

  // A dress: the bodice's waist sewn to the skirt's, front to front and back to back.
  const ofSide = (g: string, side: 'front' | 'back') => pieces.filter((pc) => garmentOf(pc) === g && (side === 'front' ? isFront(pc) : isBack(pc)));
  const bodice = garments.includes('Bodice') && garments.includes('Skirt');
  if (bodice)
    for (const side of ['front', 'back'] as const) {
      const b = sum(ofSide('Bodice', side), 'waist');
      const k = sum(ofSide('Skirt', side), 'waist');
      checks.push({
        group: 'Seams',
        label: `Waist seam, bodice ${side} to skirt ${side}`,
        detail: `bodice ${cm(b)}, skirt ${cm(k)}, darts closed, ${Math.abs(b - k) < 0.05 ? 'identical' : `${cm(Math.abs(b - k))} apart`}`,
        ok: Math.abs(b - k) <= SEAM_TOLERANCE,
      });
      // The waist darts meet across the seam: the skirt's dart nearest the centre under the bodice's.
      // A princess line meets the skirt dart the same way.
      const waistDart = (pcs: Piece[]) =>
        pcs
          .flatMap((pc) => [
            ...dartsOf(pc)
              .filter((d) => Math.abs(d.far.x - d.near.x) > Math.abs(d.far.y - d.near.y))
              .map((d) => (d.near.x + d.far.x) / 2),
            ...(typeof pc.meta.waistSeamAt === 'number' ? [pc.meta.waistSeamAt] : []),
          ])
          .sort((x, y) => x - y)[0];
      const bd = waistDart(ofSide('Bodice', side));
      const kd = waistDart(ofSide('Skirt', side));
      if (bd !== undefined && kd !== undefined)
        checks.push({
          group: 'Darts',
          label: `${cap(side)} darts meet at the waist seam`,
          detail: `bodice ${cm(bd)}, skirt ${cm(kd)} from the centre`,
          ok: Math.abs(bd - kd) <= 0.5,
        });
    }

  // A collar's neck edge against the neckline it sews to (half of it, centre back to centre front, or
  // on to the edge of a button extension), and a shirt collar against its stand.
  const neckline = pieces.filter((pc) => !pc.kind && (isFront(pc) || isBack(pc)));
  for (const c of pieces.filter((pc) => pc.kind === 'collar' && taggedLength(pc.outline, 'neck') > 0)) {
    const a = taggedLength(c.outline, 'neck');
    const b = sum(neckline, 'neck') + (c.meta.collarTo === 'extension' ? sum(neckline.filter(isFront), 'opening-neck') : 0);
    checks.push({
      group: 'Seams',
      label: `${c.name} to neckline`,
      detail: `collar ${cm(a)}, neckline ${cm(b)} (half), ${Math.abs(a - b) < 0.05 ? 'identical' : `${cm(Math.abs(a - b))} apart`}`,
      ok: Math.abs(a - b) <= SEAM_TOLERANCE,
    });
  }
  const stand = pieces.find((pc) => pc.name === 'Collar stand');
  const fall = pieces.find((pc) => pc.name === 'Collar' && pc.kind === 'collar');
  if (stand && fall && taggedLength(fall.outline, 'stand') > 0) {
    const a = taggedLength(fall.outline, 'stand');
    const b = taggedLength(stand.outline, 'stand');
    checks.push({
      group: 'Seams',
      label: 'Collar to stand',
      detail: `collar ${cm(a)}, stand ${cm(b)} to the centre front, ${Math.abs(a - b) < 0.05 ? 'identical' : `${cm(Math.abs(a - b))} apart`}`,
      ok: Math.abs(a - b) <= SEAM_TOLERANCE,
    });
  }

  const sleeve = pieces.find((pc) => /^sleeve$/i.test(pc.name));
  if (sleeve && front && back) checks.push(...sleeveChecks(sleeve, pieces.filter(isFront), pieces.filter(isBack)));

  // Centre lines are square to the edges that cross them, so the piece mirrors without a point or dip.
  for (const pc of pieces) {
    const where = (pc.meta.foldAt as string | undefined) ?? (isFront(pc) ? 'centre front' : 'centre back');
    for (const c of corners(pc)) {
      const centres = ['fold', 'centre', 'crotch'];
      const centre = centres.includes(c.a) ? c.b : centres.includes(c.b) ? c.a : '';
      if (!centre || !NAMES[centre] || ((pc.meta.pointedAtCentre as string[] | undefined) ?? []).includes(centre)) continue;
      checks.push({
        group: 'Corners',
        label: `${cap(NAMES[centre])} square at ${where}`,
        detail: deg(c.angle),
        ok: Math.abs(c.angle - 90) <= SQUARE_TOLERANCE,
      });
    }
    dartsOf(pc).forEach((d, i, all) => {
      const l1 = len(sub(d.near, d.tip));
      const l2 = len(sub(d.far, d.tip));
      checks.push({
        group: 'Darts',
        label: `${pc.name}${all.length > 1 ? ` dart ${i + 1}` : ' dart'} legs trued`,
        detail: `${cm(l1)} and ${cm(l2)}`,
        ok: Math.abs(l1 - l2) <= SEAM_TOLERANCE / 2,
      });
    });
  }
  return checks;
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** Most crown ease a set-in sleeve can take without puckering, in cm per half. */
const MAX_CROWN_EASE = 3.5;

/**
 * A set-in sleeve against the bodice: its underarm seam walked, its crown against the armhole it
 * sews into (eased in, never shorter), and the underarm and hem curves blending once the sleeve is
 * sewn into a tube.
 */
function sleeveChecks(sleeve: Piece, fronts: Piece[], backs: Piece[]): Check[] {
  const out: Check[] = [];
  const f = taggedLength(sleeve.outline, 'sleeve-front');
  const b = taggedLength(sleeve.outline, 'sleeve-back');
  out.push({
    group: 'Seams',
    label: 'Sleeve seam',
    detail: `front ${cm(f)}, back ${cm(b)}${sleeve.lines.length ? ' with the elbow dart closed' : ''}, ${Math.abs(f - b) < 0.05 ? 'identical' : `${cm(Math.abs(f - b))} apart`}`,
    ok: Math.abs(f - b) <= SEAM_TOLERANCE,
  });
  // The crown's halves: from the crown point to each underarm.
  const { pts, tags } = sleeve.outline.taggedPoints(96);
  let crownF = 0;
  let crownB = 0;
  let seenSeam = false;
  tags.forEach((t, i) => {
    if (t !== 'armhole') {
      seenSeam = true;
      return;
    }
    const d = len(sub(pts[i + 1], pts[i]));
    if (seenSeam) crownB += d;
    else crownF += d;
  });
  const easeF = crownF - sum(fronts, 'armhole');
  const easeB = crownB - sum(backs, 'armhole');
  const gathered = !!sleeve.meta.gatheredCrown;
  out.push({
    group: 'Seams',
    label: gathered ? 'Sleeve crown gathers' : 'Sleeve crown ease',
    detail: `front ${cm(easeF)}, back ${cm(easeB)} ${gathered ? 'gathered' : 'eased'} into the armhole`,
    ok: easeF >= 0 && easeB >= 0 && (gathered || (easeF <= MAX_CROWN_EASE && easeB <= MAX_CROWN_EASE)),
  });
  const cs = corners(sleeve);
  for (const [edge, name] of [
    ['armhole', 'Sleeve underarm'],
    ['hem', 'Sleeve hem'],
  ] as const) {
    const cf = cs.find((c) => (c.a === edge && c.b === 'sleeve-front') || (c.b === edge && c.a === 'sleeve-front'));
    const cb = cs.find((c) => (c.a === edge && c.b === 'sleeve-back') || (c.b === edge && c.a === 'sleeve-back'));
    if (!cf || !cb) continue;
    const sum = cf.angle + cb.angle;
    out.push({
      group: 'Corners',
      label: `${name} blends across the sleeve seam`,
      detail: `${deg(cf.angle)} + ${deg(cb.angle)} = ${deg(sum)}`,
      ok: Math.abs(sum - 180) <= BLEND_TOLERANCE,
    });
  }
  return out;
}

/** A row of the finished measurements table (the tech pack's SpecRow has the same shape). */
export interface FinishedRow {
  label: string;
  body?: number;
  ease?: number;
  finished: number | string;
}

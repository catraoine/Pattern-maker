// Fit sweep: the skirt and bodice drafted for many bodies, and the drawn pieces measured against the body
// the way a toile would be, not just against each other. Added after the Fable fit check of 2026-10-24.
import { describe, expect, it } from 'vitest';
import { draftSkirt, FIT_EASE } from './skirt';
import { BODICE_FIT_EASE, draftBodice, girthBelowWaist } from './bodice';
import { draftDress } from './dress';
import { draftTrousers, TROUSER_EASE, TrousersMeasurements } from './trousers';
import { checkPattern } from './qc';
import { randomBody, randomCrotch, rng } from './randomBodies';
import { withEstimates } from '../estimate';
import { waistPieces } from './finishing';
import { taggedLength } from './geometry';
import type { Piece } from './piece';

const BODIES = 80;
const r1 = (v: number) => Math.round(v * 10) / 10;

/** The width of a piece along the horizontal line y, from its leftmost crossing to its rightmost. */
function widthAt(pc: Piece, y: number): number {
  const pts = pc.outline.points(48);
  const xs: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) xs.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y));
  }
  return xs.length < 2 ? NaN : Math.max(...xs) - Math.min(...xs);
}

/** A tester's short list: the base set, the high bust, the hip lengths, the shoulder width and the back length. */
const asTester = (b: ReturnType<typeof randomBody>) =>
  withEstimates({
    height: b.waist_to_floor / 0.615,
    waist: b.waist,
    full_bust: b.full_bust,
    high_bust: b.high_bust,
    full_hip: b.full_hip,
    waist_to_hip: b.waist_to_hip,
    waist_to_knee: b.waist_to_knee,
    waist_to_floor: b.waist_to_floor,
    shoulder_width: b.shoulder_width,
    nape_to_waist: b.nape_to_waist,
  }) as unknown as ReturnType<typeof randomBody>;

describe('skirt measured against the body', () => {
  const styles = [
    { fit: 'regular', silhouette: 'a_line', length: 'knee' },
    { fit: 'fitted', silhouette: 'pencil', length: 'knee' },
    { fit: 'relaxed', silhouette: 'straight', length: 'midi' },
  ] as const;

  it(`sits at the hip and waist, passes the hips at the zip and matches its waistband, for ${BODIES} bodies`, () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= BODIES; seed++) {
      const body = randomBody(rng(seed + 5000));
      for (const st of styles) {
        const tag = `seed ${seed} ${st.fit} ${st.silhouette}`;
        const d = draftSkirt(body, st);
        const [front, back] = d.pieces;
        const ease = FIT_EASE[st.fit];
        // Round the hip line, which is the person's waist to hip down: the hip plus the fit's ease.
        const hip = 2 * (widthAt(front, body.waist_to_hip) + widthAt(back, body.waist_to_hip));
        if (Math.abs(hip - (body.full_hip + ease.hip)) > 0.6) failures.push(`${tag}: hip line ${r1(hip)} vs ${r1(body.full_hip + ease.hip)}`);
        // The waist seam with the darts closed is the waist plus ease, within what a band eases in.
        const waist = 2 * (taggedLength(front.outline, 'waist') + taggedLength(back.outline, 'waist'));
        if (Math.abs(waist - (body.waist + ease.waist)) > 1) failures.push(`${tag}: waist ${r1(waist)} vs ${r1(body.waist + ease.waist)}`);
        // Below the zip the skirt is a closed tube: it must pass over the hips.
        const atZip = 2 * (widthAt(front, d.zipCm + 1) + widthAt(back, d.zipCm + 1));
        if (atZip < body.full_hip - 1.5) failures.push(`${tag}: ${r1(atZip)} round at the zip end, hip ${r1(body.full_hip)}`);
        // Dart tips clear the hip line, where the body is widest.
        for (const pc of [front, back])
          for (const ln of pc.lines) {
            const tip = ln.points()[1];
            if (body.waist_to_hip - tip.y < 2) failures.push(`${tag} ${pc.name}: dart tip ${r1(body.waist_to_hip - tip.y)} cm above the hip line`);
          }
        // The printed waistband is the finished waist long on its stitching line and twice its finished width.
        const band = waistPieces(d, 1.5).find((pc) => pc.kind === 'waistband')!;
        const ys = band.outline.points().map((q) => q.y);
        const xs = band.outline.points().map((q) => q.x);
        if (Math.abs(Math.max(...ys) - Math.min(...ys) - d.finishedWaist) > 0.2) failures.push(`${tag}: waistband ${r1(Math.max(...ys) - Math.min(...ys))} vs waist ${d.finishedWaist}`);
        if (Math.abs(Math.max(...xs) - Math.min(...xs) - 6) > 0.2) failures.push(`${tag}: waistband ${r1(Math.max(...xs) - Math.min(...xs))} wide`);
        for (const c of checkPattern(d.pieces, { finishedWaist: d.finishedWaist })) if (!c.ok) failures.push(`${tag}: ${c.label} (${c.detail})`);
      }
    }
    expect(failures.slice(0, 10), `${failures.length} failures`).toEqual([]);
  });
});

describe('bodice measured against the body', () => {
  const styles = [
    { fit: 'regular', neckline: 'crew' },
    { fit: 'fitted', neckline: 'v' },
    { fit: 'relaxed', neckline: 'scoop' },
  ] as const;

  it(`is the bust and waist plus ease, balances its armholes and clears the neck, for ${BODIES} bodies`, () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= BODIES; seed++) {
      const body = randomBody(rng(seed + 5000));
      for (const st of styles) {
        const tag = `seed ${seed} ${st.fit} ${st.neckline}`;
        const d = draftBodice(body, st);
        const [front, back] = d.pieces;
        const ease = BODICE_FIT_EASE[st.fit];
        if (d.warnings.length) failures.push(`${tag}: ${d.warnings.join('; ')}`);
        // Round the bust: the front just below where the side seam reaches full bust width (above the
        // bust dart), and the back at the same height below its underarm. The back side seam already
        // tapers toward the waist there, so the round is the bust plus ease within 3 cm (the taper on a very full bust).
        const sideBust = front.draft!.points.find((q) => q.n === '6')!.at;
        const underF = front.draft!.points.find((q) => q.n === '5')!.at;
        const bust = 2 * (widthAt(front, sideBust.y + 0.2) + widthAt(back, d.armholeDepth + (sideBust.y - underF.y) + 0.2));
        if (Math.abs(bust - (body.full_bust + ease.bust)) > 3) failures.push(`${tag}: bust ${r1(bust)} vs ${r1(body.full_bust + ease.bust)}`);
        const waist = 2 * (taggedLength(front.outline, 'waist') + taggedLength(back.outline, 'waist'));
        if (Math.abs(waist - (body.waist + ease.waist)) > 1.5) failures.push(`${tag}: waist ${r1(waist)} vs ${r1(body.waist + ease.waist)}`);
        // The back armhole a little longer than the front, never shorter.
        const balance = taggedLength(back.outline, 'armhole') - taggedLength(front.outline, 'armhole');
        if (balance < 0.3 || balance > 1.5) failures.push(`${tag}: back armhole ${r1(balance)} longer than the front`);
        // The armhole is the person's plus ease; the neckline clears the neck.
        const target = body.armscye! + 4 + ease.bust / 2;
        if (Math.abs(d.armhole - target) > 1.5) failures.push(`${tag}: armhole ${d.armhole} vs ${r1(target)}`);
        if (d.neck < body.neck + 1.5) failures.push(`${tag}: neckline ${d.neck} round a ${body.neck} neck`);
        // The side dart is capped and the rest of a full bust's shaping moves to the waist dart.
        if (d.bustDart > 6.05) failures.push(`${tag}: bust dart ${d.bustDart}`);
        if (d.waistDarts.front > 8 || d.waistDarts.back > 4.6) failures.push(`${tag}: waist darts ${JSON.stringify(d.waistDarts)}`);
        for (const c of checkPattern(d.pieces, { finishedWaist: d.finishedWaist })) if (!c.ok) failures.push(`${tag}: ${c.label} (${c.detail})`);
      }
    }
    expect(failures.slice(0, 10), `${failures.length} failures`).toEqual([]);
  });

  it(`drafts close to the measured bodice from a tester's short list of measurements, for ${BODIES} bodies`, () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= BODIES; seed++) {
      const body = randomBody(rng(seed + 5000));
      const full = draftBodice(body, { fit: 'regular' });
      const est = draftBodice(asTester(body), { fit: 'regular' });
      const tag = `seed ${seed}`;
      const cf = (d: typeof full) => d.front.waistCentre.y - d.pieces[0].outline.start.y;
      const diffs: [string, number, number][] = [
        ['armhole', est.armhole - full.armhole, 3],
        ['bust dart', est.bustDart - full.bustDart, 2],
        ['centre front length', cf(est) - cf(full), 2.5],
        ['shoulder', est.shoulder.front - full.shoulder.front, 1.5],
        ['neck', est.neck - full.neck, 3],
        ['bust point across', est.front.apex.x - full.front.apex.x, 1.5],
        ['bust point down', est.front.apex.y - full.front.apex.y, 2],
      ];
      for (const [what, diff, max] of diffs) if (Math.abs(diff) > max) failures.push(`${tag}: ${what} ${r1(diff)} cm off when estimated`);
    }
    expect(failures.slice(0, 10), `${failures.length} failures`).toEqual([]);
  });
});

/** Along a piece's side seam, from its waist end, to where it crosses the horizontal line y. */
function alongSide(pc: Piece, y: number): number {
  const { pts, tags } = pc.outline.taggedPoints(48);
  let run = 0;
  for (let i = 0; i < tags.length; i++) {
    if (tags[i] !== 'side') continue;
    const a = pts[i];
    const b = pts[i + 1];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) return run + (d * (y - a.y)) / (b.y - a.y);
    run += d;
  }
  return NaN;
}

// Added after the Fable fit check of the dress and trousers, 2026-10-27.
describe('trousers measured against the body', () => {
  const styles = [
    { fit: 'regular', leg: 'straight', closure: 'fly' },
    { fit: 'fitted', leg: 'tapered', closure: 'side_zip' },
    { fit: 'relaxed', leg: 'wide', closure: 'fly', riseCm: -6 },
  ] as const;

  it(`sit at the hip and waist, meet at the hip notches, keep the darts off the hip and open over the hips, for ${BODIES} bodies`, () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= BODIES; seed++) {
      const r = rng(seed + 9000);
      const b = randomBody(r);
      const m: TrousersMeasurements = { ...b, ...randomCrotch(b, r) };
      for (const st of styles) {
        const tag = `seed ${seed} ${st.fit} ${st.leg} ${st.closure}`;
        const d = draftTrousers(m, st);
        const [front, back] = d.block;
        const ease = TROUSER_EASE[st.fit];
        const rise = d.riseCm ?? 0;
        const hipY = m.waist_to_hip + rise;
        // Round the hip line: the hip plus the fit's ease (a little more where the hip line is kept above the crotch line).
        const hip = 2 * (widthAt(front, hipY) + widthAt(back, hipY));
        if (hip < m.full_hip + ease.hip - 0.6 || hip > m.full_hip + ease.hip + 2) failures.push(`${tag}: hip ${r1(hip)} vs ${r1(m.full_hip + ease.hip)}`);
        const waist = 2 * (taggedLength(front.outline, 'waist') + taggedLength(back.outline, 'waist'));
        if (Math.abs(waist - d.finishedWaist) > 1) failures.push(`${tag}: waist ${r1(waist)} vs ${d.finishedWaist}`);
        // The back's side seam from the waist to the hip notch is the front's, so the notches meet when sewn.
        const hd = front.balance!.find((x) => x.label === 'HIP LINE')!.pts[0].y;
        const gap = alongSide(back, hd) - alongSide(front, hd);
        if (Math.abs(gap) > 0.5) failures.push(`${tag}: hip notch ${r1(gap)} cm off along the side seam`);
        // Dart tips clear the hip line.
        for (const pc of [front, back])
          for (const ln of pc.lines) {
            const tip = ln.points()[1];
            if (tip.y > hipY - 2) failures.push(`${tag} ${pc.name}: dart tip ${r1(hipY - tip.y)} cm above the hip line`);
          }
        // A side zip opens far enough to pull on over the hips.
        if (d.closure === 'side_zip') {
          const atZip = 2 * (widthAt(front, d.zipCm + 1) + widthAt(back, d.zipCm + 1));
          if (atZip < m.full_hip - 1.5) failures.push(`${tag}: ${r1(atZip)} round at the zip end, hip ${r1(m.full_hip)}`);
        }
        if (d.crotchCapped) failures.push(`${tag}: crotch ${JSON.stringify(d.crotch)}`);
        for (const c of checkPattern(d.pieces, { finishedWaist: d.finishedWaist })) if (!c.ok) failures.push(`${tag}: ${c.label} (${c.detail})`);
      }
    }
    expect(failures.slice(0, 10), `${failures.length} failures`).toEqual([]);
  });
});

describe('dress measured against the body', () => {
  const styles = [
    { fit: 'regular', silhouette: 'a_line', seam: 'natural' },
    { fit: 'fitted', silhouette: 'pencil', seam: 'low' },
    { fit: 'regular', silhouette: 'a_line', seam: 'dropped' },
  ] as const;

  it(`has room at a moved seam, passes the seam check there, and zips or goes on over the head, for ${BODIES} bodies`, () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= BODIES; seed++) {
      const body = randomBody(rng(seed + 7000));
      for (const st of styles) {
        const tag = `seed ${seed} ${st.fit} ${st.silhouette} ${st.seam}`;
        const d = draftDress(body, { fit: st.fit }, { fit: st.fit, silhouette: st.silhouette, length: 'knee' }, st.seam);
        const sEase = FIT_EASE[st.fit];
        const skirt = d.pieces.filter((pc) => /^Skirt/.test(pc.name) && !pc.kind);
        // The skirt's hip line is still at the hip: the hip plus ease.
        const hipY = body.waist_to_hip - d.seamDrop;
        const hip = 2 * skirt.reduce((t, pc) => t + widthAt(pc, hipY), 0);
        if (Math.abs(hip - (body.full_hip + sEase.hip)) > 0.6) failures.push(`${tag}: hip ${r1(hip)} vs ${r1(body.full_hip + sEase.hip)}`);
        // A moved seam has the hip's ease over the body where it sits, and is checked against its own girth.
        if (d.seamDrop > 0) {
          const girth = girthBelowWaist(body, d.seamDrop);
          if (!d.seamCm || d.seamCm < girth + sEase.hip - 1) failures.push(`${tag}: seam ${d.seamCm} over a ${r1(girth)} body at ${d.seamDrop} below the waist`);
          for (const c of checkPattern(d.pieces, { finishedWaist: d.seamCm })) if (!c.ok) failures.push(`${tag}: ${c.label} (${c.detail})`);
        } else for (const c of checkPattern(d.pieces, { finishedWaist: d.finishedWaist })) if (!c.ok) failures.push(`${tag}: ${c.label} (${c.detail})`);
        // Below the zip the dress pulls up over the hips, or it is marked to go on over the head.
        const ring = 2 * skirt.reduce((t, pc) => t + widthAt(pc, d.zipBelowWaist + 1), 0);
        if (ring < body.full_hip - 1.5 && !d.overHead) failures.push(`${tag}: ${r1(ring)} round at the zip end, hip ${r1(body.full_hip)}, zip ${d.zipCm}`);
        if (d.overHead && ring < body.full_bust - 1.5) failures.push(`${tag}: over the head but ${r1(ring)} round at the zip end, bust ${r1(body.full_bust)}`);
      }
    }
    expect(failures.slice(0, 10), `${failures.length} failures`).toEqual([]);
  });
});

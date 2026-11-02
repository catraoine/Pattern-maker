// Fit sweep: the skirt and bodice drafted for many bodies, and the drawn pieces measured against the body
// the way a toile would be, not just against each other. Added after the Fable fit check of 2026-10-24.
import { describe, expect, it } from 'vitest';
import { draftSkirt, FIT_EASE, skirtFitOf } from './skirt';
import { BODICE_FIT_EASE, BOXY, LONG_BELOW_HIP, draftBodice, girthBelowWaist } from './bodice';
import { draftDress } from './dress';
import { draftTrousers, TROUSER_EASE, TrousersMeasurements } from './trousers';
import { draftOuter, OUTER_EASE } from './outerwear';
import { draftSleeve } from './sleeve';
import { checkPattern } from './qc';
import { randomArms, randomBody, randomCrotch, rng } from './randomBodies';
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

// Added after the Fable fit check of the SS27 house looks, 2026-10-29: the combinations the collection
// uses that no sweep had measured before.
describe('the SS27 looks measured against the body', () => {
  /** Where a piece's outline crosses the level y: its leftmost and rightmost x. */
  const spanAt = (pc: Piece, y: number): [number, number] => {
    const pts = pc.outline.points(24);
    const xs: number[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) xs.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y));
    }
    return [Math.min(...xs), Math.max(...xs)];
  };
  const maxY = (pc: Piece) => Math.max(...pc.outline.points(24).map((q) => q.y));
  const outerChecks = (pieces: Piece[]) => checkPattern(pieces.filter((pc) => !pc.kind || pc.kind === 'collar' || pc.kind === 'pocket'));

  it(`drafts the boxy unpadded jacket and the double-breasted A-line coat to the body, pockets inside their panels, for ${BODIES} bodies`, () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= BODIES; seed++) {
      const r = rng(seed + 31000);
      const b = randomBody(r);
      const m = { ...b, ...randomArms(b, r) };
      const styles = [
        { kind: 'jacket', fit: 'relaxed', shaping: 'boxy', pads: 'none', pockets: 'patch', length: 'hip' },
        { kind: 'coat', fit: 'relaxed', front: 'double', flare: 'a_line', pads: 'soft', shaping: 'princess', pockets: 'welt', length: 'knee' },
      ] as const;
      for (const st of styles) {
        const tag = `seed ${seed} ${st.kind}`;
        const d = draftOuter(m, st);
        const ease = OUTER_EASE[st.kind][st.fit];
        if (d.warnings.length) failures.push(`${tag}: ${d.warnings.join('; ')}`);
        const [bf, bb] = d.block;
        const base = d.base;
        const [basef] = base.block ?? base.pieces;
        const sideBust = basef.draft!.points.find((q) => q.n === '6')!.at;
        const underF = basef.draft!.points.find((q) => q.n === '5')!.at;
        const bust = 2 * (widthAt(bf, sideBust.y + 0.2) + widthAt(bb, base.armholeDepth + (sideBust.y - underF.y) + 0.2));
        if (bust < m.full_bust + ease - 3.5 || bust > m.full_bust + ease + 1) failures.push(`${tag}: bust ${r1(bust)} vs ${r1(m.full_bust + ease)}`);
        // The hem clears the hip by the fit's room (a jacket ends at the hip; a coat flares on past it).
        if (d.finishedHem < m.full_hip + 16) failures.push(`${tag}: hem ${d.finishedHem} over a ${r1(m.full_hip)} hip`);
        // The sleeve has the outerwear ease at the bicep and goes on over a hand.
        if (d.sleeve.bicep < m.upper_arm + (st.kind === 'coat' ? 16 : 13) - 0.5) failures.push(`${tag}: sleeve ${d.sleeve.bicep} round a ${r1(m.upper_arm)} arm`);
        if (d.sleeve.hemCm < Math.max(19, m.wrist * 1.3) + 4) failures.push(`${tag}: sleeve hem ${d.sleeve.hemCm}`);
        // The pocket lies inside the front it is drawn on, clear of the side seam, the front edge and the buttons.
        const pk = d.pocket!;
        const carrier = d.pieces.find((pc) => !pc.kind && /front/i.test(pc.name) && pc.lines.some((l) => l.points().some((q) => Math.abs(q.x - pk.x) < 1e-6 && Math.abs(q.y - pk.y) < 1e-6)));
        if (!carrier) failures.push(`${tag}: pocket drawn on no front`);
        else {
          const [lo, hi] = spanAt(carrier, pk.y + pk.h / 2);
          if (hi - (pk.x + pk.w) < 1.9) failures.push(`${tag}: pocket to ${r1(pk.x + pk.w)} on a ${carrier.name} that ends at ${r1(hi)}`);
          if (pk.x - lo < 1.4) failures.push(`${tag}: pocket from ${r1(pk.x)} on a ${carrier.name} that starts at ${r1(lo)}`);
          if (maxY(carrier) - (pk.y + pk.h) < 3.9) failures.push(`${tag}: pocket bottom ${r1(maxY(carrier) - (pk.y + pk.h))} above the hem`);
          if (pk.x - Math.max(...d.buttons.columns) < d.buttons.sizeCm) failures.push(`${tag}: pocket under the buttons`);
          if (pk.y < base.front.waistCentre.y - 2.05) failures.push(`${tag}: pocket top ${r1(base.front.waistCentre.y - pk.y)} above the waist`);
        }
        if (pk.w < 11) failures.push(`${tag}: pocket ${pk.w} wide`);
        // The collar's neck edge is the neckline it sews to.
        const collar = d.pieces.find((pc) => pc.name === 'Collar')!;
        const opened = d.pieces.find((pc) => !pc.kind && /front/i.test(pc.name) && pc.outline.tags.includes('gorge'))!;
        const backFold = d.pieces.find((pc) => !pc.kind && /back/i.test(pc.name) && (pc.fold || pc.meta.vent))!;
        const neck = taggedLength(opened.outline, 'neck') + taggedLength(backFold.outline, 'neck');
        if (Math.abs(taggedLength(collar.outline, 'neck') - neck) > 0.3) failures.push(`${tag}: collar ${r1(taggedLength(collar.outline, 'neck'))} on a ${r1(neck)} neck seam`);
        for (const c of outerChecks(d.pieces)) if (!c.ok) failures.push(`${tag}: ${c.label} (${c.detail})`);
      }
    }
    expect(failures.slice(0, 10), `${failures.length} failures`).toEqual([]);
  });

  it(`drafts the relaxed dartless shirt with its collar and sleeves, the gathered sash skirt and the knee-slit column, for ${BODIES} bodies`, () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= BODIES; seed++) {
      const r = rng(seed + 31000);
      const b = randomBody(r);
      const m = { ...b, ...randomArms(b, r) };
      const tag = `seed ${seed}`;
      // The shirt: no darts, so the bust is still the bust plus ease, the hem clears the hip, and the front hangs a little longer at the centre.
      const shirt = draftBodice(m, { fit: 'relaxed', neckline: 'crew', collar: 'shirt', closure: 'front_buttons', length: 'hip', darts: 'none' });
      const [sf, sb] = shirt.block ?? shirt.pieces;
      const sideBust = sf.draft!.points.find((q) => q.n === '6')!.at;
      const underF = sf.draft!.points.find((q) => q.n === '5')!.at;
      const bust = 2 * (widthAt(sf, sideBust.y + 0.2) + widthAt(sb, shirt.armholeDepth + (sideBust.y - underF.y) + 0.2));
      if (Math.abs(bust - (m.full_bust + BODICE_FIT_EASE.relaxed.bust)) > 3) failures.push(`${tag} shirt: bust ${r1(bust)} vs ${r1(m.full_bust + 11)}`);
      if ((shirt.finishedHem ?? 0) < m.full_hip + 10) failures.push(`${tag} shirt: hem ${shirt.finishedHem} over a ${r1(m.full_hip)} hip`);
      const dip = shirt.front.hemCentre.y - shirt.front.hemSide.y;
      if (dip < -0.5 || dip > 8) failures.push(`${tag} shirt: front hem ${r1(dip)} lower at the centre than the side`);
      if (!shirt.pieces.some((pc) => /stand/i.test(pc.name)) || !shirt.buttons) failures.push(`${tag} shirt: no collar stand or buttons`);
      if (shirt.neck < m.neck + 1.5) failures.push(`${tag} shirt: neck ${shirt.neck} round a ${r1(m.neck)} neck`);
      const sl = draftSleeve(shirt, m, { length: 'long', shape: 'straight', fit: 'relaxed', seamAllowance: 1.5, armholeAllowance: 1, hemAllowance: 2.5 });
      if (sl.hemCm < Math.max(19, m.wrist * 1.3) + 1.5) failures.push(`${tag} shirt: sleeve hem ${sl.hemCm}`);
      for (const c of checkPattern([...shirt.pieces, ...sl.pieces])) if (!c.ok) failures.push(`${tag} shirt: ${c.label} (${c.detail})`);
      // The gathered maxi: its round passes the hips with room to spare, and a quarter cuts on folded 140 cm cloth.
      const sash = draftSkirt(m, { fit: 'regular', silhouette: 'gathered', length: 'maxi' });
      if (!sash.gathers || sash.gathers.round < m.full_hip + 19) failures.push(`${tag} sash: round ${sash.gathers?.round} over a ${r1(m.full_hip)} hip`);
      const [gf] = sash.pieces;
      const qw = Math.max(...gf.outline.points().map((q) => q.x)) - Math.min(...gf.outline.points().map((q) => q.x));
      if (qw + gf.seamAllowance > 70) failures.push(`${tag} sash: quarter ${r1(qw)} wide`);
      if (Math.abs(sash.finishedWaist - (m.waist + FIT_EASE.regular.waist)) > 0.05) failures.push(`${tag} sash: waist ${sash.finishedWaist}`);
      // The column: a straight maxi skirt's unasked walking slit reaches the knee.
      const column = draftDress(m, { fit: 'fitted', neckline: 'scoop' }, { fit: 'fitted', silhouette: 'straight', length: 'maxi' }, 'natural');
      const slit = column.skirt.slit;
      const want = Math.min(column.skirt.lengthCm - m.waist_to_knee, column.skirt.slit?.range.max ?? Infinity);
      if (!slit || slit.at !== 'back' || Math.abs(slit.cm - Math.round(want)) > 1) failures.push(`${tag} column: slit ${JSON.stringify(slit)} vs ${r1(want)} to the knee`);
      // Asked for, a slit keeps its height.
      const asked = draftSkirt(m, { fit: 'fitted', silhouette: 'straight', length: 'maxi', slit: 'back', slitCm: 20 });
      if (asked.slit?.cm !== 20) failures.push(`${tag} column: asked for 20, got ${asked.slit?.cm}`);
    }
    expect(failures.slice(0, 10), `${failures.length} failures`).toEqual([]);
  });
});

// The boxy dress (Cat, 2026-10-30, from her gingham drop-waist dress): straight from the bust, squared at the shoulder
// by the cut, bust darts kept, short straight sleeves.
describe('the boxy dress measured against the body', () => {
  /** The shoulder seam's outer end on a bodice piece: the end of its 'shoulder' run away from the neck. */
  const shoulderTip = (pc: Piece) => {
    const { pts, tags } = pc.outline.taggedPoints(2);
    const run = pts.filter((_, i) => tags[i] === 'shoulder' || tags[i - 1] === 'shoulder');
    return run.reduce((a, q) => (Math.abs(q.x) > Math.abs(a.x) ? q : a));
  };
  const styles = [
    { seam: 'dropped', silhouette: 'straight', darts: 'bust_waist' },
    { seam: 'natural', silhouette: 'a_line', darts: 'bust' },
    { seam: 'low', silhouette: 'straight', darts: 'bust' },
  ] as const;

  it(`hangs straight from the bust, squares the shoulder in the cut and sews up with its sleeves, for ${BODIES} bodies`, () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= BODIES; seed++) {
      const r = rng(seed + 41000);
      const b = randomBody(r);
      const m = { ...b, ...randomArms(b, r) };
      for (const st of styles) {
        const tag = `seed ${seed} ${st.seam} ${st.silhouette}`;
        const bodice = { fit: 'boxy', neckline: 'boat', darts: st.darts } as const;
        const d = draftDress(m, bodice, { fit: skirtFitOf('boxy'), silhouette: st.silhouette, length: 'mini' }, st.seam);
        // The relaxed dress's bodice, to measure the square against (its skirt may not draft where the waist passes the hip).
        const relaxed = draftBodice(m, { ...bodice, fit: 'relaxed', length: 'waist' });
        if (d.warnings.length) failures.push(`${tag}: ${d.warnings.join('; ')}`);
        if (Math.abs(d.finishedBust - (m.full_bust + BODICE_FIT_EASE.boxy.bust)) > 0.6) failures.push(`${tag}: bust ${d.finishedBust}`);
        // Straight: the waist no narrower than the bust less BOXY.waist, a moved seam no narrower than the bust.
        if (d.finishedWaist < d.finishedBust - BOXY.waist - 0.6) failures.push(`${tag}: waist ${d.finishedWaist} under a ${d.finishedBust} bust`);
        if (d.seamCm && d.seamCm < d.finishedBust - 0.6) failures.push(`${tag}: seam ${d.seamCm} under a ${d.finishedBust} bust`);
        // Squared in the cut: each shoulder point higher and further out than the relaxed dress's, by about BOXY.
        for (const side of ['front', 'back'] as const)
          if (relaxed.shoulderSlope[side] - d.bodice.shoulderSlope[side] < 3) failures.push(`${tag} ${side}: shoulder only ${r1(relaxed.shoulderSlope[side] - d.bodice.shoulderSlope[side])} degrees squarer`);
        for (const i of [0, 1]) {
          const [box, rel] = [shoulderTip(d.bodice.pieces[i]), shoulderTip(relaxed.pieces[i])];
          if (rel.y - box.y < 0.6) failures.push(`${tag} ${d.bodice.pieces[i].name}: shoulder only ${r1(rel.y - box.y)} cm higher`);
          if (box.x - rel.x < BOXY.extend * 0.6) failures.push(`${tag} ${d.bodice.pieces[i].name}: shoulder only ${r1(box.x - rel.x)} cm wider`);
        }
        const sl = draftSleeve(d.bodice, m, { length: 'short', lengthCm: 20, shape: 'straight', fit: 'boxy', seamAllowance: 1.5, armholeAllowance: 1, hemAllowance: 2.5 });
        const pieces = [...d.pieces, ...sl.pieces];
        for (const c of checkPattern(pieces, { finishedWaist: d.seamCm ?? d.finishedWaist })) if (!c.ok) failures.push(`${tag}: ${c.label} (${c.detail})`);
      }
    }
    expect(failures.slice(0, 10), `${failures.length} failures`).toEqual([]);
  });
});

// The oversized long shirt (Cat broke the freeze for it, 2026-10-31, for the Parma Shirt): straight from the bust
// with the oversized ease and no darts, long over the seat, dropped shoulders and cuffed sleeves.
describe('the oversized long shirt measured against the body', () => {
  it(`hangs straight from the bust with its ease, runs past the hip and sews up with its sleeves, for ${BODIES} bodies`, () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= BODIES; seed++) {
      const r = rng(seed + 52000);
      const b = randomBody(r);
      const m = { ...b, ...randomArms(b, r) };
      const tag = `seed ${seed}`;
      const shirt = draftBodice(m, { fit: 'oversized', neckline: 'crew', collar: 'shirt', closure: 'front_buttons', length: 'long', darts: 'none', sleeve: 'long', sleeveCut: 'drop' } as never);
      const want = m.full_bust + BODICE_FIT_EASE.oversized.bust;
      if (Math.abs(shirt.finishedBust - want) > 3) failures.push(`${tag}: bust ${shirt.finishedBust} vs ${r1(want)}`);
      if ((shirt.finishedHem ?? 0) < want - 1) failures.push(`${tag}: hem ${shirt.finishedHem} narrower than the ${r1(want)} bust`);
      if ((shirt.finishedHem ?? 0) < m.full_hip + 10) failures.push(`${tag}: hem ${shirt.finishedHem} over a ${r1(m.full_hip)} hip`);
      if (Math.abs(shirt.drop - (m.waist_to_hip + LONG_BELOW_HIP)) > 0.5) failures.push(`${tag}: hem ${shirt.drop} below the waist`);
      // No darts take anything in: the waist is as wide as the bust.
      if (shirt.finishedWaist < want - 1) failures.push(`${tag}: waist ${shirt.finishedWaist} narrower than the ${r1(want)} bust`);
      if (!shirt.buttons || !shirt.pieces.some((pc) => /stand/i.test(pc.name))) failures.push(`${tag}: no collar stand or buttons`);
      for (const w of shirt.warnings) if (/armhole/.test(w)) failures.push(`${tag}: ${w}`);
      const sl = draftSleeve(shirt, m, { length: 'long', shape: 'straight', cuff: 'shirt', fit: 'oversized', seamAllowance: 1.5, armholeAllowance: 1, hemAllowance: 2.5 });
      for (const c of checkPattern([...shirt.pieces, ...sl.pieces])) if (!c.ok) failures.push(`${tag}: ${c.label} (${c.detail})`);
    }
    expect(failures.slice(0, 10), `${failures.length} failures`).toEqual([]);
  });
});

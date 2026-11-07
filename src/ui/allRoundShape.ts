// The shape All round draws: where the garment's cloth lies round the body at every height and angle, its sleeves and
// trouser legs, from the draft (engine/allRound.ts) and the measurements. Shared by the two painters: the 3D mesh
// (allRoundMesh.ts) the phone's graphics chip draws, and the canvas painter (AllRound.tsx) kept for a browser without it.
import { RoundGarment } from '../engine/allRound';
import { SHOULDER_TIP_Y, bodyHalf as formHalfWidth, depthShare, reach as bodyReach } from '../engine/body';
import { FORM_CROTCH, FORM_HIP, LEG as FORM_LEG, LEG_FLOOR as FORM_FLOOR, LEG_KNEE as FORM_KNEE, LEG_X as FORM_LEG_X } from '../engine/form';
export { FORM_HIP };

const TAU = Math.PI * 2;
const HALF = Math.PI / 2;
export const WAIST = 0.1;
/** Where the nape and the bust sit on the form. */
const NAPE_Y = -1.45;
/** The base of the form's neck, and its shoulder tips, where the shoulders reach their full width. */
export const NECK_Y = -1.47;
export const SHOULDER_Y = SHOULDER_TIP_Y;
export const BUST_Y = -0.58;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const smooth = (u: number) => u * u * (3 - 2 * u);
const TOP_N = 360;

/** The measurements the view places the garment by; any it lacks fall back to the form's own. */
export interface RoundMeasurements {
  waist?: number;
  full_bust?: number;
  full_hip?: number;
  waist_to_hip?: number;
  waist_to_knee?: number;
  waist_to_floor?: number;
  nape_to_waist?: number;
  crotch_depth?: number;
}

/** Lengths in cm from the waist, onto the form: the nape, waist, hip, crotch, knee and floor each at their own line
 * on the figure. A top's shoulder tip goes on the form's shoulder tip, where its shoulders are full width, and the
 * neck point at the base of the form's neck: drawn from the nape alone, the shoulders sat up on the neck and the
 * sleeves hung low off the side, like dropped shoulders (Cat, 2026-10-26: "the shoulders are too low"). */
export function placeOnForm(round: Pick<RoundGarment, 'armhole'>, m: RoundMeasurements): (cm: number) => number {
  const N = m.nape_to_waist ?? 41;
  const wh = m.waist_to_hip ?? 20.5;
  const tip = round.armhole?.shoulderCm;
  const knots: [number, number][] = [
    ...(tip !== undefined && tip > -N + 0.3 && tip < -N / 2
      ? ([
          [-N - 4, NECK_Y],
          [-N, NAPE_Y],
          [tip, SHOULDER_Y],
        ] as [number, number][])
      : ([[-N, NAPE_Y]] as [number, number][])),
    [0, WAIST],
    [wh, FORM_HIP],
  ];
  const add = (cm: number | undefined, y: number) => {
    if (cm !== undefined && cm > knots[knots.length - 1][0] + 1) knots.push([cm, y]);
  };
  add(m.crotch_depth ?? wh * 1.3, FORM_CROTCH);
  add(m.waist_to_knee, FORM_KNEE);
  add(Math.max(m.waist_to_floor ?? 104, wh + 2), FORM_FLOOR);
  return (cm: number) => {
    let i = 1;
    while (i < knots.length - 1 && cm > knots[i][0]) i++;
    const [c0, y0] = knots[i - 1];
    const [c1, y1] = knots[i];
    return y0 + ((cm - c0) / (c1 - c0)) * (y1 - y0);
  };
}

/** How the view is drawn: for the How it works film (a gentler waist), or the film's old look (the form's lines running on
 *  through the garment). */
interface ShapeFlags {
  film: boolean;
  through: boolean;
}

export type RoundShape = ReturnType<typeof roundShape>;

/** The garment's shape on the form. */
export function roundShape(round: RoundGarment, m: RoundMeasurements, { film, through }: ShapeFlags) {
  const trousers = round.kind === 'trousers';
  const isTop = round.kind === 'top' || round.kind === 'dress';
  const N = m.nape_to_waist ?? 41;
  const wh = m.waist_to_hip ?? 20.5;
  const yOfLevel = placeOnForm(round, m);
  // On a body the neck sits tilted: its base at the front is a good way below the neck point at the side, while the
  // form's neck base is level all round. So on the front, a neckline is measured from the front of the neck's base,
  // not from the side's, or every front neckline sits too deep on the form and a boat neck reads as a scoop (Cat,
  // 2026-10-26: "does the neckline look strange?"). The lift fades out by the bust, so nothing below it moves.
  const N0 = m.nape_to_waist ?? 41;
  const frontNeckCm = -N0 + 5;
  // A plain round neck, as drafted, follows the base of the neck: at the side neck point and some 9 cm lower at the
  // centre front, round in between. Where that natural neckline lies is placed at the form's neck base all round.
  const naturalNeck = (a: number) => -N0 - 4 + (frontNeckCm + N0 + 4) * Math.max(0, Math.cos(a)) ** 0.6;
  const yAt = (a: number, cm: number) => {
    if (!isTop || Math.cos(a) <= 0) return yOfLevel(cm);
    const lift = Math.max(0, yOfLevel(naturalNeck(a)) - NECK_Y);
    return yOfLevel(cm) - lift * clamp(1 - (cm - naturalNeck(a)) / 14, 0, 1);
  };
  const yOf = yOfLevel;
  const kY = (WAIST - NAPE_Y) / N;

  // The garment's ease over the body, as form units, at the bust, the waist and the hip.
  const krB = formHalfWidth(BUST_Y) / ((m.full_bust ?? 90) / TAU);
  const krW = formHalfWidth(WAIST) / ((m.waist ?? 72) / TAU);
  const krH = formHalfWidth(FORM_HIP) / ((m.full_hip ?? 98) / TAU);
  const easeOf = (fin: number | undefined, body: number | undefined, kr: number) => (fin && body ? clamp(((fin - body) / TAU) * kr, 0.012, 0.25) : undefined);
  const eW = easeOf(round.girth.waist, m.waist, krW) ?? 0.02;
  const eB = easeOf(round.girth.bust, m.full_bust, krB) ?? eW;
  const eH = easeOf(round.girth.hip, m.full_hip, krH) ?? eW;
  const easeAt = (y: number) =>
    y <= BUST_Y ? 0.01 + (eB - 0.01) * smooth(clamp((y - NAPE_Y) / (BUST_Y - NAPE_Y), 0, 1)) : y <= WAIST ? eB + (eW - eB) * ((y - BUST_Y) / (WAIST - BUST_Y)) : y <= FORM_HIP ? eW + (eH - eW) * ((y - WAIST) / (FORM_HIP - WAIST)) : eH;

  const lengths = Array.from({ length: 73 }, (_, i) => round.lengthAt((TAU * i) / 72));
  const tops = Array.from({ length: 73 }, (_, i) => round.topAt((TAU * i) / 72));
  const longest = Math.max(...lengths);
  const highest = Math.min(...tops);
  const meanY = yOf(lengths.reduce((t, v) => t + v, 0) / lengths.length);
  const flares = !trousers && meanY > FORM_HIP + 0.05;
  const bodyR = (y: number) => formHalfWidth(Math.min(y, 1.3)) + easeAt(y);
  // The cloth shows the pattern's own widths everywhere (Cat, 2026-10-27: "the waist should only cinch to the extent
  // that the pattern does"), as the Form view does: a tee goes in at the waist by what its side seam does, no more
  // and no less. (It used to hang straight from the bust when it had more ease at the waist than the bust.)
  const wornR = bodyR;
  // Whether the cloth hangs in front and behind, or is shaped to the body there: a garment cut straight, with more
  // ease at the waist than at the bust (a tee), hangs from the bust; one cut in to the waist (a bodice, a jacket or
  // coat with shaped seams, a dress held at its waist seam) follows the body, however much ease it has (Cat,
  // 2026-10-26: the bodice and jacket "hung like boxes"). Below the hip everything hangs from the hip.
  const seamed = round.kind === 'dress' && round.rings.length > 0;
  const waistEase = round.girth.waist && m.waist ? round.girth.waist - m.waist : undefined;
  const bustEase = round.girth.bust && m.full_bust ? round.girth.bust - m.full_bust : undefined;
  const straightCut = waistEase === undefined ? 0 : bustEase === undefined ? (waistEase - 4) / 3 : (waistEase - bustEase - 2) / 4;
  // A seamed dress follows the body unless its bodice is cut straight too (Boxy: about as wide at the waist as at the
  // bust): its ease spread evenly round the body at the waist read as a belly and a barrel (Cat, 2026-10-30: "it
  // just makes the person look fat"), where the cloth really falls straight from the bust in front and behind.
  const hangShare = !isTop || (seamed && straightCut < 1) ? 0 : clamp(straightCut, 0, 1) * (through ? 0 : film ? 0.5 : 1);
  const hipR = wornR(FORM_HIP);
  // The body's widest point below the waist is the top of the thighs, a little under the hip line; trousers hang from
  // there (hung from the hip line they came in over the thighs: the hip stood out as a shelf, Cat 2026-10-28).
  const hipWide = Math.max(...Array.from({ length: 25 }, (_, i) => wornR(FORM_HIP + ((1.3 - FORM_HIP) * i) / 24)));
  const hemR = hipR * clamp(round.flare, 0.85, 2.3);
  const bodyRadius = (y: number) =>
    y <= FORM_HIP || !flares ? wornR(y) : hipR + (hemR - hipR) * clamp((y - FORM_HIP) / Math.max(0.05, meanY - FORM_HIP), 0, 1.3);
  const bandTop = WAIST - round.bandCm * kY;

  // Sleeves hang from the armhole: out from the shoulder tip, then down the arm.
  const arm = round.armhole;
  const yS = arm ? yOf(arm.shoulderCm) : 0;
  const yU = arm ? yOf(arm.underarmCm) : 0;
  const sl = round.sleeve;
  // In the film the sleeve hugs the arm (Cat, 2026-10-24: "make it look chic"); in the app it keeps its wearing ease.
  const slim = film ? 0.9 : 1;
  const ra = sl ? Math.max(0.08, (sl.bicepCm / TAU) * krB * 0.95 * slim) : 0;
  const rh = sl ? Math.max(0.05, (sl.hemCm / TAU) * krB * 0.95 * slim) : 0;
  // A jacket or coat is tailored: a pad squares and extends its shoulder a little past the body's, and the sleeve
  // head is set flat from there (Cat, 2026-10-26: "I'd like them flatter"; 2026-10-27: B Slimmer).
  const tailored = !!round.outer && !!sl;
  // The neck itself, above the trapezius, for the view through a neckline.
  const neckOnly = formHalfWidth(-1.62) + 0.01;
  // The cloth lies on the body's own shoulder (Cat, 2026-10-27: "a real body"): from the side of the neck it slopes
  // down to the shoulder tip and no further. Nothing runs out past the tip in a shelf for the sleeve to hang from;
  // the sleeve's cap rounds over the top of the arm from the tip instead, as a shoulder does.
  const pad = tailored ? 0.045 : 0;
  const radius = (y: number) => {
    const r = bodyRadius(y);
    if (!arm || y >= BUST_Y || !pad) return r;
    // The pad runs out to the tip and fades to the body by the underarm.
    const over = y <= yS ? pad * clamp((y - NECK_Y) / (yS - NECK_Y), 0, 1) ** 0.7 : pad * (1 - smooth(clamp((y - yS) / (yU - yS || 1), 0, 1)));
    return r + over;
  };
  /** How far out the cloth lies at angle a round the body: the full width at the sides, the body's own depth front and back. */
  // Cloth that hangs falls in soft folds, not as a smooth vase (Cat, 2026-10-28, "in another league"): a few gentle
  // ones down any hanging cloth from where it leaves the body, and deeper ones where a flare adds cloth.
  const foldAmp = (y: number) => {
    // Trousers hang smooth: their legs are drawn without folds, so folds down the body stopped at the crotch as a row
    // of bumps over the legs (Cat, 2026-11-06: "two banded bumps").
    const soft = isTop ? 0.028 * smooth(clamp((y - BUST_Y) / 0.6, 0, 1)) : trousers ? 0 : 0.034 * smooth(clamp((y - WAIST) / 0.5, 0, 1));
    const flared = flares ? (0.018 + 0.06 * clamp(round.flare - 1, 0, 1)) * smooth(clamp((y - FORM_HIP) / Math.max(0.05, meanY - FORM_HIP), 0, 1)) : 0;
    return Math.max(soft, flared);
  };
  const FOLDS = 8;
  const fold = (a: number, y: number) => 1 + foldAmp(y) * Math.cos(FOLDS * a + 0.6 * Math.sin(3 * a));
  const foldTilt = (a: number, y: number) => Math.atan(-foldAmp(y) * FOLDS * Math.sin(FOLDS * a + 0.6 * Math.sin(3 * a)) * 1.2);
  // Seen from above a body is an oval, not a circle: thin across the shoulders, deeper at the bust, the seat standing
  // out behind at the hip. The depths are the body's own (form.ts, shared with the 3D body and the turning form), so
  // the figure turning here is the same body as the one drawn flat; whatever the garment adds over the body (its
  // ease, a flare) stands out evenly all round (Cat, 2026-10-27: "this body shape still looks weird").
  const deep = depthShare;
  const depthAt = (a: number, y: number) => {
    const body = formHalfWidth(Math.min(y, 1.3));
    return body * deep(y, Math.cos(a) > 0) + radius(y) - body;
  };
  /** The body's own cross-section at this height (engine/body.ts, from MakeHuman's body) with the garment's ease over it. */
  const onBody = (a: number, y: number) => {
    const body = formHalfWidth(Math.min(y, 1.3));
    return bodyReach(body, a, y) + radius(y) - body;
  };
  // Hanging cloth falls straight from the widest point above it rather than following the body in and out (which
  // drew the belly's own bump on a tee, Cat 2026-10-27: "the bump out around the belly line looks weird"). Down each line round the body the cloth reaches at least as far as it did just above, with the pattern's
  // own width at the sides: where the pattern narrows (the waist) the sides come in and the front and back hang
  // straight; where it widens below the hip (a flare) it widens all round. The body itself still shows wherever it
  // stands out further than the hanging cloth. Laid as a table down the garment, read between its rows.
  // How much of a flare below the hip is cut at the side seams (an A-line: its centre front and back on the straight
  // grain, so seen from the side it hangs straight and only the sides go out) and how much all round (gores, a
  // circle). Flaring everything all round made an A-line a tent from the side (Cat, 2026-10-28: "these angles are
  // a bit weird"). From the side seams' angle to the grain over the drop from the hip to the hem.
  const dropCm = Math.max(0, longest - wh);
  const gainCm = Math.max(0, (round.girth.hip ?? 0) * (round.flare - 1));
  const sideGainCm = 2 * dropCm * (Math.tan((round.sideAngle.front * Math.PI) / 180) + Math.tan((round.sideAngle.back * Math.PI) / 180));
  const allRound = gainCm > 0.5 ? 1 - clamp(sideGainCm / gainCm, 0, 1) : 0;
  const HANG_N = 72;
  const HANG_DY = 0.02;
  // From the bust down: above it the cloth is held on the neck and shoulders and lies on the body (hung from the
  // shoulders, the chest and back read as a box seen from the side). Cloth shaped to the body down to the hip (a
  // bottom, a seamed dress, a fitted jacket) leaves it at the waist, not the bust: hung from the bust it stood out
  // past the body in one step at the hip, a shelf right round the garment (Cat, 2026-10-28).
  const hangTop = hangShare > 0 ? BUST_Y : WAIST;
  const hangRows = Math.max(2, Math.ceil((Math.max(yOf(longest), FORM_HIP) + 0.1 - hangTop) / HANG_DY) + 1);
  // A boxy dress hangs from the bust as a tube: below it the cloth keeps the bust's own cross-section, its sides
  // following the pattern's girth (the bust's, then the waist's and the hip's), not the body's waist plus the ease
  // spread evenly round it, which stood out in front and behind as a belly (Cat, 2026-10-30: "makes the person look
  // fat"). Underneath, the body shows only where it stands out further than that, with a whisper of ease.
  const tube = seamed && hangShare > 0;
  const girthAt = (y: number) => {
    const { bust = 90, waist = bust, hip = waist } = round.girth;
    return y <= BUST_Y ? bust : y <= WAIST ? bust + (waist - bust) * ((y - BUST_Y) / (WAIST - BUST_Y)) : y <= FORM_HIP ? waist + (hip - waist) * ((y - WAIST) / (FORM_HIP - WAIST)) : hip;
  };
  const under = (a: number, y: number) => (tube ? bodyReach(formHalfWidth(Math.min(y, 1.3)), a, y) + 0.012 : onBody(a, y));
  /** The cloth down each line round the body, falling from `top` at the top row over `under` below it. */
  const fallFrom = (under: (a: number, y: number) => number, top: (a: number, y: number) => number) => {
    const table = new Float64Array(HANG_N * hangRows);
    for (let i = 0; i < HANG_N; i++) {
      const a = -Math.PI + (TAU * i) / HANG_N;
      const sa = Math.sin(a) ** 2;
      let prev = top(a, hangTop);
      table[i * hangRows] = prev;
      for (let j = 1; j < hangRows; j++) {
        const y = hangTop + j * HANG_DY;
        const rho = tube ? girthAt(y) / girthAt(y - HANG_DY) : radius(y) / (radius(y - HANG_DY) || 1e-6);
        const sides = Math.sqrt(sa * rho * rho + (1 - sa));
        const fell = prev * (y > FORM_HIP ? sides + (rho - sides) * allRound : sides);
        prev = Math.max(y > hangTop + HANG_DY / 2 ? under(a, y) : top(a, y), fell);
        table[i * hangRows + j] = prev;
      }
    }
    return table;
  };
  const hang = fallFrom(under, onBody);
  const hungOf = (table: Float64Array) => (a: number, y: number) => {
    const f = ((((a + Math.PI) / TAU) % 1) + 1) % 1 * HANG_N;
    const i0 = Math.floor(f) % HANG_N;
    const i1 = (i0 + 1) % HANG_N;
    const u = f - Math.floor(f);
    const g = (y - hangTop) / HANG_DY;
    if (g <= 0) return onBody(a, y);
    const j0 = Math.min(hangRows - 2, Math.floor(g));
    const v = Math.min(1, g - j0);
    const at = (i: number) => table[i * hangRows + j0] * (1 - v) + table[i * hangRows + j0 + 1] * v;
    return at(i0) * (1 - u) + at(i1) * u;
  };
  const hung = hungOf(hang);
  const shell = (a: number, y: number) => {
    // Cloth shaped to the body hangs from wherever the body is fullest below the waist (the belly in front, the seat
    // behind), straight on down: hung from the waist it lies on the body until then, so there is no step. Cloth
    // hung from the bust in part (a tee) lets go of the body over the last stretch above the hip.
    const share = hangShare > 0 ? hangShare + (1 - hangShare) * smooth(clamp((y - (FORM_HIP - 0.2)) / 0.2, 0, 1)) : 1;
    const r = share ? (share < 1 ? onBody(a, y) + (hung(a, y) - onBody(a, y)) * share : hung(a, y)) : onBody(a, y);
    return r * fold(a, y);
  };
  /** How far forward (or back) the cloth reaches at x across the body at height y: zero at the side, the full depth at the middle. */
  const zAcross = (x: number, y: number, front = true) => {
    const ax = Math.abs(x);
    let px = 0;
    let pz = depthAt(front ? 0 : Math.PI, y);
    for (let i = 1; i <= 24; i++) {
      const a = (HALF * i) / 24;
      const r = shell(front ? a : Math.PI - a, y);
      const qx = r * Math.sin(a);
      const qz = r * Math.cos(a);
      if (qx >= ax) return pz + ((qz - pz) * (ax - px)) / (qx - px || 1e-6);
      px = qx;
      pz = qz;
    }
    return 0;
  };
  // Over the shoulder the cloth runs out more than down: its print is laid by the length of cloth, not by the height
  // alone, or it smears into streaks across the top. Counted up from the bust, so below it nothing moves.
  const SHOULDER_TOP = BUST_Y;
  const clothDown = (a: number, y: number) => {
    if (!sl || y >= SHOULDER_TOP) return y;
    let extra = 0;
    const n = 16;
    const dy = (SHOULDER_TOP - y) / n;
    for (let i = 0; i < n; i++) {
      const ya = y + i * dy;
      extra += Math.hypot(dy, shell(a, ya + dy) - shell(a, ya)) - dy;
    }
    return y - extra;
  };
  // The sleeve stands on the arm, outside the body at the underarm; even the shortest reaches a little below it.
  const yE = sl ? Math.max(yS + sl.lengthCm * kY, yU + (film ? 0.4 : 0.1)) : 0;
  // The sleeve's cap is sewn to the shoulder tip and rounds over the top of the arm from there, as the shoulder's
  // own muscle does: its outer edge leaves the tip on the shoulder's slope and curves down to the arm, which hangs
  // beside the body, its inner side pressed to the body's side. (The cap's inner edge is inside the bodice.)
  const yCap = yS;
  const tipX = radius(yS);
  // Where the arm hangs: its middle a little out from the body's side at the underarm (a tailored sleeve a touch more,
  // its head padded), angling out a little as it falls, as an arm at rest does.
  const armX = Math.max(tipX, yU ? radius(yU) : 0) + ra * (tailored ? 0.45 : 0.3);
  const capT = (y: number) => clamp((y - yCap) / (yU - yCap || 1), 0, 1);
  const capOuter = (y: number) => {
    // The cap is out to the arm's full width well up the cap, as the shoulder's own muscle rounds out from the tip, not
    // slowly down to the underarm (which hung the sleeve as a bell with a corner at the tip, Cat 2026-10-27: "frumpy").
    const t = Math.min(1, capT(y) / 0.85);
    // Set flat, a tailored head runs out a little further before it turns down.
    return tipX + (armX + ra - tipX) * (1 - (1 - t) ** (tailored ? 1.5 : 2));
  };
  const capInner = (y: number) => tipX - 0.03 + (armX - ra - (tipX - 0.03)) * capT(y);
  const filmAxis = (y: number) => (y < yU ? (capOuter(y) + capInner(y)) / 2 : armX + (y - yU) * 0.06);
  const filmR = (y: number) => (y < yU ? Math.max(0.012, (capOuter(y) - capInner(y)) / 2) : ra + (rh - ra) * clamp((y - yU) / (yE - yU || 1), 0, 1));
  const axisX = filmAxis;
  // The crown rounds over the top of the arm: a little deeper, front to back, than the arm is wide where it meets
  // the shoulder, so it runs into the shoulder without a notch, but never as deep as the body, which from the side
  // read as a box with a lid on the shoulder (Cat, 2026-10-27); by the underarm it is round, as the arm is.
  const capDepth = (y: number) => {
    if (y >= yU || !sl) return 1;
    const r = filmR(y);
    const need = Math.max(zAcross(filmAxis(y) - r * 0.4, y, true), zAcross(filmAxis(y) - r * 0.4, y, false));
    return clamp(need / r, 1, 1.3) ** (1 - capT(y) ** 2);
  };
  const sleeveR = filmR;

  // Trouser legs, round the form's own legs: easy at the thigh, then to the knee and the hem.
  const lg = round.legs;
  const yC = lg ? yOf(lg.crotchCm) : 0;
  const yH = lg ? yOf(lg.lengthCm) : 0;
  const yK = lg ? Math.min(yOf(m.waist_to_knee ?? lg.crotchCm + 31), yH) : 0;
  const krL = krH * 0.85;
  const thighR = lg ? FORM_LEG(yC) + 0.045 : 0;
  const kneeR = lg ? Math.max(FORM_LEG(yK) + 0.02, (lg.kneeCm / TAU) * krL) : 0;
  const legHemR = lg ? Math.max(FORM_LEG(yH) + 0.012, (lg.hemCm / TAU) * krL) : 0;
  // At the top each leg is as wide as the hip above it, so the outside runs on down from the hip without a step in
  // (Cat, 2026-10-26: "trousers look weird"); the extra goes by mid-thigh, as a thigh narrows.
  // Trouser legs are the seat's two halves, side by side with their inseams together, each as wide as half the seat
  // at the crotch and hanging straight from there to the knee as cut cloth does (not closing in round the thigh and
  // belling out above it, Cat 2026-10-28: "why are pants like this?"). Each leg stands on its own axis, out at half
  // its width so the two touch, and back on the form's leg once the cloth is narrower than the legs are apart.
  const thighTop = lg ? Math.max(thighR, hipWide / 2) : 0;
  // A barrel leg swells out to the knee and holds its width a while below it before curving in to the hem.
  const bow = (t: number, out: boolean) => (lg?.barrel ? (out ? Math.sin((t * Math.PI) / 2) : t * t) : t);
  const legR = (y: number) =>
    y <= yK ? thighTop + (kneeR - thighTop) * bow(clamp((y - yC) / (yK - yC || 1), 0, 1), true) : kneeR + (legHemR - kneeR) * bow(clamp((y - yK) / (yH - yK || 1), 0, 1), false);
  const legAxis = (y: number) => (lg ? Math.max(FORM_LEG_X, legR(y) * 0.97) : FORM_LEG_X);

  // Trousers from the waist to the crotch are the body's own cross-section with the ease over it, hung as a skirt
  // is: lying on the body from the band down, then falling straight from wherever it is fullest, the belly in
  // front and the seat behind (shell). They used to be an oval of their own, as round as the pattern is wide at the
  // waist and three quarters as deep by the hip, which bellied out right under the band in front and behind where
  // the body is far flatter than it is wide, and so stood as a bulb over the legs once they hung plumb (Cat,
  // 2026-11-06: "more of a bump now").
  // Woven cloth takes no hollow down its length: from the band it runs straight to wherever the body stands out below,
  // the seat behind and the belly in front, where a line down the body itself dips in at the small of the back
  // first and then bows out over the seat as a bump (Cat, 2026-11-06: "still looks a bit too bumpy"). Down each
  // line round the body, the hung cloth from the waist to the crotch is bridged by its own hull: the lowest
  // line over it that never dips.
  // On loose trousers the room does not stand out evenly all round (spread so, the front swelled as a belly and the
  // back stood out behind the seat, Cat 2026-11-06: "flatter"): the pleats carry the fullness in front, so the front
  // falls straight down from under the band, and the back falls from the seat with a little room behind it; the
  // sides take the rest, at the pattern's own width.
  const underTrousers = (a: number, y: number) => {
    const body = formHalfWidth(Math.min(y, 1.3));
    const ease = radius(y) - body;
    const whisper = 0.012 + 0.25 * Math.max(0, ease - 0.012);
    return bodyReach(body, a, y) + whisper + (ease - whisper) * Math.sin(a) ** 2;
  };
  const hungTrousers = lg ? hungOf(fallFrom(underTrousers, underTrousers)) : hung;
  const seatRows = lg ? Math.min(hangRows, Math.ceil((yC + 0.05 - WAIST) / HANG_DY) + 1) : 0;
  const bridged = new Float64Array(HANG_N * seatRows);
  for (let i = 0; i < HANG_N; i++) {
    const a = -Math.PI + (TAU * i) / HANG_N;
    const hull: [number, number][] = [];
    for (let j = 0; j < seatRows; j++) {
      const q: [number, number] = [WAIST + j * HANG_DY, hungTrousers(a, WAIST + j * HANG_DY)];
      while (hull.length >= 2) {
        const [p1, p2] = [hull[hull.length - 2], hull[hull.length - 1]];
        if ((p2[0] - p1[0]) * (q[1] - p1[1]) - (p2[1] - p1[1]) * (q[0] - p1[0]) < 0) break;
        hull.pop();
      }
      hull.push(q);
    }
    for (let j = 0, h = 0; j < seatRows; j++) {
      const y = WAIST + j * HANG_DY;
      while (h < hull.length - 2 && hull[h + 1][0] <= y) h++;
      const [p1, p2] = [hull[h], hull[Math.min(h + 1, hull.length - 1)]];
      bridged[i * seatRows + j] = p2[0] > p1[0] ? p1[1] + ((p2[1] - p1[1]) * (y - p1[0])) / (p2[0] - p1[0]) : p1[1];
    }
  }
  const rAt = (a: number, y: number) => {
    if (!lg || y <= WAIST) return shell(a, y);
    const f = ((((a + Math.PI) / TAU) % 1) + 1) % 1 * HANG_N;
    const i0 = Math.floor(f) % HANG_N;
    const i1 = (i0 + 1) % HANG_N;
    const u = f - Math.floor(f);
    const g = Math.min(seatRows - 1.001, (y - WAIST) / HANG_DY);
    const j0 = Math.floor(g);
    const v = g - j0;
    const at = (i: number) => bridged[i * seatRows + j0] * (1 - v) + bridged[i * seatRows + j0 + 1] * v;
    return (at(i0) * (1 - u) + at(i1) * u) * fold(a, y);
  };

  const reach = Math.max(hemR, sl ? axisX(yE) + rh : 0, lg ? FORM_LEG_X + Math.max(thighTop, kneeR, legHemR) : 0, formHalfWidth(-0.55) + eB);
  const hemY = (a: number) => yOf(round.lengthAt(a));
  const topRaw = (a: number) => {
    const y = yAt(a, round.topAt(a));
    // At the side neck point a neckline that reaches the neck sits right at its base, so no pocket of the form shows
    // between the cloth and the neck over the shoulder (Cat, 2026-10-26).
    const near = isTop && sl ? clamp(1 - (y - NECK_Y) / 0.12, 0, 1) * Math.sin(a) ** 2 : 0;
    // The shoulders slope from the side of the neck down to the shoulder tip on the body itself, so the top edge
    // simply lies where it is drafted.
    return y - Math.max(0, y - NECK_Y) * near;
  };
  // Where the front neck meets the shoulder the edge is eased round, not left as a notch; the centre front (a V's
  // point) and the back stay exactly as drawn.
  const topTable = Array.from({ length: TOP_N + 1 }, (_, i) => {
    const a = -Math.PI + (TAU * i) / TOP_N;
    const w = isTop ? Math.sin(a) ** 2 * Math.max(0, Math.cos(a) + 0.3) : 0;
    if (w < 0.01) return topRaw(a);
    let sum = 0;
    for (let k = -6; k <= 6; k++) sum += topRaw(a + k * 0.03);
    return topRaw(a) + (sum / 13 - topRaw(a)) * Math.min(1, w * 2.5);
  });
  const topY = (a: number) => {
    const f = ((((a + Math.PI) / TAU) % 1) + 1) % 1 * TOP_N;
    const i = Math.floor(f);
    return topTable[i] + (topTable[i + 1] - topTable[i]) * (f - i);
  };

  return { trousers, isTop, hemY, topY, N, wh, yOfLevel, N0, frontNeckCm, naturalNeck, yAt, yOf, kY, krB, krW, krH, easeOf, eW, eB, eH, easeAt, lengths, tops, longest, highest, meanY, flares, bodyR, wornR, seamed, waistEase, bustEase, straightCut, hangShare, hipR, hemR, bodyRadius, bandTop, arm, yS, yU, sl, slim, ra, rh, tailored, neckOnly, pad, radius, foldAmp, FOLDS, fold, foldTilt, deep, depthAt, onBody, HANG_N, HANG_DY, hangTop, hangRows, hang, hung, shell, zAcross, SHOULDER_TOP, clothDown, yE, yCap, tipX, armX, capT, capOuter, capInner, filmAxis, filmR, axisX, capDepth, sleeveR, lg, yC, yH, yK, krL, thighR, kneeR, legHemR, thighTop, legR, legAxis, rAt, reach };
}

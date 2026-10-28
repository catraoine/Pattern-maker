// Cuffs for a long or three-quarter sleeve: a shirt cuff that buttons, over a bound placket slit; a
// pull-on elastic casing; or a narrow band that runs on into ties, over a short slit in the sleeve
// seam. The sleeve stops short of the wrist by the cuff's depth and blouses a little over it, and its
// hem is gathered (or pleated) into the cuff. Plain ASCII punctuation (see instructions.ts).
import { P, Path, p } from './geometry';
import type { Piece } from './piece';

export type Cuff = 'none' | 'shirt' | 'elastic' | 'tie' | 'ruffle';
export const CUFFS: [Cuff, string][] = [
  ['none', 'None'],
  ['shirt', 'Shirt cuff'],
  ['elastic', 'Elastic'],
  ['tie', 'Tie'],
  ['ruffle', 'Ruffle'],
];

/** A shirt cuff 6 cm deep, 3 cm round the wrist and 2.5 cm more to lap under the button, over a 10 cm
 * placket; elastic 1.5 cm wide in a casing 2.5 cm deep, 2 cm over the wrist; a tie band 2 cm deep,
 * 3 cm round the wrist, with 35 cm ties each side and an 8 cm slit. The sleeve blouses 2 cm over it. */
export const CUFF = {
  shirt: { depth: 6, ease: 3, overlap: 2.5, placket: 10, placketWidth: 1 },
  elastic: { depth: 2.5, width: 1.5, ease: 2 },
  tie: { depth: 2, ease: 3, tie: 35, slit: 8 },
  /** A ruffle: a straight strip gathered onto the sleeve's hem, deeper on a longer sleeve. In testing. */
  ruffle: { ratio: 1.8, depth: { short: 5, elbow: 6, three_quarter: 7, long: 8 } },
  blouse: 2,
};

type Length = 'short' | 'elbow' | 'three_quarter' | 'long';

/** Which sleeves take each cuff: a straight or bishop sleeve, long for a shirt cuff, three-quarter or
 * long for ties, and elbow-length too for elastic. */
export function cuffAllowed(cuff: Cuff, length: Length | 'none', shape: string): boolean {
  if (cuff === 'none') return true;
  // A ruffle goes on a plain straight sleeve of any length.
  if (cuff === 'ruffle') return shape === 'straight' && length !== 'none';
  if (shape !== 'straight' && shape !== 'bishop') return false;
  if (cuff === 'shirt') return length === 'long';
  if (cuff === 'tie') return length === 'long' || length === 'three_quarter';
  return length === 'long' || length === 'three_quarter' || length === 'elbow';
}

/** Whether the cuff choice shows: when the sleeve can take some cuff. */
export const cuffShown = (s: { length: Length | 'none'; shape: string }) => (['shirt', 'elastic', 'tie', 'ruffle'] as const).some((c) => cuffAllowed(c, s.length, s.shape));

/** The cuff as drafted: its kind, how deep it is finished, how far round, and what goes with it. */
export interface CuffDraft {
  kind: Exclude<Cuff, 'none'>;
  depth: number;
  /** Round the arm where it sits, finished; for a ruffle, the sleeve's hem it is gathered onto. */
  round: number;
  /** A ruffle: how many times the hem its strip is cut. */
  ratio?: number;
  /** Elastic: cut this long. Shirt: the placket slit. Tie: the ties, and the slit. */
  elasticCm?: number;
  placketCm?: number;
  tieCm?: number;
  slitCm?: number;
}

const r1 = (v: number) => Math.round(v * 10) / 10;

/** Round the arm where the cuff sits: the wrist on a long sleeve, the forearm or the elbow on a shorter one. */
function armAt(length: Length, wrist: number, upperArm: number): number {
  if (length === 'long') return wrist;
  if (length === 'three_quarter') return wrist + (upperArm - wrist) * 0.4;
  return upperArm * 0.85;
}

export function cuffOf(cuff: Exclude<Cuff, 'none'>, length: Length, wrist: number, upperArm: number): CuffDraft {
  const arm = armAt(length, wrist, upperArm);
  // The ruffle's round is set from the sleeve's hem once it is drafted.
  if (cuff === 'ruffle') return { kind: 'ruffle', depth: CUFF.ruffle.depth[length], round: 0, ratio: CUFF.ruffle.ratio };
  if (cuff === 'shirt') return { kind: 'shirt', depth: CUFF.shirt.depth, round: r1(arm + CUFF.shirt.ease), placketCm: CUFF.shirt.placket };
  if (cuff === 'tie') return { kind: 'tie', depth: CUFF.tie.depth, round: r1(arm + CUFF.tie.ease), tieCm: CUFF.tie.tie, slitCm: CUFF.tie.slit };
  // Elastic: the casing passes the hand, and the elastic draws it in to the arm.
  return { kind: 'elastic', depth: CUFF.elastic.depth, round: r1(arm + CUFF.elastic.ease), elasticCm: r1(arm + CUFF.elastic.ease + 1) };
}

/** A strip piece: `L` long and `W` wide, with its name and cut, notches at the given lengths on both long edges. */
function strip(name: string, label: string, L: number, W: number, cut: string, sa: number, opts: { fold?: boolean; notchAt?: number[]; marks?: { at: number; text: string }[]; fabric?: string; meta?: Record<string, unknown> }): Piece {
  const outline = new Path(p(0, 0)).line(p(W, 0), 'end').line(p(W, L), 'band').line(p(0, L), 'end').line(p(0, 0), 'band');
  outline.closed = true;
  return {
    name,
    kind: 'band',
    outline,
    lines: [],
    grain: [p(W * 0.25, Math.min(2, L / 4)), p(W * 0.25, Math.max(L / 2, L - 2))],
    notches: (opts.notchAt ?? []).flatMap((y): [P, P][] => [
      [p(W, y), p(1, 0)],
      [p(0, y), p(-1, 0)],
    ]),
    balance: opts.fold ? [{ pts: [p(W / 2, 0), p(W / 2, L)], label: 'FOLD LINE' }] : [],
    labels: [
      { at: p(W * 0.66, L * 0.3), text: label, size: Math.min(0.9, W * 0.12), rotate: 90 },
      { at: p(W * 0.34, L * 0.3), text: cut, size: Math.min(0.6, W * 0.09), rotate: 90 },
      ...(opts.marks ?? []).map((m) => ({ at: p(W * 0.75, m.at), text: m.text, size: 0.45 })),
    ],
    cut,
    fabric: opts.fabric,
    seamAllowance: sa,
    allowances: {},
    meta: opts.meta ?? {},
  };
}

/** The pieces a cuff takes: a shirt cuff and its placket strip, or a tie band. Elastic needs none. */
export function cuffPieces(c: CuffDraft, sa: number): Piece[] {
  if (c.kind === 'shirt') {
    // The cuff laps: the button end runs on 2.5 cm past the buttonhole end, under it.
    const L = c.round + CUFF.shirt.overlap;
    const cuff = strip('Cuff', 'CUFF', L, 2 * c.depth, 'Cut 2', sa, {
      fold: true,
      notchAt: [CUFF.shirt.overlap],
      marks: [
        { at: 1.2, text: 'BUTTONHOLE' },
        { at: L - CUFF.shirt.overlap / 2, text: 'BUTTON' },
      ],
      fabric: 'Self + interfacing',
      meta: { finishedWidth: c.depth, lengthCm: r1(L) },
    });
    // A continuous bound placket: one strip round both sides of the slit.
    const placket = strip('Sleeve placket', 'PLACKET', 2 * c.placketCm! + 2, 4 * CUFF.shirt.placketWidth, 'Cut 2', 0, { meta: { lengthCm: 2 * c.placketCm! + 2 } });
    return [cuff, placket];
  }
  if (c.kind === 'ruffle') {
    // One layer, its lower edge narrow-hemmed: the depth, the seam above and 1 cm for the hem.
    const L = c.round * c.ratio!;
    return [
      strip('Sleeve ruffle', 'SLEEVE RUFFLE', r1(L + 2 * sa), c.depth + sa + 1, 'Cut 2', 0, {
        notchAt: [r1(sa + L / 2)],
        meta: { finishedWidth: c.depth, lengthCm: r1(L), ruffle: c.ratio },
      }),
    ];
  }
  if (c.kind === 'tie') {
    // The band round the wrist, running on into a tie at each end, cut on the grain.
    const L = c.round + 2 * c.tieCm!;
    return [
      strip('Tie cuff', 'TIE CUFF', L, 2 * c.depth, 'Cut 2', sa, {
        fold: true,
        notchAt: [c.tieCm!, c.tieCm! + c.round],
        meta: { finishedWidth: c.depth, lengthCm: r1(L) },
      }),
    ];
  }
  return [];
}

// ---------------------------------------------------------------------------------------------------
// Words for the sewing steps and the pattern notes.

/** Cutting the cuffs, added to the cutting step. */
export function cuffCutWords(c: CuffDraft | undefined): string {
  if (!c) return '';
  if (c.kind === 'shirt') return ' Cut the two cuffs on the fold line, and again from fusible interfacing to the fold, and the two placket strips. Snip the cuff notches and mark BUTTONHOLE and BUTTON.';
  if (c.kind === 'tie') return ' Cut the two tie cuffs and snip their notches, where the ties start. Snip the slit notch on the back of each sleeve seam too.';
  if (c.kind === 'ruffle') return ' Cut the two sleeve ruffles and snip the notch at the middle of each.';
  return '';
}

/** The cuff for the pattern's notes. */
export function cuffNote(c: CuffDraft | undefined): string {
  if (!c) return '';
  if (c.kind === 'shirt') return `Shirt cuffs, ${c.depth} cm deep and ${c.round} cm round, buttoned over a ${c.placketCm} cm bound placket.`;
  if (c.kind === 'ruffle') return `Sleeve ruffles, ${c.depth} cm deep, gathered ${c.ratio} to 1 onto the ${c.round} cm sleeve hem.`;
  if (c.kind === 'tie') return `Tie cuffs, ${c.depth} cm deep and ${c.round} cm round, with ${c.tieCm} cm ties, over an ${c.slitCm} cm slit.`;
  return `Elastic cuffs: ${c.elasticCm} cm of ${CUFF.elastic.width} cm elastic in each, in a ${c.depth} cm casing.`;
}

/** What the cuffs need besides the fabric. */
export function cuffNotions(c: CuffDraft | undefined): string[] {
  if (!c) return [];
  if (c.kind === 'shirt') return ['2 cuff buttons, 1 cm across', '0.2 m lightweight fusible interfacing, for the cuffs'];
  if (c.kind === 'elastic') return [`${((2 * c.elasticCm!) / 100).toFixed(1)} m of ${CUFF.elastic.width} cm wide elastic, for the cuffs`];
  return [];
}

type Step = { title: string; text: string };

/** Binding the shirt cuff's placket slit, before the sleeve seam is sewn. */
export function placketStep(c: CuffDraft): Step {
  return {
    title: 'Bind the plackets',
    text: `Cut each sleeve up the PLACKET line, ${c.placketCm} cm from the hem. Spread the slit open into a straight line and pin a placket strip to it, right sides together, its edge along the slit's edges. Sew 0.5 cm from the edge, tapering to a few threads at the top of the slit, and press the strip away from the sleeve. Fold the strip's other long edge under 0.5 cm, fold it over the seam to the inside and stitch it down close to the fold. Fold the placket's front half to the inside and press: the back half stays out, under it. Stitch a short diagonal line across the top of the placket, inside, so it lies flat.`,
  };
}

/** Making and sewing on the cuffs, once the sleeve seams are sewn. */
export function cuffStep(c: CuffDraft, sl: { gathers?: { hem: number } }, seam: string): Step {
  const gathers = sl.gathers?.hem ?? 0;
  const gather = `Sew two rows of long gathering stitches round each sleeve hem, inside the seam allowance${gathers > 0 ? `, and draw them up by ${gathers} cm to fit the cuff` : ''}, spreading the gathers evenly`;
  if (c.kind === 'shirt') {
    return {
      title: 'Attach the cuffs',
      text: `Fuse the interfacing to the wrong side of each cuff. Press under ${seam} along the long edge without the notch. ${gather}, or fold the fullness into two pleats toward the placket. Pin the cuff's notched edge to the sleeve hem, right sides together, with the BUTTON end at the back of the placket and the BUTTONHOLE end at the front: the back of the placket laps under by the cuff's ${CUFF.shirt.overlap} cm extension. Sew ${seam} from the edge and press the seam into the cuff. Fold the cuff right sides together along its fold line and sew across each end ${seam} in. Trim, turn it right side out and press. Stitch the pressed edge down over the seam inside, then topstitch round the cuff 0.3 cm from the edge. Work a buttonhole at BUTTONHOLE and sew a button at BUTTON. The cuff closes ${c.round} cm round.`,
    };
  }
  if (c.kind === 'ruffle') {
    return {
      title: 'Attach the sleeve ruffles',
      text: `Sew the short ends of each ruffle together, right sides together, ${seam} from the edge, into a ring, and press the seam open. Press up 0.5 cm along the lower edge, then 0.5 cm more, and stitch close to the fold. Sew two rows of long gathering stitches along the top edge, inside the seam allowance. Pin the ruffle to the sleeve hem, right sides together, its seam at the underarm seam and its middle notch at the top of the sleeve, and draw the gathers up from ${r1(c.round * c.ratio!)} cm to the ${c.round} cm hem, spreading them evenly. Sew ${seam} from the edge, neaten the edges together and press the seam up into the sleeve. Topstitch 0.5 cm above it to hold it flat.`,
    };
  }
  if (c.kind === 'tie') {
    return {
      title: 'Attach the tie cuffs',
      text: `Fold each tie cuff in half along its fold line, right sides together. Sew each tie from its notch out to its end and across the end, ${seam} from the edge, leaving the middle open between the notches. Trim the corners and turn the ties right side out with a loop turner or a chopstick, and press. Finish the open edges of the slit with a narrow double-turned hem. ${gather}. Pin one edge of the band's middle to the sleeve hem, right sides together, its notches at the edges of the slit, and sew ${seam} from the edge. Turn the band's other edge under ${seam} and stitch it down over the seam inside. The ties knot at the wrist.`,
    };
  }
  return {
    title: 'Make the elastic casings',
    text: `Press each sleeve hem up 0.5 cm, then ${c.depth} cm more, and stitch close to the inner fold all the way round, leaving a 3 cm gap at the underarm seam. Cut two pieces of ${CUFF.elastic.width} cm elastic ${c.elasticCm} cm long. Thread each through its casing on a safety pin, overlap the ends 1 cm and sew them together firmly with a square of stitching. Stitch the gap closed, stretching the elastic as you go, and spread the gathers evenly round the cuff.`,
  };
}

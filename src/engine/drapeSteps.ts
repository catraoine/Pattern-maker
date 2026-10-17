// The sewing steps for a draped bodice, laid over the block's (and the styled bodice's) steps: the
// one-shoulder's whole pieces, stay-taped edge and side zip; the cowl's bias front and its grown-on
// facing; and a peplum, made, hemmed narrowly and sewn to the waist. Step titles are kept where the
// step is the same kind of work, so the couture route can still find them. Plain ASCII punctuation
// (see instructions.ts).
import { taggedLength } from './geometry';
import type { BodiceDraft } from './bodice';
import type { DressDraft } from './dress';
import type { SewStep, SewingGuide } from './instructions';
import { placeWords } from './styleSteps';

const r1 = (v: number) => Math.round(v * 10) / 10;

interface Opts {
  seam: string;
  curve: string;
  edges: string;
  sleeve: boolean;
}

/** A list of steps edited by title. */
function editor(steps: SewStep[]) {
  let out = [...steps];
  const at = (title: string) => out.findIndex((s) => s.title === title);
  return {
    get: (title: string) => out[at(title)],
    set(title: string, text: string, newTitle?: string) {
      const i = at(title);
      if (i >= 0) out[i] = { ...out[i], title: newTitle ?? title, text };
    },
    drop(title: string) {
      out = out.filter((s) => s.title !== title);
    },
    before(title: string, step: SewStep) {
      const i = at(title);
      if (i >= 0) out.splice(i, 0, step);
      return i >= 0;
    },
    after(title: string, step: SewStep) {
      const i = at(title);
      if (i >= 0) out.splice(i + 1, 0, step);
      return i >= 0;
    },
    find: (re: RegExp) => out.find((s) => re.test(s.title)),
    lastIndex: (re: RegExp) => out.reduce((k, s, i) => (re.test(s.title) ? i : k), -1),
    insertAt(i: number, step: SewStep) {
      out.splice(i, 0, step);
    },
    get steps() {
      return out;
    },
  };
}

/** The trim-for-your-side sentence at the end of a cutting step, kept when the step is rewritten. */
const sideNote = (text: string) => / Then trim the pieces for your .*$/.exec(text)?.[0] ?? '';

/** The one-shoulder top edge, front and back, along the stitching line. */
const edgeLengths = (d: BodiceDraft) => d.pieces.slice(0, 2).map((pc) => r1(taggedLength(pc.outline, 'neck')));

const staySteps = (d: BodiceDraft): SewStep => {
  const [f, b] = edgeLengths(d);
  return {
    title: 'Stay-tape the top edge',
    diagram: 'staystitch',
    text: `Cut two lengths of 1 cm wide stay tape (or strips of selvedge from a light, firm fabric), as long as the top edge's stitching line: ${f} cm for the front and ${b} cm for the back. Pin each to the wrong side, its edge along the stitching line inside the seam allowance, from the side seam to the shoulder, easing the fabric onto it over the bust. Machine it in place within the seam allowance. The edge is drafted a little tight, and the tape holds it there, so it lies against the body without gaping.`,
  };
};

const COWL_STAY: SewStep = {
  title: 'Stay-stitch the cowl front',
  diagram: 'staystitch',
  text: "The front is on the bias and stretches easily, so handle it flat and as little as you can. Stay-stitch its shoulders, the facing's shoulders and the armholes 1 cm from the edge, sewing each from the shoulder down. Hang the front up by its shoulders for a day so the bias can drop, then lay it back on the pattern and trim the side edges to it if they have grown.",
};

const cowlFold = (seam: string): SewStep => ({
  title: 'Fold the cowl facing',
  text: `Fold the facing to the inside along the FOLD LINE, wrong sides together, and finger-press the fold lightly. Baste the facing's shoulder edges to the front's shoulders, ${seam} from the edge, so the facing is caught in the shoulder seams. Don't press the fold hard: the cowl should fall softly.`,
});

/** Whether the cowl front kept any of its waist dart (the drape may have taken all of it). */
const cowlDarts = (d: BodiceDraft) => d.pieces[0].lines.some((ln) => ln.points().length >= 3);

/** The bodice's steps with its draped neckline and peplum. */
export function drapeBodiceSteps(g: SewingGuide, d: BodiceDraft, o: Opts): SewingGuide {
  if (!d.drape && !d.peplum) return g;
  const e = editor(g.steps);
  const below = d.finishedHem !== undefined;
  const notions = [...g.notions];
  const darts = !!e.find(/^Sew the .*darts$/);
  const cut = e.get('Cut out');
  const peplumCut = d.peplum ? ' Cut the peplum front on the fold and the peplum back as a pair from the rest, folded.' : '';

  if (d.drape?.kind === 'one_shoulder') {
    const lined = o.edges === 'lined';
    if (cut)
      e.set(
        'Cut out',
        `Open the fabric out in a single layer, right side up. The bodice front and back are whole pieces and the two sides differ: lay each with its printed side up, so the shoulder marked LEFT SHOULDER is on your left as you wear it, and cut each once.${peplumCut} Keep each grain arrow parallel to the selvedge. Cut along the solid outer line, snip the small notches${darts ? ', and chalk-mark the dart lines and the bust points' : ''}.${
          lined
            ? ' Cut the front and back again from the lining, this time with the printed side down, so the lining turns in the right way round.'
            : o.edges === 'facings'
              ? ' Cut the top edge facings and the armhole facings once each with the printed side down, from the fabric and again from fusible interfacing.'
              : ''
        }`,
      );
    e.set('Interface the facings', `Fuse the interfacing to the wrong side of each facing. Join the front and back facings at the left shoulder, and the armhole facings at the shoulder and the left side, ${o.seam} from the edge. Press the seams open and overlock or zigzag the outer edges marked NEATEN THIS EDGE.`);
    e.set('Neaten the edges', 'Zigzag or overlock the shoulder and side edges, so they will not fray inside.');
    const lastDart = e.lastIndex(/^Sew the .*darts$/);
    e.insertAt(lastDart >= 0 ? lastDart + 1 : e.steps.findIndex((s) => s.title === 'Neaten the edges') + 1, staySteps(d));
    e.set(
      'Put in the zip',
      `Sew a ${d.zipCm} cm invisible zip into the right side seam, front and back, with the top of the teeth ${o.curve} below the top edge, ${below ? 'stopping at the ZIP ENDS notch at the waist' : 'down to the waist edge'}. A longer zip is shortened from the bottom: stitch across the teeth where it should stop and cut 2 cm below.`,
    );
    e.drop('Close the centre back');
    const shoulder = `Pin the front to the back at the left shoulder, right sides together. The back shoulder is 1 cm longer: ease it in so it fits without pleats. Sew ${o.seam} from the edge and press the seam open.`;
    // Lined, the one shoulder is sewn first and the bodice turned through the zip opening.
    if (!e.get('Sew the shoulders')) e.before('Sew the side seams', { title: 'Sew the shoulders', text: shoulder });
    else e.set('Sew the shoulders', shoulder);
    e.set(
      'Sew the side seams',
      `Pin the front to the back at the left side, right sides together, matching the notches. Sew ${o.seam} from the edge and press the seam open.${below ? ' Sew the right side seam the same way, from the bottom of the zip to the hem.' : ''} Try the bodice on now: this is the easiest moment to take it in or let it out at the left side.`,
    );
    e.set(
      'Bind the neckline',
      `Open out one fold of the bias binding and pin it along the top edge, right sides together, from the zip at the right side across the front, over the shoulder seam and across the back to the zip again, with the crease ${o.curve} from the edge and 1 cm extra at each end. Don't stretch it: the stay tape sets the length. Sew along the crease, trim the seam to 0.5 cm and clip the curves. Fold the ends in, then turn the binding to the inside, press it flat, and stitch it down close to its folded edge.`,
    );
    e.set('Bind the armholes', 'Bind the left armhole the same way, starting and ending at the side seam with the ends overlapped by 1 cm.');
    e.set(
      'Face the neckline',
      `Pin the top edge facing to the top edge, right sides together, matching the shoulder seams, with its ends at the right side folded back over the zip tape. Sew ${o.curve} from the edge, trim the seam to 0.5 cm and clip the curves. Understitch the facing to the seam allowance close to the seam, so it rolls to the inside, then press it in and hand-tack it to the shoulder seam.`,
    );
    e.set('Face the armholes', `Pin the armhole facing into the left armhole, right sides together, matching the shoulder and side seams and the notches. Sew ${o.curve} from the edge, trim, clip, understitch and press to the inside the same way. Tack the facing to the shoulder and side seams.`);
    e.set(
      'Make the lining',
      `Sew the lining's darts, left shoulder and left side seam the same way as the bodice${below ? ', and its right side seam below the ZIP ENDS notch' : ''}, ${o.seam} from the edge. Press the lining darts the opposite way to the bodice's, so they don't stack.`,
    );
    e.set(
      'Line the neck and armholes',
      `Pin the lining to the bodice, right sides together, along the top edge from one side of the zip opening to the other, and round the left armhole. Sew ${o.curve} from the edge, trim to 0.5 cm, clip the curves and understitch as far as you can reach. Turn right side out through the zip opening, easing the shoulder strap through, and press so the lining rolls just inside.`,
    );
    e.set('Finish the lining at the zip', "Turn the lining's right side edges under and slip-stitch them to the zip tape, clear of the teeth.");
    e.set('Finish', 'Sew a hook and eye at the top of the zip, inside the top edge. Give the bodice a final press.');
    const [f, b] = edgeLengths(d);
    notions.splice(notions.findIndex((n) => /invisible zip/.test(n)) + 1, 0, `${(Math.ceil((f + b + 20) / 10) / 10).toFixed(1)} m of 1 cm wide stay tape`);
  }

  if (d.drape?.kind === 'cowl') {
    const lined = o.edges === 'lined';
    const kept = cowlDarts(d);
    const back = d.waistDarts.back > 0.3;
    if (cut)
      e.set(
        'Cut out',
        `Cut the bodice front first, from a single layer of fabric opened out right side up. It is a whole piece cut on the true bias: lay it with its grain arrow parallel to the selvedge, so its centre front runs at 45 degrees across the fabric, and cut it once. Its facing is cut in one with it, above the FOLD LINE. Then fold the rest of the fabric with the selvedges together and place the bodice back on both layers so you get a pair.${peplumCut} Bias edges stretch: cut with sharp shears without lifting the fabric. Snip the small notches${kept || back ? ', and chalk-mark the dart lines' : ''}.${
          lined
            ? ' Cut the back again from the lining, and the front lining on the fold: the cowl front is not lined, and the lining front has a lower neckline of its own, hidden under the drape.'
            : o.edges === 'facings'
              ? ` Cut the back neck facings${o.sleeve ? '' : ' and the armhole facings'} from the fabric, and again from fusible interfacing.${o.sleeve ? '' : ' The front armhole facings are on the bias, like the front.'}`
              : ''
        }${sideNote(cut.text)}`,
      );
    e.after('Cut out', COWL_STAY);
    e.set('Interface the facings', `Fuse the interfacing to the wrong side of each facing.${o.sleeve ? '' : ` Join the armhole facings at the shoulders and the sides, ${o.seam} from the edge, and press the seams open.`} Overlock or zigzag the outer edges marked NEATEN THIS EDGE.`);
    // The bust dart is closed into the drape; any waist darts are sewn as usual.
    const dartStep = e.find(/^Sew the .*darts$/);
    if (dartStep) {
      if (!kept && !back) e.drop(dartStep.title);
      else
        e.set(
          dartStep.title,
          `${below ? 'The waist darts are pointed at both ends. Fold each one along its centre, stitch from one point through the widest part at the waist to the other point, then clip into the fold at the waist so it lies flat. Press toward the centre.' : 'Fold each waist dart with right sides together so the dart lines meet, stitch from the waist edge to the point, and press toward the centre.'}${kept ? '' : ' The darts are on the back only: the front has none, its shaping is in the drape.'} Run each line of stitching off the fold at the point and knot the threads.`,
          'Sew the waist darts',
        );
    }
    if (e.get('Sew the shoulders')) {
      e.before('Sew the shoulders', cowlFold(o.seam));
      const s = e.get('Sew the shoulders');
      e.set('Sew the shoulders', `${s.text} Catch the cowl facing in the seams, and tack its shoulder edges to the seam allowance by hand so it stays inside.`);
    }
    const side = e.get('Sew the side seams');
    if (side) e.set('Sew the side seams', side.text.replace(' Try the bodice on now', ' The front side edges are on the bias: pin them to the back without stretching, with plenty of pins, and sew with the back on top. Try the bodice on now'));
    e.set(
      'Bind the neckline',
      `Bind the back neckline only: the cowl's facing finishes the front. Open out one fold of the bias binding and pin it to one half of the back neckline, right sides together, from the centre back edge to the shoulder seam, with the crease ${o.curve} from the edge and 1 cm extra at each end. Sew along the crease, trim the seam to 0.5 cm and clip the curves. Fold the end at the zip in, turn the binding to the inside, press it flat and stitch it down close to its folded edge. Its end at the shoulder tucks under the cowl facing. Bind the other half the same way.`,
    );
    e.set(
      'Face the neckline',
      `Face the back neckline only: the cowl's own facing finishes the front. Pin each back neck facing to the back neckline, right sides together, from the centre back, its end folded back over the zip tape, to the shoulder seam, where it laps under the cowl facing. Sew ${o.curve} from the edge, trim the seam to 0.5 cm and clip the curves. Understitch the facing to the seam allowance, press it in and tack it to the shoulder seam with the cowl facing.`,
    );
    const lowNeck = " Turn the lining front's lower neckline under 0.5 cm twice and stitch it: it hangs free under the cowl.";
    const lining = e.get('Make the lining');
    if (lining) e.set('Make the lining', `${lining.text}${lowNeck}`);
    e.set(
      'Line the neck and armholes',
      `Fold the cowl facing to the inside along the FOLD LINE and baste its shoulder edges to the front's shoulders. Pin the lining to the bodice, right sides together: the lining back to the back neckline, from each centre back seam line to the shoulder, and each armhole from shoulder to shoulder, keeping the lining's front neckline free. Sew ${o.curve} from the edge, trim to 0.5 cm, clip the curves, understitch as far as you can reach, and turn right side out by pulling the back through the shoulders. Sew the outer shoulders right sides together, catching in the cowl facing and easing in the extra 1 cm of the back, and press them open. Turn the lining shoulders under and slip-stitch them closed over the seam. Press so the lining rolls just inside.`,
    );
    e.set(
      'Line the neckline',
      `Pin the lining to the bodice along the back neckline, right sides together, from each centre back seam line to the shoulder seam, keeping the lining's front neckline free under the cowl. Sew ${o.curve} from the edge, trim to 0.5 cm, clip the curves, understitch the lining to the seam allowance, and turn it inside. Tack the lining to the shoulder seams under the cowl facing.`,
    );
  }

  if (d.peplum) {
    const flared = d.peplum.kind === 'flared';
    const oneShoulder = d.drape?.kind === 'one_shoulder';
    const c = e.get('Cut out');
    if (c && !d.drape) e.set('Cut out', c.text.replace(' Keep each grain arrow', `${flared ? ' The peplum pieces are curved: lay them by their grain arrows too.' : ''} Keep each grain arrow`));
    const open = oneShoulder ? 'right side' : 'centre back';
    const make: SewStep = {
      title: 'Make the peplum',
      text: `${oneShoulder ? `Sew the peplum's centre back seam and its left side seam` : 'Sew the peplum front to the peplum backs at the side seams'}, right sides together, ${o.seam} from the edge, matching the notches, and press the seams open. Leave the ${open} open: the peplum parts there below the zip.${
        flared ? ' Hang the peplum up by its waist for a day, so the parts on the bias can drop, then trim the hem level if it has.' : ''
      } Hem it narrowly: press up 0.5 cm and stitch close to the fold, trim close to the stitching, then turn up again and stitch over the first line. Hem the open edges the same way.${
        flared ? '' : ' Run two rows of long machine stitches along the waist edge, 0.5 cm and 1 cm from it, leaving long threads at each end.'
      }`,
    };
    const attach: SewStep = {
      title: 'Attach the peplum',
      text: `Pin the peplum to the bodice's waist edge, right sides together, matching the centre front and the seams, with its open edges at the zip.${
        flared ? '' : ' Pull up the gathering threads until it fits, and spread the gathers evenly.'
      } Sew ${o.seam} from the edge${flared ? '' : ', with the gathers on top so they stay even'}, overlock or zigzag the edges together, and press the seam up toward the bodice.${
        o.edges === 'lined' ? " Turn the lining's waist edge under and slip-stitch it over the seam inside." : ''
      }`,
    };
    // In place of the bodice's own hem: the peplum is sewn to its waist edge, after the neck and sleeves.
    if (!e.before('Hem', make)) e.before('Finish', make);
    e.after('Make the peplum', attach);
    e.drop('Hem');
  }
  return { ...g, notions, steps: e.steps };
}

/** The dress's steps with a draped bodice: the bodice's own draped steps in the dress's order. */
export function drapeDressSteps(g: SewingGuide, top: SewingGuide, d: DressDraft, o: Opts & { waist: string; slit: boolean }): SewingGuide {
  const kind = d.bodice.drape?.kind;
  if (!kind) return g;
  const e = editor(g.steps);
  const cut = e.get('Cut out');
  const fold = `Fold the fabric in half with the selvedges together. ${placeWords(d.bodice)}`;
  if (kind === 'one_shoulder') {
    if (cut)
      e.set(
        'Cut out',
        cut.text
          .replace(
            fold,
            'Cut the bodice first, from a single layer of fabric opened out right side up: its front and back are whole pieces and the two sides differ, so lay each printed side up, LEFT SHOULDER on your left as you wear it, and cut each once. Then fold the rest of the fabric in half with the selvedges together for the skirt.',
          )
          .replace(' Cut the bodice pieces again from the lining.', ' Cut the bodice front and back again from the lining, printed side down, so the lining turns in the right way round.')
          .replace(' Cut the four facing pieces from the fabric, and again from fusible interfacing.', ' Cut the top edge facings and the armhole facings once each, printed side down, from the fabric and again from fusible interfacing.'),
      );
    e.set('Neaten the edges', 'Zigzag or overlock the shoulder and side edges of the bodice, and the side and centre back edges of the skirt, so they will not fray inside.');
    const stay = top.steps.find((s) => s.title === 'Stay-tape the top edge');
    if (stay) e.before('Join the bodice to the skirt', stay);
    e.set(
      'Join the bodice to the skirt',
      `Sew the skirt's centre back seam first, ${o.seam} from the edge${o.slit ? ', leaving the bottom 15 cm open as a walking slit' : ''}, and press it open. Pin the bodice front to the skirt front at the waist, right sides together, matching the centre front, the side edges and the darts, so each bodice dart runs on into the skirt dart below it in one line. Pin the bodice back to the skirt back the same way, matching the centre back. Sew ${o.waist} from the edge, press the seams up toward the bodice, and zigzag or overlock the two edges together.`,
    );
    e.set(
      'Put in the zip',
      `Sew a ${d.zipCm} cm invisible zip into the right side edges of the front and back, with the top of the teeth ${o.curve} below the top edge, across the waist seam, to the ZIP ENDS notch on the skirt. Sew one side, close the zip and mark where the waist seam crosses the other tape, so the waist meets exactly when you sew the second side.`,
    );
    e.drop('Close the centre back');
    e.set(
      'Sew the side seams',
      `Pin the front to the back at the left side, right sides together, from the underarm to the hem, matching the waist seams and the hip notches. Sew ${o.seam} from the edge in one seam and press it open. Sew the right side the same way, from the bottom of the zip to the hem. Try the dress on now: this is the easiest moment to take it in or let it out at the left side.`,
    );
    e.set('Finish', 'Sew a hook and eye at the top of the zip, inside the top edge. Give the dress a final press.');
    // Lined, the one shoulder is sewn before the lining goes in.
    const shoulder = top.steps.find((s) => s.title === 'Sew the shoulders');
    if (shoulder && !e.get('Sew the shoulders')) e.before('Sew the side seams', shoulder);
  }
  if (kind === 'cowl') {
    if (cut)
      e.set(
        'Cut out',
        cut.text
          .replace(
            fold,
            'Cut the bodice front first, from a single layer of fabric opened out right side up. It is a whole piece cut on the true bias: lay it with its grain arrow parallel to the selvedge, so its centre front runs at 45 degrees across the fabric, and cut it once, its facing cut in one above the FOLD LINE. Then fold the rest of the fabric in half with the selvedges together, and place the bodice back on both layers so you get a pair.',
          )
          .replace(' Cut the bodice pieces again from the lining.', ' Cut the bodice back again from the lining, and the front lining on the fold: the cowl front is not lined.')
          .replace(' Cut the four facing pieces from the fabric', ' Cut the back neck facings and the armhole facings from the fabric')
          .replace(' Cut the neck facings from the fabric', ' Cut the back neck facings from the fabric'),
      );
    e.after('Cut out', COWL_STAY);
    if (e.get('Sew the shoulders')) {
      const fold2 = top.steps.find((s) => s.title === 'Fold the cowl facing');
      if (fold2) e.before('Sew the shoulders', fold2);
    }
    const side = e.get('Sew the side seams');
    if (side) e.set('Sew the side seams', side.text.replace(' Try the dress on now', ' The bodice front side edges are on the bias: pin them without stretching, with plenty of pins, and sew with the back on top. Try the dress on now'));
  }
  return { ...g, steps: e.steps };
}

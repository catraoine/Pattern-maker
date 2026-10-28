// The bodice's sewing steps for its styled details, laid over the block's steps: a moved bust dart,
// princess seams, a yoke, an empire seam or side panels, a button front and a collar. Plain ASCII
// punctuation (see instructions.ts).
import { BOW, RUFFLE, isBandCollar } from './collar';
import type { BodiceDraft } from './bodice';
import type { SewStep, SewingGuide } from './instructions';
import type { DartPlace } from './manipulate';
import { dartsOf } from './marks';

const PRESS: Record<DartPlace, string> = {
  side: 'from the side seam to the point, and press it down',
  french: 'from the side seam to the point, and press it down',
  shoulder: 'from the shoulder edge to the point, and press it toward the centre front',
  neck: 'from the neck edge to the point, and press it toward the centre front',
  armhole: 'from the armhole edge to the point, and press it down',
  waist: 'from the waist edge to the point, and press it toward the centre front',
};

const lower = (s: string) => s.replace(/^Bodice /, 'bodice ').toLowerCase();
const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** Which pieces go on the fold and which on both layers, from the pieces themselves. A piece cut
 * whole from a single layer is cut on its own, before the fabric is folded. */
export function placeWords(draft: BodiceDraft): string {
  const main = draft.pieces.filter((pc) => !pc.kind && !pc.meta.singleLayer);
  const fold = main.filter((pc) => /on fold/i.test(pc.cut)).map((pc) => `the ${lower(pc.name)}`);
  const pair = main.filter((pc) => !/on fold/i.test(pc.cut)).map((pc) => `the ${lower(pc.name)}`);
  const f = fold.length ? `Place ${list(fold)} on the fold` : '';
  const pr = pair.length ? `${f ? ', and ' : 'Place '}${list(pair)} on both layers so you get ${pair.length > 1 ? 'pairs' : 'a pair'}` : '';
  return `${f}${pr}.`;
}

/**
 * A style seam's steps: the darts it carries, sewn from the seam, and the seam itself. The bust dart of
 * a front yoke opens on the yoke seam of the lower front; an empire seam takes the bust and waist darts
 * into one dart on the upper bodice, with the midriff's darts below it; side panels carry the bust dart
 * in the centre front's waist dart.
 */
function seamSteps(draft: BodiceDraft, seam: string): { darts?: SewStep; join: SewStep } {
  const named = (re: RegExp) => draft.pieces.filter((pc) => !pc.kind && re.test(pc.name));
  const darted = (re: RegExp) => named(re).some((pc) => dartsOf(pc).length > 0);
  const kind = draft.styleSeams![0].kind;
  if (kind === 'yoke') {
    const front = named(/front yoke/).length > 0;
    const back = named(/back yoke/).length > 0;
    const which = front && back ? 'yokes' : front ? 'front yoke' : 'back yokes';
    const backText = front
      ? 'Join each back yoke to its back the same way, matching the double notches.'
      : `Pin each back yoke to the top edge of its back, right sides together, matching the centre back and the double notches. Sew ${seam} from the edge, and press the seam up toward the yoke.`;
    const text = [front ? `Pin the front yoke to the top edge of the bodice front, right sides together, matching the centre front and the notch. Sew ${seam} from the edge, and press the seam up toward the yoke.` : '', back ? backText : ''];
    return { join: { title: `Join the ${which}`, text: text.filter(Boolean).join(' ') } };
  }
  if (kind === 'empire') {
    const upper = darted(/^Bodice (front|back)$/);
    const band = darted(/midriff/);
    const darts: SewStep | undefined =
      upper || band
        ? {
            title: 'Sew the darts',
            text: [
              upper ? 'Fold each dart of the bodice front and back with right sides together so the dart lines meet, stitch from the empire seam edge to the point, and press it toward the centre.' : '',
              band ? `Fold each midriff dart ${upper ? 'the same way' : 'with right sides together so the dart lines meet'}, stitch from the waist edge to the point, and press toward the centre.` : '',
              'Run each line of stitching off the fold at the point and knot the threads.',
            ]
              .filter(Boolean)
              .join(' '),
          }
        : undefined;
    return {
      darts,
      join: {
        title: 'Join the midriff band',
        text: `Pin the bodice front to the midriff front along the empire seam, right sides together, matching the centre front, the notches${upper && band ? ', the side edges and the darts, so each dart runs on into the one below it' : ' and the side edges'}. Sew ${seam} from the edge, and press the seam down toward the midriff. Join each back to its midriff back the same way, matching the centre back.`,
      },
    };
  }
  return {
    darts: darted(/centre (front|back)/)
      ? {
          title: 'Sew the darts',
          text: `Fold each dart of the centre front and centre backs with right sides together so the dart lines meet, stitch from the waist edge to the point, and press it toward the centre.${draft.bustDart > 0.3 ? ' The front dart takes the bust shaping too, so it runs up close to the bust point.' : ''} Run each line of stitching off the fold at the point and knot the threads.`,
        }
      : undefined,
    join: {
      title: 'Sew the panel seams',
      text: `Pin each side front to the centre front, right sides together, from the armhole to the waist, matching the notches. Sew ${seam} from the edge, and press the seam toward the centre front. Sew the back panel seams the same way, matching their notches, and press them toward the centre back.`,
    },
  };
}

/** Steps for the styled bodice, given the block's steps. */
export function styleBodiceSteps(g: SewingGuide, draft: BodiceDraft, o: { seam: string; curve: string; edges: string; sleeve: boolean }): SewingGuide {
  const at = (title: string) => g.steps.findIndex((s) => s.title === title);
  let steps = [...g.steps];
  const buttons = draft.closure === 'front_buttons';
  const collar = draft.collar;
  const seamKind = draft.styleSeams?.[0]?.kind;
  const princess = !seamKind && draft.pieces.some((pc) => /centre front/i.test(pc.name));
  const moved = draft.pieces[0].meta.bustDart as DartPlace | undefined;

  // Cutting: the pieces as cut, and the collar and facings.
  const cut = steps[at('Cut out')];
  if (cut) {
    const extra: string[] = [];
    if (buttons) extra.push('Cut the front facings as a pair and the back neck facing on the fold, from the fabric and again from fusible interfacing.');
    if (collar === 'peter_pan') extra.push(buttons ? 'Cut the collar twice on the fold, once for the top collar and once for the under collar, and once from interfacing.' : 'Cut four collar pieces (two pairs), two for the top collar and two for the under collar, and interface the top pair.');
    if (isBandCollar(collar)) extra.push('Cut the collar twice on the fold, once for the outer band and once for the inner band, and interface the outer one.');
    if (collar === 'shirt') extra.push('Cut the collar and the collar stand twice each on the fold, and interface one of each.');
    if (collar === 'bow') extra.push('Cut the two bow strips as a pair, single layer on the true bias, and snip their notches.');
    if (collar === 'ruffle') extra.push(`Cut the neck ruffle with its fold end on the fold, so it opens out into one long strip, and snip its notches.`);
    if (collar === 'cape') extra.push(`Cut the cape ${buttons ? 'back on the fold and the cape fronts as a pair' : 'front on the fold and the cape backs as a pair'}, single layer if the fabric is narrow, and snip the notches at the middle of each neck edge.`);
    if (buttons && o.edges === 'lined') extra.push('Cut the lining fronts from the front pattern with the front facing laid over it, cutting 1.5 cm beyond the facing\'s inner edge, so the lining meets the facing.');
    let text = cut.text.replace(/Place the bodice front on the fold, and the bodice back on both layers so you get a pair\./, placeWords(draft));
    if (princess) text = text.replace(', and chalk-mark the dart lines and the bust point', ', and mark the bust point');
    if (buttons) text = text.replace(', and chalk-mark the dart lines and the bust point.', ', and chalk-mark the dart lines, the bust point and the buttonhole marks.').replace(/snip the small notches\./, 'snip the small notches and chalk-mark the buttonhole marks.');
    // A mandarin collar or a bow finishes the neck itself: no neck facings.
    if ((isBandCollar(collar) || collar === 'bow') && !buttons && o.edges === 'facings') text = text.replace(' Cut the neck facings from the fabric, and again from fusible interfacing.', '').replace('Cut the four facing pieces', 'Cut the two armhole facings');
    steps[at('Cut out')] = { ...cut, text: `${text} ${extra.join(' ')}`.trim() };
  }

  // The bust dart moved, or princess seams in place of the darts.
  const darts = steps.findIndex((s) => /^Sew the .*darts$/.test(s.title));
  if (darts >= 0 && princess) {
    steps[darts] = {
      title: 'Sew the princess seams',
      text: `Pin each side front to the centre front, right sides together, matching the notches above and below the bust. The centre front curves in where the side front curves out: clip the centre front's seam allowance almost to the stitching line over the bust so the two lie together, and ease rather than stretch. Sew ${o.seam} from the edge, then press the seam open over a tailor's ham so the bust keeps its shape. Sew the back princess seams the same way, matching their notches, and press them open.`,
    };
  } else if (darts >= 0 && moved) {
    steps[darts] = { ...steps[darts], text: steps[darts].text.replace('from the side seam to the point, and press it down', PRESS[moved]) };
  }
  if (seamKind) {
    const added = seamSteps(draft, o.seam);
    if (seamKind === 'yoke' && darts >= 0 && draft.pieces.some((pc) => pc.meta.yoke && /front/.test(pc.name)))
      steps[darts] = { ...steps[darts], text: steps[darts].text.replace('from the side seam to the point, and press it down', 'from the yoke edge to the point, and press it toward the centre front') };
    if (seamKind !== 'yoke' && darts >= 0) steps[darts] = added.darts ?? steps[darts];
    const after = darts >= 0 ? darts + 1 : steps.findIndex((s) => s.title === 'Neaten the edges') + 1;
    steps.splice(after, 0, added.join);
  }

  if ((isBandCollar(collar) || collar === 'bow') && !buttons && o.edges === 'facings') {
    const fi = steps.findIndex((s) => s.title === 'Interface the facings');
    if (o.sleeve) steps.splice(fi, 1);
    else steps[fi] = { ...steps[fi], text: `Fuse the interfacing to the wrong side of each armhole facing. Join them at the shoulders and the sides, ${o.seam} from the edge. Press the seams open and overlock or zigzag the outer edges marked NEATEN THIS EDGE.` };
  }
  if (buttons) {
    steps = steps.filter((s) => s.title !== 'Put in the zip' && s.title !== 'Close the centre back');
    steps = steps.map((s) =>
      s.title === 'Make the lining'
        ? { ...s, text: s.text.replace(/, and its centre back seam below the ZIP ENDS notch, ([^ ]+ cm) from the edge\./, ', $1 from the edge.') }
        : s.title === 'Finish the lining at the zip'
          ? { title: 'Finish the lining at the front', text: "Turn the lining's front edges under and slip-stitch them over the inner edges of the front facings." }
          : s,
    );
    const nz = steps.findIndex((s) => s.title === 'Neaten the edges');
    if (nz >= 0) steps[nz] = { ...steps[nz], text: steps[nz].text.replace('shoulder, side and centre back edges', 'shoulder and side edges') };
    const fi = steps.findIndex((s) => s.title === 'Interface the facings');
    const facingStep: SewStep = {
      title: 'Interface the facings',
      text: `Fuse the interfacing to the wrong side of the front facings and the back neck facing${o.edges === 'facings' && !o.sleeve ? ', and of the armhole facings' : ''}. Join the front facings to the back neck facing at the shoulders${o.edges === 'facings' && !o.sleeve ? ', and the armhole facings at the shoulders and the sides' : ''}, ${o.seam} from the edge. Press the seams open and overlock or zigzag the outer edges marked NEATEN THIS EDGE.`,
    };
    if (fi >= 0) steps[fi] = facingStep;
    else steps.splice(steps.findIndex((s) => s.title === 'Cut out') + 1, 0, facingStep);
  }

  // The neckline: a collar, the button facings, or the block's own finish.
  const neckTitles = ['Bind the neckline', 'Face the neckline', 'Line the neckline'];
  const neckAt = steps.findIndex((s) => neckTitles.includes(s.title));
  const collarSteps: SewStep[] = [];
  if (collar === 'peter_pan') {
    collarSteps.push(
      {
        title: 'Make the collar',
        text: `Pin the top collar to the under collar, right sides together. Sew round the outer edge ${o.curve} from it, leaving the neck edge open. Trim the seam to 0.5 cm, notch the curves, and turn it right side out. Roll the seam a little toward the under collar and press, so it won't show.${buttons ? '' : ' Make the second half the same way.'}`,
      },
      {
        title: 'Attach the collar',
        text: buttons
          ? `Pin the collar to the neckline, under collar against the right side of the bodice, matching the centre backs, the notches to the shoulder seams and the collar ends to the centre front marks. Baste it ${o.curve} from the edge.`
          : `Pin each collar half to the neckline, under collar against the right side of the bodice, the centre back ends at the zip seam line and the front ends meeting at the centre front, the notches at the shoulder seams. Baste ${o.curve} from the edge.`,
      },
    );
  } else if (isBandCollar(collar)) {
    collarSteps.push(
      {
        title: 'Make the collar',
        text: `Pin the outer band to the inner band, right sides together. Sew along the top edge${buttons ? ' and round the front ends' : ''}, ${o.curve} from it. Trim to 0.5 cm, clip the curve, turn and press. Press the inner band's neck edge under ${o.curve}.`,
      },
      {
        title: 'Attach the collar',
        text: buttons
          ? `Pin the outer band to the neckline, right sides together, the notches to the shoulder seams and the band's ends to the front edges. Sew ${o.curve} from the edge, trim and clip. Press the seam up into the band, bring the inner band's folded edge over it, and slip-stitch it down by hand.`
          : `Pin the outer band to the neckline, right sides together, its ends at the centre back seam lines either side of the zip and the notches at the shoulder seams. Sew ${o.curve} from the edge, trim and clip. Press the seam up into the band, fold the band's ends in over the zip tape, bring the inner band's folded edge over the seam, and slip-stitch it down.`,
      },
    );
  } else if (collar === 'bow') {
    collarSteps.push(
      {
        title: 'Make the bow ties',
        text: `Fold each bow strip in half along its length, right sides together. Sew across the slanted end and along the long edge as far as the CENTRE FRONT notch, 1 cm from the edge, and stop there. Trim the corner, turn the tie right side out with a loop turner or the blunt end of a pencil, and press, leaving the neck part open and flat.`,
      },
      {
        title: 'Attach the bow',
        text: `Open out the neck part of each strip. Pin one layer to the neckline, right sides together, from the zip seam line at the centre back round to the centre front, the first notch at the shoulder seam and the CENTRE FRONT notch at the centre front (the point of a V neck), so the two ties hang from there. Sew ${o.curve} from the edge, clip the curve and press the seam up into the strip. Fold the strip's end in over the zip tape, turn the free edge under along the seam, and slip-stitch it down by hand. Knot the ties into a soft bow, ${BOW.tie} cm each.`,
      },
    );
  } else if (collar === 'ruffle') {
    const r = draft.pieces.find((pc) => pc.name === 'Neck ruffle');
    const ratio = (r?.meta.ruffle as number | undefined) ?? RUFFLE.ratio;
    collarSteps.push(
      {
        title: 'Make the ruffle',
        text: `Fold the ruffle strip in half along its length, wrong sides together, and press.${buttons ? '' : ` Fold each end in ${o.seam}, right sides together, sew across it, and turn it out.`} Sew two rows of long machine stitches through both layers along the raw edges, one just inside the seam line and one 0.5 cm further out, leaving long thread ends. It is ${ratio === 2 ? 'twice' : `${ratio} times`} as long as the neckline, so it gathers up to fit.`,
      },
      {
        title: 'Attach the ruffle',
        text: buttons
          ? `Pin the ruffle to the right side of the neckline, raw edges level, its middle at the centre back, its SHOULDER notches at the shoulder seams and its ends at the centre front marks. Pull up the gathers to fit, spread them evenly and baste ${o.curve} from the edge.`
          : `Pin the ruffle to the right side of the neckline, raw edges level, its middle at the centre front, its SHOULDER notches at the shoulder seams and its ends at the zip seam lines. Pull up the gathers to fit, spread them evenly and baste ${o.curve} from the edge.`,
      },
    );
  } else if (collar === 'cape') {
    collarSteps.push(
      {
        title: 'Make the cape',
        text: `Sew the cape front to the cape ${buttons ? 'back at the shoulder seams' : 'backs at the shoulder seams'}, right sides together, ${o.seam} from the edge, and press the seams open. Staystitch the neck edge 0.8 cm from it. Hang the cape up for a day: the hem runs round the bias and drops a little. Then press up 0.5 cm round the hem and down each ${buttons ? 'front' : 'centre back'} edge, then 0.5 cm again, and stitch close to the fold, or finish with a rolled hem on the overlocker.`,
      },
      {
        title: 'Attach the cape',
        text: `Lay the cape on the right side of the bodice, both right side up, neck edges level, its shoulder seams on the bodice's shoulder seams and its finished ${buttons ? 'front edges at the centre front' : 'edges at the zip seam lines'}. Clip the cape's neck edge every 2 cm, just short of the staystitching, so it lies flat round the curve, and baste it on ${o.curve} from the edge. A hook and eye at the top of the opening holds it closed.`,
      },
    );
  } else if (collar === 'shirt') {
    collarSteps.push(
      {
        title: 'Make the collar',
        text: `Pin the two collar pieces right sides together and sew round the outer edge and the points, ${o.curve} from it. Trim, cut across the points, turn and press, rolling the seam to the underside. Topstitch 0.5 cm from the edge if you like.`,
      },
      {
        title: 'Attach the collar to the stand',
        text: `Lay the collar on the interfaced stand, both right side up, matching the centre backs and with the collar's front ends at the stand's CENTRE FRONT notches. Lay the second stand on top, right side down, and sew along the top edge through all the layers, ${o.curve} from it, round the stand's front ends. Trim, turn and press. Press the inner stand's neck edge under ${o.curve}.`,
      },
      {
        title: 'Attach the stand',
        text: `Pin the outer stand to the neckline, right sides together, the notches to the shoulder seams and its ends to the front edges. Sew ${o.curve} from the edge, trim and clip. Press the seam up into the stand, bring the inner stand over it, and slip-stitch or edgestitch it down.`,
      },
    );
  }
  const stand = isBandCollar(collar) || collar === 'shirt';
  const lined = o.edges === 'lined';
  const standName = collar === 'shirt' ? 'stand' : 'band';
  const buttonFacing: SewStep = {
    title: 'Attach the front facings',
    text: stand
      ? `Pin the facings to the fronts, right sides together, along the front edges only. Sew ${o.seam === '1.5 cm' ? '1 cm' : o.curve} from the edge from the hem to the neck seam line, trim, turn the facings to the inside and press. ${
          lined
            ? `Smooth the lining into the bodice, wrong sides together, matching the shoulder and side seams, and baste the facings and the lining to the neckline, ${o.curve} from the edge: the ${standName} goes on through all the layers and covers the lining's neck edge.`
            : `Baste the facings to the neckline, ${o.curve} from the edge, so the collar goes on through both.`
        }`
      : `Pin the facings to the bodice, right sides together, down the front edges and round the neckline${collar === 'peter_pan' ? ' over the collar' : collar === 'ruffle' ? ' over the ruffle' : collar === 'cape' ? ' over the cape' : ''}, matching the shoulder seams. Sew 1 cm from the front edges and ${o.curve} round the neck. Trim, clip the neck curve, and understitch the neck as far as you can reach. Turn the facings to the inside, press, and tack them to the shoulder seams.`,
  };

  if (neckAt >= 0) {
    const neckStep = steps[neckAt];
    const replace: SewStep[] = [];
    if (buttons && (isBandCollar(collar) || collar === 'shirt')) replace.push(buttonFacing, ...collarSteps);
    else if (buttons) replace.push(...collarSteps, buttonFacing);
    else if (isBandCollar(collar) || collar === 'bow') replace.push(...collarSteps);
    else if (collar === 'peter_pan' || collar === 'ruffle' || collar === 'cape') {
      const over = collar === 'peter_pan' ? 'collar' : collar;
      replace.push(...collarSteps, { ...neckStep, text: neckStep.text.replace(/to the neckline/, `to the neckline over the ${over}`).replace(/round the neckline/, `round the neckline over the ${over}`) });
    }
    else replace.push(neckStep);
    steps.splice(neckAt, 1, ...replace);
  } else if (buttons && lined) {
    // A lined sleeveless button front: the facings (or the stand) finish the neck, so the lining is
    // made whole, basted in at the neck, and its armholes closed by hand.
    const shoulders = steps.findIndex((s) => s.title === 'Sew the side seams');
    steps.splice(shoulders, 0, {
      title: 'Sew the shoulders',
      text: `Pin the front to the back at the shoulders, right sides together. The back shoulder is 1 cm longer: ease it in so it fits without pleats. Sew ${o.seam} from the edge and press the seams open.`,
    });
    const ml = steps.findIndex((s) => s.title === 'Make the lining');
    steps[ml] = { ...steps[ml], text: steps[ml].text.replace("'s darts and side seams", "'s darts, shoulders and side seams").replace(' Leave the shoulders of both open for now.', '') };
    const li = steps.findIndex((s) => s.title === 'Line the neck and armholes');
    steps[li] = {
      title: 'Line the armholes',
      text: `${stand ? '' : 'Smooth the lining into the bodice, wrong sides together, matching the shoulder and side seams. '}Turn the bodice's armhole allowance to the inside and press it, then turn the lining's under so it sits 0.3 cm inside the edge, and slip-stitch the lining to the bodice round each armhole.`,
    };
    steps.splice(li, 0, ...(stand ? [buttonFacing, ...collarSteps] : [...collarSteps, buttonFacing]));
  } else if (collarSteps.length || buttons) {
    // A lined sleeveless bodice finishes its neck with the lining: the collar goes on first.
    const li = steps.findIndex((s) => s.title === 'Line the neck and armholes' || s.title === 'Make the lining');
    const add = buttons ? (stand ? [buttonFacing, ...collarSteps] : [...collarSteps, buttonFacing]) : collarSteps;
    steps.splice(li >= 0 ? li : steps.findIndex((s) => s.title === 'Hem'), 0, ...add);
  }
  // Without a stand to catch it, the lining's neck edge is slip-stitched over the back neck facing.
  if (buttons && lined && !stand) {
    const fl = steps.findIndex((s) => s.title === 'Finish the lining at the front');
    if (fl >= 0)
      steps[fl] = {
        title: 'Finish the lining at the front and neck',
        text: "Trim the lining's back neck to 1.5 cm beyond the back neck facing's inner edge. Turn the lining's front and neck edges under and slip-stitch them over the inner edges of the front facings and the back neck facing.",
      };
  }

  if (buttons && draft.buttons) {
    const [over, under] = draft.lapsLeft ? ['left', 'right'] : ['right', 'left'];
    const fin = steps.findIndex((s) => s.title === 'Finish');
    steps.splice(fin, 0, {
      title: 'Make the buttonholes',
      text: `Work ${draft.buttons.count} buttonholes on the ${over} front (as you wear it) at the BUTTONHOLE marks, each ${(draft.buttons.sizeCm + 0.3).toFixed(1)} cm long, starting 0.3 cm beyond the centre front line toward the edge${isBandCollar(collar) || collar === 'shirt' ? ', and one across the stand' : ''}. Cut them open with a seam ripper, a pin across the end so you don't cut too far.`,
    }, {
      title: 'Sew on the buttons',
      text: `Lap the ${over} front over the ${under}, centre front lines together, and push a pin through each buttonhole close to its outer end to mark the button. Sew each button on the ${under} front centre line, over a pin to make a thread shank.`,
    });
    steps[steps.findIndex((s) => s.title === 'Finish')] = { title: 'Finish', text: 'Give the bodice a final press, over a ham at the bust.' };
  }

  const notions = g.notions.flatMap((n) => {
    if (buttons && /invisible zip/.test(n)) return [`${(draft.buttons?.count ?? 5) + (stand ? 1 : 0)} buttons, ${draft.buttons?.sizeCm ?? 1.5} cm`];
    if (buttons && n === 'Hook and eye') return [];
    return [n];
  });
  const interfacing = (buttons || (collar !== 'none' && collar !== 'bow' && collar !== 'cape')) && !notions.some((n) => /interfacing/.test(n));
  return { notions: interfacing ? [...notions.slice(0, -1), '0.5 m lightweight fusible interfacing', notions[notions.length - 1]] : notions, steps };
}

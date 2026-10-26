// The couture route: the same garment sewn the way a couture workroom would. Lines thread-traced
// rather than chalked, curves staystitched, seams basted and fitted before machining, darts tied off
// and pressed over a ham, a hand-picked zip, seam finishes chosen for the cloth, and hand-finished
// edges and hem. Built from the quick route's steps, so the two always describe the same garment.
// Keep to plain ASCII punctuation: the PDF uses a standard font without curly quotes.
import type { SewStep, SewingGuide } from './instructions';
import type { DiagramId } from './diagrams';

export type Route = 'quick' | 'couture';
export type Cloth = 'cotton' | 'linen' | 'wool' | 'silk';
type SeamFinish = 'french' | 'hongkong' | 'pinked' | 'overcast';

export const CLOTHS: { id: Cloth; label: string; detail: string }[] = [
  { id: 'cotton', label: 'Cotton', detail: 'Poplin, lawn, sateen' },
  { id: 'linen', label: 'Linen', detail: 'Frays readily' },
  { id: 'wool', label: 'Wool', detail: 'Crepe, suiting, tweed' },
  { id: 'silk', label: 'Silk', detail: 'Crepe de chine, dupion' },
];

/** How to set the iron for each cloth. */
const PRESS: Record<Cloth, string> = {
  cotton: 'Set the iron to cotton (about 200 C) with steam.',
  linen: 'Set the iron to linen (about 220 C) with plenty of steam, and press from the wrong side so the surface does not shine.',
  wool: 'Set the iron to wool (about 150 C) with steam, always through a press cloth, and let the wool cool on the board before you move it: that is what sets the shape.',
  silk: 'Set the iron to silk (about 120 C), dry, through a silk organza press cloth: water can mark silk.',
};

/**
 * The seam finish for the cloth. Unlined, the inside should be as clean as the outside: French seams
 * in silk, Hong Kong bound edges in anything thicker. Under a lining the edges only need to stay
 * flat: pinked where the cloth barely frays, overcast by hand where it does.
 */
export function seamFinish(cloth: Cloth, lined: boolean): SeamFinish {
  if (lined) return cloth === 'wool' || cloth === 'cotton' ? 'pinked' : 'overcast';
  return cloth === 'silk' ? 'french' : 'hongkong';
}

const FINISH_WORDS: Record<Exclude<SeamFinish, 'french'>, string> = {
  hongkong:
    'Bind each seam allowance with a 2.5 cm bias strip of lining or silk organza: sew the strip to the edge right sides together, 0.6 cm in, wrap it round to the underside and stitch in the ditch from the top. The inside of an unlined garment is then as finished as the outside.',
  pinked:
    'Trim each allowance with pinking shears, taking off as little as you can. Under a lining a pinked edge stays flat and never shows through as a ridge.',
  overcast:
    'Overcast each raw edge by hand: slanted stitches 0.5 cm deep and 0.5 cm apart, the thread never pulled tight. It stays soft and flat under the lining, where an overlocked edge would show.',
};

interface CoutureContext {
  garment: 'skirt' | 'bodice' | 'dress';
  cloth: Cloth;
  /** Lined: the inside is covered, so seam finishes only need to stay flat. */
  lined: boolean;
  /** Cut with couture allowances, the stitching line drawn solid to trace. */
  traced: boolean;
  zipCm: number;
}

const step = (title: string, text: string, diagram?: DiagramId): SewStep => (diagram ? { title, text, diagram } : { title, text });

/** The quick route's steps, rewritten for the couture route. */
export function toCouture(guide: SewingGuide, c: CoutureContext): SewingGuide {
  const finish = seamFinish(c.cloth, c.lined);
  const bodice = c.garment !== 'skirt';
  const dress = c.garment === 'dress';
  // A top cut below the shoulders (strapless, sweetheart, cami) has a top edge in place of the neck,
  // and a boned one brings its own waist stay.
  const topEdge = guide.steps.some((g) => /top edge/.test(g.title));
  const shoulders = bodice && !topEdge;
  const ownStay = guide.steps.some((g) => g.title === 'Attach the waist stay');
  // A skirt cut whole has no centre back seam: its zip is in the left side seam. A pull-on skirt has
  // no zip, and its back is cut on the fold.
  const sideZip = guide.steps.some((s) => s.title === 'Put in the side zip');
  const seams = (dress ? 'side, shoulder, centre back and waist' : bodice ? 'side, shoulder and centre back' : sideZip || !(c.zipCm > 0) ? 'side' : 'side and centre back').replace('shoulder', topEdge ? 'princess' : 'shoulder');
  const out: SewStep[] = [];
  let zip: SewStep | undefined;
  // A one-shoulder bodice zips in the right side seam, so its zip goes in after the side seams.
  let rightZip = false;
  let fitted = false;

  const fitStep = () =>
    step(
      'Baste and fit',
      sideZip
        ? 'Hand-baste the right side seam, and the left one below the ZIP ENDS marks, along the traced lines, pin the opening closed and try it on, right side out. The side seams should hang straight down and the hem should fall where the pattern draws it. Re-trace any line you change, on both pieces, then take the basting out of each seam as you come to sew it.'
        : `Hand-baste the side seams${shoulders ? ' and shoulders' : ''} along the traced lines, ${c.zipCm > 0 ? 'pin the centre back closed and ' : ''}try it on, right side out. The side seams should hang straight down and each dart point toward the fullest part of the body. Re-trace any line you change, on both pieces, then take the basting out of each seam as you come to sew it.`,
      'baste',
    );

  // Every piece is cut before the lines are traced and the curves staystitched.
  const lastCut = guide.steps.reduce((last, s, i) => (/^Cut /.test(s.title) ? i : last), 0);

  guide.steps.forEach((s, i) => {
    const t = s.title;
    if (t === 'Cut out')
      out.push({
        ...s,
        text: `${s.text.replace('from fusible interfacing', 'from silk organza').replace(/,? and chalk-mark the dart lines( and the bust point)?/, '').replace(' Chalk-mark the dart lines.', '')} Leave the pattern pinned on: the lines are traced from it.`,
      });
    else if (!/^Cut /.test(t)) rewrite(s);
    else out.push(s);
    if (i === lastCut)
      out.push(
        step(
          'Thread-trace the lines',
          `Before you lift the pattern, mark every stitching line, dart, notch and balance line with long tacking stitches in a contrasting thread, ${c.traced ? 'along the solid stitching line' : 'along the dashed stitching line'}. At each dart point${bodice ? ' and the bust point' : ''} make a tailor's tack, a loose double stitch left in loops. Ease the layers apart and snip the threads between them, so each piece carries the lines on both sides. Unlike chalk, the thread shows on the right side and the wrong, so you sew, fit and press to the exact line.${c.traced ? '' : ' For room to fit, choose Couture seam allowances above: 2.5 cm at the seams.'}`,
          'trace',
        ),
        step(
          'Staystitch the curves',
          topEdge
            ? 'Machine a line of stitching 3 mm outside the traced top edge line, in the seam allowance, sewing from each side seam toward the centre, so the curve cannot stretch as you handle it.'
            : bodice
            ? 'Machine a line of stitching 3 mm outside the traced neck and armhole lines, in the seam allowance. Sew from each shoulder toward the centre, and from the shoulder down to the underarm, so the bias curves cannot stretch as you handle them.'
            : 'Machine a line of stitching 3 mm above the traced waist line, in the seam allowance, sewing from each side seam toward the centre. The waist curve is partly on the bias and stretches as it is handled; the stitching holds it to the pattern.',
          'staystitch',
        ),
        step(
          'Press as you go',
          `${PRESS[c.cloth]} Press every dart and seam before another seam crosses it: first flat as sewn, to set the stitches, then open along the traced line. Press darts and curved seams over a tailor's ham, so they keep the body's shape.`,
          'press',
        ),
      );
  });

  function rewrite(s: SewStep) {
    const t = s.title;
    if (t === 'Neaten the edges') {
      // The seams are finished once they are sewn and fitted, to suit the cloth.
    } else if (t === 'Interface the waistband') {
      out.push({
        ...s,
        text: 'Hand-baste firm sew-in interfacing to the wrong side of the waistband, on the half marked HOOK and EYE (from the edge that joins the skirt to the fold line), and catch it to the fold line with small stitches. Sew-in interfacing moves with the cloth, where a fusible one stiffens and can bubble. This half will be the outside.',
      });
    } else if (t === 'Interface the facings') {
      out.push({
        ...s,
        text: s.text.replace('Fuse the interfacing to the wrong side of each facing.', 'Hand-baste a silk organza interfacing, cut from the same pieces, to the wrong side of each facing: it supports the edge without the stiffness of a fusible.'),
      });
    } else if (/^Sew the .*darts?$/.test(t)) {
      const fishEye = /pointed at both ends/.test(s.text);
      out.push(
        step(
          t,
          `Fold each dart right sides together, pinning through both traced lines so they meet, and baste along them. Machine from the wide end to the point, the last 2 cm a thread's width from the fold, and run off the fold. Leave long threads and tie them in a knot by hand rather than backstitching, so the point lies flat.${fishEye ? ' The waist darts are pointed at both ends: sew from the middle out to each point, then clip into the fold at the waist so they lie flat.' : ''} Press each dart flat as sewn, then over the ham, ${bodice && !/skirt/.test(t) ? 'bust darts downward and waist darts toward the centre' : 'front darts toward the centre front and back darts toward the centre back'}.${c.cloth === 'wool' ? ' In wool, slash a deep dart along its fold to 2 cm from the point and press it open, so it leaves no ridge.' : ''}`,
          'press',
        ),
      );
    } else if (t === 'Put in the zip') {
      if (!fitted) {
        out.push(fitStep());
        fitted = true;
      }
      rightZip = /right side/.test(s.text);
      zip = step(
        'Hand-pick the zip',
        `Press both ${/right side/.test(s.text) ? 'right side seam' : 'centre back'} allowances under along the traced line, down to the ZIP ENDS mark. Baste the ${c.zipCm} cm zip behind the opening, its teeth centred, with the folded edges just meeting over them. From the right side, sew each side with a prick stitch: a tiny backstitch every 6 mm, 6 mm from the fold, catching only a thread or two of the surface. It is how couture houses still set a zip: barely seen from outside, soft, and easy to adjust at a fitting.`,
        'pickzip',
      );
    } else if (t === 'Stay-stitch the waist') {
      // Every curve is staystitched once the lines are traced (above).
    } else if (t === 'Sew the right side seam' || t === 'Sew the left side seam') {
      if (!fitted) {
        out.push(fitStep());
        fitted = true;
      }
      const left = t === 'Sew the left side seam';
      out.push(
        finish === 'french' && !left
          ? step(t, `Sew the right side seam (as you wear it) as a French seam. Pin the pieces wrong sides together and sew 0.6 cm outside the traced line, in the allowance. Trim to 0.3 cm and press, then fold right sides together along the seam, press again and sew on the traced line, enclosing the raw edges.${/bias/.test(s.text) ? ' Let the cloth feed itself: a bias seam that is pulled ripples.' : ''} Press the seam toward the back.`, 'french')
          : step(t, left ? 'Machine the left side seam on the traced line, from the ZIP ENDS mark to the hem, taking out the basting as you go. Press it open.' : 'Machine the right side seam (as you wear it) on the traced line, taking out the basting as you go. Press it open.'),
      );
      if (left) {
        if (zip) out.push(zip);
        zip = undefined;
        out.push(
          finish === 'french'
            ? step('Finish the left side seam', 'A French seam cannot go round a zip, so overcast the left side allowances by hand: slanted stitches 0.5 cm deep and 0.5 cm apart.', 'overcast')
            : step('Finish the seams', `Finish the ${seams} allowances, pressed open. ${FINISH_WORDS[finish]}`, finish),
        );
      }
    } else if (t === 'Put in the side zip') {
      // A hand-picked zip goes in after the seam below it is sewn.
      zip = step(
        'Hand-pick the zip',
        `Press both left side allowances under along the traced line, down to the ZIP ENDS marks${/interfacing/.test(s.text) ? ', with a strip of silk organza basted inside each so the bias cannot stretch' : ''}. Baste the ${c.zipCm} cm zip behind the opening, its teeth centred, with the folded edges just meeting over them. From the right side, sew each side with a prick stitch: a tiny backstitch every 6 mm, 6 mm from the fold, catching only a thread or two of the surface.`,
        'pickzip',
      );
    } else if (t === 'Close the centre back') {
      // A hand-picked zip goes in after the seam below it is sewn.
      out.push({ ...s, text: s.text.replace('from the bottom of the zip', 'from the ZIP ENDS mark').replace('below the zip', 'below the ZIP ENDS mark') });
      if (zip) out.push(zip);
      zip = undefined;
    } else if (t === 'Sew the shoulders' || t === 'Sew the side seams') {
      if (!fitted) {
        out.push(fitStep());
        fitted = true;
      }
      const which = t === 'Sew the shoulders' ? 'shoulders' : 'side seams';
      // A French seam cannot turn the corner round an in-seam pocket: those side seams are pressed
      // open and overcast instead, the pocket bags with them.
      const pocketed = /POCKET notch/.test(s.text);
      out.push(
        finish === 'french' && !pocketed
          ? step(
              t,
              `Sew the ${which} as French seams. Pin the pieces wrong sides together and sew 0.6 cm outside the traced line, in the allowance. Trim to 0.3 cm and press, then fold right sides together along the seam, press again and sew on the traced line, enclosing the raw edges. Press the seam toward the back.${which === 'shoulders' ? ' Ease in the back shoulder\'s extra 1 cm as you pin.' : ''}`,
              'french',
            )
          : step(
              t,
              `${s.text.split('. Try')[0].replace(/\.$/, '').replace(/Sew [\d.]+ cm from the edge/, 'Machine on the traced line, taking out the basting as you go,')}.${
                pocketed && finish === 'french' ? ` A French seam cannot turn the corner round a pocket, so press these seams open and overcast the allowances by hand, the pocket bags with them. ${FINISH_WORDS.overcast}` : ''
              }`,
              pocketed && finish === 'french' ? 'overcast' : undefined,
            ),
      );
      if (t === 'Sew the side seams')
        out.push(
          ...(finish === 'french'
            ? rightZip
              ? [step('Finish the zip opening', 'A French seam cannot go round a zip, so sew the right side seam below the zip as a plain seam and overcast its allowances by hand: slanted stitches 0.5 cm deep and 0.5 cm apart.', 'overcast')]
              : c.zipCm > 0 && !sideZip
                ? [step('Finish the centre back', 'A French seam cannot go round a zip, so overcast the centre back allowances by hand below the zip: slanted stitches 0.5 cm deep and 0.5 cm apart.', 'overcast')]
                : []
            : [step('Finish the seams', `Finish the ${seams} allowances, pressed open. ${FINISH_WORDS[finish]}`, finish)]),
        );
      if (t === 'Sew the side seams' && zip) {
        out.push(zip);
        zip = undefined;
      }
    } else if (t === 'Bind the neckline' || t === 'Bind the armholes') {
      out.push(
        step(
          t,
          t === 'Bind the neckline'
            ? `${s.text.replace('stitch it down close to its folded edge', 'slip-stitch its fold by hand to the line of machine stitching, so nothing shows on the outside')} Cut your own 3 cm bias strips from the garment fabric or silk organza if you can: they shape to the curve better than bought binding.`
            : 'Bind each armhole the same way, starting and ending at the side seam with the ends overlapped by 1 cm, and slip-stitch it down by hand.',
          'slipstitch',
        ),
      );
    } else if (t === 'Face the neckline' || t === 'Face the armholes' || t === 'Line the neck and armholes' || t === 'Face the waist') {
      out.push({
        ...s,
        text: s.text.replace('trim the seam to 0.5 cm', "grade the seam (the facing's allowance to 0.3 cm, the bodice's to 0.6 cm) so no ridge shows,").replace('Trim to 0.5 cm,', "Grade the seam (the lining's allowance to 0.3 cm, the bodice's to 0.6 cm),"),
        diagram: 'understitch',
      });
    } else if (t === 'Join the bodice to the skirt') {
      if (ownStay) out.push(step(t, `${s.text.replace(/ Sew [\d.]+ cm from the edge and/, ' Baste along the traced lines, machine on them, take out the basting and')}`, 'baste'));
      else out.push(
        step(
          t,
          'Baste the waist seam along the traced lines, matching the centre front, the side edges and the darts, so each bodice dart runs on into the skirt dart below it. Machine on the traced line, take out the basting and press the seam up toward the bodice over the ham.',
          'baste',
        ),
        step(
          'Stay the waist',
          'Cut a length of 1.5 cm grosgrain ribbon to your waist measurement plus 3 cm. Pin it inside along the waist seam, centred at the front, and catch it by hand to the seam allowances at each dart and side seam, leaving 8 cm free each side of the zip. Finish the ends with a hook and bar. The stay carries the weight of the skirt, so the zip never strains and the waist sits exactly where it was fitted.',
        ),
      );
    } else if (t === 'Sew the sleeve seams') {
      const vent = /vent/.test(s.text) ? ' Stop at the vent notch above the wrist and leave the seam open below it for the vent.' : '';
      out.push(
        finish === 'french'
          ? step(t, `Sew the underarm seams as French seams: wrong sides together 0.6 cm outside the traced line, trimmed to 0.3 cm, then right sides together on the traced line.${vent} Press them toward the back over a sleeve board.`, 'french')
          : step(t, `Baste each underarm seam on the traced line, matching the notches and the bicep and elbow lines, then machine it and take the basting out.${vent} Press it open over a sleeve board, and finish the allowances as for the bodice. ${FINISH_WORDS[finish]}`, finish),
      );
    } else if (t === 'Ease the sleeve heads') {
      out.push(
        step(
          t,
          `${s.text.split(': draw')[0]}. Draw the threads up until the crown matches the traced armhole, then shrink the ease away over the end of the ham: steam it, pat it into a smooth cup and let it cool before you move it.${c.cloth === 'wool' ? ' Wool shrinks beautifully, so the crown can carry its full ease and still show not a single pucker.' : ' This cloth will not shrink like wool, so spread the ease with the point of a needle as you baste, a little at a time, rather than relying on the iron.'}`,
          'easehead',
        ),
      );
    } else if (t === 'Gather the sleeve heads') {
      out.push(step(t, `${s.text} Draw the gathers up with the bodice on a stand or on you, so the puff sits where it flatters, and spread them evenly between the notches.`, 'easehead'));
    } else if (t === 'Set in the sleeves') {
      out.push(
        step(
          t,
          `${s.text.split(' Sew with the sleeve on top')[0]} Hand-baste the sleeve in along the traced lines, with small stitches over the crown, and try the bodice on. The sleeve should hang straight from the shoulder, its grain plumb, with the crown smooth; if it twists, turn it a little in the armhole and re-baste. Then machine with the sleeve on top, on the traced line, and take out the basting.${c.cloth === 'wool' ? " Slip a sleeve head, a 4 cm bias strip of lambswool or wadding, into the crown's allowance and catch it to the seam: it holds the crown round and fills the hollow below the shoulder." : ''}`,
          'setsleeve',
        ),
      );
    } else if (t === 'Finish the armhole seams') {
      out.push(
        step(
          t,
          c.lined
            ? 'Trim the armhole seam to 1 cm through all the layers and bind it in a bias strip of lining, folded over the raw edges and slip-stitched down by hand. Let it turn toward the sleeve.'
            : 'Trim the armhole seam to 1 cm under the arm only, where it curves most, and leave it full over the crown so it supports the sleeve head. Overcast the two edges together by hand, or bind them in a bias strip of lining. Press only the crown edge, over the end of a sleeve roll, never flat across the armhole.',
          c.lined ? 'slipstitch' : 'overcast',
        ),
      );
    } else if (t === 'Hem the sleeves') {
      out.push(step(t, `${/vent/.test(s.text) ? 'Finish the vent first: turn the open seam allowances below the vent notch under along the traced line, and fell them by hand with a few stitches across the top of the vent. ' : ''}Thread-trace the hem line at a fitting, with the arm bent a little. Turn the hem up on the line and baste it 1 cm from the fold, trim to an even depth and finish the raw edge, then catch-stitch it by hand so nothing shows on the outside. Press from the inside over a sleeve board.`, 'catch'));
    } else if (t === 'Attach the sleeve bands') {
      out.push(step(t, s.text.replace('and stitch it down over the seam.', 'and slip-stitch it by hand to the line of machine stitching inside.'), 'slipstitch'));
    } else if (t === 'Line the neckline' || t === 'Baste the lining to the armholes') {
      out.push(t === 'Line the neckline' ? { ...s, text: s.text.replace('Trim to 0.5 cm,', "Grade the seam (the lining's allowance to 0.3 cm, the bodice's to 0.6 cm),"), diagram: 'understitch' } : s);
    } else if (t === 'Finish the waistband') {
      out.push(step(t, s.text.replace('then hand-stitch it over the seam inside, or stitch in the ditch from the outside.', 'then slip-stitch it by hand over the seam inside, the stitches just catching the machine line.'), 'slipstitch'));
    } else if (t === 'Hem') {
      const words = hemWords(c, finish, s.text);
      out.push(step(t, words, /slip-stitch/.test(words) ? 'slipstitch' : 'catch'));
    } else if (t === 'Finish') {
      out.push({ ...s, text: `${s.text.replace(/ Give the (skirt|bodice|dress) a final press\./, '')} Take out every tacking thread, and give it a last press through a press cloth.` });
    } else out.push(s);
  }

  const notions = guide.notions.flatMap((n) => {
    if (/invisible zip/.test(n)) return [n.replace('invisible zip', 'regular zip, to set by hand')];
    if (/fusible interfacing/.test(n)) return [bodice ? '0.5 m silk organza, for sew-in interfacing' : '0.3 m firm sew-in interfacing'];
    return [n];
  });
  notions.push(
    'Contrasting tacking thread',
    "A tailor's ham and a press cloth",
    ...(finish === 'hongkong' ? ['1 m of lining or silk organza, for the bias strips that bind the seams'] : []),
    ...(dress && !ownStay ? ['1 m of 1.5 cm grosgrain ribbon and a hook and bar, for the waist stay'] : []),
    ...(guide.steps.some((g) => g.title === 'Set in the sleeves')
      ? ['A sleeve board or sleeve roll', ...(c.cloth === 'wool' ? ['A pair of sleeve heads, or 0.2 m of lambswool for them'] : [])]
      : []),
    'Fine hand-sewing needles',
  );
  return { notions, steps: out };
}

function hemWords(c: CoutureContext, finish: SeamFinish, quick: string): string {
  if (/Hang the skirt up/.test(quick))
    return 'Hang the skirt up for a day before hemming: the parts cut across the grain drop. Mark an even hem with thread tracing, measured up from the floor at a fitting, and trim 1.5 cm below it. Machine along the traced line, turn the edge under along the stitching, then roll the raw edge in again and slip-stitch the narrow roll by hand. A hand-rolled hem is soft and light, and lets a full skirt swing.';
  if (/0.5 cm, then 1 cm more, and stitch close/.test(quick))
    return 'Press up 0.5 cm, then 1 cm more, and slip-stitch the fold by hand, so no stitching shows on the outside.';
  const edge =
    finish === 'french'
      ? 'turn the raw edge under 0.6 cm'
      : finish === 'hongkong'
        ? 'bind the raw edge in bias, as for the seams'
        : finish === 'pinked'
          ? 'pink the raw edge'
          : 'overcast the raw edge by hand';
  return `Mark the hem with thread tracing, measured up from the floor at a fitting if you can. Turn the hem up along the traced line and baste it 1 cm from the fold, easing in any fullness with steam. Trim the hem to an even depth and ${edge}. Catch-stitch the edge by hand, each stitch picking up a single thread of the ${c.garment}, so nothing shows on the right side. Press from the inside through a press cloth, never over the basting, then take the basting out.`;
}

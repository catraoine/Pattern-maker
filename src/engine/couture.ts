// The couture route: the same garment sewn the way a couture workroom would. Lines thread-traced
// rather than chalked, curves staystitched, seams basted and fitted before machining, darts tied off
// and pressed over a ham, a hand-picked zip, seam finishes chosen for the cloth, and hand-finished
// edges and hem. Built from the quick route's steps, so the two always describe the same garment.
// Keep to plain ASCII punctuation: the PDF uses a standard font without curly quotes.
import type { SewStep, SewingGuide } from './instructions';
import type { DiagramId } from './diagrams';

export type Route = 'quick' | 'couture';
export type Cloth = 'cotton' | 'linen' | 'wool' | 'silk';
export type SeamFinish = 'french' | 'hongkong' | 'pinked' | 'overcast';

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

export interface CoutureContext {
  garment: 'skirt' | 'bodice';
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
  const bodice = c.garment === 'bodice';
  const seams = bodice ? 'side, shoulder and centre back' : 'side and centre back';
  const out: SewStep[] = [];
  let zip: SewStep | undefined;
  let fitted = false;

  const fitStep = () =>
    step(
      'Baste and fit',
      `Hand-baste the side seams${bodice ? ' and shoulders' : ''} along the traced lines, pin the centre back closed and try it on, right side out. The side seams should hang straight down and each dart point toward the fullest part of the body. Re-trace any line you change, on both pieces, then take the basting out of each seam as you come to sew it.`,
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
          bodice
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
          `Fold each dart right sides together, pinning through both traced lines so they meet, and baste along them. Machine from the wide end to the point, the last 2 cm a thread's width from the fold, and run off the fold. Leave long threads and tie them in a knot by hand rather than backstitching, so the point lies flat.${fishEye ? ' The waist darts are pointed at both ends: sew from the middle out to each point, then clip into the fold at the waist so they lie flat.' : ''} Press each dart flat as sewn, then over the ham, ${bodice ? 'bust darts downward and waist darts toward the centre' : 'front darts toward the centre front and back darts toward the centre back'}.${c.cloth === 'wool' ? ' In wool, slash a deep dart along its fold to 2 cm from the point and press it open, so it leaves no ridge.' : ''}`,
          'press',
        ),
      );
    } else if (t === 'Put in the zip') {
      if (!fitted) {
        out.push(fitStep());
        fitted = true;
      }
      zip = step(
        'Hand-pick the zip',
        `Press both centre back allowances under along the traced line, down to the ZIP ENDS mark. Baste the ${c.zipCm} cm zip behind the opening, its teeth centred, with the folded edges just meeting over them. From the right side, sew each side with a prick stitch: a tiny backstitch every 6 mm, 6 mm from the fold, catching only a thread or two of the surface. It is how couture houses still set a zip: barely seen from outside, soft, and easy to adjust at a fitting.`,
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
      out.push(
        finish === 'french'
          ? step(
              t,
              `Sew the ${which} as French seams. Pin the pieces wrong sides together and sew 0.6 cm outside the traced line, in the allowance. Trim to 0.3 cm and press, then fold right sides together along the seam, press again and sew on the traced line, enclosing the raw edges. Press the seam toward the back.${which === 'shoulders' ? ' Ease in the back shoulder\'s extra 1 cm as you pin.' : ''}`,
              'french',
            )
          : step(t, `${s.text.split('. Try')[0].replace(/\.$/, '').replace(/Sew [\d.]+ cm from the edge/, 'Machine on the traced line, taking out the basting as you go,')}.`),
      );
      if (t === 'Sew the side seams')
        out.push(
          finish === 'french'
            ? step('Finish the centre back', 'A French seam cannot go round a zip, so overcast the centre back allowances by hand below the zip: slanted stitches 0.5 cm deep and 0.5 cm apart.', 'overcast')
            : step('Finish the seams', `Finish the ${seams} allowances, pressed open. ${FINISH_WORDS[finish]}`, finish),
        );
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
    } else if (t === 'Face the neckline' || t === 'Face the armholes' || t === 'Line the neck and armholes') {
      out.push({
        ...s,
        text: s.text.replace('trim the seam to 0.5 cm', "grade the seam (the facing's allowance to 0.3 cm, the bodice's to 0.6 cm) so no ridge shows,").replace('Trim to 0.5 cm,', "Grade the seam (the lining's allowance to 0.3 cm, the bodice's to 0.6 cm),"),
        diagram: 'understitch',
      });
    } else if (t === 'Finish the waistband') {
      out.push(step(t, s.text.replace('then hand-stitch it over the seam inside, or stitch in the ditch from the outside.', 'then slip-stitch it by hand over the seam inside, the stitches just catching the machine line.'), 'slipstitch'));
    } else if (t === 'Hem') {
      const words = hemWords(c, finish, s.text);
      out.push(step(t, words, /slip-stitch/.test(words) ? 'slipstitch' : 'catch'));
    } else if (t === 'Finish') {
      out.push({ ...s, text: `${s.text.replace(' Give the skirt a final press.', '').replace(' Give the bodice a final press.', '')} Take out every tacking thread, and give it a last press through a press cloth.` });
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

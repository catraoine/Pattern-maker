// Sewing a skirt's faced or high waist, and a zip in the left side seam (see skirtWaist.ts): the band's
// steps give way to facings, the high waist's darts run up past the waist, and the zip's steps move to
// the side. Plain ASCII punctuation (see instructions.ts).
import type { SewStep, SewingGuide } from './instructions';
import type { SkirtDraft } from './skirt';

const step = (title: string, text: string): SewStep => ({ title, text });

export function skirtWaistSteps(g: SewingGuide, d: SkirtDraft, o: { seam: string; waist: string }): SewingGuide {
  const fin = d.waistFinish;
  const side = d.opening === 'left_side' && !d.halves;
  if (!fin && !side) return g;
  const high = fin === 'high';
  const backFold = !!d.pieces[1].fold;
  const edge = high ? 'top edge' : 'waist edge';
  const top = high ? 'the top edge' : 'the waist';
  const steps: SewStep[] = [];
  for (const s of g.steps) {
    switch (s.title) {
      case 'Cut the waistband':
        if (!fin) break;
        steps.push(
          step(
            'Cut the facings',
            `Cut the front waist facing on the fold and the back waist facing${backFold ? ' on the fold too' : 's as a pair'}, from the fabric and again from fusible interfacing. Snip their notches.${high ? ' The facings reach down to the waist, so they hold the high waist to its shape.' : ''}`,
          ),
        );
        continue;
      case 'Interface the waistband':
        if (!fin) break;
        steps.push(
          step(
            'Interface the facings',
            `Fuse the interfacing to the wrong side of each facing. Sew the facings together at the ${side ? 'right side seam only (the left stays open for the zip)' : 'side seams'}, ${o.seam} from the edge, and press the seams open. Zigzag or overlock the facing's lower edge.`,
          ),
        );
        continue;
      case 'Put in the zip':
        steps.push({
          ...s,
          text: s.text
            .replace('into the centre back edges', side ? 'into the left side seam edges (as you wear it), front and back' : 'into the centre back edges')
            .replace('below the waist edge', `below the ${edge}`),
        });
        continue;
      case 'Close the centre back':
        if (!side) break;
        if (!backFold) steps.push({ ...s, title: 'Sew the centre back', text: s.text.replace('Sew the rest of the centre back seam, from the bottom of the zip', `Sew the centre back seam, from ${top}`) });
        continue;
      case 'Sew the side seams':
        if (!side) break;
        steps.push({
          ...s,
          text: s.text.replace(
            /Sew (\S+ cm) from the edge and press the seams open\./,
            `Sew the right side seam from ${top} to the hem, and the left one from the bottom of the zip to the hem, $1 from the edge, and press the seams open.`,
          ),
        });
        continue;
      case 'Make the lining':
        if (!side) break;
        steps.push({
          ...s,
          text: s.text.replace(
            'side seams and the centre back seam from the ZIP ENDS notch down',
            backFold ? 'right side seam, and the left one from the ZIP ENDS notch down' : 'centre back seam, the right side seam, and the left one from the ZIP ENDS notch down',
          ),
        });
        continue;
      case 'Put the lining in':
        if (!side) break;
        steps.push({ ...s, text: s.text.replace("lining's centre back edges", "lining's left side edges") });
        continue;
      case 'Attach the waistband':
        if (fin) {
          steps.push(
            step(
              'Face the waist',
              `Pin the facing to the skirt's ${edge}, right sides together, matching the side seams and the centre ${backFold ? 'front and back' : 'front'}, with each end of the facing extending ${o.seam} past the zip. Sew ${o.waist} from the edge, trim to 0.5 cm and clip the curve. Press the seam toward the facing and understitch it close to the seam, through the facing and the seam allowances. Turn the facing to the inside and press, so it rolls just out of sight. Turn its ends under beside the zip and slip-stitch them to the zip tape, clear of the teeth, and catch the facing to the seams and darts inside.`,
            ),
          );
          continue;
        }
        if (side) {
          steps.push({ ...s, text: s.text.replace('Match the centre front notch to the centre front, the side notches to the side seams,', 'Match the notches to the centre front, the right side seam and the centre back,') });
          continue;
        }
        break;
      case 'Finish the waistband':
        if (fin) continue;
        break;
      case 'Finish':
        if (!fin) break;
        steps.push({ ...s, text: s.text.replace('Sew the hook and eye to the waistband ends at the HOOK and EYE marks.', 'Sew a hook and eye at the top of the zip, inside the facing.') });
        continue;
    }
    if (high && /^Sew the \d+ darts?$|^Sew the darts?$/.test(s.title)) {
      steps.push({
        ...s,
        text: 'Each dart runs up past the waist to the top edge, shaped like a long diamond open at the top. Fold it right sides together so the dart lines meet, and stitch from the top edge down, through the waist, to the point, running off the fold, and knot the threads. Clip the fold at the waist so it lies flat, and press front darts toward the centre front and back darts toward the centre back.',
      });
      continue;
    }
    steps.push(s);
  }
  return { ...g, steps };
}

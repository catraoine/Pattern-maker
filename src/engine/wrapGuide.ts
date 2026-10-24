// Sewing a wrap bodice: no zip, the back on the fold, and the two fronts' long edges finished in one
// line from the far end of one front, up round the back neck, to the far end of the other. One front
// laps over the other; its own side seam keeps a gap at the waist for the inner tie to come through.
// Plain ASCII punctuation (see instructions.ts).
import type { BodiceDraft } from './bodice';
import type { SkirtDraft } from './skirt';
import type { DressDraft } from './dress';
import type { SewStep, SewingGuide } from './instructions';

const step = (title: string, text: string): SewStep => ({ title, text });

/** The cutting words for the ties and the stay-stitched edges. */
export function wrapCut(d: BodiceDraft): string {
  const t = d.wrap?.ties;
  if (!t) return '';
  return ` Cut two tie strips on the straight grain, ${t.cutWidth} cm wide: one ${t.cut.outer} cm long and one ${t.cut.inner} cm long. As soon as the fronts are cut, stay-stitch their front edges 1 cm in: the edge runs across the grain and stretches easily.`;
}

/** Making the two ties and sewing them on at the far ends of the fronts. */
export function wrapTieSteps(d: BodiceDraft): SewStep[] {
  const t = d.wrap?.ties;
  if (!t) return [];
  return [
    step(
      'Make the ties',
      `Fold each tie strip in half lengthwise, right sides together, and sew the long edge and across one end 1 cm from the edge. Trim the corners, turn it right side out with a loop turner or a safety pin, and press it flat with the seam along one edge. The longer tie, ${t.outer} cm finished, goes round your waist; the shorter, ${t.inner} cm, reaches from the inside round to the side.`,
    ),
  ];
}

const ATTACH = step(
  'Attach the ties',
  'Turn the open end of each tie in by 1 cm. Slip the far end of a front 1 cm inside it, at the TIE mark, so the tie wraps the corner with its seam to the inside, and edgestitch across through every layer, then again 0.5 cm in. The longer tie goes on the front that laps on top, the shorter on the one beneath.',
);

const SIDES =
  'Decide which front laps on top. Pin each front to the back at its own side seam, right sides together: the far end of the other front lies free and is not caught in the seam. On the side where the top front starts, leave a 3 cm gap at the waist for the inner tie, backstitching on each side of it.';

/**
 * The bodice's steps for a wrap: the zip and centre back go, the side seams leave the tie gap, the
 * neckline finish runs the whole front edge, and the ties go on.
 */
export function wrapSteps(g: SewingGuide, d: BodiceDraft, o: { curve: string }): SewingGuide {
  if (!d.wrap) return g;
  const edgeLine = `from the far end of one front, up its edge to the shoulder, round the back neck and down the other front to its far end`;
  const steps: SewStep[] = [];
  for (const s of g.steps) {
    switch (s.title) {
      case 'Put in the zip':
      case 'Close the centre back':
      case 'Finish the lining at the zip':
        continue;
      case 'Cut out':
        steps.push({ ...s, text: `${s.text}${wrapCut(d)}` });
        continue;
      case 'Neaten the edges':
        steps.push({ ...s, text: s.text.replace('shoulder, side and centre back edges', 'shoulder and side edges') });
        continue;
      case 'Sew the side seams':
        steps.push({ ...s, text: s.text.replace(/^Pin the front to the back at the sides, right sides together\./, SIDES) }, ...wrapTieSteps(d));
        continue;
      case 'Bind the neckline':
        steps.push({
          title: 'Bind the front edges',
          text: `Open out one fold of the bias binding and pin it along the front edges, right sides together, ${edgeLine}, with the crease ${o.curve} from the edge and 1 cm extra at each end. Ease it on round the back neck and keep it relaxed, never stretched, down the fronts. Sew along the crease, trim to 0.5 cm and clip the curves. Fold the ends in, then turn the binding to the inside, press, and stitch close to its fold.`,
        });
        continue;
      case 'Make the lining':
        steps.push({ ...s, text: s.text.replace(/,? and its centre back seam below the ZIP ENDS notch,/, ',').replace(/ (\d)/, ' $1') });
        continue;
      case 'Line the neck and armholes':
        steps.push({ ...s, title: 'Line the front edges and armholes', text: s.text.replace(/Sew the neckline (.+?) from the edge, from one centre back seam line to the other,/, `Sew the front edge $1 from the edge, ${edgeLine},`) });
        continue;
      case 'Line the neckline':
        steps.push({ ...s, title: 'Line the front edges', text: s.text.replace('round the neckline', 'along the front edges').replace(/from one centre back seam line to the other\./, `${edgeLine}.`) });
        continue;
      case 'Hem':
        steps.push(s, ATTACH);
        continue;
      case 'Finish':
        steps.push({ ...s, text: s.text.replace(/Sew a hook and eye at the top of the zip, inside the neckline\. ?/, 'Sew a small snap inside where the fronts cross at the centre front, so the top front lies flat. ') });
        continue;
      default:
        steps.push(s);
    }
  }
  const notions = g.notions.filter((n) => !/invisible zip|Hook and eye/.test(n));
  return { notions: [...notions.slice(0, -1), 'A small snap', 'A loop turner or a safety pin, for the ties', notions[notions.length - 1]], steps };
}

/**
 * A wrap skirt's steps: no zip, the back on the fold, the fronts' free edges hemmed, and a waistband
 * that goes round once and across the front again with a tie in each end.
 */
export function wrapSkirtSteps(g: SewingGuide, d: SkirtDraft): SewingGuide {
  const t = d.wrap?.ties;
  if (!t) return g;
  const steps: SewStep[] = [];
  for (const s of g.steps) {
    switch (s.title) {
      case 'Put in the zip':
      case 'Close the centre back':
        continue;
      case 'Cut out':
        steps.push({
          ...s,
          text: `${s.text.replace(/Place the skirt front on the fold, and the skirt back on both layers so you get a pair\.|Place the skirt front and the skirt back on the fold\./, 'Place the skirt back on the fold, and the skirt front on both layers so you get a pair.')} Cut two tie strips on the straight grain, ${t.cutWidth} cm wide: one ${t.cut.outer} cm long and one ${t.cut.inner} cm long.`,
        });
        continue;
      case 'Neaten the edges':
        steps.push({ ...s, text: s.text.replace('side and centre back edges', 'side edges') });
        continue;
      case 'Interface the waistband':
        steps.push({ ...s, text: s.text.replace('on the half marked HOOK and EYE (from the edge that joins the skirt to the fold line)', 'on the half from the edge that joins the skirt to the fold line') });
        continue;
      case 'Sew the side seams':
        steps.push(
          { ...s, text: s.text.replace(/^Pin the front to the back at the sides, right sides together,/, 'Pin each front to the back at its own side seam, right sides together, with the far side of each front lying free,') },
          step('Hem the front edges', "Press each front's free edge under 1 cm, then 1 cm more, from the waist to the hem, and stitch close to the inner fold. The skirt is now one long piece from one free edge round the back to the other."),
          ...wrapTieSteps({ wrap: { ties: t } } as BodiceDraft),
        );
        continue;
      case 'Make the lining':
        steps.push({ ...s, text: s.text.replace(' and the centre back seam from the ZIP ENDS notch down', '') });
        continue;
      case 'Attach the waistband':
        steps.push({
          ...s,
          text: "Decide which front laps on top: its free edge goes at the end of the band marked LONG TIE. Pin the interfaced long edge of the waistband to the skirt waist, right sides together, from that free edge, matching the CENTRE FRONT and SIDE SEAM notches to the top front's centre and its side seam, round the back and on across the under front to its free edge at the SHORT TIE end. Let each end extend 1.5 cm past the free edges. Sew 1.5 cm from the edge and press the seam up into the band.",
        });
        continue;
      case 'Finish the waistband':
        steps.push(
          { ...s, text: s.text.replace('and sew across each end 1.5 cm in.', "and sew across each end 1.5 cm in, with a tie's open end tucked inside: the long tie at the LONG TIE end and the short tie at the other, each lying along the band.") },
          step('Make the tie hole', 'Work a 3.5 cm buttonhole, upright, at the TIE HOLE mark on the outside of the band, over the first side seam. The short tie comes out through it from inside, to knot with the long tie at that side.'),
        );
        continue;
      case 'Finish':
        steps.push({ ...s, text: 'Give the skirt a final press. To wear it, wrap the under front across, pass its tie out through the tie hole, lap the top front over and knot the ties at the side.' });
        continue;
      default:
        steps.push(s);
    }
  }
  const notions = g.notions.filter((n) => !/invisible zip|Hook and eye/.test(n));
  return { notions: [...notions.slice(0, -1), 'A loop turner or a safety pin, for the ties', notions[notions.length - 1]], steps };
}

/**
 * A wrap dress's steps: each bodice front joins its own skirt front, the skirt back is on the fold, there
 * is no zip, and the skirt fronts' free edges are hemmed from the waist seam down.
 */
export function wrapDressSteps(g: SewingGuide, d: DressDraft, o: { seam: string; waist: string }): SewingGuide {
  if (!d.bodice.wrap) return g;
  const steps: SewStep[] = [];
  for (const s of g.steps) {
    switch (s.title) {
      case 'Put in the zip':
      case 'Close the centre back':
        continue;
      case 'Cut out':
        steps.push({
          ...s,
          text: s.text
            .replace(/ The skirt pieces are too wide for folded fabric:[^.]*\./, '')
            .replace(/ Place the skirt front on the fold and the skirt back on both layers\./, '')
            .replace(/Place the bodice back on the fold, and the bodice front on both layers so you get a pair\./, 'Place the bodice back and the skirt back on the fold, and the bodice front and the skirt front on both layers so you get pairs.')
            .concat(wrapCut(d.bodice)),
        });
        continue;
      case 'Neaten the edges':
        steps.push({ ...s, text: s.text.replace(', the side edges of the skirt, and the centre back edges of both', ' and the side edges of the skirt') });
        continue;
      case 'Join the bodice to the skirt':
        steps.push({
          ...s,
          text: `Pin each bodice front to a skirt front at the waist, right sides together, matching the CENTRE FRONT lines, the side edges, the far ends and the darts, so each bodice dart runs on into the skirt dart below it in one line. Pin the back the same way, matching the centre backs. Sew ${o.waist} from the edge, press the seams up toward the bodice, and zigzag or overlock the two edges together.`,
        });
        continue;
      case 'Sew the side seams':
        steps.push({
          ...s,
          text: s.text.replace(
            /^Pin the front to the back at the sides, right sides together, from the underarm to the hem,/,
            'Decide which front laps on top. Pin each front to the back at its own side seam, right sides together, from the underarm to the hem, the far end of the other front lying free. On the side where the top front starts, leave a 3 cm gap at the waist seam for the inner tie, backstitching on each side of it. Match',
          ).replace(/Match matching /, 'Match '),
        });
        continue;
      case 'Line the front edges and armholes':
      case 'Line the front edges':
        steps.push({ ...s, text: `${s.text} Turn the lining's waist edge under and slip-stitch it over the waist seam inside.` });
        continue;
      case 'Hem':
        steps.push(
          step('Hem the skirt front edges', "Press each skirt front's free edge under 1 cm, then 1 cm more, from the waist seam to the hem, and stitch close to the inner fold, running on neatly from the bound or lined bodice edge above."),
          s,
          ATTACH,
        );
        continue;
      case 'Finish':
        steps.push({ ...s, text: s.text.replace(/Sew a hook and eye at the top of the zip, inside the neckline\. ?/, 'Sew a small snap inside where the fronts cross at the centre front, so the top front lies flat. ') + ' To wear it, wrap the under front across, pass its tie out through the side seam gap, lap the top front over and knot the ties at the side.' });
        continue;
      default:
        steps.push(s);
    }
  }
  return { ...g, steps };
}

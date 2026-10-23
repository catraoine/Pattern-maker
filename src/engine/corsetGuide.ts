// Sewing steps for a top cut below the shoulders: a cami on spaghetti straps, and the boned bodice
// sewn in couture corsetry order. Flat-line every panel to its coutil, sew and press the panels, sew
// the boning channels over the seams, cut the bones to length and tip them, put in the waist stay,
// stay the top edge, then line it and understitch so the lining rolls inside.
// Plain ASCII punctuation (see instructions.ts).
import type { BodiceDraft } from './bodice';
import type { DressDraft } from './dress';
import type { BodiceEdges, SewStep, SewingGuide } from './instructions';
import { BONED_EASE, BONE_STOP, STRAP_ADJUST, WAIST_STAY } from './corset';
import { placeWords } from './styleSteps';
import { type Slit, slitStop, toHem } from './slit';

export interface TopFinish {
  seam: string;
  curve: string;
  fabricM: number;
  liningM?: number;
  coutilM?: number;
  width?: number;
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const step = (title: string, text: string, diagram?: SewStep['diagram']): SewStep => (diagram ? { title, text, diagram } : { title, text });

/** Cutting the straps, for the cutting step. */
export function strapCut(d: BodiceDraft): string {
  const st = d.top?.straps;
  const ties = d.top?.ties;
  if (ties) return ` Cut two strips for the neck ties on the straight grain, ${ties.cutWidthCm} cm wide and ${ties.cutLengthCm} cm long. Stay-stitch the cut-in armholes 1 cm in as soon as they are cut, so they cannot stretch.`;
  return st ? ` Cut two bias strips for the straps, ${st.cutWidthCm} cm wide and ${st.cutLengthCm} cm long.` : '';
}

/** Sewing a halter's tie to each strap end. */
const tieStep = () =>
  step(
    'Attach the ties',
    "Turn the open end of each tie in by 1 cm. Slip a strap end 1 cm inside it, so the tie wraps the end with its seam to the inside, and edgestitch across through every layer, then again 0.5 cm above. Try the top on and knot the ties behind your neck: it should lie flat across the chest without pulling down the front.",
  );

/** Making the rouleau straps and settling their length. */
function strapSteps(d: BodiceDraft): SewStep[] {
  const st = d.top?.straps;
  const ties = d.top?.ties;
  if (ties)
    return [
      step(
        'Make the neck ties',
        `Fold each tie strip in half lengthwise, right sides together, and sew the long edge and across one end ${r1((ties.cutWidthCm - 2 * 2.5) / 2)} cm from the edge. Trim the corners, turn the tie right side out with a loop turner or a safety pin, and press it flat with the seam along one edge. Each tie is ${ties.lengthCm} cm finished, long enough to reach round the back of your neck and knot.`,
      ),
    ];
  if (!st) return [];
  return [
    step(
      'Make the straps',
      `Fold each bias strip in half lengthwise, right sides together, and sew 0.6 cm from the fold, stretching the strip a little as you go so the stitches don't snap. Trim to 0.3 cm and turn it through with a loop turner. Each strap is ${st.lengthCm} cm finished, from the front top edge over the shoulder to the back, with ${STRAP_ADJUST} cm extra to settle at the fitting.${
        st.lower ? ` Your ${st.lower.side} shoulder is lower: that strap will want to be about ${st.lower.cm} cm shorter.` : ''
      } Pin the straps inside at the STRAP marks and try the bodice on, then trim each one to length, leaving ${'1 cm'} at each end to sew into the seam.`,
    ),
  ];
}

/** The boned bodice's own steps, from the flat-lining to the lined top edge. */
function bonedCore(d: BodiceDraft, o: TopFinish): { early: SewStep[]; bones: SewStep[]; lining: SewStep[] } {
  const t = d.top!;
  const bones = t.bones.map((b) => `${b.where.toLowerCase()}, ${b.count} x ${b.lengthCm} cm`).join('; ');
  const straps = !!t.straps;
  const early: SewStep[] = [
    step(
      'Sew the centre channels',
      'Before the layers are joined, stitch a boning casing to the coutil centre front, centred on the CENTRE FRONT line, and one to each coutil centre back panel 1.5 cm in from the seam line. Edgestitch both long sides through the coutil only, so the stitching never shows on the outside.',
    ),
    step(
      'Flat-line the panels',
      "Lay each fabric panel wrong side down on its coutil panel, matching the edges and the notches, and smooth it from the middle outward. Hand-baste the two together all round 1 cm from the cut edge, and once down the middle of each panel with long stitches. From here on, sew each pair as one layer. The coutil takes the strain of the close fit and the boning, so the fashion fabric never pulls or shows the bones.",
      'baste',
    ),
  ];
  const boneSteps: SewStep[] = [
    step(
      'Press the seams',
      "Press every seam open over a tailor's ham, the princess seams curved over the bust, and clip the curves where they pull. Pressed open, each seam's two allowances make a flat bed for its boning channel.",
      'press',
    ),
    step(
      'Sew the boning channels',
      `Stitch a boning casing (ready-made casing, or 1.2 cm cotton tape) centred over each pressed-open princess and side seam on the coutil side, through the seam allowances only. Edgestitch both long sides, from ${BONE_STOP.top} cm below the top stitching line to ${BONE_STOP.waist} cm above the waist stitching line, and leave the top end open.`,
    ),
    step(
      'Insert the boning',
      `Cut spiral steel boning, 7 mm wide, to these lengths with boning cutters: ${bones}. Each stops ${BONE_STOP.top} cm below the top edge and ${BONE_STOP.waist} cm above the waist. Crimp a metal tip on each cut end with pliers, so the ends never wear through. (Plastic boning works too in a lighter fabric: round its ends and cover them with a scrap of tape.) Slide each bone into its channel and stitch the open end closed by hand.`,
    ),
    step(
      'Attach the waist stay',
      `Cut ${t.waistStay?.lengthCm ?? r1(d.finishedWaist + WAIST_STAY.ends)} cm of ${WAIST_STAY.width} cm grosgrain ribbon: the finished waist, ${d.finishedWaist} cm, plus ${WAIST_STAY.ends} cm. Turn each end back twice and sew a hook to one end and a bar to the other. Pin the stay inside along the waist line, its ends meeting at the zip, and catch it by hand to each seam allowance and boning channel, leaving 5 cm free each side of the zip. Fasten the stay before you close the zip: it takes the strain at the waist, so the zip and the seams don't.`,
    ),
    step(
      'Stay the top edge',
      `Cut 1 cm cotton twill tape to the top edge on the pattern, ${t.topEdge} cm all round. Hand-sew it to the coutil just inside the top stitching line, easing the edge to it, so the edge cannot stretch as you wear it.${
        t.grip ? ` The top edge is drafted ${t.grip} cm smaller round the body than you are, taken out of the princess seams at the top, so it grips and never gapes; the tape holds it there.` : ''
      }`,
    ),
  ];
  const lining: SewStep[] = [
    ...strapSteps(d),
    step('Make the lining', `Sew the lining panels together the same way, the princess seams and then the side seams, ${o.seam} from the edge, and press the seams open. Leave its centre back open.`),
    step(
      'Line the top edge',
      `Pin the lining to the bodice along the top edge, right sides together, matching the seams${straps ? ', with each strap end between the layers at its STRAP mark, the strap hanging down inside' : ''}, and the lining's centre back ends folded back over the zip tape. Sew ${o.curve} from the edge. Grade the seam (the lining's allowance to 0.3 cm, the bodice's to 0.6 cm) and clip the curves. Understitch the lining to the seam allowances, as far as you can reach, so it rolls inside. Turn and press: the lining sits just inside the top edge, hiding the bones.`,
      'understitch',
    ),
    step('Finish the lining at the zip', 'Turn the lining centre back edges under and slip-stitch them to the zip tape, clear of the teeth.', 'slipstitch'),
  ];
  return { early, bones: boneSteps, lining };
}

/** The boned bodice's notions. */
function bonedNotions(d: BodiceDraft, o: TopFinish, zip: string, fabric: string): string[] {
  const t = d.top!;
  const count = t.bones.reduce((s, b) => s + b.count, 0);
  const boning = t.bones.reduce((s, b) => s + b.count * b.lengthCm, 0);
  const w = o.width ?? 140;
  return [
    fabric,
    `${(o.coutilM ?? o.liningM ?? o.fabricM).toFixed(1)} m of cotton coutil, ${w} cm wide, for the interlining`,
    `${(o.liningM ?? o.fabricM).toFixed(1)} m of lining, ${w} cm wide`,
    zip,
    `${(Math.ceil(boning * 1.1) / 100).toFixed(1)} m of 7 mm spiral steel boning, for ${count} bones, and ${2 * count} end tips`,
    `${(Math.ceil(boning + 20) / 100).toFixed(1)} m of boning casing or 1.2 cm cotton tape`,
    `${t.waistStay?.lengthCm ?? r1(d.finishedWaist + WAIST_STAY.ends)} cm of ${WAIST_STAY.width} cm grosgrain ribbon and a hook and bar, for the waist stay`,
    `${(Math.ceil(t.topEdge + 10) / 100).toFixed(1)} m of 1 cm cotton twill tape`,
    ...(t.straps ? ['A loop turner, for the straps'] : []),
    'Hook and eye',
    'Matching thread',
  ];
}

/** The zip, shortened when no standard one is short enough. */
const zipWords = (cm: number) => `${cm} cm invisible zip${cm < 20 ? ' (a 20 cm zip, shortened)' : ''}`;

/**
 * The bodice's steps for a top below the shoulders. A boned bodice gets its own steps; a soft cami
 * keeps the block's, with straps in place of shoulders.
 */
export function topSteps(g: SewingGuide, d: BodiceDraft, o: TopFinish): SewingGuide {
  const t = d.top;
  if (!t) return g;
  if (t.boned) {
    const c = bonedCore(d, o);
    const steps: SewStep[] = [
      g.steps[0],
      step(
        'Cut out',
        `Fold the fabric in half with the selvedges together. ${placeWords(d)} Keep each grain arrow parallel to the selvedge. Cut along the solid outer line, snip the small notches, and mark the bust point. Cut every panel again from the coutil and again from the lining, the same way. On the coutil, chalk the boning lines and their end marks.${strapCut(d)}`,
      ),
      ...c.early,
      step(
        'Sew the princess seams',
        `Pin each side front to its centre front, right sides together, matching the notches above and below the bust. The centre front curves in where the side front curves out: clip the centre front's allowance almost to the stitching line over the bust so the two lie together. Sew ${o.seam} from the edge. Sew the back princess seams the same way, matching their notches.`,
      ),
      step('Put in the zip', `Sew a ${zipWords(d.zipCm)} into the centre back edges, with the top of the teeth ${o.curve} below the top edge, stopping at the ZIP ENDS notch.`),
      step('Close the centre back', `Sew the last centimetre of the centre back seam below the zip, ${o.seam} from the edge, and press it open.`),
      step(
        'Sew the side seams',
        `Pin the side fronts to the side backs, right sides together, matching the top edge and the waist. Sew ${o.seam} from the edge. Try the bodice on now, zipped: it should hold you firmly at the waist and lie flat against you along the top edge, with no gap. Take it in or let it out at the side and princess seams if it needs it.`,
      ),
      ...c.bones,
      ...c.lining,
      step(
        'Finish the waist edge',
        "Turn the bodice's waist allowance up over the coutil, clear of the bone ends, and catch-stitch it to the coutil. Turn the lining's waist edge under so its fold sits 0.3 cm above the bodice's, and slip-stitch it in place.",
        'catch',
      ),
      step('Finish', 'Sew a hook and eye at the top of the zip, inside the top edge. Give the bodice a final press, over a ham at the bust.'),
    ];
    return { notions: bonedNotions(d, o, zipWords(d.zipCm), g.notions[0]), steps };
  }
  // A soft cami: no shoulders to sew, and the top edge finished with the straps sewn in.
  const steps: SewStep[] = [];
  for (const s of g.steps) {
    if (s.title === 'Sew the shoulders' || s.title === 'Bind the armholes' || s.title === 'Face the armholes') continue;
    if (s.title === 'Cut out') steps.push({ ...s, text: `${s.text}${strapCut(d)}` });
    else if (s.title === 'Bind the neckline' && t.ties)
      steps.push(
        { ...s, title: 'Bind the top edge', text: `${s.text.replace('to the neckline', 'to the top edge')} Bind the neckline and each armhole separately, from the centre back round to the strap end, leaving the strap ends themselves unbound.` },
        tieStep(),
      );
    else if (s.title === 'Bind the neckline')
      steps.push(
        { ...s, title: 'Bind the top edge', text: s.text.replace('to the neckline', 'to the top edge') },
        step(
          'Attach the straps',
          'Tuck each strap end 1 cm under the binding on the inside at its STRAP mark and stitch it to the binding by hand. Fold the strap up over the edge and stitch across again through the binding, so it can never pull out.',
        ),
      );
    else if (s.title === 'Face the neckline' && t.ties) steps.push({ ...s, title: 'Face the top edge', text: s.text.replace('to the neckline', 'to the top edge').replace(', matching the shoulder seams,', ', matching the side seams,').replace(' and hand-tack it to the shoulder seams', ' and hand-tack it to the side seams') }, tieStep());
    else if (s.title === 'Face the neckline') steps.push({ ...s, title: 'Face the top edge', text: s.text.replace('to the neckline', 'to the top edge').replace(', matching the shoulder seams,', `, matching the side seams, with each strap end between the layers at its STRAP mark,`).replace(' and hand-tack it to the shoulder seams', ' and hand-tack it to the side seams') });
    else if (s.title === 'Make the lining') steps.push({ ...s, text: s.text.replace(' Leave the shoulders of both open for now.', '') });
    else if (s.title === 'Line the neck and armholes' && t.ties)
      steps.push(
        step(
          'Line the top edge',
          `Pin the lining to the bodice along the top edge, right sides together, matching the side seams, with each tie's open end between the layers at its strap end, the tie lying down inside. Sew ${o.curve} from the edge, from one centre back seam line round the neck, across the strap ends and down the armholes to the other. Trim to 0.5 cm, clip the curves, and understitch the lining as far as you can reach. Turn and press.`,
          'understitch',
        ),
      );
    else if (s.title === 'Line the neck and armholes')
      steps.push(
        step(
          'Line the top edge',
          `Pin the lining to the bodice along the top edge, right sides together, matching the side seams, with each strap end between the layers at its STRAP mark, the strap hanging down inside. Sew ${o.curve} from the edge, from one centre back seam line to the other. Trim to 0.5 cm, clip the curves, and understitch the lining to the seam allowance so it rolls inside. Turn and press.`,
          'understitch',
        ),
      );
    else if (s.title === 'Finish') steps.push({ ...s, text: s.text.replace('inside the neckline', 'inside the top edge') });
    else steps.push(s);
    if (s.title === 'Sew the side seams') steps.push(...strapSteps(d));
  }
  return { notions: [...g.notions.slice(0, -1), t.ties ? 'A loop turner or a safety pin, for the ties' : 'A loop turner, for the straps', g.notions[g.notions.length - 1]], steps };
}

/**
 * A boned dress: the corset bodice flat-lined and seamed, joined to the skirt, the zip across the
 * waist, the side seams in one, then the boning, the waist stay (which carries the skirt), and the
 * lining over it all.
 */
export function bonedDressSteps(d: DressDraft, top: SewingGuide, skirt: SewingGuide, o: TopFinish & { waist: string; slit?: Slit; wide: boolean }): SewingGuide {
  const b = d.bodice;
  const c = bonedCore(b, o);
  const find = (g: SewingGuide, re: RegExp) => g.steps.filter((s) => re.test(s.title));
  const stay = c.bones.map((s) =>
    s.title === 'Attach the waist stay'
      ? {
          ...s,
          text: s.text
            .replace('along the waist line', 'along the waist seam')
            .replace('to each seam allowance and boning channel', "to the waist seam allowance at each seam and boning channel")
            .replace("it takes the strain at the waist, so the zip and the seams don't.", "it carries the weight of the skirt and holds the waist where it was fitted, so the zip never strains."),
        }
      : s,
  );
  const steps: SewStep[] = [
    top.steps[0],
    step(
      'Cut out',
      `Fold the fabric in half with the selvedges together. ${placeWords(b)}${o.wide ? '' : ' Place the skirt front on the fold and the skirt back on both layers.'}${
        o.wide ? ' The skirt pieces are too wide for folded fabric: cut them from a single layer, turning the pattern over for the second of each so you get pairs.' : ''
      } Keep each grain arrow parallel to the selvedge. Cut along the solid outer line, snip the small notches, and mark the bust point. Cut the bodice panels again from the coutil and again from the lining. On the coutil, chalk the boning lines and their end marks.${strapCut(b)}`,
    ),
    ...c.early,
    ...find(top, /^Sew the princess seams$/),
    ...find(skirt, /^Sew the .*darts?$/).map((s) => ({ ...s, title: 'Sew the skirt darts' })),
    ...find(skirt, /^Sew the centre front$/).map((s) => ({ ...s, title: 'Sew the skirt centre front' })),
    step(
      'Join the bodice to the skirt',
      `Pin the bodice front to the skirt front at the waist, right sides together, matching the centre front, the side edges and the princess seams to the skirt darts, so each runs on in one line. Pin each back half the same way. Sew ${o.waist} from the edge and press the seam up toward the bodice.`,
    ),
    step(
      'Put in the zip',
      `Sew a ${d.zipCm} cm invisible zip into the centre back edges, with the top of the teeth ${o.curve} below the top edge, across the waist seam, to the ZIP ENDS notch on the skirt. Sew one side, close the zip and mark where the waist seam crosses the other tape, so the waist meets exactly when you sew the second side.`,
    ),
    step('Close the centre back', `Sew the rest of the centre back seam, from the bottom of the zip ${toHem(o.slit, 'back')}, ${o.seam} from the edge. Press the seam open.${slitStop(o.slit, 'back')}`),
    step(
      'Sew the side seams',
      `Pin the front to the back at the sides, right sides together, from the top edge to the hem, matching the waist seams and the hip notches. Sew ${o.seam} from the edge in one seam. Try the dress on now, zipped: the bodice should hold you firmly at the waist and lie flat along the top edge, with no gap. Take it in or let it out at the side and princess seams if it needs it.`,
    ),
    ...stay,
    ...c.lining.map((s) =>
      s.title === 'Make the lining'
        ? { ...s, text: s.text.replace('Sew the lining panels', 'Sew the bodice lining panels') }
        : s.title === 'Finish the lining at the zip'
          ? { ...s, text: `${s.text} Turn the lining's waist edge under and slip-stitch it over the waist seam inside, covering the stay's stitches.` }
          : s,
    ),
    ...find(skirt, /^Hem$/),
    step('Finish', 'Sew a hook and eye at the top of the zip, inside the top edge. Give the dress a final press, over a ham at the bust.'),
  ];
  return { notions: bonedNotions(b, o, `${d.zipCm} cm invisible zip`, top.notions[0]), steps };
}

/** A top's edge finish: a boned bodice is always lined, and a cami has no shoulders to face (nor a wrap its edge). */
export function edgesFor(d: BodiceDraft, e: BodiceEdges): BodiceEdges {
  if (d.top?.boned) return 'lined';
  // A wrap's long front edge is bound or lined: a facing that long and curved would twist.
  if (d.wrap && e === 'facings') return 'lined';
  return d.top && e === 'facings' ? 'lined' : e;
}

/** The pattern notes for a top: its bones, grip, waist stay and straps. */
export function topNotes(d: BodiceDraft): string[] {
  const t = d.top;
  if (!t) return [];
  const out: string[] = [];
  if (t.boned) {
    const count = t.bones.reduce((s, b) => s + b.count, 0);
    out.push(
      `Boned like a corset: ${BONED_EASE.bust} cm ease at the bust and ${BONED_EASE.waist} cm at the waist, so it holds you. Cut every panel from the fabric, the coutil and the lining.`,
      `${count} bones (${t.bones.map((b) => `${b.where.toLowerCase()} ${b.count} x ${b.lengthCm} cm`).join(', ')}), each stopping ${BONE_STOP.top} cm below the top edge and ${BONE_STOP.waist} cm above the waist.${
        t.waistStay ? ` Waist stay: ${t.waistStay.lengthCm} cm of ${t.waistStay.widthCm} cm grosgrain.` : ''
      }`,
    );
  }
  if (t.grip) out.push(`The top edge is drafted ${t.grip} cm smaller round the body than you are, so it grips and stays up.`);
  if (t.ties) out.push(`A halter: the front rises to the neck, tied behind it with two ties, each ${t.ties.lengthCm} cm finished. Cut the strips ${t.ties.cutWidthCm} x ${t.ties.cutLengthCm} cm.`);
  if (t.straps)
    out.push(
      `Straps: two bias rouleaux, each ${t.straps.lengthCm} cm finished from the front top edge over the shoulder to the back, plus ${STRAP_ADJUST} cm to settle at the fitting. Cut the strips ${t.straps.cutWidthCm} x ${t.straps.cutLengthCm} cm.`,
    );
  return out;
}

// Plain-language sewing steps for the knit T-shirt, on a home sewing machine with a stretch or zigzag
// stitch, or an overlocker. Plain ASCII only: the PDF's standard font has no curly quotes.
import type { SewingGuide, SewStep } from './instructions';
import { STRETCH_WORDS } from './knits';
import { KNIT_HEM, KNIT_SEAM, KNIT_SLEEVE_HEM, NECKBAND_CM, TeeDraft } from './tee';

const n1 = (v: number) => `${v} cm`;

export function teeGuide(d: TeeDraft, fabricM: number, finish: { width?: number } = {}): SewingGuide {
  const seam = n1(KNIT_SEAM);
  const v = d.neckline === 'v';
  const pct = Math.round(d.neckband.ratio * 100);
  // The front cut longer at the centre for the bust: it looks uneven flat, and hangs level when worn.
  const bustHem =
    d.frontExtra >= 0.5
      ? `The front hem curves down ${n1(d.frontExtra)} lower at the centre than at the sides: that is the length the bust takes up, so the tee hangs level when worn. Press it up the same depth all along. `
      : '';
  const steps: SewStep[] = [
    {
      title: 'Print and check the size',
      text: 'Print the pattern at 100% (actual size). Measure the test square: it should be exactly 10 cm. Trim each page along the dashed line, then tape the pages together, matching the row letters and column numbers.',
    },
    {
      title: 'Cut out',
      text: `Fold the knit in half lengthwise, right sides together, with one rib running straight along the fold. Keep it all on the table: fabric hanging over the edge stretches and the pieces come out too long. Place the front and back against the fold and the sleeve on both layers, every grain line along the ribs, so the stretch runs round the body. Place the neckband against the fold too, lying across the fabric, so it stretches along its length. Use pattern weights and a rotary cutter, or sharp shears, and snip the notches no deeper than 3 mm.`,
    },
    {
      title: 'Set up your machine',
      text: `Fit a ballpoint or stretch needle (size 75 or 80) and use polyester thread, which gives a little. Sew every seam ${seam} from the edge with a narrow zigzag (width 1 to 1.5 mm, length 2.5 mm) or your machine's stretch stitch: a straight stitch snaps when the knit stretches. With an overlocker (serger), sew and neaten each seam in one pass, the knife trimming at ${seam}. A walking foot helps the layers feed evenly. Try it on a scrap first: the seam should stretch with the fabric without the stitches popping. Knits do not fray, so there are no edges to neaten.`,
    },
    {
      title: 'Sew the shoulders',
      text: `Pin the front to the back at the shoulders, right sides together. Lay a strip of clear elastic or stay tape along the seam line on the back shoulder, so the shoulders keep their shape, and sew through it ${seam} from the edge. Press the seams toward the back with a warm iron, lifting it rather than sliding it.`,
    },
    {
      title: 'Make the neckband',
      text: v
        ? `The neckband is ${pct}% of the neckline's length, so it pulls the neck in to lie flat. Fold it in half lengthwise, wrong sides together, and press lightly without stretching it. Staystitch the front neckline just inside ${seam} for 3 cm each side of the point of the V, then clip into the point, right up to the stitching. Mark the band's fold (the centre back) with a pin.`
        : `The neckband is ${pct}% of the neckline's length, so it pulls the neck in to lie flat. Sew its short ends right sides together, ${seam} from the edge, into a loop, and finger-press the seam open. Fold it in half lengthwise, wrong sides together, and press lightly without stretching it. Mark it in quarters with pins: the seam is the centre back, the fold the centre front, and the notches halfway between.`,
    },
    {
      title: 'Sew on the neckband',
      text: v
        ? `Pin the band's centre back to the tee's centre back, on the right side, raw edges together. Stretch the band, not the neckline, round to the front, and pin its ends at the V so each runs down to the clipped point and on past it, the right end crossing over the left. Sew ${seam} from the edge with the band on top, from the point up round the back and down to the point, stretching the band gently to fit as you go. Fold the band up, tack the crossed ends together inside and trim them. Press the seam toward the tee.`
        : `Fold the tee's neckline in half to find the centre front and centre back, then again for the quarters, and mark each with a pin. Pin the band to the right side of the neckline, raw edges together, matching the band's seam to the centre back and its pins to the neckline's. The band is shorter: stretch it, not the neckline, to fit between the pins. Sew ${seam} from the edge with the band on top, stretching it gently as you go. Press the seam toward the tee.`,
    },
    {
      title: 'Topstitch the neck',
      text: 'From the right side, stitch round the tee just below the neckband seam, about 6 mm from it, through the seam allowance underneath, with a twin needle or a long narrow zigzag. It keeps the seam flat and the band sitting up. This step is optional on an overlocked seam.',
    },
    {
      title: 'Sew in the sleeves',
      text: `Lay the tee open, right side up. Pin each sleeve's crown to its armhole, right sides together, matching the notch at the top of the sleeve to the shoulder seam, the single notches at the front and the double notches at the back. There is very little to ease in: a knit sleeve fits its armhole almost exactly. Sew ${seam} from the edge with the sleeve on top and press the seams toward the sleeve.`,
    },
    {
      title: 'Sew the side seams',
      text: `Fold the tee right sides together at the sides. Pin each side from the sleeve hem, through the underarm, to the body hem, matching the underarm seams. Sew ${seam} from the edge in one go and press the seams toward the back.`,
    },
    {
      title: 'Hem',
      text: `${bustHem}Press up ${n1(KNIT_SLEEVE_HEM)} at each sleeve hem and ${n1(KNIT_HEM)} at the body hem. A strip of fusible knit hem tape inside the fold stops the stitching rippling. From the right side, stitch ${n1(KNIT_SLEEVE_HEM - 0.5)} from the fold with a stretch twin needle, or a long narrow zigzag. Let the machine feed the knit: pulling it makes the hem wavy.`,
    },
    {
      title: 'Finish',
      text: 'Give the tee a light press with plenty of steam, holding the iron just above the knit, and let it cool flat before you try it on. Any slight waves at the hem or neck shrink back with the steam.',
    },
  ];
  return {
    notions: [
      `${fabricM.toFixed(1)} m of knit fabric, ${finish.width ?? 150} cm wide, ${STRETCH_WORDS[d.stretch]}`,
      `Neckband: from the same knit, or 0.2 m of 1x1 rib (finished ${n1(NECKBAND_CM)} wide)`,
      'Ballpoint or stretch machine needles, size 75 or 80',
      'Polyester all-purpose thread (with an overlocker, 3 or 4 cones)',
      '0.5 m clear elastic or stay tape, 6 mm wide, for the shoulders',
      'Stretch twin needle, 4 mm, for the hems (optional)',
      'Fusible knit hem tape, about 2 m (optional)',
    ],
    steps,
  };
}

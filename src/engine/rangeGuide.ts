// Plain-language sewing steps for the Garment range (2026-11-07): the knit dress and the hoodie, built on the
// T-shirt's steps, and the jumpsuit, a top and trousers joined at the waist. Plain ASCII only: the PDF's standard
// font has no curly quotes. All three are In testing until testers sew them.
import type { SewingGuide, SewStep } from './instructions';
import { teeGuide } from './teeGuide';
import { KNIT_HEM, KNIT_SEAM } from './tee';
import type { KnitDressDraft } from './knitDress';
import type { HoodieDraft } from './hoodie';
import type { JumpsuitDraft } from './jumpsuit';
import { SEAM_WIDTHS, type SeamWidths } from './allowances';

const n1 = (v: number) => `${v} cm`;
const seam = n1(KNIT_SEAM);
const has = (pieces: { name: string }[], name: string) => pieces.some((pc) => pc.name === name);

/** Replace the tee's steps by title, and put new ones after a named step. */
function edit(steps: SewStep[], swap: Record<string, SewStep | null>, after: Record<string, SewStep[]> = {}): SewStep[] {
  return steps.flatMap((s) => {
    const own = s.title in swap ? swap[s.title] : s;
    return [...(own ? [own] : []), ...(after[s.title] ?? [])];
  });
}

const ribBand = (what: string, cm: number, joinTo: string): SewStep => ({
  title: `Sew on the ${what}`,
  text: `The ${what} is cut shorter than the edge it goes on (${n1(cm)} round), so the rib hugs in. Sew its short ends right sides together into a loop, fold it in half lengthwise wrong sides together, and mark it and the ${joinTo} in quarters with pins. Pin it to the right side, raw edges together, matching the pins, and sew ${seam} from the edge with the band on top, stretching the band, not the ${joinTo}, to fit. Press the seam toward the garment.`,
});

export function knitDressGuide(d: KnitDressDraft, fabricM: number, finish: { width?: number } = {}): SewingGuide {
  const tee = teeGuide(d.tee, fabricM, finish);
  const skater = !!d.skater;
  const steps = edit(
    tee.steps,
    {
      'Cut out': {
        title: 'Cut out',
        text: `Fold the knit in half lengthwise, right sides together, with one rib running straight along the fold. Keep it all on the table: fabric hanging over the edge stretches and the pieces come out too long. Place the dress front and back against the fold${skater ? ', and the skirt front and back against the fold too' : ''}, and the sleeve on both layers, every grain line along the ribs, so the stretch runs round the body. Place the neckband against the fold, lying across the fabric, so it stretches along its length.${d.bands ? ' Cut the hem band and cuffs from rib, with the stretch along their length.' : ''} Use pattern weights and a rotary cutter, or sharp shears, and snip the notches no deeper than 3 mm.`,
      },
      'Sew the side seams': {
        title: 'Sew the side seams',
        text: `Fold the dress right sides together at the sides. Pin each side from the sleeve hem, through the underarm${skater ? ' to the waist' : ', past the waist and the hip, to the hem'}, matching the underarm seams and the notches. Sew ${seam} from the edge in one go and press the seams toward the back.${skater ? '' : ' A long seam in knit can grow: let the machine feed it and do not pull.'}`,
      },
      Hem: d.bands
        ? null
        : {
            title: 'Hem',
            text: `Let the dress hang for a day before you hem it: a knit drops a little${skater ? ', most of all on the bias of a skater skirt' : ''}. Try it on, check the hem is level and trim it if not. Press up ${n1(KNIT_HEM)} at the hem and 2 cm at each sleeve hem. A strip of fusible knit hem tape inside the fold stops the stitching rippling. From the right side, stitch 1.5 cm from the fold with a stretch twin needle, or a long narrow zigzag. Let the machine feed the knit: pulling it makes the hem wavy.`,
          },
    },
    {
      'Sew the side seams': [
        ...(skater
          ? [
              {
                title: 'Sew the skirt',
                text: `Sew the skirt front to the skirt back at the side seams, right sides together, ${seam} from the edge, and press the seams toward the back. Pin the skirt's waist to the bodice's waist, right sides together, matching the side seams, centre front and centre back. Sew ${seam} from the edge, with clear elastic (6 mm) laid along the seam line and sewn through, cut to the bodice's waist (${n1(d.skater!.waistCm)}) so the waist keeps its shape. Press the seam up toward the bodice.`,
              },
            ]
          : []),
        ...(d.bands
          ? [
              ribBand('hem band', d.bands.hemBand ?? 0, 'hem'),
              ribBand('cuffs', d.bands.cuff ?? 0, 'sleeve hem'),
            ]
          : []),
      ],
    },
  );
  return {
    notions: [
      ...tee.notions,
      ...(skater ? ['0.8 m clear elastic, 6 mm wide, for the waist seam'] : []),
      ...(d.bands ? ['0.5 m of 1x1 rib, 50 cm wide or more, for the hem band and cuffs'] : []),
    ],
    steps,
  };
}

export function hoodieGuide(d: HoodieDraft, fabricM: number, finish: { width?: number } = {}): SewingGuide {
  const tee = teeGuide(d.tee, fabricM, finish);
  const { front, pocket } = d.style;
  const zip = front === 'zip';
  const half = front === 'half_zip';
  const pocketStep: SewStep | undefined =
    pocket === 'kangaroo'
      ? {
          title: 'Sew on the pocket',
          text: `Press the pocket's curved openings under by 1 cm and topstitch them 6 mm from the fold with a long narrow zigzag. Press its top and bottom under by 1 cm. Pin it to the front, centred, with its lower edge on the hem's line, and topstitch it down along the top only. Tack its sides into the side seams and its lower edge into the hem${d.bands.hemBand ? ' band seam' : ''}.`,
        }
      : pocket === 'split'
        ? {
            title: 'Sew on the pockets',
            text: `Press each pocket's slanted opening under by 1 cm and topstitch it 6 mm from the fold. Press the top edge under by 1 cm. Pin a pocket to each front, the lower and outer edges level with the hem and side, and topstitch along the top edge. The sides and hem catch the rest.`,
          }
        : undefined;
  const hood: SewStep[] = [
    {
      title: 'Make the hood',
      text: `Sew each hood's centre seam, the curved one from the forehead over the crown to the nape, right sides together, ${seam} from the edge: the self hood, then the lining hood. Press the seams to one side. Put the lining inside the hood, right sides together, and sew them together round the face opening. Turn the hood right side out, press the opening flat and topstitch it 1.5 cm from the edge${zip || half ? '' : ' to make a channel for a cord if you want one, with two buttonholes either side of the centre before you sew'}. Tack the two necklines together just inside the seam line.`,
    },
    {
      title: 'Sew on the hood',
      text: `Pin the hood's neckline (${n1(d.hood.neckCm)}) to the hoodie's neckline, right sides together, matching the hood's centre seam to the centre back and its front edges ${zip ? 'to the zip line' : half ? 'to the top of the zip opening' : 'overlapping by 2 cm at the centre front'}. Sew ${seam} from the edge, and topstitch the seam allowance down toward the body, or bind it with a strip of the knit for a clean inside.`,
    },
  ];
  const zipStep: SewStep[] = zip
    ? [
        {
          title: 'Sew in the zip',
          text: `Use a ${n1(d.zipCm ?? 0)} open-ended (separating) zip. Iron a strip of fusible knit tape down each centre front edge so it doesn't stretch. Pin a zip tape to each front edge, right sides together, the teeth 1 cm in from the edge and the hood's front edge caught in at the top${d.bands.hemBand ? ', the bottom stop at the hem band seam' : ''}. Sew with a zipper foot, fold the edges back and topstitch 6 mm from the fold.`,
        },
      ]
    : half
      ? [
          {
            title: 'Sew in the half zip',
            text: `Use a ${n1(d.zipCm ?? 0)} closed-end zip. Mark the zip's length down the centre front. Pin the zip facing to the front, right sides together, centred on the line, and stitch a narrow box round the line, 6 mm each side of it and across its end. Cut down the centre and into the corners, turn the facing to the inside and press. Lay the zip behind the opening, pin and topstitch round it 6 mm from the folds.`,
          },
        ]
      : [];
  const steps = edit(
    tee.steps,
    {
      'Cut out': {
        title: 'Cut out',
        text: `Fold the sweatshirt fleece or French terry in half lengthwise, right sides together, the ribs or the grain straight along the fold. ${zip ? 'Place the back against the fold, and the two fronts on both layers' : 'Place the front and back against the fold'}, the sleeve, the hood and the hood lining on both layers, every grain line along the length. ${pocket !== 'none' ? 'Cut the pocket too. ' : ''}${half ? 'Cut the zip facing from the same fabric. ' : ''}Cut the${d.bands.hemBand ? ' hem band and' : ''} cuffs from rib, the stretch along their length. Snip the notches no deeper than 3 mm.`,
      },
      'Make the neckband': null,
      'Sew on the neckband': null,
      'Topstitch the neck': null,
      Hem: d.bands.hemBand
        ? null
        : {
            title: 'Hem',
            text: `Press up ${n1(KNIT_HEM)} at the body hem and topstitch it 2 cm from the fold with a long narrow zigzag or a twin needle.`,
          },
    },
    {
      'Set up your machine': [...(pocketStep ? [pocketStep] : []), ...zipStep],
      'Sew the shoulders': hood,
      'Sew the side seams': [...(d.bands.hemBand ? [ribBand('hem band', d.bands.hemBand, 'hem')] : []), ribBand('cuffs', d.bands.cuff ?? 0, 'sleeve hem')],
    },
  ).map((s) =>
    // The cuffs finish the sleeves, so the hem step is only the body's.
    s.title === 'Finish' ? { ...s, text: 'Give the hoodie a light press with plenty of steam, holding the iron just above the fabric, and let it cool flat before you try it on.' } : s,
  );
  return {
    notions: [
      tee.notions[0].replace('knit fabric', 'sweatshirt fleece or French terry'),
      `0.5 m of 1x1 rib, 50 cm wide or more, for the ${d.bands.hemBand ? 'hem band and ' : ''}cuffs`,
      ...(zip ? [`${n1(d.zipCm ?? 0)} open-ended (separating) zip, chunky or metal`, '1 m fusible knit stay tape, 1.5 cm wide'] : half ? [`${n1(d.zipCm ?? 0)} closed-end zip`] : []),
      ...tee.notions.slice(2).filter((l) => !/hem tape/.test(l) || !d.bands.hemBand),
      ...(!zip && !half ? ['1.5 m cord and two cord stops, for the hood (optional)'] : []),
    ],
    steps,
  };
}

export function jumpsuitGuide(d: JumpsuitDraft, fabricM: number, finish: { width?: number; seams?: SeamWidths } = {}): SewingGuide {
  const sw = finish.seams ?? SEAM_WIDTHS.home;
  const s = n1(sw.seam);
  const buttons = d.closure === 'front_buttons';
  const collar = has(d.pieces, 'Collar');
  const sleeve = !!d.sleeve;
  const shorts = d.pieces.some((pc) => /^Shorts /.test(pc.name));
  const legs = shorts ? 'shorts' : 'legs';
  const band = has(d.pieces, 'Sleeve band');
  const steps: SewStep[] = [
    {
      title: 'Print and check the size',
      text: 'Print the pattern at 100% (actual size). Measure the test square: it should be exactly 10 cm. Trim each page along the dashed line, then tape the pages together, matching the row letters and column numbers.',
    },
    {
      title: 'Make a toile first',
      text: `A jumpsuit has to fit at the bust, the waist, the hip and down the body at once. Sew the top and ${legs} in calico or an old sheet, join them at the waist and try it on, sitting down as well as standing. If it pulls at the crotch when you sit, it is too short in the body: let the waist seam out on the toile and add that to the pattern.`,
    },
    {
      title: 'Cut out',
      text: `Fold the fabric right sides together, selvedges matching. Place the pieces with every grain line parallel to the selvedge, the ${legs} with their crease line on the grain. Cut ${buttons ? 'the facings and collar' : 'the facings'} from the same fabric and iron interfacing to them. Mark the darts, notches and ${buttons ? 'buttonholes' : 'the end of the zip'} with chalk or tailor's tacks.`,
    },
    {
      title: 'Sew the darts',
      text: `Sew the darts on the top's front and back and on the ${legs}, from the wide end to the point, and knot the threads at the point. Press the front darts down and the back darts toward the centre.`,
    },
    {
      title: 'Sew the top',
      text: `Sew the shoulder seams and the side seams of the top, right sides together, ${s} from the edge. Neaten the edges with zigzag or an overlocker and press them open.`,
    },
    ...(collar
      ? [
          {
            title: 'Make the collar',
            text: `Sew the collar's outer edges to its facing, right sides together, trim, turn and press. Sandwich it between the collar stands, sew round, trim and turn. Sew the stand to the neckline, matching the centre backs, and close the inner stand by hand or by stitching in the ditch.`,
          },
        ]
      : []),
    ...(buttons
      ? [
          {
            title: 'Face the front',
            text: `Sew the front facings to the back neck facing at the shoulders. Pin the facing to the front edges, right sides together, and sew from the hem of the top up to the neck${collar ? ', catching the collar stand' : ' and round the neckline'}. Trim, turn the facing inside and press. Understitch where you can.`,
          },
        ]
      : [
          {
            title: 'Finish the neck and armholes',
            text: `Finish the neckline${sleeve ? '' : ' and armholes'} with bias binding: open one fold, pin it to the right side along the edge, sew in the fold, then turn it to the inside, press and topstitch 6 mm from the edge. ${has(d.pieces, 'Bodice front') && !sleeve ? 'For straps, sew a tube of bias, turn it and sew it in at the marks before you bind.' : ''}`.trim(),
          },
        ]),
    ...(sleeve
      ? [
          {
            title: 'Set in the sleeves',
            text: `Sew two rows of long stitches over the sleeve's crown between the notches. Sew the sleeve's underarm seam and press it open. Pin the sleeve into the armhole, right sides together, matching the top notch to the shoulder seam, draw up the threads to ease in the crown, and sew ${s} from the edge with the sleeve on top. Neaten the seam together and press it toward the sleeve.${band ? ' Sew the band into a loop, fold it in half and sew it to the sleeve hem, gathering the sleeve to fit.' : ''}`,
          },
        ]
      : []),
    {
      title: `Sew the ${legs}`,
      text: `Sew each ${shorts ? 'side' : 'leg'}'s inside leg seam and outside seam, right sides together, ${s} from the edge, and neaten them. Turn one leg right side out and put it inside the other, right sides together, and sew the crotch seam ${buttons ? 'from the back waist round to the fly mark' : 'from the front waist round to the zip mark at the back'}. Sew it twice on the curve and clip it, then neaten it.`,
    },
    ...(buttons
      ? [
          {
            title: 'Sew the fly',
            text: `Sew in a ${n1(d.zipCm)} trouser zip in the fly with its facing and shield, as for trousers. The buttons on the top meet the fly at the waist seam.`,
          },
        ]
      : []),
    {
      title: 'Join the top to the legs',
      text: `Pin the top to the ${legs} at the waist, right sides together, matching the side seams, the centre front and the centre back, and the darts on the top to the darts below. Sew ${s} from the edge, with a strip of stay tape along the seam line so the waist doesn't stretch, and press the seam up toward the top.`,
    },
    ...(buttons
      ? [
          {
            title: 'Buttons',
            text: 'Make the buttonholes down the right front (left for menswear) at the marks, and sew the buttons on the other front to match.',
          },
        ]
      : [
          {
            title: 'Sew in the zip',
            text: `Sew a ${n1(d.zipCm)} invisible zip into the centre back, from the neck down to the mark ${n1(20)} below the waist, with an invisible zipper foot. Close the rest of the crotch seam below it, then fold the facing or binding ends in over the zip tape and slip-stitch them down.`,
          },
        ]),
    {
      title: 'Hem',
      text: `Try the jumpsuit on with the shoes you will wear and pin up the hem. Press up the allowance${sleeve && !band ? ' at the sleeves and' : ''} at the ${legs}, turn the raw edge under and stitch by hand or machine.`,
    },
    { title: 'Finish', text: 'Press the jumpsuit all over on the wrong side, with a pressing cloth on the right side wherever you need to.' },
  ];
  return {
    notions: [
      `${fabricM.toFixed(1)} m of woven fabric, ${finish.width ?? 140} cm wide`,
      buttons ? `A ${n1(d.zipCm)} trouser zip, and ${collar ? '7' : '6'} buttons, 1.5 cm` : `A ${n1(d.zipCm)} invisible zip`,
      ...(buttons ? ['0.5 m lightweight fusible interfacing'] : ['2.5 m bias binding, 12 mm wide']),
      '1 m stay tape, 1 cm wide, for the waist seam',
      'All-purpose polyester thread',
    ],
    steps,
  };
}

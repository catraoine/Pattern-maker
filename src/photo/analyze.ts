// Server side only: asks Claude which garment a photo shows and which of its style options. Imported by the Netlify function,
// never by the app, so the API key and SDK stay off the phone.
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { IMAGE_TYPES, MAX_IMAGE_BYTES, PhotoError, PhotoReading, PhotoResponse, READ_COLOURS } from './types';

const confidence = z.enum(['low', 'medium', 'high']);

const fit = z.object({ value: z.enum(['fitted', 'regular', 'relaxed']), confidence });
export const piece = z.enum(['skirt', 'dress', 'top', 'tee', 'trousers', 'jacket', 'coat']);

const Top = z.object({
  fit,
  neckline: z.enum(['crew', 'scoop', 'v', 'square', 'boat', 'one_shoulder', 'cowl', 'strapless', 'sweetheart', 'cami', 'halter']),
  sleeve: z.enum(['none', 'short', 'elbow', 'three_quarter', 'long']),
  sleeveShape: z.enum(['fitted', 'straight', 'puff', 'bishop', 'cap', 'flutter']),
  length: z.enum(['cropped', 'waist', 'high_hip', 'hip', 'tunic']),
  seams: z.enum(['darts', 'princess', 'none']),
  opening: z.enum(['back', 'front_buttons']),
  collar: z.enum(['none', 'peter_pan', 'mandarin', 'shirt']),
  peplum: z.enum(['none', 'flared', 'gathered']),
  boned: z.boolean(),
  knit: z.boolean(),
  waistSeam: z.boolean(),
  waistSeamAt: z.enum(['none', 'empire', 'raised', 'natural', 'dropped', 'low']),
  belt: z.enum(['none', 'sash', 'loops', 'ties']),
});

const Fabric = z.object({
  type: z.enum(['plain', 'denim', 'leather', 'velvet', 'corduroy', 'sheer', 'satin', 'lace', 'sequins', 'knit', 'fleece', 'chiffon', 'crepe', 'gauze']),
  colour: z.enum(READ_COLOURS),
  print: z.enum(['none', 'checks', 'stripes', 'floral', 'animal', 'abstract', 'border']),
  sheer: z.boolean(),
});

const Trousers = z.object({
  fit,
  leg: z.enum(['straight', 'wide', 'tapered', 'culotte']),
  length: z.enum(['shorts', 'knee', 'capri', 'cropped', 'ankle', 'full']),
  elasticWaist: z.boolean(),
  opening: z.enum(['fly', 'side_zip']),
  pockets: z.enum(['none', 'inseam', 'slant']),
});

const Outer = z.object({
  fit,
  length: z.enum(['cropped', 'hip', 'long', 'thigh', 'knee', 'midi']),
  front: z.enum(['single', 'double', 'zip']),
  collar: z.enum(['notched', 'stand', 'collarless', 'hood']),
  pockets: z.enum(['none', 'patch', 'welt']),
  shaping: z.enum(['darts', 'princess', 'boxy']),
  pads: z.enum(['none', 'soft', 'structured']),
  flare: z.enum(['straight', 'a_line']),
  sleeve: z.enum(['set_in', 'raglan']).optional(),
  trim: z.enum(['none', 'rib']).optional(),
});

export const Reading = z.object({
  garment: z.enum(['skirt', 'dress', 'top', 'tee', 'trousers', 'jacket', 'coat', 'other', 'none']),
  pieces: z.array(z.object({ garment: piece, x: z.number(), y: z.number() })),
  silhouette: z.object({ value: z.enum(['pencil', 'straight', 'a_line', 'trumpet', 'half_circle', 'circle']), confidence }),
  length: z.object({ value: z.enum(['mini', 'above_knee', 'knee', 'midi', 'maxi']), confidence }),
  fit,
  shape: z.object({ hemAt: z.number(), hemFullness: z.number(), flareAt: z.number().nullable(), confidence }),
  extras: z.object({
    volume: z.enum(['none', 'knife', 'box', 'inverted', 'godets', 'hem_flounce', 'tiers']),
    asymHem: z.enum(['none', 'high_low', 'diagonal']),
    pockets: z.boolean(),
    elasticWaist: z.boolean(),
  }),
  top: Top.nullable(),
  trousers: Trousers.nullable(),
  outer: Outer.nullable(),
  fabric: Fabric.nullable(),
  worn: z.boolean(),
  details: z.string(),
});

export const SYSTEM = `You help home sewists turn a photo of a garment into a sewing pattern. The garment may be worn, on a hanger, or laid flat, and in any size: the app drafts it to the sewist's own measurements, so your job is only to read the style. The app drafts skirts, dresses (a bodice joined to a skirt at the waist, with a back zip), woven tops, knit T-shirts, trousers, jackets and coats.

- garment: the main item in the photo: "skirt", "dress", "top" (a woven top or blouse), "tee" (a T-shirt or other knit jersey top), "trousers" (including shorts and culottes), "jacket", "coat", "other" (clothing the app doesn't draft, such as a jumpsuit, knitwear or a bag) or "none" if there is no clothing. A jacket ends at or above the upper thigh; a coat is longer.
- pieces: every separate garment the app drafts that is clearly shown, the main one first, each with x and y, the middle of that garment as fractions of the photo's width and height (0 to 1 from the top left). A dress is one piece. A top tucked into a skirt is two pieces. Leave out partly hidden layers and accessories.

The skirt fields (silhouette, length, fit, shape, extras) describe the skirt, or the skirt part of a dress. Always fill them in: if the photo has no skirt, give your best skirt reading of whatever is below the waist, with low confidence.

Pick the closest option in each group:
- silhouette:
  - "pencil" narrows toward the hem.
  - "straight" hangs straight down from the hip.
  - "a_line" widens gently and evenly from the hip to the hem, keeping a clean outline without deep folds.
  - "trumpet" stays close to the body through the hips and thighs, then flares out lower down, usually from around the knee (also called mermaid, fishtail, godet or Edwardian walking skirt).
  - "half_circle" is smooth at the waist and falls into soft folds, noticeably fuller than an A-line; laid flat it makes a half circle (skater skirts are often half circles).
  - "circle" is very full, with deep folds all round the hem; laid flat it makes a whole circle (1950s circle skirts, ra-ra skirts). A skirt that is full because it is gathered or pleated into the waist, rather than smooth at the waist, is not a circle skirt: pick the closest shape and mention the gathers or pleats in details.
- length, where the hem falls on the wearer: "mini" (mid-thigh), "above_knee", "knee", "midi" (mid-calf), "maxi" (near the ankle). For a skirt laid flat or on a hanger, estimate from its proportions and use low confidence.
- fit, how much room there is round the hips: "fitted" only when the fabric clearly lies close across the hips and seat, like a pencil skirt; "regular" (some room) for most skirts, including any that flare out from the waist, where the hips can't be seen; "relaxed" (loose). A snug waistband alone does not make a skirt fitted. When unsure, choose "regular".
- shape: the exact proportions, so the pattern can match the photo rather than a standard shape. Measure them against the wearer's body, not the photo frame:
  - hemAt: where the hem falls, as a fraction of the distance from the natural waist (0) down to the floor (1). On a typical body the hip line is about 0.2, mid-thigh 0.38, just above the knee 0.5, the knee 0.56, mid-calf 0.76 and the ankle 0.93. For a skirt that sits below the natural waist, still measure from the natural waist.
  - hemFullness: the hem's circumference divided by the circumference round the hips. Judge it from how far the hem stands out from the hips and how deep and many the folds are. A pencil skirt is about 0.85 to 0.95, a straight skirt 1, an A-line 1.2 to 1.8, a half circle skirt about 2.5 to 3.5 and a full circle skirt 4 to 6 (more for a long one). Use any number in between that fits what you see.
  - flareAt: for a trumpet skirt, where the flare starts, as a fraction of waist to floor like hemAt (around the knee is 0.5 to 0.56). null for every other silhouette.

- extras, details of the skirt the app can draft (use "none" or false when the skirt has none):
  - volume: "knife" pleats (all folded one way), "box" pleats, "inverted" pleats (folds meeting at a centre), "godets" (triangular panels set into the hem), "hem_flounce" (one gathered or flared band at the hem) or "tiers" (two or more gathered bands, each fuller than the one above). Gathers into the waist are not any of these: use "none" and mention them in details.
  - asymHem: "high_low" (shorter at the front than the back) or "diagonal" (one side longer than the other).
  - pockets: true when there are pockets in the side seams.
  - elasticWaist: true for a pull-on, gathered elastic waist.

top: fill this in for a top, a T-shirt, the bodice of a dress, or a top worn under an open jacket; otherwise null.
- fit: how close it sits round the bust and waist, judged like the skirt's fit. When unsure, choose "regular".
- neckline: "crew" (round, close to the neck), "scoop" (lower round), "v", "square", "boat" (wide and shallow, shoulder to shoulder), "one_shoulder", "cowl" (draped folds at the front), "strapless" (straight across), "sweetheart" (strapless with two curves over the bust), "cami" (thin straps), "halter" (rises to the neck and ties or fastens behind it, shoulders bare).
- sleeve: "none", "short", "elbow", "three_quarter" or "long". sleeveShape: "fitted" (narrow, close to the arm), "straight", "puff" (gathered at the shoulder and the band), "bishop" (long, full, gathered into a cuff), "cap" (a tiny sleeve just covering the shoulder, short only) or "flutter" (short, flared and rippling at the hem, short only). Use "straight" when there are no sleeves.
- length: where its hem falls: "cropped" (above the waist), "waist", "high_hip", "hip" or "tunic" (to the upper thigh). For a dress, use "waist".
- seams: "princess" when long shaping seams run down the front over the bust, "darts" when it is shaped with darts or is close-fitting without visible seams, "none" for a loose, unshaped top.
- opening: "front_buttons" when it buttons down the front, otherwise "back".
- collar: "none", "peter_pan" (flat and rounded), "mandarin" (a short stand-up band) or "shirt" (a stand with a turned-down collar).
- peplum: a short flared or gathered frill below the waist: "none", "flared" or "gathered".
- boned: true for a corset-like bodice with visible boning or a rigid, close-fitted shape.
- knit: true when the fabric is a stretchy jersey or knit (a T-shirt), false for a woven fabric (a blouse, a shirt, a dress bodice in cotton or silk).
- waistSeam: for a dress, true when a seam joins bodice and skirt at the natural waist. false for a shift, wrap or empire-line dress, and for anything that isn't a dress.
- waistSeamAt: for a dress, where the seam between bodice and skirt sits: "empire" (just under the bust), "raised" (between the bust and the waist), "natural" (at the waist), "dropped" (at the high hip), "low" (near the hip), or "none" for a dress cut in one piece from shoulder to hem (a sheath, a shift, a slip). Use "natural" for anything that isn't a dress.
- belt: what is at the waist: "sash" (a tie sash or a tie belt in the same fabric), "loops" (belt loops, with or without a belt in them), "ties" (narrow ties that knot, as on a wrap), or "none".

fabric: fill this in for the main garment whenever there is one; null only when garment is "none".
- type: what the cloth is: "denim", "leather" (including faux leather), "velvet", "corduroy", "sheer" (organza, mesh, tulle), "satin" (a shine), "lace", "sequins", "knit" (jersey, rib, sweatshirting), "fleece" (fleece, boucle, shearling, teddy), "chiffon" (a sheer, floaty woven), "crepe" (a matte, pebbled surface), "gauze" (a crinkled open cotton), or "plain" for any other woven cotton, linen, wool or silk.
- colour: the garment's main colour, the nearest of: ${READ_COLOURS.slice(0, -1).map((c) => `"${c}"`).join(', ')}, or "other" when none is close (a bright pink, a green that isn't olive or emerald). For a print, the ground colour.
- print: "checks" (gingham, plaid, tartan, windowpane), "stripes", "floral", "animal" (leopard, zebra, snake), "abstract" (a marble, a paint, geometric shapes, a toile or any other pattern), "border" (a print that runs along the hem only), or "none" for plain cloth or a texture.
- sheer: true when the cloth is see-through or partly so (a chiffon skirt showing the legs, a mesh panel), false otherwise.

trousers: fill this in for trousers, shorts or culottes; otherwise null.
- fit: "fitted" only when close through the hip and thigh, otherwise "regular" or "relaxed".
- leg: "straight", "wide" (widening toward the hem), "tapered" (narrowing toward the ankle) or "culotte" (wide and cut off below the knee). length: "shorts" (mid-thigh), "knee", "capri" (below the calf), "cropped" (a hand above the ankle), "ankle" (just above the ankle bone) or "full".
- elasticWaist: true for a pull-on elastic waist. opening: "fly" (a front zip under a flap) or "side_zip". pockets: "none", "inseam" (in the side seams) or "slant" (angled openings at the front hip).

outer: fill this in for a jacket or a coat; otherwise null.
- fit: as for a top. length: a jacket is "cropped" (above the hip), "hip" or "long" (to the upper thigh); a coat is "thigh" (mid-thigh), "knee" or "midi".
- front: "single" (one row of buttons), "double" (two rows of buttons, overlapping fronts) or "zip" (a zip up the centre front). collar: "notched" (a lapel with a notch), "stand", "collarless" or "hood".
- sleeve: "raglan" when a seam runs from the neck to the underarm with no shoulder seam, otherwise "set_in". trim: "rib" when the hem and cuffs are stretchy ribbed bands (as on a bomber), otherwise "none".
- pockets: "patch" (sewn on top), "welt" (set-in slits or flaps) or "none". shaping: "princess" (long seams down the front), "darts" or "boxy" (straight and unshaped).
- pads: "structured" for sharp, built-up shoulders, "soft" for a natural shoulder line, "none" for a soft, unstructured jacket. flare: "a_line" for a coat that widens below the hip, otherwise "straight".

worn: true when a person or a full-length mannequin is wearing the main garment, so where it ends can be measured against the body; false when it is laid flat, on a hanger or on a dress form without legs.

Confidence (for each group, and for the shape as a whole): "high" when the photo clearly shows it, "medium" when it is a reasonable reading, "low" when you are guessing (cropped, folded, odd angle, or not that garment).

details: one short, friendly sentence naming design features of the main garment that none of the fields above cover, which the sewist may want to add themselves (for example gathers, a front slit, patch pockets on a skirt, a yoke, a ruffle at the neck, a wrap front, a hood). Leave it empty if there are none. If the item is "other", still fill in your best reading and say what the item is.`;

export interface AnalyzeInput {
  image: string; // base64, no data: prefix
  mediaType: string;
}

/**
 * The monthly spend limit set in the Claude Console was reached (a 400 "specified API usage limits", or the tier cap's
 * 429). Shown as "resting" rather than as a bad photo, and nothing more is spent until the limit resets or is raised.
 */
export const spendLimitReached = (e: unknown) =>
  e instanceof Anthropic.APIError && (e.status === 400 || e.status === 429) && /API usage limit/i.test(e.message);

/** Cheap checks on the upload, done before anything that costs money. */
export function checkPhoto(input: AnalyzeInput): PhotoError | null {
  if (typeof input?.image !== 'string' || !(IMAGE_TYPES as readonly string[]).includes(input.mediaType)) return 'bad_image';
  if (input.image.length > MAX_IMAGE_BYTES) return 'too_large';
  return null;
}

/** Validate the upload, ask Claude, and turn every outcome into a PhotoResponse the app can show. */
export async function analyzePhoto(input: AnalyzeInput, client: Anthropic | null): Promise<PhotoResponse> {
  if (!client) return { ok: false, error: 'not_configured' };
  const bad = checkPhoto(input);
  if (bad) return { ok: false, error: bad };

  try {
    const response = await client.beta.messages.parse({
      model: 'claude-opus-5-5',
      // A reading is a few hundred words at most; the ceiling bounds what one request can ever cost (about 16 cents).
      max_tokens: 8000,
      // Reading a photo is a quick classification, so low effort keeps it fast and cheap.
      output_config: { effort: 'low', format: betaZodOutputFormat(Reading) },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: input.mediaType as (typeof IMAGE_TYPES)[number], data: input.image },
            },
            { type: 'text', text: 'Read the garment style in this photo.' },
          ],
        },
      ],
    });
    // Logged so the real cost per reading shows in Netlify's function logs.
    console.log('photo reading tokens', { in: response.usage?.input_tokens, out: response.usage?.output_tokens });
    if (response.stop_reason === 'refusal') return { ok: false, error: 'declined' };
    const reading = response.parsed_output as PhotoReading | null;
    return reading ? { ok: true, reading } : { ok: false, error: 'failed' };
  } catch (e) {
    if (spendLimitReached(e)) return { ok: false, error: 'busy' };
    if (e instanceof Anthropic.BadRequestError) return { ok: false, error: 'bad_image' };
    console.error('analyzePhoto failed', e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e);
    return { ok: false, error: 'failed' };
  }
}

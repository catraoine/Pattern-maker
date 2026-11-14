// Era lines: each era's whole line, not only its skirts (Cat, 2026-11-11: "We need full garment line eras"). Every era
// gets a top, a dress, and a trouser, jacket or coat beside its two skirt looks. Each piece is a preset of choices the
// app already drafts, so no pattern changes: picking one sets the choices, and any of them can be changed after. They
// sit under the collection's In testing tag, and each is draped in CLO before the tag comes off (Cat: "make sure they
// are all clo checked").
import { COLLECTION, HouseLook, bodiceChoices as bodice, dressChoices as dress, skirtLook } from './collection';
import { ERAS } from './engine/eras';
import { DEFAULT_COAT_CHOICES, DEFAULT_JACKET_CHOICES, DEFAULT_TROUSERS_CHOICES, OuterChoices, TrousersChoices } from './garments';

interface EraPiece extends HouseLook {
  /** The era it belongs to, by its id in ERAS. */
  era: string;
}

const PIECES: Omit<EraPiece, 'number'>[] = [
  // Edwardian
  { era: 'edwardian', id: 'ed-blouse', name: 'Edwardian high-neck blouse', fabric: 'Ivory cotton lawn', garment: 'bodice', line: 'A standing collar, buttons down the front and long full sleeves gathered into a cuff.',
    choices: bodice({ fit: 'relaxed', neckline: 'crew', collar: 'funnel', closure: 'front_buttons', sleeve: 'long', sleeveShape: 'bishop', sleeveFullness: 'full', sleeveCuff: 'shirt', length: 'high_hip' }) },
  { era: 'edwardian', id: 'ed-dress', name: 'Edwardian afternoon dress', fabric: 'Lilac cotton voile', garment: 'dress', line: 'A high collar and long, close sleeves over a skirt that flares out below the knee to the ankle.',
    choices: dress('regular', { neckline: 'crew', collar: 'funnel', sleeve: 'long', sleeveShape: 'fitted' }, { silhouette: 'trumpet', length: 'maxi', flareCm: 26 }) },
  { era: 'edwardian', id: 'ed-jacket', name: 'Edwardian walking jacket', fabric: 'Navy wool suiting', garment: 'jacket', line: 'Fitted through the waist with princess seams, flaring over the hip.',
    choices: <OuterChoices>{ ...DEFAULT_JACKET_CHOICES, fit: 'fitted', shaping: 'princess', length: 'hip', flare: 'flared', pads: 'none', pockets: 'none' } },
  // 1920s
  { era: '1920s', id: '20-top', name: 'Twenties tunic', fabric: 'Butter silk crepe de chine', garment: 'bodice', line: 'Loose and sleeveless with a V neck, falling straight to the hip.',
    choices: bodice({ fit: 'relaxed', neckline: 'v', darts: 'none', sleeve: 'none', length: 'hip' }) },
  { era: '1920s', id: '20-dress', name: 'Drop-waist dress', fabric: 'Blush silk crepe de chine', garment: 'dress', line: 'A straight, easy bodice to a low waist seam, then a knee-length skirt.',
    choices: { ...dress('relaxed', { neckline: 'boat', sleeve: 'none', darts: 'none' }, { silhouette: 'straight', length: 'knee' }), waistSeam: 'low' } },
  { era: '1920s', id: '20-coat', name: 'Twenties shawl coat', fabric: 'Camel wool velour', garment: 'coat', line: 'A relaxed knee-length coat with a deep shawl collar.',
    choices: <OuterChoices>{ ...DEFAULT_COAT_CHOICES, fit: 'relaxed', length: 'knee', collar: 'shawl', lapel: 'plunge', shaping: 'boxy', flare: 'straight', pads: 'none', pockets: 'none' } },
  // 1930s
  { era: '1930s', id: '30-top', name: 'Thirties cowl blouse', fabric: 'Ivory silk satin', garment: 'bodice', line: 'A soft cowl at the front, cut on the bias, with fluttering short sleeves.',
    choices: bodice({ fit: 'regular', neckline: 'cowl', sleeve: 'short', sleeveShape: 'flutter', length: 'high_hip' }) },
  { era: '1930s', id: '30-dress', name: 'Thirties halter gown', fabric: 'Black crepe-backed satin', garment: 'dress', line: 'A halter neck over a fitted body and a fluted skirt to the ankle.',
    choices: dress('fitted', { neckline: 'halter', sleeve: 'none' }, { silhouette: 'trumpet', length: 'maxi' }) },
  { era: '1930s', id: '30-trousers', name: 'Beach pyjama trouser', fabric: 'Navy linen', garment: 'trousers', line: 'High at the waist and wide all the way to the floor, with one pleat.',
    choices: <TrousersChoices>{ ...DEFAULT_TROUSERS_CHOICES, fit: 'relaxed', leg: 'wide', length: 'full', rise: 'high', closure: 'side_zip', pleats: 'single' } },
  // 1940s
  { era: '1940s', id: '40-top', name: 'Forties blouse', fabric: 'Butter viscose crepe', garment: 'bodice', line: 'A shirt collar, buttons down the front and short puffed sleeves.',
    choices: bodice({ fit: 'regular', neckline: 'crew', collar: 'shirt', closure: 'front_buttons', sleeve: 'short', sleeveShape: 'puff', length: 'high_hip' }) },
  { era: '1940s', id: '40-dress', name: 'Forties tea dress', fabric: 'Cobalt viscose crepe', garment: 'dress', line: 'A V neck and puffed short sleeves over a trim A-line skirt to the knee.',
    choices: dress('regular', { neckline: 'v', sleeve: 'short', sleeveShape: 'puff' }, { silhouette: 'a_line', length: 'knee' }) },
  { era: '1940s', id: '40-jacket', name: 'Utility jacket', fabric: 'Olive wool flannel', garment: 'jacket', line: 'Square shoulders, a notched lapel and flap pockets, to the hip.',
    choices: <OuterChoices>{ ...DEFAULT_JACKET_CHOICES, fit: 'fitted', pads: 'structured', pockets: 'flap', length: 'hip', vent: 'none' } },
  // 1950s
  { era: '1950s', id: '50-top', name: 'Fifties Peter Pan blouse', fabric: 'Aqua cotton poplin', garment: 'bodice', line: 'A round Peter Pan collar, front buttons and little cap sleeves.',
    choices: bodice({ fit: 'fitted', neckline: 'crew', collar: 'peter_pan', closure: 'front_buttons', sleeve: 'short', sleeveShape: 'cap', length: 'high_hip' }) },
  { era: '1950s', id: '50-dress', name: 'Wiggle dress', fabric: 'Burgundy wool crepe', garment: 'dress', line: 'A square neck and a close pencil skirt to the knee.',
    choices: dress('fitted', { neckline: 'square', sleeve: 'short', sleeveShape: 'cap' }, { silhouette: 'pencil', length: 'knee' }) },
  { era: '1950s', id: '50-trousers', name: 'Cigarette capri', fabric: 'Black cotton sateen', garment: 'trousers', line: 'High-waisted and slim, tapering to mid-calf, with a side zip.',
    choices: <TrousersChoices>{ ...DEFAULT_TROUSERS_CHOICES, fit: 'fitted', leg: 'tapered', length: 'capri', rise: 'high', closure: 'side_zip' } },
  // 1960s
  { era: '1960s', id: '60-top', name: 'Mod shell', fabric: 'Chartreuse wool crepe', garment: 'bodice', line: 'A boat neck, no sleeves, and a clean line to the high hip.',
    choices: bodice({ fit: 'relaxed', neckline: 'boat', darts: 'bust', sleeve: 'none', length: 'high_hip' }) },
  { era: '1960s', id: '60-dress', name: 'Empire mini', fabric: 'Cobalt wool crepe', garment: 'dress', line: 'A Peter Pan collar and long sleeves over an A-line mini from a high waist.',
    choices: { ...dress('regular', { neckline: 'crew', collar: 'peter_pan', sleeve: 'long', sleeveShape: 'fitted' }, { silhouette: 'a_line', length: 'mini' }), waistSeam: 'empire' } },
  { era: '1960s', id: '60-coat', name: 'Mod A-line coat', fabric: 'White wool melton', garment: 'coat', line: 'Collarless and double-breasted, flaring gently to mid-thigh.',
    choices: <OuterChoices>{ ...DEFAULT_COAT_CHOICES, fit: 'regular', length: 'thigh', collar: 'collarless', front: 'double', flare: 'a_line', pockets: 'welt', shaping: 'boxy', pads: 'none' } },
  // 1970s
  { era: '1970s', id: '70-top', name: 'Pussy-bow blouse', fabric: 'Rust silk crepe de chine', garment: 'bodice', line: 'A soft bow at the neck and full bishop sleeves.',
    choices: bodice({ fit: 'relaxed', neckline: 'crew', collar: 'bow', sleeve: 'long', sleeveShape: 'bishop', sleeveFullness: 'full', sleeveCuff: 'shirt', length: 'high_hip' }) },
  { era: '1970s', id: '70-dress', name: 'Seventies wrap maxi', fabric: 'Brown viscose crepe', garment: 'dress', line: 'A wrap front, long bishop sleeves and an A-line skirt to the ankle.',
    choices: dress('regular', { neckline: 'v', closure: 'wrap', sleeve: 'long', sleeveShape: 'bishop' }, { silhouette: 'a_line', length: 'maxi' }) },
  { era: '1970s', id: '70-trousers', name: 'High-rise flares', fabric: 'Cotton denim', garment: 'trousers', line: 'High at the waist, close over the hip and knee, flaring wide to the floor.',
    choices: <TrousersChoices>{ ...DEFAULT_TROUSERS_CHOICES, fit: 'fitted', leg: 'flare', length: 'full', rise: 'high' } },
  // 1980s
  { era: '1980s', id: '80-top', name: 'Eighties slouch top', fabric: 'Lilac viscose crepe', garment: 'bodice', line: 'Oversized, with a wide boat neck and dropped shoulders.',
    choices: bodice({ fit: 'oversized', neckline: 'boat', sleeve: 'long', sleeveShape: 'straight', sleeveCut: 'drop', length: 'hip', darts: 'none' }) },
  { era: '1980s', id: '80-dress', name: 'Puff-sleeve party dress', fabric: 'Emerald silk taffeta', garment: 'dress', line: 'Big puffed sleeves and a V neck over a pencil skirt to the knee.',
    choices: dress('fitted', { neckline: 'v', sleeve: 'short', sleeveShape: 'puff', sleeveFullness: 'full' }, { silhouette: 'pencil', length: 'above_knee' }) },
  { era: '1980s', id: '80-jacket', name: 'Power blazer', fabric: 'Grey wool gabardine', garment: 'jacket', line: 'Big padded shoulders, a peak lapel and two rows of buttons, long and easy.',
    choices: <OuterChoices>{ ...DEFAULT_JACKET_CHOICES, fit: 'relaxed', shaping: 'boxy', length: 'long', pads: 'structured', collar: 'peak', front: 'double', pockets: 'flap', shoulderCm: 3 } },
  // 1990s
  { era: '1990s', id: '90-top', name: 'Nineties cami', fabric: 'Black silk satin', garment: 'bodice', line: 'Fine straps and a softly dipped neckline, skimming to the high hip.',
    choices: bodice({ fit: 'relaxed', neckline: 'cami', darts: 'bust', sleeve: 'none', length: 'high_hip' }) },
  { era: '1990s', id: '90-dress', name: 'Nineties slip maxi', fabric: 'Ivory sand-washed satin', garment: 'dress', line: 'Cut in one on the bias from fine straps to the ankle, with a low scoop, no waist seam and no zip.',
    // The house Ivory Bias Slip's own cut, so a fix to the house slip (its straps, its armholes) reaches this one too.
    choices: COLLECTION.find((l) => l.id === 'ivory-slip')!.choices },
  { era: '1990s', id: '90-trousers', name: 'Low-slung slouch trouser', fabric: 'Grey wool crepe', garment: 'trousers', line: 'Low on the hip and relaxed, falling straight to the floor.',
    choices: <TrousersChoices>{ ...DEFAULT_TROUSERS_CHOICES, fit: 'relaxed', leg: 'straight', length: 'full', rise: 'low' } },
];

/** One era's whole line: its skirt looks first (as the skirt page's Looks offer them), then its other pieces. */
export function eraLine(eraId: string): EraPiece[] {
  const era = ERAS.find((e) => e.id === eraId);
  if (!era) return [];
  const skirts: Omit<EraPiece, 'number'>[] = era.looks.map((l) => ({
    era: era.id,
    id: l.id,
    name: l.name,
    line: l.about,
    fabric: l.fabric,
    garment: 'skirt',
    choices: skirtLook({ fit: l.fit, silhouette: l.silhouette, length: l.length, look: l.id }),
  }));
  return [...skirts, ...PIECES.filter((p) => p.era === era.id)].map((p, i) => ({ ...p, number: i + 1 }));
}

/** Every era piece that isn't a skirt look, for the pattern and fit sweeps. */
export const ERA_PIECES: EraPiece[] = PIECES.map((p, i) => ({ ...p, number: i + 1 }));

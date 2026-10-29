// The Archive: cuts from fashion history, set out like a museum's catalogue records and drafted to the
// sewist like any house look. Each cut is credited to the museum, dealer or pattern cutter it comes
// from, on its record and on the pattern. Until a source is licensed a cut is shown as a preview only,
// with a sign-up for when the Archive opens.
import { HouseLook, bodiceChoices, dressChoices, skirtLook } from './collection';
import { DEFAULT_JACKET_CHOICES, OuterChoices, TrousersChoices } from './garments';

export interface ArchiveCut extends HouseLook {
  year: number;
  /** Where and how it was first made. */
  origin: string;
  /** Who it is licensed from; until then the cut is a preview. */
  source?: string;
  /** The credit line, as the source asks for it: on the record and the pattern's title block. */
  credit?: string;
}

// Last season's house looks, kept here once the House moves on to the next season: the house's own, so
// credited to it and made like any look.
const HOUSE = 'Maison Tracé';
const HOUSE_CREDIT = 'From the Maison Tracé collection, Autumn Winter 2026.';

export const ARCHIVE: ArchiveCut[] = [
  {
    id: 'arc-1954-day',
    number: 1,
    year: 1954,
    name: 'Day Dress',
    origin: 'Paris couture',
    line: 'A fitted bodice with a scoop neck over a full circle skirt to the mid-calf.',
    fabric: 'Cotton sateen, or a silk faille',
    garment: 'dress',
    choices: dressChoices('fitted', { neckline: 'scoop' }, { silhouette: 'circle', length: 'midi' }),
  },
  {
    id: 'arc-1962-shift',
    number: 2,
    year: 1962,
    name: 'Shift',
    origin: 'London ready-to-wear',
    line: 'Straight from the bust to just above the knee, with a boat neck.',
    fabric: 'Wool crepe, or a bonded double knit woven',
    garment: 'dress',
    choices: dressChoices('regular', { neckline: 'boat' }, { silhouette: 'straight', length: 'above_knee' }),
  },
  {
    id: 'arc-1974-wide',
    number: 3,
    year: 1974,
    name: 'High Wide Trouser',
    origin: 'New York disco',
    line: 'High at the waist and wide from the hip to the floor.',
    fabric: 'Wool gabardine, or a heavy crepe',
    garment: 'trousers',
    choices: { garment: 'trousers', fit: 'regular', leg: 'wide', length: 'full', closure: 'side_zip' } as TrousersChoices,
  },
  {
    id: 'arc-1996-slip',
    number: 4,
    year: 1996,
    name: 'Bias Slip',
    origin: 'Nineties minimalism',
    line: 'A slip on fine straps, its skirt cut on the bias to fall close to the body.',
    fabric: 'Silk charmeuse, or a sand-washed satin',
    garment: 'dress',
    choices: dressChoices('regular', { neckline: 'cami' }, { silhouette: 'slip', length: 'midi' }),
  },
  {
    id: 'aw26-tailleur',
    number: 5,
    year: 2026,
    origin: 'Maison Tracé, AW26',
    source: HOUSE,
    credit: HOUSE_CREDIT,
    name: 'Tailleur',
    line: 'The house jacket: double-breasted, a notched lapel, a two-piece sleeve and a soft shoulder.',
    fabric: 'Wool suiting, or a fine bouclé',
    garment: 'jacket',
    choices: { ...DEFAULT_JACKET_CHOICES, fit: 'fitted', shaping: 'princess', front: 'double', pockets: 'welt' } as OuterChoices,
  },
  {
    id: 'aw26-bal',
    number: 6,
    year: 2026,
    origin: 'Maison Tracé, AW26',
    source: HOUSE,
    credit: HOUSE_CREDIT,
    name: 'Bal',
    line: 'A boned sweetheart bodice, cut like a corset, over a full circle skirt to the mid-calf.',
    fabric: 'Silk duchess satin, or a taffeta',
    garment: 'dress',
    choices: dressChoices('fitted', { neckline: 'sweetheart', structure: 'boned' }, { silhouette: 'circle', length: 'midi' }),
  },
  {
    id: 'aw26-epaule',
    number: 7,
    year: 2026,
    origin: 'Maison Tracé, AW26',
    source: HOUSE,
    credit: HOUSE_CREDIT,
    name: 'Épaule',
    line: 'One bare shoulder, a clean diagonal neckline, and a hem that dips longer at the back.',
    fabric: 'Silk crepe, or a heavy crepe-backed satin',
    garment: 'dress',
    choices: dressChoices('fitted', { neckline: 'one_shoulder' }, { silhouette: 'a_line', length: 'midi', asymHem: 'high_low' }),
  },
  {
    id: 'aw26-drape',
    number: 8,
    year: 2026,
    origin: 'Maison Tracé, AW26',
    source: HOUSE,
    credit: HOUSE_CREDIT,
    name: 'Drapé',
    line: 'A cowl neck that falls in soft folds at the front, its front cut on the bias.',
    fabric: 'Silk satin, or a fluid viscose crepe',
    garment: 'bodice',
    choices: bodiceChoices({ fit: 'regular', neckline: 'cowl' }),
  },
  {
    id: 'aw26-peplum',
    number: 9,
    year: 2026,
    origin: 'Maison Tracé, AW26',
    source: HOUSE,
    credit: HOUSE_CREDIT,
    name: 'Basque',
    line: 'A fitted bodice with a boat neck and a flared peplum that stands out from the waist.',
    fabric: 'Wool crepe, or a silk faille',
    garment: 'bodice',
    choices: bodiceChoices({ fit: 'fitted', neckline: 'boat', peplum: 'flared' }),
  },
  {
    id: 'aw26-sirene',
    number: 10,
    year: 2026,
    origin: 'Maison Tracé, AW26',
    source: HOUSE,
    credit: HOUSE_CREDIT,
    name: 'Sirène',
    line: 'A pencil skirt to the floor, opened out below the knee by eight godets.',
    fabric: 'Crepe-backed satin, or a silk crepe',
    garment: 'skirt',
    choices: skirtLook({ fit: 'fitted', silhouette: 'pencil', length: 'maxi', godets: 8 }),
  },
  {
    id: 'aw26-colonne',
    number: 11,
    year: 2026,
    origin: 'Maison Tracé, AW26',
    source: HOUSE,
    credit: HOUSE_CREDIT,
    name: 'Colonne',
    line: 'A long, narrow column: a fitted bodice with a boat neck over a floor-length straight skirt.',
    fabric: 'Wool crepe, or a heavy silk crepe',
    garment: 'dress',
    choices: dressChoices('fitted', { neckline: 'boat', princess: 'armhole' }, { silhouette: 'straight', length: 'maxi' }),
  },
  {
    id: 'aw26-volant',
    number: 12,
    year: 2026,
    origin: 'Maison Tracé, AW26',
    source: HOUSE,
    credit: HOUSE_CREDIT,
    name: 'Volant',
    line: 'An A-line skirt that ends in a circular flounce, so the hem moves with every step.',
    fabric: 'Silk georgette, or a light crepe',
    garment: 'skirt',
    choices: skirtLook({ fit: 'regular', silhouette: 'a_line', length: 'midi', flounce: 'hem_flounce' }),
  },
  {
    id: 'aw26-ligne',
    number: 13,
    year: 2026,
    origin: 'Maison Tracé, AW26',
    source: HOUSE,
    credit: HOUSE_CREDIT,
    name: 'Ligne',
    line: 'An A-line skirt with its hem cut on a diagonal, short on one side and long on the other.',
    fabric: 'Wool crepe, or a heavy linen, the same on both sides',
    garment: 'skirt',
    choices: skirtLook({ fit: 'regular', silhouette: 'a_line', length: 'midi', asymHem: 'diagonal' }),
  },
  {
    id: 'aw26-palazzo',
    number: 14,
    year: 2026,
    origin: 'Maison Tracé, AW26',
    source: HOUSE,
    credit: HOUSE_CREDIT,
    name: 'Palazzo',
    line: 'Wide, fluid trousers that fall from the hip to the floor.',
    fabric: 'Silk crepe, viscose or a fluid wool',
    garment: 'trousers',
    choices: { garment: 'trousers', fit: 'regular', leg: 'wide', length: 'full', closure: 'side_zip' } as TrousersChoices,
  },
];

/** The record's catalogue number, like a museum's accession number: ARC · 1954 · 001. */
export const accession = (c: ArchiveCut) => `ARC · ${c.year} · ${String(c.number).padStart(3, '0')}`;

/** A cut can be made once its source is licensed and credited. */
export const canMake = (c: ArchiveCut) => Boolean(c.source && c.credit);

export const archiveCut = (id: string | undefined) => ARCHIVE.find((c) => c.id === id);


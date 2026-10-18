// The Archive: cuts from fashion history, set out like a museum's catalogue records and drafted to the
// sewist like any house look. Each cut is credited to the museum, dealer or pattern cutter it comes
// from, on its record and on the pattern. Until a source is licensed a cut is shown as a preview only,
// with a sign-up for when the Archive opens.
import { HouseLook, dressChoices } from './collection';
import type { TrousersChoices } from './garments';

export interface ArchiveCut extends HouseLook {
  year: number;
  /** Where and how it was first made. */
  origin: string;
  /** Who it is licensed from; until then the cut is a preview. */
  source?: string;
  /** The credit line, as the source asks for it: on the record and the pattern's title block. */
  credit?: string;
}

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
];

/** The record's catalogue number, like a museum's accession number: ARC · 1954 · 001. */
export const accession = (c: ArchiveCut) => `ARC · ${c.year} · ${String(c.number).padStart(3, '0')}`;

/** A cut can be made once its source is licensed and credited. */
export const canMake = (c: ArchiveCut) => Boolean(c.source && c.credit);

export const archiveCut = (id: string | undefined) => ARCHIVE.find((c) => c.id === id);


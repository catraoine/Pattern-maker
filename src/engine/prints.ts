// Prints: what is printed or woven on the cloth, which changes how the pieces are laid and how much to buy.
// Plain and small all-over prints cut as they are; a one-way print lays every piece the same way up; big
// motifs are placed on the pieces; a border runs along the hem; checks and stripes are matched at the seams.
// Kept apart from specialFabrics.ts (the cloth itself) since any cloth can carry any print.
// Keep to plain ASCII punctuation: these words go into the PDF and the tech pack.
import { checksExtra, checksLines } from './specialFabrics';

export type PrintKind = 'plain' | 'ditsy' | 'oneway' | 'motif' | 'border' | 'checks';
type Garment = 'skirt' | 'bodice' | 'dress' | 'trousers' | 'tee' | 'jacket' | 'coat' | 'lingerie';

export interface PrintInfo {
  label: string;
  /** One line under the label in the picker. */
  hint: string;
  /** The example swatch in public/prints. */
  image: string;
  /** Every piece is cut the same way up. */
  nap?: boolean;
  /** Takes a repeat, in cm. */
  repeat?: boolean;
  /** The repeat used until the maker enters theirs, in cm. */
  defaultRepeat?: number;
}

export const PRINTS: Record<PrintKind, PrintInfo> = {
  plain: { label: 'Plain', hint: 'one colour, or a texture', image: 'plain' },
  ditsy: { label: 'Small all-over', hint: 'reads the same any way up', image: 'ditsy' },
  oneway: { label: 'One-way', hint: 'motifs all point one way', image: 'oneway', nap: true },
  motif: { label: 'Big motifs', hint: 'placed on the pieces', image: 'motif', nap: true, repeat: true, defaultRepeat: 32 },
  border: { label: 'Border', hint: 'runs along one selvedge', image: 'border' },
  checks: { label: 'Checks, stripes', hint: 'matched at the seams', image: 'checks', repeat: true, defaultRepeat: 10 },
};

export const PRINT_IDS = Object.keys(PRINTS) as PrintKind[];

export const printImage = (kind: PrintKind, base = '/') => `${base}prints/${PRINTS[kind].image}.jpg`;

/** The print recorded for a fabric: fabrics saved before the picker only had the checks switch. */
export function printOf(f: { print?: PrintKind; checks?: object } | undefined): PrintKind | undefined {
  return f?.print ?? (f?.checks ? 'checks' : undefined);
}

/** Every piece the same way up, for a one-way print or placed motifs. */
export const printNap = (kind: PrintKind | undefined) => !!kind && !!PRINTS[kind].nap;

const MAIN_PIECES: Record<Garment, number> = { skirt: 2, bodice: 2, dress: 4, trousers: 2, tee: 2, jacket: 4, coat: 4, lingerie: 3 };

/** Extra fabric to place big motifs: about one repeat for each main piece. In metres, to 0.1. */
export function motifExtra(repeat: number | undefined, garment: Garment): number {
  const r = repeat && repeat > 0 ? repeat : PRINTS.motif.defaultRepeat!;
  return Math.ceil((r * MAIN_PIECES[garment]) / 10) / 10;
}

/** Full shapes that go all the way round and so cannot keep a border level on the hem. */
const ROUND_HEMS = ['half_circle', 'circle'];

/** Lines for the print, for the card, the PDF and the tech pack. */
export function printLines(kind: PrintKind | undefined, repeat: number | undefined, garment: Garment, style: { silhouette?: string } = {}): string[] {
  switch (kind) {
    case 'oneway':
      return ['One-way print: every piece is laid the same way up, with the motifs pointing up the body, so it takes a little more fabric.'];
    case 'motif': {
      const extra = motifExtra(repeat, garment);
      return [
        `Big motifs: buy about ${extra.toFixed(1)} m more${repeat ? ` for a ${repeat} cm repeat` : ` (for a ${PRINTS.motif.defaultRepeat} cm repeat; enter yours to work it out)`}.`,
        'Lay plan: cut single layer, right side up, every piece the same way up. Centre the front on a motif, keep a motif off the bust points and the centre of the seat, and mirror the back pair.',
      ];
    }
    case 'border':
      return [
        'Border print: the cutting layout turns the hemmed pieces crosswise, so the grain runs across the fabric and every hem sits on the border, level all round.',
        ROUND_HEMS.includes(style.silhouette ?? '')
          ? 'A half or full circle hem curves away from a straight border. Choose a straighter shape, or let the border fall where it lands.'
          : 'The fabric must be wider than each piece is long, waist to hem. Cut single layer and match the border at the side seams.',
      ];
    case 'checks':
      return checksLines({ repeat }, garment);
    default:
      return [];
  }
}

/** Extra fabric for the print, in metres, when it needs any. */
export function printExtra(kind: PrintKind | undefined, repeat: number | undefined, garment: Garment): number {
  if (kind === 'motif') return motifExtra(repeat, garment);
  if (kind === 'checks') return checksExtra({ repeat }, garment);
  return 0;
}

/** The cutting step words for a print that changes how the pieces are laid. */
export function printCut(kind: PrintKind | undefined): string | undefined {
  if (kind === 'checks') return 'Put every piece on the same check line, and line the checks up at the side seams, centre back and the waist, matching at the notches.';
  if (kind === 'motif') return 'Lay the pattern on the right side so you can see the motifs. Centre the front on a motif, keep motifs off the bust points and the seat, and cut the back pair as a mirror.';
  if (kind === 'border') return 'Turn the pieces crosswise and put every hem on the border, level, so it matches at the side seams.';
  if (kind === 'oneway') return 'Lay every piece the same way up, with the motifs pointing up the body.';
  return undefined;
}

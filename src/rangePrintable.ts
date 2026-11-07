// The printed pattern for the Garment range (2026-11-07): the knit dress and hoodie print like the T-shirt (knit
// allowances and a knit lay whatever the allowance style), the jumpsuit like the trousers (the maker's allowances).
// Kept beside printable.ts so the launch garments' printing stays as it is.
import { type FabricWidth, layPlan, layPlans } from './engine/layplan';
import { withKnitFabric } from './engine/knits';
import { withFabric, type MyFabric } from './engine/fabrics';
import { teeSpec, bodiceSpec, trousersSpec } from './engine/spec';
import type { SpecRow } from './engine/techpack';
import type { TeeMeasurements } from './engine/tee';
import type { BodiceMeasurements } from './engine/bodice';
import type { TrousersMeasurements } from './engine/trousers';
import type { KnitDressDraft, KnitDressMeasurements } from './engine/knitDress';
import type { HoodieDraft } from './engine/hoodie';
import type { JumpsuitDraft } from './engine/jumpsuit';
import type { SeamWidths } from './engine/allowances';
import { hoodieFlat, jumpsuitFlat, knitDressFlat } from './engine/rangeFlat';
import { hoodieGuide, jumpsuitGuide, knitDressGuide } from './engine/rangeGuide';
import { piecesLengthCm, toMetres } from './engine/fabric';
import type { Printable } from './screens/ExportScreen';
import type { Piece } from './engine/piece';
import type { MeasurementValues } from './measurements';

const r1 = (v: number) => Math.round(v * 10) / 10;

/** Fabric to buy, from the cutting layout: knits on 150 cm, the jumpsuit's woven on 140 cm. Rib bands come from rib. */
const rangeMetres = (pieces: Piece[], width: FabricWidth) => {
  const own = pieces.filter((pc) => !pc.meta?.rib);
  return layPlan(own, width)?.metres ?? toMetres(piecesLengthCm(own) + 10);
};
export const knitDressMetres = (d: KnitDressDraft) => rangeMetres(d.pieces, 150);
export const hoodieMetres = (d: HoodieDraft) => rangeMetres(d.pieces, 150);
export const jumpsuitMetres = (d: JumpsuitDraft) => rangeMetres(d.pieces, 140);

/** The T-shirt's rows, with the hem and length the dress or hoodie is cut to. */
function knitRows(m: TeeMeasurements, d: KnitDressDraft | HoodieDraft, hem: SpecRow[]): SpecRow[] {
  return teeSpec(m, d.tee).filter((r) => !/^Hem|^Hip \(hem\)/.test(r.label)).flatMap((r) => (r.label === 'Waist' ? [r, ...hem] : [r]));
}

export function knitDressSpec(m: KnitDressMeasurements, d: KnitDressDraft): SpecRow[] {
  return knitRows(m, d, [
    { label: 'Hip', body: r1(m.full_hip), finished: '' },
    { label: 'Hem below the waist, at the side', finished: r1(d.belowWaist + (d.bands?.hemBand ?? 0)) },
    { label: 'Hem, round', finished: r1(d.hemCm) },
    ...(d.skater ? [{ label: 'Skirt, waist seam to hem', finished: r1(d.skater.length) }] : []),
    ...(d.bands?.hemBand ? [{ label: 'Rib hem band, round', finished: r1(d.bands.hemBand) }] : []),
  ]);
}

export function hoodieSpec(m: TeeMeasurements, d: HoodieDraft): SpecRow[] {
  // The hood sews to the neckline in the neckband's place.
  return [
    ...knitRows(m, d, [{ label: 'Hem below the waist, at the side', finished: r1(d.belowWaist) }, ...(d.bands.hemBand ? [{ label: 'Rib hem band, round', finished: r1(d.bands.hemBand) }] : [])]).filter((r) => !/^Neckband/.test(r.label)),
    { label: 'Hood, height x depth', finished: `${d.hood.height} x ${d.hood.depth}` },
    { label: 'Hood neckline', finished: r1(d.hood.neckCm) },
    ...(d.zipCm ? [{ label: d.style.front === 'zip' ? 'Open-ended zip' : 'Half zip', finished: r1(d.zipCm) }] : []),
  ];
}

export function jumpsuitSpec(m: BodiceMeasurements & TrousersMeasurements, d: JumpsuitDraft): SpecRow[] {
  const top = bodiceSpec(m, d.bodice, 'waist').filter((r) => !/zip/i.test(r.label));
  const legs = trousersSpec(m, d.trousers).filter((r) => r.label !== 'Waist' && !/zip|Waistband/i.test(r.label));
  return [...top, ...legs, { label: d.closure === 'front_buttons' ? 'Trouser zip, fly front' : 'Invisible zip, centre back', finished: r1(d.zipCm) }];
}

interface Ctx {
  values: MeasurementValues;
  width: FabricWidth;
  nap: boolean;
  hide: boolean;
  border: boolean;
  fabric?: MyFabric;
  seams: SeamWidths;
  couture: boolean;
  allow: (pieces: Piece[]) => Piece[];
  fittingNotes: string[];
}

const KNIT_NOTE = 'Seam allowance 1 cm included, 2.5 cm at the hem, 2 cm at the sleeve hem. Dashed line = stitching line. Grain lines run along the ribs.';

export function rangePrintable(d: { knitDress?: KnitDressDraft; hoodie?: HoodieDraft; jumpsuit?: JumpsuitDraft }, c: Ctx): Printable | undefined {
  // A knee-length skater skirt can be wider than a 140 cm knit folded: then it is laid on 150 cm, the usual knit width.
  const lay = (pieces: Piece[], knit: boolean) => {
    const own = layPlans(pieces, c.width, c.nap, c.hide, knit, c.border);
    return own.length || !knit || c.width === 150 ? own : layPlans(pieces, 150, c.nap, c.hide, knit, c.border);
  };
  const selfM = (lays: ReturnType<typeof layPlans>, or: number) => lays.find((l) => l.fabric === 'self')?.metres ?? or;
  if (d.knitDress) {
    const k = d.knitDress;
    const lays = lay(k.pieces, true);
    return {
      pieces: k.pieces,
      notes: [
        `Knit dress for fabric with ${k.style.stretch} stretch. Finished bust ${k.tee.finishedBust} cm, hem ${r1(k.hemCm)} cm round, ${r1(k.belowWaist + (k.bands?.hemBand ?? 0))} cm below the waist at the side.`,
        KNIT_NOTE,
        `Neckband ${k.tee.neckband.length} cm, ${Math.round(k.tee.neckband.ratio * 100)}% of the ${k.tee.necklineCm} cm neckline.${k.bands ? ' Hem band and cuffs from rib.' : ''} In testing: tell us how it sews. Sewing steps are on the last pages.`,
      ],
      guide: withKnitFabric(knitDressGuide(k, selfM(lays, knitDressMetres(k)), { width: c.width }), c.fabric),
      spec: knitDressSpec(c.values as unknown as KnitDressMeasurements, k),
      lays,
      flat: knitDressFlat(k),
    };
  }
  if (d.hoodie) {
    const h = d.hoodie;
    const lays = lay(h.pieces, true);
    return {
      pieces: h.pieces,
      notes: [
        `Hoodie for sweatshirt fleece or French terry with ${h.style.stretch} stretch. Finished bust ${h.tee.finishedBust} cm, ${r1(h.belowWaist)} cm below the waist at the side.`,
        KNIT_NOTE,
        `Lined hood ${h.hood.height} cm high. ${h.bands.hemBand ? 'Hem band and cuffs' : 'Cuffs'} from rib.${h.zipCm ? ` ${h.zipCm} cm zip.` : ''} In testing: tell us how it sews. Sewing steps are on the last pages.`,
      ],
      guide: withKnitFabric(hoodieGuide(h, selfM(lays, hoodieMetres(h)), { width: c.width }), c.fabric),
      spec: hoodieSpec(c.values as unknown as TeeMeasurements, h),
      lays,
      flat: hoodieFlat(h),
    };
  }
  if (d.jumpsuit) {
    const j = d.jumpsuit;
    const pieces = c.allow(j.pieces);
    const lays = lay(pieces, false);
    const hem = pieces.find((pc) => /^(Leg|Shorts) front/.test(pc.name))?.allowances.hem ?? 4;
    return {
      pieces,
      notes: [
        `Finished bust ${j.bodice.finishedBust} cm, waist ${j.bodice.finishedWaist} cm, hip ${j.trousers.finishedHip} cm, outside leg ${j.trousers.lengthCm} cm.`,
        c.couture
          ? `Couture allowances: ${c.seams.seam} cm at the seams, 1 cm on the crotch curve, ${hem} cm at the hem. Thread-trace the solid stitching line.`
          : `Seam allowance ${c.seams.seam} cm included, 1 cm on the crotch curve, ${hem} cm at the hem. Dashed line = stitching line.`,
        `The top and ${/^Shorts/.test(pieces.find((pc) => /front/.test(pc.name) && !/Bodice/.test(pc.name))?.name ?? '') ? 'shorts' : 'legs'} join at the waist, cut lower in the body to sit in. ${j.closure === 'front_buttons' ? `Buttons down the front with a ${j.zipCm} cm fly zip below.` : `A ${j.zipCm} cm invisible zip at the centre back.`} In testing: make a toile first. Sewing steps are on the last pages.`,
        ...c.fittingNotes,
      ],
      guide: withFabric(jumpsuitGuide(j, selfM(lays, jumpsuitMetres(j)), { width: c.width, seams: c.seams }), c.fabric, 'dress'),
      spec: jumpsuitSpec(c.values as unknown as BodiceMeasurements & TrousersMeasurements, j),
      lays,
      flat: jumpsuitFlat(j, c.values as unknown as TrousersMeasurements),
    };
  }
  return undefined;
}

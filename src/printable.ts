import { finishesNeck } from './engine/collar';
import { beltNote, beltPieces, dressBelt, skirtBelt, withBelt } from './engine/belt';
import { SkirtDraft, SkirtMeasurements, draftSkirt } from './engine/skirt';
import { BodiceMeasurements, blockOf } from './engine/bodice';
import { slitNote } from './engine/slit';
import { HIGH } from './engine/skirtWaist';
import { cuffNote } from './engine/cuffs';
import { SewingGuide, bodiceGuide, dressGuide, sewingGuide } from './engine/instructions';
import { bodiceFlat, dressFlat, outerFlat, skirtFlat, teeFlat, trousersFlat } from './engine/flat';
import { DressMeasurements } from './engine/dress';
import { TrousersMeasurements, trousersWaistband } from './engine/trousers';
import { trousersGuide } from './engine/trousersGuide';
import { TeeMeasurements } from './engine/tee';
import { teeGuide } from './engine/teeGuide';
import { LingerieMeasurements } from './engine/lingerie';
import { lingerieGuide } from './engine/lingerieGuide';
import { withKnitFabric } from './engine/knits';
import { OuterMeasurements } from './engine/outerwear';
import { outerGuide } from './engine/outerGuide';
import { toCouture } from './engine/couture';
import { SEAM_WIDTHS, withAllowances } from './engine/allowances';
import { bodiceFacings, liningPieces, waistPieces } from './engine/finishing';
import { edgesFor, topNotes } from './engine/corsetGuide';
import { drapeFacings, drapeLined, drapeNote, zipSide } from './engine/drape';
import { bodiceSpec, dressSpec, outerSpec, skirtSpec, sleeveSpec, teeSpec, trousersSpec, lingerieSpec } from './engine/spec';
import { SleeveMeasurements, sleeveNote } from './engine/sleeve';
import { Fitting, describeFitting } from './engine/fitting';
import { layPlans } from './engine/layplan';
import { MyFabric, clothFor, withFabric } from './engine/fabrics';
import { SPECIALS, needsNap, withCheckMarks, withSpecialAllowances } from './engine/specialFabrics';
import { printNap, printOf } from './engine/prints';
import { Garment, MeasurementValues } from './measurements';
import { BodiceChoices, COLLAR_WORDS, TrousersChoices, DressChoices, describeBodice } from './garments';
import { fabricMetres } from './skirtChoices';
import { bindingMetres, bodiceFabricMetres } from './fabricAmounts';
import { trousersFabricMetres } from './fabricAmounts';
import { teeFabricMetres } from './fabricAmounts';
import { lingerieFabricMetres } from './fabricAmounts';
import { outerFabricMetres } from './fabricAmounts';
import type { Printable } from './screens/ExportScreen';
import type { PocketStyle } from './engine/pockets';
import { layoutExtras } from './engine/skirtVolume';
import { withFinishedMarks } from './engine/finishedMarks';

import type { Choices, Finish } from './savedWork';
import type { Drafts } from './garmentDrafts';

// The printed pattern for a garment: its pieces with allowances, the notes on its first page, the sewing guide, the
// spec sheet, the cutting layouts and the flat drawing. Built from the drafts App makes, for the print screen and
// the files.

const fmtCm = (v: number) => `${v} cm`;

/** Pockets, for the notes on the pattern's first page. */
const pocketWords = (style: PocketStyle, sides?: 'both' | 'right') =>
  style === 'slant' ? ', with slant pockets' : style === 'inseam' ? (sides === 'right' ? ', with an in-seam pocket on the right' : ', with in-seam pockets') : '';

/** The pattern's version and its toile corrections, for the title block, in lines that fit it. */
function fittingLines(f: Fitting | undefined, garment: Garment): string[] {
  const changes = describeFitting(f, garment);
  if (!f || !changes.length) return [];
  const date = f.date ? new Date(`${f.date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const lines = [`Version ${f.round + 1}, corrected after the toile${date ? ` on ${date}` : ''}:`];
  for (const c of changes) {
    const last = lines.length - 1;
    if (last > 0 && lines[last].length + c.length < 96) lines[last] += `; ${c}`;
    else lines.push(c[0].toUpperCase() + c.slice(1));
  }
  return lines.map((l, i) => (i && i === lines.length - 1 ? `${l}.` : l));
}

/** What the printed pattern is made from. */
interface PrintInputs {
  result: Drafts;
  values: MeasurementValues;
  finish: Finish;
  fabric?: MyFabric;
  garment: Garment;
  ownFitting?: Fitting;
  carriedNotes: string[];
  saved: { choices: Choices; bodice: BodiceChoices };
  dress: DressChoices;
  skirtStyle: Parameters<typeof draftSkirt>[1];
  trousersChoices: TrousersChoices;
}

/** The printed pattern, its front pieces marked with the finished bust, waist and hip (F5, 2026-10-28). */
export function printableFor(inputs: PrintInputs): Printable | undefined {
  const made = drafted(inputs);
  return made && { ...made, pieces: withFinishedMarks(made.pieces, made.spec) };
}

function drafted({ result, values, finish, fabric, garment, ownFitting, carriedNotes, saved, dress, skirtStyle, trousersChoices }: PrintInputs): Printable | undefined {
  const { skirt, bodice, sleeve, dress: dressDraft, trousers, tee, lingerie, outer } = result;
  // A special cloth (leather) can need its own seam allowances, whatever the style.
  const special = fabric?.special;
  const own = special && SPECIALS[special].seam;
  const seams = own ? { seam: own, waist: own, curve: own } : SEAM_WIDTHS[finish.allowances];
  const checks = !!fabric?.checks;
  const allow = (pieces: Printable['pieces']) =>
    pieces.map((pc) => {
      const cut = withSpecialAllowances(withAllowances(pc, finish.allowances), special);
      return checks ? withCheckMarks(cut) : cut;
    });
  const nap = finish.nap || needsNap(special) || printNap(printOf(fabric));
  const hide = special === 'leather';
  const border = printOf(fabric) === 'border';
  const couture = finish.allowances === 'couture';
  const fittingNotes = [...fittingLines(ownFitting, garment), ...carriedNotes.map((l) => `${l}.`)];
  // The couture route's cloth follows the recorded fibre; either route opens with preparing the fabric.
  const route = (guide: SewingGuide, c: { garment: 'skirt' | 'bodice' | 'dress'; lined: boolean; zipCm: number }) =>
    withFabric(finish.route === 'couture' ? toCouture(guide, { ...c, cloth: clothFor(fabric, finish.cloth), traced: couture }) : guide, fabric, c.garment);
  if (tee) {
    // Knit allowances (1 cm, 2.5 cm at the hem) whatever the allowance style, and a knit lay.
    const pieces = tee.pieces;
    const lays = layPlans(pieces, finish.fabricWidth, nap, false, true, border);
    return {
      pieces,
      notes: [
        `For knit fabric with ${tee.stretch} stretch. Finished bust ${tee.finishedBust} cm, ${tee.length === 'cropped' ? 'hem' : 'hem at the hip'} ${tee.finishedHem} cm, back length ${tee.backLength} cm.`,
        `Seam allowance 1 cm included, 2.5 cm at the hem, 2 cm at the sleeve hem. Dashed line = stitching line. Grain lines run along the ribs.`,
        `Neckband ${tee.neckband.length} cm long, ${Math.round(tee.neckband.ratio * 100)}% of the ${tee.necklineCm} cm neckline, cut with the stretch along it. Sleeve: bicep ${tee.sleeve.bicep} cm. Sewing steps are on the last pages.`,
      ],
      guide: withKnitFabric(teeGuide(tee, lays.find((l) => l.fabric === 'self')?.metres ?? teeFabricMetres(tee), { width: finish.fabricWidth }), fabric),
      spec: teeSpec(values as TeeMeasurements, tee),
      lays,
      flat: teeFlat(tee),
    };
  }
  if (lingerie) {
    // Knit allowances whatever the allowance style, and a knit lay.
    const pieces = lingerie.pieces;
    const lays = layPlans(pieces, finish.fabricWidth, nap, false, true);
    const { piece } = lingerie.style;
    const cut = [
      lingerie.finishedBust !== undefined && `bust ${lingerie.finishedBust} cm`,
      lingerie.finishedBand !== undefined && `band ${lingerie.finishedBand} cm`,
      lingerie.finishedWaist !== undefined && `waist ${lingerie.finishedWaist} cm`,
      piece !== 'bralette' && `hip ${lingerie.finishedHip} cm`,
    ].filter(Boolean);
    return {
      pieces,
      notes: [
        `For ${lingerie.style.way === 'two' ? 'knit that stretches across' : `four-way stretch ${piece === 'swimsuit' || piece === 'bikini' ? 'swim Lycra' : 'knit'}`} with ${lingerie.style.stretch} stretch. Cut ${cut.join(', ')}, ${lingerie.lengthReduction ? `${Math.round(lingerie.lengthReduction * 100)}% shorter than the body` : 'full length'}.`,
        `Seams 1 cm, and each elastic edge as wide as its elastic, all included. Dashed line = stitching line. Grain lines run down the fabric, with the most stretch going round the body.`,
        `Elastic: ${lingerie.elastic.map((e) => `${e.edge.toLowerCase()} ${e.length} cm${e.count > 1 ? ` (cut ${e.count})` : ''}`).join(', ')}. Sewing steps are on the last pages.`,
      ],
      guide: withKnitFabric(lingerieGuide(lingerie, lays.find((l) => l.fabric === 'self')?.metres ?? lingerieFabricMetres(lingerie), { width: finish.fabricWidth }), fabric),
      spec: lingerieSpec(values as LingerieMeasurements, lingerie),
      lays,
    };
  }
  if (outer) {
    const pieces = allow(outer.pieces);
    const lays = layPlans(pieces, finish.fabricWidth, nap, hide, false, border);
    const metres = (f: 'self' | 'lining') => lays.find((l) => l.fabric === f)?.metres;
    const hem = outer.pieces[0].allowances['opening-hem'] ?? 4;
    const kind = outer.kind;
    return {
      pieces,
      notes: [
        `Finished bust ${outer.finishedBust} cm, waist ${outer.finishedWaist} cm, hem ${outer.finishedHem} cm, back length ${outer.lengthCm} cm.`,
        couture
          ? `Couture allowances: ${fmtCm(seams.seam)} at the seams, ${fmtCm(seams.curve)} at the neck and armholes, ${fmtCm(hem)} at the hem. Thread-trace the solid stitching line.`
          : `Seam allowance ${fmtCm(seams.seam)} included, 1 cm at the neck, armholes, collar and front edges, ${fmtCm(hem)} at the hem. Dashed line = stitching line.`,
        `Fully lined, with front facings${outer.lapel ? ' and a notched collar' : ''}. ${outer.buttons.at.length * outer.buttons.columns.length} buttons, ${outer.buttons.sizeCm} cm. Sewing steps are on the last pages.`,
        `Sleeve: bicep ${outer.sleeve.bicep} cm, crown ease ${outer.sleeve.crownEase.front} cm front, ${outer.sleeve.crownEase.back} cm back.`,
        ...fittingNotes,
      ],
      guide: withFabric(
        outerGuide(outer, metres('self') ?? outerFabricMetres(outer), { seams, width: finish.fabricWidth, liningM: metres('lining') }),
        fabric,
        kind,
      ),
      spec: outerSpec(values as OuterMeasurements, outer),
      lays,
      flat: outerFlat(outer),
    };
  }
  if (trousers) {
    const pieces = allow([...trousers.pieces, trousersWaistband(trousers, 1.5)]);
    const hem = pieces[0].allowances.hem;
    const lays = layPlans(pieces, finish.fabricWidth, nap, hide, false, border);
    const m = values as TrousersMeasurements;
    return {
      pieces,
      notes: [
        `Finished waist ${trousers.finishedWaist} cm, hip ${trousers.finishedHip} cm, outside leg ${trousers.lengthCm} cm, crotch seam ${Math.round((trousers.crotch.front + trousers.crotch.back) * 10) / 10} cm.`,
        couture
          ? `Couture allowances: ${fmtCm(seams.seam)} at the seams, ${fmtCm(seams.waist)} at the waist, 1 cm on the crotch curve, ${fmtCm(hem)} at the hem. Thread-trace the solid stitching line.`
          : `Seam allowance ${fmtCm(seams.seam)} included, 1 cm on the crotch curve, ${fmtCm(hem)} at the hem. Dashed line = stitching line.`,
        `${
          trousers.elastic
            ? `A pull-on elastic waist, with no zip: ${trousers.elastic.cutCm} cm of ${trousers.elastic.widthCm} cm elastic in the waistband casing`
            : trousers.closure === 'fly'
              ? `A ${trousers.zipCm} cm fly zip with its facing and shield, and the waistband`
              : `A ${trousers.zipCm} cm invisible zip in the left side seam, and the waistband`
        }${pocketWords(trousers.pockets, trousers.pocketSides)}. The crease line is the grain line. Sewing steps are on the last pages.`,
        ...fittingNotes,
      ],
      guide: withFabric(trousersGuide(trousers, lays.find((l) => l.fabric === 'self')?.metres ?? trousersFabricMetres(trousers), { seams, width: finish.fabricWidth, length: trousersChoices.length }), fabric, 'trousers'),
      spec: trousersSpec(m, trousers),
      lays,
      flat: trousersFlat(trousers, m),
    };
  }
  if (skirt) {
    // The lining is drafted 2.5 cm shorter than the skirt, from the same measurements and style.
    let lining: SkirtDraft | undefined;
    if (finish.skirtLined) {
      try {
        // A plain lining under pleats, godets or a flounce: they need no second layer. Nor pockets.
        lining = draftSkirt(values as SkirtMeasurements, { ...skirtStyle, pleats: undefined, godets: undefined, flounce: undefined, lengthCm: skirt.lengthCm - 2.5, pockets: 'none', yoke: undefined, buttons: undefined, ruched: undefined });
      } catch {
        lining = undefined;
      }
    }
    const belt = skirtBelt(saved.choices.belt, skirt);
    const pieces = allow([...skirt.pieces, ...(lining ? liningPieces(lining) : []), ...waistPieces(skirt, 1.5), ...beltPieces(belt, seams.seam)]);
    // The hem is on the flounce below a flounced skirt, and on the bottom tier (2 cm) of a tiered one.
    const hem = pieces.find((pc) => !pc.kind && pc.allowances.hem !== undefined)?.allowances.hem ?? 2;
    // Tiers and the extra godets are cut but not printed.
    const lays = layPlans([...pieces, ...allow(layoutExtras(skirt))], finish.fabricWidth, nap, hide, false, border);
    const metres = (f: 'self' | 'lining', fallback: () => number) => lays.find((l) => l.fabric === f)?.metres ?? fallback();
    return {
      pieces,
      notes: [
        `Finished waist ${skirt.finishedWaist} cm${skirt.elastic ? `, gathered onto ${skirt.elastic.finishedCm} cm of elastic` : ''}, hip ${skirt.finishedHip} cm, length ${skirt.lengthCm} cm.`,
        couture
          ? `Couture allowances: ${fmtCm(seams.seam)} at the seams, ${fmtCm(seams.waist)} at the waist, ${fmtCm(hem)} at the hem. Thread-trace the solid stitching line.`
          : `Seam allowance ${fmtCm(seams.seam)} included, ${fmtCm(hem)} at the hem. Dashed line = stitching line.`,
        `${skirt.elastic ? `A pull-on elastic waist, with no zip: ${skirt.elastic.cutCm} cm of ${skirt.elastic.widthCm} cm elastic in the waistband casing` : skirt.wrap?.ties ? `A wrap with no zip: the front cut as a crossing pair, and a waistband that runs on into ties (${skirt.wrap.ties.outer} cm and ${skirt.wrap.ties.inner} cm, cut ${skirt.wrap.ties.cutWidth} cm wide)` : skirt.faced || skirt.waistFinish ? `${skirt.waistFinish === 'high' ? `A high waist, ${HIGH.rise} cm above your own, with waist facings` : 'Waist facings'}` : 'Waistband'}${lining ? ' and lining' : ''}${pocketWords(skirt.pocket ? 'inseam' : 'none')} included.${skirt.bias ? ' Cut on the bias: every piece single layer, grain at 45 degrees.' : ''}${skirt.volume?.tiers ? ' The tiers are rectangles: their measurements are in the sewing steps.' : ''} Sewing steps are on the last pages.`,
        ...(skirt.slit ? [slitNote(skirt.slit)] : []),
        ...(skirt.yoke ? ['A shaped yoke at the top, the darts closed into it, so the skirt below has none.'] : []),
        ...(skirt.buttons ? [`Buttoned down the front, with no zip: ${skirt.buttons.count} buttons (${skirt.buttons.sizeCm} cm) down the front and one on the waistband${skirt.pieces[1].fold ? ', and the back cut on the fold' : ''}.`] : []),
        ...(belt ? [beltNote(belt)] : []),
        ...(skirt.opening === 'left_side' && !skirt.halves && !skirt.faced ? [`The zip goes in the left side seam (as you wear it)${skirt.pieces[1].fold ? ', so the back is cut on the fold' : ''}.`] : []),
        ...fittingNotes,
      ],
      guide: route(
        withBelt(
          sewingGuide(skirt, saved.choices, metres('self', () => fabricMetres(skirt)), {
            seams,
            width: finish.fabricWidth,
            liningM: lining ? metres('lining', () => fabricMetres(lining!)) : undefined,
            hem: skirt.pieces[0].allowances.hem >= 4 ? hem : undefined,
          }),
          belt,
          { band: !skirt.faced && !skirt.waistFinish, sideZip: skirt.opening === 'left_side' },
        ),
        { garment: 'skirt', lined: !!lining, zipCm: skirt.zipCm },
      ),
      spec: skirtSpec(values as SkirtMeasurements, skirt),
      lays,
      flat: skirtFlat(skirt, belt),
    };
  }
  if (dressDraft) {
    const d = dressDraft;
    const edges = edgesFor(d.bodice, finish.bodiceEdges);
    // The bodice's own pieces (its collar and a button front's facings among them), and the skirt's.
    const skirtNames = new Set(d.skirt.pieces.map((pc) => pc.name));
    const bodicePcs = d.pieces.filter((pc) => !skirtNames.has(pc.name));
    const skirtPcs = d.pieces.filter((pc) => skirtNames.has(pc.name));
    const top =
      edges === 'lined'
        ? d.bodice.drape
          ? drapeLined(bodicePcs, d.bodice)
          : bodicePcs.map((pc) => (pc.kind || /coutil/.test(pc.fabric ?? '') ? pc : { ...pc, fabric: 'Self fabric and lining' }))
        : bodicePcs;
    // Facings are cut from the bodice as sewn, with any moved dart or princess seam closed. A button
    // front's facings, or a band or shirt collar, finish the neck.
    const [bf, bb] = blockOf(d.bodice);
    const neckDone = d.bodice.closure === 'front_buttons' || finishesNeck(d.bodice.collar);
    const facings = edges === 'facings' ? (d.bodice.drape ? drapeFacings(d.bodice, !sleeve) : bodiceFacings(bf, bb, !sleeve, !neckDone)) : [];
    const belt = dressBelt(dress.skirt.belt, d);
    const pieces = allow([...top, ...(sleeve?.pieces ?? []), ...skirtPcs, ...facings, ...beltPieces(belt, seams.seam)]);
    const lays = layPlans([...pieces, ...allow(layoutExtras(d.skirt))], finish.fabricWidth, nap, hide, false, border);
    const metres = (f: 'self' | 'lining' | 'interlining') => lays.find((l) => l.fabric === f)?.metres ?? bodiceFabricMetres(d.bodice, sleeve) + fabricMetres(d.skirt);
    const edgeWords = sleeve
      ? { binding: 'a bias-bound neckline', facings: 'a faced neckline', lined: 'a lined bodice' }[edges]
      : { binding: 'bias-bound neck and armholes', facings: 'a faced neck and armholes', lined: 'a lined bodice' }[edges];
    return {
      pieces,
      notes: [
        `Finished bust ${d.finishedBust} cm, waist ${d.finishedWaist} cm, hip ${d.finishedHip} cm, nape to hem ${d.lengthCm} cm.`,
        couture
          ? `Couture allowances: ${fmtCm(seams.seam)} at the seams, ${fmtCm(seams.waist)} at the waist, ${fmtCm(seams.curve)} at the neck and armholes. Thread-trace the solid stitching line.`
          : `Seam allowance ${fmtCm(seams.seam)} included, ${fmtCm(seams.curve)} at the neck and armholes, ${fmtCm(pieces.find((pc) => /^(Skirt|Flounce|Dress) front/.test(pc.name) && pc.allowances.hem !== undefined)?.allowances.hem ?? (d.skirt.volume?.tiers ? 2 : 4))} at the hem. Dashed line = stitching line.`,
        `${d.noSeam ? `Cut with no waist seam, as a ${d.noSeam}: front and back each one piece from the shoulder to the hem${d.noSeam === 'sheath' ? ', shaped at the waist by darts pointed at both ends' : ''}.` : 'The skirt is drafted to the bodice: waist seams the same length and darts in one line.'} ${d.skirtButtons ? `${(d.bodice.buttons?.count ?? 0) + d.skirtButtons.count} buttons down the centre front, from the neck through the waist,` : d.bodice.wrap ? `Wrap fronts that cross over and tie at the waist, with no zip (ties ${d.bodice.wrap.ties.outer} cm and ${d.bodice.wrap.ties.inner} cm, cut ${d.bodice.wrap.ties.cutWidth} cm wide),` : `A ${d.zipCm} cm ${d.zipSide ? `zip in the ${zipSide(d.bodice)} side seam` : 'centre back zip'}`}${d.bodice.collar !== 'none' ? `, a ${COLLAR_WORDS[d.bodice.collar]}` : ''} and ${edgeWords}${pocketWords(d.skirt.pocket ? 'inseam' : 'none')}. Sewing steps are on the last pages.`,
        ...(drapeNote(d.bodice) ? [drapeNote(d.bodice)!] : []),
        ...(sleeve ? [sleeveNote(sleeve)] : []),
        ...(sleeve?.cuff ? [cuffNote(sleeve.cuff)] : []),
        ...topNotes(d.bodice),
        ...(d.skirt.slit && !d.noSeam ? [slitNote(d.skirt.slit)] : []),
        ...(belt ? [beltNote(belt)] : []),
        ...fittingNotes,
      ],
      guide: route(
        withBelt(dressGuide(d, dress.skirt, metres('self'), bindingMetres(d.bodice, { neck: edges === 'binding' && !finishesNeck(d.bodice.collar), armholes: sleeve ? edges === 'lined' : edges === 'binding' }), {
          seams,
          edges,
          width: finish.fabricWidth,
          liningM: metres('lining'),
          coutilM: d.bodice.top?.boned ? metres('interlining') : undefined,
          sleeve,
        }), belt, { band: false, sideZip: !!d.zipSide }),
        { garment: 'dress', lined: edges === 'lined', zipCm: d.zipCm },
      ),
      spec: dressSpec(values as DressMeasurements, d, sleeve),
      lays,
      flat: dressFlat(d, edges, { sleeve, belt }),
    };
  }
  if (bodice) {
    const below = bodice.finishedHem !== undefined;
    const edges = edgesFor(bodice, finish.bodiceEdges);
    const main =
      edges === 'lined'
        ? bodice.drape || bodice.peplum
          ? drapeLined(bodice.pieces, bodice)
          : bodice.pieces.map((pc) => (pc.kind || /coutil/.test(pc.fabric ?? '') ? pc : { ...pc, fabric: 'Self fabric and lining' }))
        : bodice.pieces;
    // A button front's facings, or a band collar, finish the neck.
    const neckDone = bodice.closure === 'front_buttons' || finishesNeck(bodice.collar);
    const facings = edges === 'facings' ? (bodice.drape ? drapeFacings(bodice, !sleeve, !neckDone) : bodiceFacings(...blockOf(bodice), !sleeve, !neckDone)) : [];
    const pieces = allow([...main, ...(sleeve?.pieces ?? []), ...facings]);
    const edgeWords = sleeve
      ? { binding: 'a bias-bound neckline', facings: 'a faced neckline', lined: 'a lined bodice' }[edges]
      : { binding: 'bias-bound edges', facings: 'faced neck and armholes', lined: 'a full lining' }[edges];
    const sleeveWords = sleeve ? `${describeBodice(saved.bodice).replace(/^.* with /, 'With ')}` : 'Sleeveless';
    const lays = layPlans(pieces, finish.fabricWidth, nap, hide, false, border);
    const metres = (f: 'self' | 'lining' | 'interlining') => lays.find((l) => l.fabric === f)?.metres ?? bodiceFabricMetres(bodice);
    return {
      pieces,
      notes: [
        `Finished bust ${bodice.finishedBust} cm, waist ${bodice.finishedWaist} cm${below ? `, hem ${bodice.finishedHem} cm` : ''}, back length ${bodice.backLength} cm.`,
        couture
          ? `Couture allowances: ${fmtCm(seams.seam)} at the seams, ${fmtCm(seams.curve)} at the neck and armholes. Thread-trace the solid stitching line.`
          : `Seam allowance ${fmtCm(seams.seam)} included, ${fmtCm(seams.curve)} at the neck and armholes${below ? ', 2.5 cm at the hem' : ''}. Dashed line = stitching line.`,
        `${sleeveWords}, ${bodice.closure === 'front_buttons' ? `${bodice.buttons?.count ?? 5} buttons down the centre front` : bodice.wrap ? `wrap fronts that tie at the waist (ties ${bodice.wrap.ties.outer} cm and ${bodice.wrap.ties.inner} cm, cut ${bodice.wrap.ties.cutWidth} cm wide)` : `a ${bodice.zipCm} cm ${bodice.drape?.kind === 'one_shoulder' ? `zip in the ${zipSide(bodice)} side seam` : 'centre back zip'}`}${bodice.collar !== 'none' ? `, a ${COLLAR_WORDS[bodice.collar]}` : ''} and ${edgeWords}. Sewing steps are on the last pages.`,
        ...(drapeNote(bodice) ? [drapeNote(bodice)!] : []),
        ...(bodice.peplum ? [`A ${bodice.peplum.kind} peplum, ${bodice.peplum.depthCm} cm deep, ${bodice.peplum.hemCm} cm round the hem.`] : []),
        ...(sleeve ? [sleeveNote(sleeve)] : []),
        ...(sleeve?.cuff ? [cuffNote(sleeve.cuff)] : []),
        ...topNotes(bodice),
        ...fittingNotes,
      ],
      guide: route(
        bodiceGuide(bodice, saved.bodice, metres('self'), bindingMetres(bodice, { neck: !neckDone && (!sleeve || edges === 'binding'), armholes: !sleeve || edges === 'lined' }), {
          seams,
          edges,
          width: finish.fabricWidth,
          liningM: metres('lining'),
          coutilM: bodice.top?.boned ? metres('interlining') : undefined,
          sleeve,
        }),
        { garment: 'bodice', lined: edges === 'lined', zipCm: bodice.zipCm },
      ),
      spec: [...bodiceSpec(values as BodiceMeasurements, bodice, saved.bodice.length, saved.bodice.dropCm), ...(sleeve ? sleeveSpec(values as SleeveMeasurements, sleeve) : [])],
      lays,
      flat: bodiceFlat(bodice, edges, sleeve),
    };
  }
  return undefined;
}

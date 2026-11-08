// The style page for the Garment range (2026-11-07): the knit dress, the hoodie and the jumpsuit, all In testing.
// One page for the three, built like the T-shirt's: the five starting Looks Cat kept from the option sheet, the
// choices on the usual steps, the garment on the form, its flat and its pattern.
import { useMemo, useState } from 'react';
import { layout } from '../engine/export';
import { bounds } from '../engine/piece';
import type { P } from '../engine/geometry';
import { wornLines, wornShapes } from '../engine/flat';
import type { KnitDressDraft } from '../engine/knitDress';
import type { HoodieDraft } from '../engine/hoodie';
import type { JumpsuitDraft } from '../engine/jumpsuit';
import type { TeeDraft } from '../engine/tee';
import { STRETCH_TEST } from '../engine/tee';
import { teeFabrics } from '../engine/knits';
import { trousersFabrics } from '../engine/fabrics';
import type { MyFabric } from '../engine/fabrics';
import { hoodieFlat, jumpsuitFlat, knitDressFlat } from '../engine/rangeFlat';
import type { TrousersMeasurements } from '../engine/trousers';
import {
  HOODIE_GROUPS,
  HOODIE_LOOKS,
  JUMPSUIT_GROUPS,
  JUMPSUIT_LOOKS,
  KNIT_DRESS_GROUPS,
  KNIT_DRESS_LOOKS,
  type HoodieChoices,
  type JumpsuitChoices,
  type KnitDressChoices,
  type RangeChoices,
  describeHoodie,
  describeJumpsuit,
  describeKnitDress,
  isHoodie,
  isJumpsuit,
  isKnitDress,
  teeFitOf,
  validJumpsuit,
} from '../garmentRange';
import type { MeasurementValues } from '../measurements';
import { hoodieMetres, hoodieSpec, jumpsuitMetres, jumpsuitSpec, knitDressMetres, knitDressSpec } from '../rangePrintable';
import type { Finish } from '../savedWork';
import type { Mode } from '../mode';
import { TechFlatView } from '../ui/TechFlatView';
import { GarmentViews, PreviewSwitch } from '../ui/PreviewSwitch';
import { PatternPreview } from '../ui/Preview';
import { PatternPane } from '../ui/PointEditor';
import { UndoToast, useUndo } from '../ui/useUndo';
import { FabricSwatches, GarmentFabric } from '../ui/FabricFill';
import { FabricCard, FabricSummary } from '../ui/FabricCard';
import { FabricDetails } from '../ui/FabricDetails';
import { ChoicePic, chipsClass } from '../ui/ChoicePic';
import { FormSketch } from '../ui/FormSketch';
import { armFor, formWidth } from '../ui/DrawOnForm';
import { landmarks } from '../ui/formLines';
import { type TeeFormMeasurements, teeForm, teeLines } from '../ui/formTops';
import { FABRIC, Group, LOOKS, StyleLayout, TabPanel } from '../ui/StyleLayout';
import { PiecesList, SummaryActions } from '../ui/StyleSummary';
import { FinishedTable, finishedLines } from '../ui/FinishedTable';
import type { BodiceMeasurements } from '../engine/bodice';
import type { KnitDressMeasurements } from '../engine/knitDress';
import type { TeeMeasurements } from '../engine/tee';

type RangeDraft = KnitDressDraft | HoodieDraft | JumpsuitDraft;

interface Props {
  onPhoto?: () => void;
  photo?: string;
  choices: RangeChoices;
  onChoices: (c: RangeChoices) => void;
  onChooseGarment: () => void;
  values: MeasurementValues;
  draft?: RangeDraft;
  error?: string;
  onEditMeasurements: () => void;
  onNext: () => void;
  saveState: 'can' | 'saved' | 'full';
  onSave: () => void;
  onAccount: () => void;
  fabric?: MyFabric;
  onFabric?: (f: MyFabric) => void;
  finish?: Finish;
  onFinish?: (f: Finish) => void;
  mode?: Mode;
  onMode?: (m: Mode) => void;
}

// Where this page's own questions sit among the usual steps.
const SECTIONS: Record<string, string> = {
  'Fit at the top': 'Shape',
  'Fit at the hip': 'Shape',
  Skirt: 'Shape',
  Hood: 'Neck & sleeves',
  Finish: 'Length & hem',
  Pocket: 'Details',
};

/** The engine's warnings are written for the pattern cutter; this turns them into a nudge (as the T-shirt's page does). */
function friendly(w: string) {
  if (w.startsWith('bust widened')) return 'Your shoulders are broad next to your bust, so it is cut a little roomier at the bust for the armholes to fit.';
  if (w.startsWith('sleeve')) return 'Your armhole is large next to your upper arm, so the sleeve is cut a little wider to fit it. Please check both measurements.';
  if (w.startsWith('armhole')) return 'Your armhole measurement is large for the rest of you, so the armhole is drafted as close to it as the block allows. Please re-measure it.';
  return `One of your measurements looks unusual (${w}). Please double-check it.`;
}

/** A boxy hoodie on the form: its dropped armhole is filled in straight from the shoulder down to the underarm, so the
 *  body reads as the box it is cut as, with the sleeves hanging in front of it. */
function boxed(shapes: P[][]): P[][] {
  const [body, ...rest] = shapes;
  if (!body?.length) return shapes;
  const top = Math.min(...body.map((q) => q.y));
  const widest = (pts: P[]) => pts.reduce((a, b) => (Math.abs(b.x) > Math.abs(a.x) + 0.3 ? b : a));
  const corners = [1, -1].map((sign) => {
    const side = body.filter((q) => Math.sign(q.x) === sign);
    // The shoulder tip near the top, and the underarm: the widest point in the armhole's reach below it.
    const tipPts = side.filter((q) => q.y < top + 8);
    if (!tipPts.length) return undefined;
    const tip = widest(tipPts);
    const underPts = side.filter((q) => q.y > tip.y + 8 && q.y < tip.y + 35);
    return underPts.length ? { sign, tip, under: widest(underPts) } : undefined;
  });
  const out = body.filter((q) => {
    const k = corners.find((c) => c && c.sign === Math.sign(q.x));
    if (!k || q.y <= k.tip.y + 0.3 || q.y >= k.under.y - 0.3) return true;
    const chord = Math.abs(k.tip.x) + ((Math.abs(k.under.x) - Math.abs(k.tip.x)) * (q.y - k.tip.y)) / (k.under.y - k.tip.y);
    return Math.abs(q.x) >= chord - 0.05;
  });
  return [out, ...rest];
}

type Group = { id: string; label: string; options: [string, string][] };

/** The page's words and drawings for each garment. */
function about(c: RangeChoices) {
  if (isKnitDress(c)) return { label: 'your knit dress', noun: 'knit dress', title: describeKnitDress(c), groups: KNIT_DRESS_GROUPS as Group[], looks: KNIT_DRESS_LOOKS as { code: string; name: string; choices: RangeChoices }[], knit: true };
  if (isHoodie(c)) return { label: 'your hoodie', noun: 'hoodie', title: describeHoodie(c), groups: HOODIE_GROUPS as Group[], looks: HOODIE_LOOKS as { code: string; name: string; choices: RangeChoices }[], knit: true };
  return { label: 'your jumpsuit', noun: 'jumpsuit', title: describeJumpsuit(c as JumpsuitChoices), groups: JUMPSUIT_GROUPS as Group[], looks: JUMPSUIT_LOOKS as { code: string; name: string; choices: RangeChoices }[], knit: false };
}

/** The choices pictured with the T-shirt's, bodice's or trousers' drawings, where the ids are the same. */
function pic(c: RangeChoices, group: string) {
  if (isJumpsuit(c)) return group === 'neckline' || group === 'sleeve' || group === 'sleeveShape' ? ('bodice' as const) : group === 'leg' ? ('trousers' as const) : undefined;
  return group === 'fit' || group === 'neckline' || group === 'sleeve' ? ('tee' as const) : undefined;
}

const sameLook = (a: RangeChoices, b: RangeChoices) => JSON.stringify(a) === JSON.stringify(isJumpsuit(b) ? validJumpsuit(b) : b);

export function RangeStyleScreen({ onPhoto, photo, choices, onChoices: setChoices, onChooseGarment, values, draft, error, onEditMeasurements, onNext, saveState, onSave, onAccount, fabric, onFabric, finish, onFinish, mode = 'all', onMode }: Props) {
  const undo = useUndo(choices, setChoices);
  const onChoices = undo.change;
  const [view, setView] = useState<'sketch' | 'flat' | 'pattern'>('sketch');
  const a = about(choices);
  const c = isJumpsuit(choices) ? validJumpsuit(choices) : choices;
  const pieces = useMemo(() => draft?.pieces ?? [], [draft]);
  const sheet = useMemo(() => (draft ? layout(pieces, '', []) : undefined), [draft, pieces]);
  const flat = useMemo(() => {
    if (!draft) return undefined;
    if ('trousers' in draft) return jumpsuitFlat(draft, values as unknown as TrousersMeasurements);
    if ('hood' in draft) return hoodieFlat(draft);
    return knitDressFlat(draft);
  }, [draft, values]);
  // On the form the hoodie's hood is worn down, so the face shows; the flat draws it up.
  const worn = useMemo(() => (draft && 'hood' in draft ? hoodieFlat(draft, true) : flat), [draft, flat]);
  const boxy = isHoodie(c) && c.fit === 'boxy';
  const cloth = useMemo(() => (worn ? (boxy ? boxed(wornShapes(worn)) : wornShapes(worn)) : undefined), [worn, boxy]);
  const flatLines = useMemo(() => (worn ? wornLines(worn) : undefined), [worn]);
  const metres = draft ? ('trousers' in draft ? jumpsuitMetres(draft) : 'hood' in draft ? hoodieMetres(draft) : knitDressMetres(draft)) : undefined;
  const spec = draft
    ? 'trousers' in draft
      ? jumpsuitSpec(values as unknown as BodiceMeasurements & TrousersMeasurements, draft)
      : 'hood' in draft
        ? hoodieSpec(values as unknown as TeeMeasurements, draft)
        : knitDressSpec(values as unknown as KnitDressMeasurements, draft)
    : undefined;

  // The knits on the T-shirt's form, carried down to the hem; the jumpsuit on the bodice's form with legs.
  const knitForm = useMemo(() => {
    if (!draft || 'trousers' in draft || isJumpsuit(c)) return undefined;
    const tee: TeeDraft = draft.tee;
    const k = c as KnitDressChoices | HoodieChoices;
    const form = teeForm(values as TeeFormMeasurements, { garment: 'tee', fit: teeFitOf(k.fit), stretch: k.stretch, neckline: 'neckline' in k ? k.neckline : 'crew', sleeve: 'sleeve' in k ? k.sleeve : 'long', length: 'tunic' }, tee);
    // The skater skirt is a piece of its own below the waist seam, so its length is added to the bodice's.
    const hemY = bounds(draft.pieces[0])[3] + ('skater' in draft && draft.skater ? draft.skater.length : 0);
    return { form, lines: teeLines(tee, form), bottom: hemY + 16 };
  }, [draft, c, values]);
  const jumpForm = useMemo(() => {
    if (!draft || !('trousers' in draft)) return undefined;
    const m = values as unknown as BodiceMeasurements & { arm_length?: number; upper_arm?: number; wrist?: number };
    const marks = landmarks(draft.bodice);
    const arms = draft.sleeve && m.arm_length && m.upper_arm ? armFor(marks.shoulderTip, marks.underarm, { arm_length: m.arm_length, upper_arm: m.upper_arm, wrist: m.wrist }) : undefined;
    return { body: formWidth(draft.bodice, m), arms, underarmY: marks.underarm.y, bottom: marks.waistY + Math.max(draft.trousers.lengthCm + 4, ((values as { waist_to_knee?: number }).waist_to_knee ?? 58) + 8) };
  }, [draft, values]);

  const value = (id: string) => String((c as unknown as Record<string, unknown>)[id]);
  const pick = (id: string, v: string) => onChoices({ ...c, [id]: v === 'true' ? true : v === 'false' ? false : v } as RangeChoices);
  // The jumpsuit only offers what can be cut with the rest: a collar on a crew neck, buttons with a front that opens.
  const offered = (g: Group) => (isJumpsuit(c) ? g.options.filter(([id]) => String((validJumpsuit({ ...c, [g.id]: id } as JumpsuitChoices) as unknown as Record<string, unknown>)[g.id]) === id) : g.options);
  const label = `The ${a.title.toLowerCase()} on your form`;
  const knitFabric = isJumpsuit(c) ? undefined : (c as KnitDressChoices | HoodieChoices);
  const advice = knitFabric ? { ...teeFabrics({ ...knitFabric, fit: teeFitOf(knitFabric.fit) }), style: `a ${a.noun}` } : { ...trousersFabrics({ leg: (c as JumpsuitChoices).leg }), style: 'a jumpsuit' };

  return (
    <StyleLayout
      fabric={fabric}
      onEditMeasurements={onEditMeasurements}
      onPrint={onNext}
      flat={flat}
      undo={undo}
      sections={SECTIONS}
      label={a.label}
      garment={c.garment}
      name={a.title}
      metres={metres}
      ready={!!draft}
      onChooseGarment={onChooseGarment}
      onPhoto={onPhoto}
      photo={photo}
      mode={mode}
      onMode={onMode}
      finished={draft && spec && <FinishedTable lines={finishedLines(spec, { knit: a.knit })} noun={a.noun} />}
    >
      <section className="card numbered" aria-labelledby="opts">
        <TabPanel tab={LOOKS}>
          <p className="muted small">In testing: a new pattern, drafted to you. Start from a look, then change anything.</p>
          <div className="chips">
            {a.looks.map((l) => (
              <button key={l.code} type="button" className={sameLook(c, l.choices) ? 'chip on' : 'chip'} aria-pressed={sameLook(c, l.choices)} onClick={() => onChoices(l.choices)}>
                {l.name}
              </button>
            ))}
          </div>
        </TabPanel>
        {a.groups.map((g) => {
          const options = offered(g);
          if (options.length < 2) return null;
          const set = pic(c, g.id);
          return (
            <Group key={g.id} label={g.label}>
              <div className={set ? chipsClass(set, g.id) : 'chips'}>
                {options.map(([id, text]) => (
                  <button key={id} type="button" className={value(g.id) === id ? 'chip on' : 'chip'} aria-pressed={value(g.id) === id} onClick={() => pick(g.id, id)}>
                    {set && <ChoicePic set={set} group={g.id} id={id} />}
                    {text}
                  </button>
                ))}
              </div>
              {g.id === 'stretch' && (
                <details className="how-to-test muted small">
                  <summary>How to test</summary>
                  <p>{STRETCH_TEST}</p>
                </details>
              )}
            </Group>
          );
        })}
        {draft && metres !== undefined && (
          <TabPanel tab={FABRIC}>
            <FabricCard metres={metres} advice={advice} fabric={fabric} knit={a.knit}>
              {finish && onFinish ? (
                <FabricSwatches finish={finish} onFinish={onFinish} garment={a.knit ? 'tee' : 'dress'} details />
              ) : (
                onFabric && <FabricDetails fabric={fabric} garment={a.knit ? 'tee' : 'dress'} onFabric={onFabric} />
              )}
            </FabricCard>
          </TabPanel>
        )}
      </section>

      <section className="card grow" aria-label="Preview">
        <PreviewSwitch look={view === 'pattern' ? 'pattern' : 'garment'} onLook={(l) => setView(l === 'pattern' ? 'pattern' : 'sketch')} />
        <div className="row between wrap">
          {/* The view bar stays on the pattern too, with Pattern lit at its end (Cat, Nov 8). */}
          <GarmentViews<'sketch' | 'flat'>
            views={[
              ['sketch', 'Front'],
              ['flat', 'Flat'],
            ]}
            view={view}
            onView={setView}
          />
        </div>
        <div className="preview">
          {error && <p className="msg error">{error}</p>}
          {view === 'sketch' && knitForm && draft && 'tee' in draft && (
            <GarmentFabric fabric={fabric}>
              <FormSketch body={knitForm.form.body} m={values as TeeFormMeasurements} legs={isKnitDress(c)} bottom={knitForm.bottom} arms={knitForm.form.arm} lines={knitForm.lines} cloth={cloth} flatLines={flatLines} sleeve={draft.tee.sleeve} sleevesOver={boxy} label={label} />
            </GarmentFabric>
          )}
          {view === 'sketch' && jumpForm && draft && 'trousers' in draft && (
            <GarmentFabric fabric={fabric}>
              <FormSketch body={jumpForm.body} m={values as unknown as BodiceMeasurements} legs bottom={jumpForm.bottom} lines={{}} cloth={cloth} flatLines={flatLines} arms={jumpForm.arms} sleeve={jumpForm.arms ? draft.sleeve : undefined} underarmY={jumpForm.underarmY} label={label} />
            </GarmentFabric>
          )}
          {flat && view === 'flat' && (
            <GarmentFabric fabric={fabric}>
              <TechFlatView flat={flat} title={a.title} />
            </GarmentFabric>
          )}
          {sheet && view === 'pattern' && (
            <PatternPane>
              <PatternPreview paper sheet={sheet} label={`Pattern pieces for ${a.title.toLowerCase()}`} />
            </PatternPane>
          )}
          <UndoToast undo={undo} />
        </div>
        <p className="muted small">Drafted to your measurements as you choose. In testing: tell us how it sews.</p>
        {draft?.warnings.map((w) => (
          <p key={w} className="msg small">
            {friendly(w)}
          </p>
        ))}
      </section>

      <aside className="card" aria-labelledby="sum">
        <h2 id="sum">Summary</h2>
        <PiecesList pieces={pieces} />
        {metres !== undefined && <FabricSummary metres={metres} fabric={fabric} />}
        <p className="muted small">
          {a.knit
            ? 'Seam allowances are 1 cm, the usual for knits, with 2.5 cm at the hem. Bands are cut shorter than the edge they go on so they lie flat.'
            : 'Seam allowances follow your choice on the print page. Make a toile first: a jumpsuit has to fit from the shoulder to the crotch at once.'}
        </p>
        <SummaryActions ready={!!draft} onNext={onNext} saveState={saveState} onSave={onSave} onAccount={onAccount} onEditMeasurements={onEditMeasurements} />
      </aside>
    </StyleLayout>
  );
}

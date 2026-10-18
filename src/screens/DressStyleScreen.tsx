import { useMemo, useState } from 'react';
import { layout } from '../engine/export';
import { bodiceEase } from '../engine/bodice';
import { isTop } from '../engine/corset';
import type { DressDraft } from '../engine/dress';
import { dressFlat } from '../engine/flat';
import { piecesLengthCm, toMetres } from '../engine/fabric';
import { layPlan } from '../engine/layplan';
import { hasSlit } from '../engine/instructions';
import { SHAPES_FOR_LENGTH, SleeveDraft, needsArms } from '../engine/sleeve';
import { BODICE_GROUPS, BodiceChoices, DARTS_FOR_FIT, DressChoices, detailAllowed, sleeveOf, topAllowed, validDetails } from '../garments';
import type { MeasurementValues } from '../measurements';
import { SaveControl } from '../ui/SaveControl';
import { UndoToast, UndoTools, useUndo } from '../ui/useUndo';
import { PatternPreview } from '../ui/Preview';
import { PatternPane } from '../ui/PointEditor';
import { TechFlatView } from '../ui/TechFlatView';
import { FabricSwatches, GarmentFabric } from '../ui/FabricFill';
import { DETAIL_GROUPS, GROUPS } from './StyleScreen';
import { cutAllowed, validCut } from '../engine/slip';
import { describePattern } from './describe';
import { FABRIC, Group, PRO, StyleLayout, TabPanel } from '../ui/StyleLayout';

import { Mode, ProTool, shows } from '../mode';
import { EaseMapView } from '../ui/EaseMapView';
import { MyFabric, dressFabrics, fabricEase } from '../engine/fabrics';
import { FabricCard, FabricSummary } from '../ui/FabricCard';
import type { EaseView } from '../engine/easeMap';
import { FinishChoices } from '../ui/FinishChoices';
import type { Finish } from '../App';
import { GODET_OPTIONS, VOLUME_OPTIONS, layoutExtras, setVolume, volumeAllowed, volumeOf } from '../engine/skirtVolume';
import { isDraped, zipSide } from '../engine/drape';
import { lengthRange } from '../engine/skirt';
import type { BodiceMeasurements } from '../engine/bodice';
import type { SkirtMeasurements } from '../engine/skirt';
import { DrawOnForm, formWidth } from '../ui/DrawOnForm';
import { orSeam, readSeamLine } from '../ui/formSeams';
import { orNeckline, readUnevenNeckline, unevenNecklineLines } from '../ui/formBodice';
import { REPLACES } from './BodiceStyleScreen';
import { bodiceLines, landmarks, readDrape, readFit, readNeckline, readSeam, readSkirtHem, skirtLines } from '../ui/formLines';
import { ChoicePic, chipsClass } from '../ui/ChoicePic';

/** Moving the shaping is a pro tool, so these groups sit on the Pro tab. */
const PRO_GROUPS: string[] = ['princess', 'bustDart'];

interface Props {
  /** Start from a photo, and the photo this garment was matched to while the app is open. */
  onPhoto?: () => void;
  photo?: string;
  choices: DressChoices;
  onChoices: (c: DressChoices) => void;
  /** Open the list of what to make, to pick another garment. */
  onChooseGarment: () => void;
  values: MeasurementValues;
  draft?: DressDraft;
  sleeve?: SleeveDraft;
  error?: string;
  onEditMeasurements: () => void;
  onNext: () => void;
  saveState: 'can' | 'saved' | 'full';
  onSave: () => void;
  onAccount: () => void;
  /** Room over the body at every level, for the ease map. */
  easeMap?: EaseView[];
  finish: Finish;
  onFinish: (f: Finish) => void;
  /** The fabric recorded on the print screen, if any. */
  fabric?: MyFabric;
  /** Simple or all tools; all when not given. */
  mode?: Mode;
  onMode?: (m: Mode) => void;
}

type Option = { id: string; label: string; options: [string, string][] };

/** Fabric for the dress on 140 cm wide fabric, from the cutting layout, or a rough estimate. */
// Whole bias pieces too wide for 140 cm cloth are bought 150 cm wide.
export const dressFabricMetres = (pieces: DressDraft['pieces']) =>
  (layPlan(pieces, 140) ?? (pieces.some((pc) => pc.meta.bias) ? layPlan(pieces, 150) : undefined))?.metres ?? toMetres(piecesLengthCm(pieces) + 10);

/**
 * Style the dress: one fit for the whole dress, the bodice's neckline, darts and sleeves, and the
 * skirt's shape and length. The preview is the technical flat, so the skirt is seen hanging from the
 * bodice with its darts running on through the waist seam.
 */
export function DressStyleScreen({ onPhoto, photo, choices, onChoices: setChoices, onChooseGarment, values, draft, sleeve, error, onEditMeasurements, onNext, saveState, onSave, onAccount, easeMap, finish, onFinish, fabric, mode = 'all', onMode }: Props) {
  const undo = useUndo(choices, setChoices);
  const onChoices = undo.change;
  const can = (t: ProTool) => shows(mode, t);
  const [picked, setView] = useState<'sketch' | 'pattern' | 'ease'>('sketch');
  /** Drawing on the form: the choices from before, to keep or go back to. */
  const [onForm, setOnForm] = useState<DressChoices>();
  const view = picked === 'ease' && !can('easeMap') ? 'sketch' : picked;
  const pieces = useMemo(() => (draft ? [...draft.pieces.filter((pc) => /^Bodice/.test(pc.name)), ...(sleeve?.pieces ?? []), ...draft.skirt.pieces] : []), [draft, sleeve]);
  const sheet = useMemo(() => (pieces.length ? layout(pieces, '', []) : undefined), [pieces]);
  const flat = useMemo(() => (draft ? dressFlat(draft, 'binding', { sleeve, slit: hasSlit(choices.skirt) }) : undefined), [draft, sleeve, choices.skirt]);
  const title = describePattern(choices);
  const arms = !needsArms(values);
  const chosen = sleeveOf(choices.bodice);
  const valid = validDetails({ ...choices.bodice, fit: choices.fit, length: 'waist', closure: 'back_zip' }, 'dress');
  const boned = valid.structure === 'boned';
  const top = isTop(choices.bodice.neckline);
  const ease = bodiceEase(valid);
  const extra = fabricEase(fabric, 'dress');
  // A draped neckline is its own shaping: no princess seams, moved dart or collar.
  const draped = isDraped(choices.bodice);

  const groups: Option[] = [
    { id: 'fit', label: 'Fit', options: GROUPS[0].options },
    ...BODICE_GROUPS.filter(
      (g) =>
        g.id === 'neckline' ||
        g.id === 'darts' ||
        (g.id === 'princess' && !boned && !draped && (can('dartMoves') || (choices.bodice.princess ?? 'none') !== 'none')) ||
        (g.id === 'bustDart' &&
          choices.bodice.darts !== 'none' &&
          (choices.bodice.princess ?? 'none') === 'none' &&
          !boned &&
          !draped &&
          (can('dartMoves') || (choices.bodice.bustDart ?? 'side') !== 'side')) ||
        (g.id === 'collar' && !top && !draped) ||
        (g.id === 'structure' && !draped) ||
        g.id === 'sleeve' ||
        (g.id === 'sleeveShape' && chosen.length !== 'none'),
    ).map((g) => ({
      id: g.id,
      label: g.label,
      options: g.options as [string, string][],
    })),
    { id: 'silhouette', label: 'Skirt', options: GROUPS[1].options },
    { id: 'length', label: 'Length', options: GROUPS[2].options },
    // The dress's zip runs down the centre back, so its skirt can't be cut whole for a diagonal hem.
    { id: 'asymHem', label: 'Hem', options: GROUPS[3].options.filter(([id]) => id !== 'diagonal') as [string, string][] },
    { id: 'volume', label: 'Skirt details', options: VOLUME_OPTIONS },
    { id: 'pockets', label: 'Pockets', options: DETAIL_GROUPS[1].options },
  ];

  const value = (id: string) =>
    id === 'volume'
      ? volumeOf(choices.skirt)
      : id === 'fit'
      ? choices.fit
      : id === 'asymHem'
        ? choices.skirt.asymHem ?? 'none'
      : id === 'silhouette' || id === 'length'
        ? choices.skirt[id]
        : id === 'pockets'
          ? (choices.skirt.pockets ?? 'none')
          : id === 'sleeve'
            ? chosen.length
            : id === 'sleeveShape'
              ? chosen.shape
              : id === 'bustDart'
                ? choices.bodice.bustDart ?? 'side'
                : id === 'princess'
                  ? choices.bodice.princess ?? 'none'
                  : id === 'collar'
                    ? choices.bodice.collar ?? 'none'
                    : id === 'structure'
                      ? valid.structure ?? 'none'
                      : choices.bodice[id as keyof BodiceChoices];

  // The dress's fit also sets the skirt's ease, so it stays free; a boned bodice keeps its own close fit.
  const allowed = (id: string, opt: string) => (id === 'fit' || topAllowed(choices.bodice, id, opt)) && baseAllowed(id, opt);
  const baseAllowed = (id: string, opt: string) =>
    id === 'volume'
      ? volumeAllowed(choices.skirt, opt as Parameters<typeof volumeAllowed>[1])
      : id === 'darts'
      ? DARTS_FOR_FIT[choices.fit].includes(opt as BodiceChoices['darts'])
      : id === 'sleeve'
        ? (opt === 'none' || arms) && detailAllowed(choices.bodice, 'sleeve', opt, 'dress')
        : id === 'sleeveShape'
          ? SHAPES_FOR_LENGTH[chosen.length].includes(opt as NonNullable<BodiceChoices['sleeveShape']>)
          : id === 'princess' || id === 'bustDart' || id === 'collar' || id === 'structure'
            ? detailAllowed({ ...choices.bodice, length: 'waist', closure: 'back_zip' }, id, opt, 'dress')
            : id === 'silhouette' || id === 'length' || id === 'asymHem'
              ? cutAllowed(choices.skirt, id, opt, 'dress')
              : true;

  const choose = (id: string, opt: string) => {
    if (id === 'silhouette' || id === 'length' || id === 'asymHem' || id === 'pockets') {
      // The dress skirt is styled by its chips: no era look, photo shape or hand-drawn changes.
      // Pleats, godets or a flounce stay; one the new shape, length or hem doesn't take falls back to none.
      const { fit, silhouette, length, asymHem, pleats, godets, flounce, pockets } = choices.skirt;
      onChoices({ ...choices, skirt: validCut({ fit, silhouette, length, ...(asymHem ? { asymHem } : {}), ...(pockets ? { pockets } : {}), pleats, godets, flounce, [id]: opt }) });
      return;
    }
    if (id === 'volume') {
      onChoices({ ...choices, skirt: setVolume(choices.skirt, opt as Parameters<typeof setVolume>[1]) });
      return;
    }
    const fit = id === 'fit' ? (opt as DressChoices['fit']) : choices.fit;
    const bodice = { ...choices.bodice, fit, ...(id === 'fit' ? {} : { [id]: opt }) } as BodiceChoices;
    // A chip lets go of what was drawn on the form for it.
    for (const k of REPLACES[id] ?? []) delete bodice[k];
    // A tighter fit needs more shaping, and each sleeve length allows only some shapes.
    const darts = DARTS_FOR_FIT[fit].includes(bodice.darts) ? bodice.darts : 'bust_waist';
    onChoices({ ...choices, fit, bodice: validDetails({ ...bodice, darts, length: 'waist', closure: 'back_zip', sleeveShape: sleeveOf(bodice).shape }, 'dress'), skirt: { ...choices.skirt, fit } });
  };

  if (onForm && draft) {
    // The bodice's lines are read at the dress's own fit and length; the hem is the skirt's.
    const asBodice: BodiceChoices = { ...choices.bodice, fit: choices.fit, length: 'waist', closure: 'back_zip' };
    const mv = values as BodiceMeasurements & SkirtMeasurements;
    const waistY = landmarks(draft.bodice).waistY;
    return (
      <DrawOnForm<DressChoices>
        body={formWidth(draft.bodice, mv)}
        m={mv}
        legs
        bottom={waistY + lengthRange(mv).max + 4}
        kinds={[
          ['neckline', 'Neckline'],
          ['seam', 'Seam'],
          ['drape', 'Drape'],
          ['fit', 'Side'],
          ['hem', 'Hem'],
        ]}
        lines={(side) => {
          const uneven = side === 'front' ? unevenNecklineLines(draft.bodice) : [];
          return { ...bodiceLines(draft.bodice, side), hem: skirtLines(draft.skirt, choices.skirt, mv, side, waistY).hem, ...(uneven.length ? { neckline: uneven } : {}) };
        }}
        choices={choices}
        onChoices={setChoices}
        read={(kind, side, stroke) => {
          if (kind === 'hem') {
            const r = readSkirtHem(stroke, waistY, draft.skirt, mv, choices.skirt, side, 'dress');
            return { said: r.said, choices: r.choices && { ...choices, skirt: r.choices } };
          }
          if (kind === 'fit') {
            const r = readFit(stroke, draft.bodice, mv, asBodice);
            return { said: r.said, choices: r.choices && { ...choices, fit: r.choices.fit, bodice: r.choices, skirt: { ...choices.skirt, fit: r.choices.fit } } };
          }
          const r =
            kind === 'neckline'
              ? orNeckline(readUnevenNeckline(stroke, draft.bodice, asBodice, 'dress', side), () => readNeckline(stroke, draft.bodice, asBodice, 'dress', side))
              : kind === 'seam'
                ? orSeam(readSeamLine(stroke, draft.bodice, asBodice, 'dress', side), () => readSeam(stroke, draft.bodice, asBodice, 'dress', side))
                : readDrape(stroke, draft.bodice, asBodice, 'dress');
          return { said: r.said, choices: r.choices && { ...choices, bodice: r.choices } };
        }}
        onDone={() => {
          undo.change(choices, onForm);
          setOnForm(undefined);
          setView('pattern');
        }}
        onCancel={() => {
          setChoices(onForm);
          setOnForm(undefined);
        }}
      />
    );
  }

  return (
    <StyleLayout
      label="your dress"
      name={title}
      metres={draft ? dressFabricMetres([...pieces, ...layoutExtras(draft.skirt)]) : undefined}
      ready={!!draft}
      onChooseGarment={onChooseGarment}
      onPhoto={onPhoto}
      photo={photo}
      mode={mode}
      onMode={onMode}
    >
      <section className="card numbered" aria-labelledby="opts">
        {groups.map((g) => (
          <Group key={g.id} label={g.label} tab={PRO_GROUPS.includes(g.id) ? PRO : undefined}>
            <div className={chipsClass((['silhouette', 'length', 'asymHem'].includes(g.id) ? 'skirt' : 'bodice'), g.id)}>
              {g.options.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={value(g.id) === id ? 'chip on' : 'chip'}
                  aria-pressed={value(g.id) === id}
                  disabled={!allowed(g.id, id)}
                  onClick={() => choose(g.id, id)}
                >
                  <ChoicePic set={(['silhouette', 'length', 'asymHem'].includes(g.id) ? 'skirt' : 'bodice')} group={g.id} id={id} />
                  {label}
                </button>
              ))}
            </div>
            {g.id === 'sleeve' && !arms && (
              <p className="muted small">
                For sleeves, add your arm length, upper arm and wrist.{' '}
                <button type="button" className="link inline-link" onClick={onEditMeasurements}>
                  Add them
                </button>
              </p>
            )}
            {g.id === 'volume' && volumeOf(choices.skirt) === 'godets' && (
              <div className="chips">
                {GODET_OPTIONS.map(([n, label]) => (
                  <button key={n} type="button" className={choices.skirt.godets === n ? 'chip on' : 'chip'} aria-pressed={choices.skirt.godets === n} onClick={() => onChoices({ ...choices, skirt: setVolume(choices.skirt, 'godets', n) })}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            {g.id === 'volume' &&
              (choices.skirt.silhouette === 'slip' ? (
                <p className="muted small">A bias slip hangs from the hip without pleats, godets, flounces or tiers.</p>
              ) : !volumeAllowed({ ...choices.skirt, asymHem: 'none' }, 'knife') ? (
                <p className="muted small">Pleats, godets, flounces and tiers go on a pencil, straight or A-line skirt.</p>
              ) : choices.skirt.asymHem === 'high_low' ? (
                <p className="muted small">A high-low hem takes godets. Pleats, flounces and tiers need a level hem.</p>
              ) : null)}
            {g.id === 'neckline' && draped && (
              <p className="muted small">
                {choices.bodice.neckline === 'cowl'
                  ? 'The bodice front is cut on the bias and falls in soft folds. It needs a fluid fabric.'
                  : (
                    <>
                    <span className="seg" role="group" aria-label="Which shoulder">
                      {(['left', 'right'] as const).map((sh) => (
                        <button key={sh} type="button" aria-pressed={(choices.bodice.shoulder ?? 'left') === sh} className={(choices.bodice.shoulder ?? 'left') === sh ? 'on' : ''} onClick={() => onChoices({ ...choices, bodice: sh === 'right' ? { ...choices.bodice, shoulder: sh } : (({ shoulder: _s, ...rest }) => rest)(choices.bodice) })}>
                          {sh}
                        </button>
                      ))}
                    </span>{' '}
                      Over your {choices.bodice.shoulder ?? 'left'} shoulder. The dress is sleeveless, with a zip in the {choices.bodice.shoulder === 'right' ? 'left' : 'right'} side seam.
                    </>
                  )}
              </p>
            )}
            {g.id === 'structure' && !top && <p className="muted small">Boning needs a strapless, sweetheart or cami top.</p>}
            {g.id === 'structure' && choices.bodice.neckline === 'strapless' && <p className="muted small">A strapless dress is always boned: the boning holds it up.</p>}
            {g.id === 'darts' && !boned && choices.fit !== 'relaxed' && (
              <p className="muted small">{choices.fit === 'fitted' ? 'A fitted dress needs bust and waist darts.' : 'Choose a relaxed fit to go without waist darts.'}</p>
            )}
          </Group>
        ))}
        {can('insideFinish') && (
          <TabPanel tab={PRO}>
            <p className="eyebrow">Inside the dress</p>
            <FinishChoices
              garment="dress"
              finish={finish}
              onFinish={onFinish}
              sleeved={sleeveOf(choices.bodice).length !== 'none'}
              edgeIds={boned ? ['lined'] : top ? ['binding', 'lined'] : undefined}
              edgeLegend={top ? 'Top edge' : undefined}
            />
          </TabPanel>
        )}
        {(flat || draft) && (
          <TabPanel tab={FABRIC}>
            {draft ? (
              <FabricCard
            metres={dressFabricMetres([...pieces, ...(draft ? layoutExtras(draft.skirt) : [])])}
            advice={dressFabrics({ fit: choices.fit, neckline: choices.bodice.neckline, silhouette: choices.skirt.silhouette, length: choices.skirt.length, structure: valid.structure, asymHem: choices.skirt.asymHem, pleats: choices.skirt.pleats, godets: choices.skirt.godets, flounce: choices.skirt.flounce })}
            fabric={fabric}>
                {flat && <FabricSwatches finish={finish} onFinish={onFinish} />}
              </FabricCard>
            ) : (
              <FabricSwatches finish={finish} onFinish={onFinish} />
            )}
          </TabPanel>
        )}
      </section>

      <section className="card grow" aria-label="Preview">
        <div className="row between wrap">
          <div className="seg" role="group" aria-label="Preview view">
            <button type="button" aria-pressed={view === 'sketch'} className={view === 'sketch' ? 'on' : ''} onClick={() => setView('sketch')}>
              Sketch
            </button>
            <button type="button" aria-pressed={view === 'pattern'} className={view === 'pattern' ? 'on' : ''} onClick={() => setView('pattern')}>
              Pieces
            </button>
            {easeMap && easeMap.length > 0 && can('easeMap') && (
              <button type="button" aria-pressed={view === 'ease'} className={view === 'ease' ? 'on' : ''} onClick={() => setView('ease')}>
                Ease
              </button>
            )}
          </div>
          <div className="row tools">
            <button type="button" className="link small" onClick={() => setOnForm(choices)}>
              Draw on your form
            </button>
            <UndoTools undo={undo} />
          </div>
        </div>
        <div className="preview">
          {error && <p className="msg error">{error}</p>}
          {flat && view === 'sketch' && (
            <GarmentFabric fabric={fabric}>
              <TechFlatView flat={flat} title={title} />
            </GarmentFabric>
          )}
          {sheet && view === 'pattern' && <PatternPane><PatternPreview paper sheet={sheet} label={`Pattern pieces for a ${title}`} /></PatternPane>}
          {view === 'ease' && easeMap && <EaseMapView views={easeMap} label={`Ease map of the ${title}`} />}
          <UndoToast undo={undo} />
        </div>
        <p className="muted small">
          Drafted to your measurements as you choose.{undo.shake.state === 'on' ? ' Shake your phone to undo.' : ''}
        </p>
      </section>

      <aside className="card" aria-labelledby="sum">
        <h2 id="sum">Summary</h2>
        <div className="sumgrid">
          <span />
          <span className="muted">Body</span>
          <span className="muted">Dress</span>
          <span>Bust</span>
          <span>{values.full_bust} cm</span>
          <strong>{draft ? draft.finishedBust : '–'} cm</strong>
          <span>Waist</span>
          <span>{values.waist} cm</span>
          <strong>{draft ? draft.finishedWaist : '–'} cm</strong>
          <span>Hip</span>
          <span>{values.full_hip} cm</span>
          <strong>{draft ? draft.finishedHip : '–'} cm</strong>
          <span>Nape to hem</span>
          <span />
          <strong>{draft ? draft.lengthCm : '–'} cm</strong>
          {sleeve && (
            <>
              <span>Upper arm</span>
              <span>{values.upper_arm} cm</span>
              <strong>{sleeve.bicep} cm</strong>
            </>
          )}
        </div>
        <p className="muted small">
          Ease added: {ease.bust + extra.bust} cm at the bust, {ease.waist + extra.waist} cm at the waist{boned ? ' (negative ease, so the boned bodice holds you)' : ''}
          {extra.bust ? `, including ${extra.bust} cm and ${extra.waist} cm for your heavy fabric` : ''}.
        </p>
        <div>
          <p className="eyebrow">Pattern pieces</p>
          <ul className="pieces">
            {pieces.map((pc) => (
              <li key={pc.name}>
                {pc.name}: {pc.cut.replace(' (1 pair)', '').toLowerCase()}
              </li>
            ))}
            {draft?.skirt.volume?.tiers?.bands.map((b) => (
              <li key={b.name}>
                {b.name}: cut {b.panels}, {b.cutLength} × {b.cutWidth} cm
              </li>
            ))}
          </ul>
        </div>
        {draft && <FabricSummary metres={dressFabricMetres([...pieces, ...(draft ? layoutExtras(draft.skirt) : [])])} fabric={fabric} />}
        <p className="muted small">
          {choices.skirt.silhouette === 'slip'
            ? 'The skirt is cut on the bias, for a slip dress: it has no darts, its waist seam is drafted to the bodice, and the cloth moulds to the hip.'
            : 'The skirt is drafted to the bodice: the waist seams are the same length, and the darts meet at the seam in one line.'}{' '}
          {draft?.zipSide ? `One zip opens the ${zipSide(draft.bodice)} side seam from under the arm to below the waist.` : `One zip opens the centre back from the ${top ? 'top edge' : 'neck'} to below the waist.`}
          {boned ? ' The bodice is boned like a corset, cut again from coutil and lining, with a grosgrain waist stay that carries the skirt.' : ''}
        </p>
        <button type="button" className="primary" disabled={!draft} onClick={onNext}>
          Print my pattern
        </button>
        <SaveControl state={saveState} disabled={!draft} onSave={onSave} onAccount={onAccount} />
        <button type="button" className="link" onClick={onEditMeasurements}>
          Edit measurements
        </button>
      </aside>
    </StyleLayout>
  );
}

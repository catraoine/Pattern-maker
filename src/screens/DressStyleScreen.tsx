import { useMemo, useState } from 'react';
import { layout } from '../engine/export';
import { BODICE_FIT_EASE } from '../engine/bodice';
import type { DressDraft } from '../engine/dress';
import { dressFlat } from '../engine/flat';
import { piecesLengthCm, toMetres } from '../engine/fabric';
import { layPlan } from '../engine/layplan';
import { hasSlit } from '../engine/instructions';
import { SHAPES_FOR_LENGTH, SleeveDraft, needsArms } from '../engine/sleeve';
import { BODICE_GROUPS, BodiceChoices, DARTS_FOR_FIT, DressChoices, detailAllowed, sleeveOf, validDetails } from '../garments';
import type { Garment, MeasurementValues } from '../measurements';
import { GarmentSwitch } from '../ui/GarmentSwitch';
import { PatternPreview } from '../ui/Preview';
import { TechFlatView } from '../ui/TechFlatView';
import { FREE_SAVED_LIMIT } from '../account';
import { GROUPS } from './StyleScreen';
import { describePattern } from './describe';

import { EaseMapView } from '../ui/EaseMapView';
import type { EaseView } from '../engine/easeMap';
import { FinishChoices } from '../ui/FinishChoices';
import type { Finish } from '../App';

interface Props {
  choices: DressChoices;
  onChoices: (c: DressChoices) => void;
  onGarment: (g: Garment) => void;
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
}

type Option = { id: string; label: string; options: [string, string][] };

/** Fabric for the dress on 140 cm wide fabric, from the cutting layout, or a rough estimate. */
export const dressFabricMetres = (pieces: DressDraft['pieces']) => layPlan(pieces, 140)?.metres ?? toMetres(piecesLengthCm(pieces) + 10);

/**
 * Style the dress: one fit for the whole dress, the bodice's neckline, darts and sleeves, and the
 * skirt's shape and length. The preview is the technical flat, so the skirt is seen hanging from the
 * bodice with its darts running on through the waist seam.
 */
export function DressStyleScreen({ choices, onChoices, onGarment, values, draft, sleeve, error, onEditMeasurements, onNext, saveState, onSave, onAccount, easeMap, finish, onFinish }: Props) {
  const [view, setView] = useState<'sketch' | 'pattern' | 'ease'>('sketch');
  const pieces = useMemo(() => (draft ? [...draft.pieces.filter((pc) => /^Bodice/.test(pc.name)), ...(sleeve?.pieces ?? []), ...draft.skirt.pieces] : []), [draft, sleeve]);
  const sheet = useMemo(() => (pieces.length ? layout(pieces, '', []) : undefined), [pieces]);
  const flat = useMemo(() => (draft ? dressFlat(draft, 'binding', { sleeve, slit: hasSlit(choices.skirt) }) : undefined), [draft, sleeve, choices.skirt]);
  const title = describePattern(choices);
  const arms = !needsArms(values);
  const chosen = sleeveOf(choices.bodice);
  const ease = BODICE_FIT_EASE[choices.fit];

  const groups: Option[] = [
    { id: 'fit', label: 'Fit', options: GROUPS[0].options },
    ...BODICE_GROUPS.filter(
      (g) =>
        g.id === 'neckline' ||
        g.id === 'darts' ||
        g.id === 'princess' ||
        (g.id === 'bustDart' && choices.bodice.darts !== 'none' && (choices.bodice.princess ?? 'none') === 'none') ||
        g.id === 'collar' ||
        g.id === 'sleeve' ||
        (g.id === 'sleeveShape' && chosen.length !== 'none'),
    ).map((g) => ({
      id: g.id,
      label: g.label,
      options: g.options as [string, string][],
    })),
    { id: 'silhouette', label: 'Skirt', options: GROUPS[1].options },
    { id: 'length', label: 'Length', options: GROUPS[2].options },
  ];

  const value = (id: string) =>
    id === 'fit'
      ? choices.fit
      : id === 'silhouette' || id === 'length'
        ? choices.skirt[id]
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
                  : choices.bodice[id as keyof BodiceChoices];

  const allowed = (id: string, opt: string) =>
    id === 'darts'
      ? DARTS_FOR_FIT[choices.fit].includes(opt as BodiceChoices['darts'])
      : id === 'sleeve'
        ? opt === 'none' || arms
        : id === 'sleeveShape'
          ? SHAPES_FOR_LENGTH[chosen.length].includes(opt as NonNullable<BodiceChoices['sleeveShape']>)
          : id === 'princess' || id === 'bustDart' || id === 'collar'
            ? detailAllowed({ ...choices.bodice, length: 'waist', closure: 'back_zip' }, id, opt, 'dress')
            : true;

  const choose = (id: string, opt: string) => {
    if (id === 'silhouette' || id === 'length') {
      // The dress skirt is styled by its chips: no era look, photo shape or hand-drawn changes.
      onChoices({ ...choices, skirt: { fit: choices.fit, silhouette: choices.skirt.silhouette, length: choices.skirt.length, [id]: opt } });
      return;
    }
    const fit = id === 'fit' ? (opt as DressChoices['fit']) : choices.fit;
    const bodice = { ...choices.bodice, fit, ...(id === 'fit' ? {} : { [id]: opt }) } as BodiceChoices;
    // A tighter fit needs more shaping, and each sleeve length allows only some shapes.
    const darts = DARTS_FOR_FIT[fit].includes(bodice.darts) ? bodice.darts : 'bust_waist';
    onChoices({ ...choices, fit, bodice: validDetails({ ...bodice, darts, length: 'waist', closure: 'back_zip', sleeveShape: sleeveOf(bodice).shape }, 'dress'), skirt: { ...choices.skirt, fit } });
  };

  return (
    <div className="split three">
      <section className="card" aria-labelledby="opts">
        <div className="row between wrap">
          <h1 id="opts">Style your dress</h1>
          <GarmentSwitch garment="dress" onGarment={onGarment} />
        </div>
        {groups.map((g) => (
          <fieldset key={g.id} className="group">
            <legend>{g.label}</legend>
            <div className="chips">
              {g.options.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={value(g.id) === id ? 'chip on' : 'chip'}
                  aria-pressed={value(g.id) === id}
                  disabled={!allowed(g.id, id)}
                  onClick={() => choose(g.id, id)}
                >
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
            {g.id === 'darts' && choices.fit !== 'relaxed' && (
              <p className="muted small">{choices.fit === 'fitted' ? 'A fitted dress needs bust and waist darts.' : 'Choose a relaxed fit to go without waist darts.'}</p>
            )}
          </fieldset>
        ))}
        <p className="eyebrow">Inside the dress</p>
        <FinishChoices garment="dress" finish={finish} onFinish={onFinish} sleeved={sleeveOf(choices.bodice).length !== 'none'} />
        <p className="muted small">
          The skirt is drafted to the bodice: the waist seams are the same length, and the darts meet at the seam in one line. One zip opens the centre back from the neck to below the waist.
        </p>
      </section>

      <section className="card grow" aria-label="Preview">
        <div className="row between wrap">
          <div className="seg" role="group" aria-label="Preview view">
            <button type="button" aria-pressed={view === 'sketch'} className={view === 'sketch' ? 'on' : ''} onClick={() => setView('sketch')}>
              Sketch
            </button>
            <button type="button" aria-pressed={view === 'pattern'} className={view === 'pattern' ? 'on' : ''} onClick={() => setView('pattern')}>
              Pattern pieces
            </button>
            {easeMap && easeMap.length > 0 && (
              <button type="button" aria-pressed={view === 'ease'} className={view === 'ease' ? 'on' : ''} onClick={() => setView('ease')}>
                Ease
              </button>
            )}
          </div>
          <p className="muted small">Drafted to your measurements as you choose.</p>
        </div>
        <div className="preview">
          {error && <p className="msg error">{error}</p>}
          {flat && view === 'sketch' && <TechFlatView flat={flat} title={title} />}
          {sheet && view === 'pattern' && <PatternPreview sheet={sheet} label={`Pattern pieces for a ${title}`} />}
          {view === 'ease' && easeMap && <EaseMapView views={easeMap} label={`Ease map of the ${title}`} />}
        </div>
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
          Ease added: {ease.bust} cm at the bust, {ease.waist} cm at the waist.
        </p>
        <div>
          <p className="eyebrow">Pattern pieces</p>
          <ul className="pieces">
            {pieces.map((pc) => (
              <li key={pc.name}>
                {pc.name}: {pc.cut.replace(' (1 pair)', '').toLowerCase()}
              </li>
            ))}
          </ul>
        </div>
        {draft && (
          <div className="fabric">
            <p className="eyebrow">Fabric</p>
            <p className="big">{dressFabricMetres(pieces).toFixed(1)} m</p>
            <p className="muted small">of 140 cm wide woven fabric, rough estimate</p>
          </div>
        )}
        <button type="button" className="primary" disabled={!draft} onClick={onNext}>
          Print my pattern
        </button>
        {saveState === 'can' && (
          <button type="button" className="secondary" disabled={!draft} onClick={onSave}>
            Save pattern
          </button>
        )}
        {saveState === 'saved' && (
          <p className="msg small" role="status">
            Saved to <button type="button" className="link inline-link" onClick={onAccount}>your account</button>.
          </p>
        )}
        {saveState === 'full' && (
          <p className="muted small">
            You've saved {FREE_SAVED_LIMIT} patterns, the free limit.{' '}
            <button type="button" className="link inline-link" onClick={onAccount}>Manage saved patterns</button>
          </p>
        )}
        <button type="button" className="link" onClick={onEditMeasurements}>
          Edit measurements
        </button>
      </aside>
    </div>
  );
}

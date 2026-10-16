import { useMemo, useState } from 'react';
import { layout } from '../engine/export';
import { BODICE_FIT_EASE, BodiceDraft, needsHip } from '../engine/bodice';
import { piecesLengthCm, toMetres } from '../engine/fabric';
import { layPlan } from '../engine/layplan';
import { BODICE_GROUPS, BodiceChoices, DARTS_FOR_FIT, describeBodice, detailAllowed, sleeveOf, validDetails } from '../garments';
import { bodiceFlat } from '../engine/flat';
import { TechFlatView } from '../ui/TechFlatView';
import { SHAPES_FOR_LENGTH, SleeveDraft, needsArms } from '../engine/sleeve';
import { Garment, MeasurementValues, hasHip } from '../measurements';
import { PatternPreview } from '../ui/Preview';
import { GarmentSwitch } from '../ui/GarmentSwitch';
import { FREE_SAVED_LIMIT } from '../account';

interface Props {
  choices: BodiceChoices;
  onChoices: (c: BodiceChoices) => void;
  onGarment: (g: Garment) => void;
  values: MeasurementValues;
  draft?: BodiceDraft;
  /** The set-in sleeve, drafted to the bodice's armhole, when one is chosen. */
  sleeve?: SleeveDraft;
  error?: string;
  onEditMeasurements: () => void;
  onNext: () => void;
  saveState: 'can' | 'saved' | 'full';
  onSave: () => void;
  onAccount: () => void;
}

/** Fabric needed on 140 cm wide fabric, from the cutting layout. */
export const bodiceFabricMetres = (draft: BodiceDraft, sleeve?: SleeveDraft) => {
  const pieces = [...draft.pieces, ...(sleeve?.pieces ?? [])];
  return layPlan(pieces, 140)?.metres ?? toMetres(piecesLengthCm(pieces) + 10);
};

/** Bias binding for the neck and armholes; with sleeves, for the neck, or for the armhole seams of a lined bodice.
 * Some to spare for joins. */
export const bindingMetres = (draft: BodiceDraft, binds: { neck: boolean; armholes: boolean } = { neck: true, armholes: true }) =>
  toMetres((binds.neck ? draft.neck : 0) + (binds.armholes ? 2 * draft.armhole : 0) + 20);

/** The engine's warnings are written for the pattern cutter; this turns the common ones into a nudge. */
function friendly(w: string) {
  if (w.startsWith('shoulder width')) return 'Your shoulder width and shoulder length don’t quite agree. The pattern still drafts, but re-measuring both will make the shoulders fit better.';
  if (w.startsWith('front length')) return 'Your front length came out shorter than your back length, which usually means a tape slip. It’s drafted with a little extra; please re-measure it.';
  return 'Something in your measurements looks unusual. Please double-check them.';
}

export function BodiceStyleScreen({ choices, onChoices, onGarment, values, draft, sleeve, error, onEditMeasurements, onNext, saveState, onSave, onAccount }: Props) {
  const [view, setView] = useState<'sketch' | 'pattern'>('sketch');
  const pieces = useMemo(() => (draft ? [...draft.pieces, ...(sleeve?.pieces ?? [])] : []), [draft, sleeve]);
  const sheet = useMemo(() => (draft ? layout(pieces, '', []) : undefined), [draft, pieces]);
  const ease = BODICE_FIT_EASE[choices.fit];
  const title = describeBodice(choices);
  const hip = hasHip(values);
  const arms = !needsArms(values);
  const chosen = sleeveOf(choices);
  const flat = useMemo(() => (draft ? bodiceFlat(draft, 'binding', sleeve) : undefined), [draft, sleeve]);
  const detail = { bustDart: choices.bustDart ?? 'side', princess: choices.princess ?? 'none', closure: choices.closure ?? 'back_zip', collar: choices.collar ?? 'none' };
  const valueOf = (id: (typeof BODICE_GROUPS)[number]['id']) =>
    id === 'sleeveShape' ? chosen.shape : id === 'sleeve' ? chosen.length : id in detail ? detail[id as keyof typeof detail] : choices[id];
  const shown = (id: string) =>
    (id !== 'sleeveShape' || chosen.length !== 'none') && (id !== 'bustDart' || (choices.darts !== 'none' && detail.princess === 'none'));

  const allowed = (id: string, opt: string) =>
    id === 'darts'
      ? DARTS_FOR_FIT[choices.fit].includes(opt as BodiceChoices['darts'])
      : id === 'length'
        ? hip || !needsHip(opt as BodiceChoices['length'])
        : id === 'sleeve'
          ? opt === 'none' || arms
          : id === 'sleeveShape'
            ? SHAPES_FOR_LENGTH[chosen.length].includes(opt as NonNullable<BodiceChoices['sleeveShape']>)
            : id === 'princess' || id === 'bustDart' || id === 'closure' || id === 'collar'
              ? detailAllowed(choices, id, opt)
              : true;

  const choose = (c: BodiceChoices) => {
    // A tighter fit needs more shaping, so moving to it brings the darts back.
    const darts = DARTS_FOR_FIT[c.fit].includes(c.darts) ? c.darts : 'bust_waist';
    // Each sleeve length allows only some shapes; keep the chosen one when it still fits.
    // Details the other choices no longer allow (a collar on a V-neck, say) fall back to the plain ones.
    onChoices(validDetails({ ...c, darts, sleeveShape: sleeveOf(c).shape }));
  };

  return (
    <div className="split three">
      <section className="card" aria-labelledby="opts">
        <div className="row between wrap">
          <h1 id="opts">Style your bodice</h1>
          <GarmentSwitch garment="bodice" onGarment={onGarment} />
        </div>
        {BODICE_GROUPS.filter((g) => shown(g.id)).map((g) => (
          <fieldset key={g.id} className="group">
            <legend>{g.label}</legend>
            <div className="chips">
              {g.options.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={valueOf(g.id) === id ? 'chip on' : 'chip'}
                  aria-pressed={valueOf(g.id) === id}
                  disabled={!allowed(g.id, id)}
                  onClick={() => choose({ ...choices, [g.id]: id })}
                >
                  {label}
                </button>
              ))}
            </div>
            {g.id === 'length' && !hip && (
              <p className="muted small">
                For hip lengths, add your full hip and waist to hip.{' '}
                <button type="button" className="link inline-link" onClick={onEditMeasurements}>
                  Add them
                </button>
              </p>
            )}
            {g.id === 'sleeve' && !arms && (
              <p className="muted small">
                For sleeves, add your arm length, upper arm and wrist.{' '}
                <button type="button" className="link inline-link" onClick={onEditMeasurements}>
                  Add them
                </button>
              </p>
            )}
            {g.id === 'princess' && choices.darts !== 'bust_waist' && <p className="muted small">Princess seams carry the bust and waist darts, so they need both.</p>}
            {g.id === 'collar' && choices.neckline !== 'crew' && <p className="muted small">Collars sit on a crew neck (a Peter Pan on a scoop neck too).</p>}
            {g.id === 'collar' && choices.neckline === 'crew' && detail.closure !== 'front_buttons' && <p className="muted small">A shirt collar needs the front buttons.</p>}
            {g.id === 'darts' && choices.fit !== 'relaxed' && (
              <p className="muted small">{choices.fit === 'fitted' ? 'A fitted bodice needs bust and waist darts.' : 'Choose a relaxed fit to go without darts.'}</p>
            )}
          </fieldset>
        ))}
        <p className="muted small">
          {detail.closure === 'front_buttons' ? `Buttons down the centre front${draft?.buttons ? ` (${draft.buttons.count})` : ''}, with front facings.` : 'With a centre back zip.'}{' '}
          {chosen.length === 'none'
            ? 'The neckline and armholes are finished with bias binding.'
            : 'The sleeves are drafted to fit your armholes, with their ease set where a tailor sets it.'}
          {detail.princess !== 'none' || detail.bustDart !== 'side' ? ' The shaping is moved the way a pattern cutter does it: the garment sews up to exactly the same fit.' : ''}
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
          </div>
          <p className="muted small">Drafted to your measurements as you choose.</p>
        </div>
        <div className="preview">
          {error && <p className="msg error">{error}</p>}
          {flat && view === 'sketch' && <TechFlatView flat={flat} title={title} />}
          {draft && sheet && view === 'pattern' && <PatternPreview sheet={sheet} label={`Front and back pattern pieces for a ${title}`} />}
        </div>
        {draft?.warnings.map((w) => (
          <p key={w} className="msg small">
            {friendly(w)}
          </p>
        ))}
      </section>

      <aside className="card" aria-labelledby="sum">
        <h2 id="sum">Summary</h2>
        <div className="sumgrid">
          <span />
          <span className="muted">Body</span>
          <span className="muted">Bodice</span>
          <span>Bust</span>
          <span>{values.full_bust} cm</span>
          <strong>{draft ? draft.finishedBust : '–'} cm</strong>
          <span>Waist</span>
          <span>{values.waist} cm</span>
          <strong>{draft ? draft.finishedWaist : '–'} cm</strong>
          {draft?.finishedHem !== undefined && (
            <>
              <span>Hem</span>
              <span />
              <strong>{draft.finishedHem} cm</strong>
            </>
          )}
          <span>Back length</span>
          <span />
          <strong>{draft ? draft.backLength : '–'} cm</strong>
          {sleeve && (
            <>
              <span>Upper arm</span>
              <span>{values.upper_arm} cm</span>
              <strong>{sleeve.bicep} cm</strong>
              <span>Sleeve length</span>
              <span />
              <strong>{sleeve.lengthCm} cm</strong>
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
            <p className="big">{bodiceFabricMetres(draft, sleeve).toFixed(1)} m</p>
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

import { useMemo, useRef, useState } from 'react';
import { layout } from '../engine/export';
import { BodiceDraft, BodiceMeasurements, bodiceEase, needsHip } from '../engine/bodice';
import { piecesLengthCm, toMetres } from '../engine/fabric';
import { layPlan } from '../engine/layplan';
import { BODICE_GROUPS, BodiceChoices, DARTS_FOR_FIT, describeBodice, detailAllowed, sleeveOf, validDetails } from '../garments';
import { bodiceFlat } from '../engine/flat';
import { TechFlatView } from '../ui/TechFlatView';
import { SHAPES_FOR_LENGTH, SleeveDraft, needsArms } from '../engine/sleeve';
import { Garment, MeasurementValues, hasHip } from '../measurements';
import { PatternPreview } from '../ui/Preview';
import { GarmentSwitch } from '../ui/GarmentSwitch';
import { SaveControl } from '../ui/SaveControl';
import { FinishChoices } from '../ui/FinishChoices';
import { BodiceShape } from '../ui/BodiceShape';
import type { Side } from '../ui/ShapeSketch';
import { useShake } from '../ui/shake';
import type { Finish } from '../App';
import { MyFabric, bodiceFabrics, fabricEase } from '../engine/fabrics';
import { FabricCard } from '../ui/FabricCard';

import { EaseMapView } from '../ui/EaseMapView';
import type { EaseView } from '../engine/easeMap';

interface Props {
  finish: Finish;
  onFinish: (f: Finish) => void;
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
  /** The fabric recorded on the print screen, if any. */
  fabric?: MyFabric;
  /** Room over the body at every level, for the ease map. */
  easeMap?: EaseView[];
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

const NECK_NAMES: Record<BodiceChoices['neckline'], string> = { crew: 'crew neck', scoop: 'scoop neck', v: 'V-neck', square: 'square neck', boat: 'boat neck' };

const UNDO_LIMIT = 40;

/** Which hand-shaped value a chip group replaces: picking a named choice lets go of the dragged or drawn one. */
const REPLACES = { fit: 'bustEase', length: 'dropCm', neckline: 'neck' } as const;
const handShaped = (c: BodiceChoices, id: string) => id in REPLACES && c[REPLACES[id as keyof typeof REPLACES]] !== undefined;

type View = 'sketch' | 'flat' | 'pattern' | 'ease';

export function BodiceStyleScreen({ choices, onChoices, onGarment, values, draft, sleeve, error, onEditMeasurements, onNext, saveState, onSave, onAccount, easeMap, finish, onFinish, fabric }: Props) {
  const [view, setView] = useState<View>('sketch');
  const [side, setSide] = useState<Side>('front');
  const [drawing, setDrawing] = useState(false);
  const [play, setPlay] = useState(0);
  const [toast, setToast] = useState<string>();
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const [history, setHistory] = useState<BodiceChoices[]>([]);
  const m = values as BodiceMeasurements;
  const pieces = useMemo(() => (draft ? [...draft.pieces, ...(sleeve?.pieces ?? [])] : []), [draft, sleeve]);
  const sheet = useMemo(() => (draft ? layout(pieces, '', []) : undefined), [draft, pieces]);
  const ease = bodiceEase(choices);
  const extra = fabricEase(fabric, 'bodice');
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

  const say = (text: string) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(undefined), 1800);
  };
  /** Every change goes through here, so it can be undone. */
  const change = (next: BodiceChoices, before: BodiceChoices = choices) => {
    if (JSON.stringify(next) === JSON.stringify(before)) return onChoices(next);
    setHistory((h) => [...h.slice(-UNDO_LIMIT + 1), before]);
    onChoices(next);
  };
  const undo = () => {
    const prev = history[history.length - 1];
    if (!prev) return say('Nothing to undo');
    setHistory(history.slice(0, -1));
    onChoices(prev);
    say('Undone');
  };
  const shake = useShake(undo);

  const choose = (c: BodiceChoices, group?: string) => {
    // A tighter fit needs more shaping, so moving to it brings the darts back.
    const darts = DARTS_FOR_FIT[c.fit].includes(c.darts) ? c.darts : 'bust_waist';
    const next = { ...c, darts };
    // Picking a named fit, length or neckline lets go of the dragged or drawn one.
    if (group && group in REPLACES) delete next[REPLACES[group as keyof typeof REPLACES]];
    // Each sleeve length allows only some shapes; keep the chosen one when it still fits.
    // Details the other choices no longer allow (a collar on a V-neck, say) fall back to the plain ones.
    change(validDetails({ ...next, sleeveShape: sleeveOf(next).shape }));
  };

  const views: [View, string][] = [
    ['sketch', 'Sketch'],
    ['flat', 'Flat'],
    ['pattern', 'Pieces'],
    ...(easeMap && easeMap.length > 0 ? ([['ease', 'Ease']] as [View, string][]) : []),
  ];

  return (
    <>
    <div className="screen-head">
      <h1 id="opts">Style your bodice</h1>
      <GarmentSwitch garment="bodice" onGarment={onGarment} />
    </div>
    <div className="split three">
      <section className="card" aria-labelledby="opts">
        {BODICE_GROUPS.filter((g) => shown(g.id)).map((g) => (
          <fieldset key={g.id} className="group">
            <legend>{g.label}</legend>
            <div className="chips">
              {g.options.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={valueOf(g.id) === id && !handShaped(choices, g.id) ? 'chip on' : 'chip'}
                  aria-pressed={valueOf(g.id) === id && !handShaped(choices, g.id)}
                  disabled={!allowed(g.id, id)}
                  onClick={() => choose({ ...choices, [g.id]: id }, g.id)}
                >
                  {label}
                </button>
              ))}
            </div>
            {g.id === 'neckline' && choices.neck && (
              <p className="muted small">
                Drawn by hand.{' '}
                <button type="button" className="link inline-link" onClick={() => choose({ ...choices }, 'neckline')}>
                  Use the {NECK_NAMES[choices.neckline]} instead
                </button>
              </p>
            )}
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
            {g.id === 'collar' && choices.neck && <p className="muted small">Collars sit on the named necklines, not a drawn one.</p>}
            {g.id === 'collar' && !choices.neck && choices.neckline !== 'crew' && <p className="muted small">Collars sit on a crew neck (a Peter Pan on a scoop neck too).</p>}
            {g.id === 'collar' && !choices.neck && choices.neckline === 'crew' && detail.closure !== 'front_buttons' && <p className="muted small">A shirt collar needs the front buttons.</p>}
            {g.id === 'darts' && choices.fit !== 'relaxed' && (
              <p className="muted small">{choices.fit === 'fitted' ? 'A fitted bodice needs bust and waist darts.' : 'Choose a relaxed fit to go without darts.'}</p>
            )}
          </fieldset>
        ))}
        <p className="eyebrow">Inside the bodice</p>
        <FinishChoices garment="bodice" finish={finish} onFinish={onFinish} sleeved={chosen.length !== 'none'} />
        <p className="muted small">
          {detail.closure === 'front_buttons' ? `Buttons down the centre front${draft?.buttons ? ` (${draft.buttons.count})` : ''}, with front facings.` : 'With a centre back zip.'}{' '}
          {chosen.length === 'none'
            ? 'Sleeveless.'
            : 'The sleeves are drafted to fit your armholes, with their ease set where a tailor sets it.'}
          {detail.princess !== 'none' || detail.bustDart !== 'side' ? ' The shaping is moved the way a pattern cutter does it: the garment sews up to exactly the same fit.' : ''}
        </p>
      </section>

      <section className="card grow" aria-label="Preview">
        <div className="row between wrap">
          <div className="seg views" role="group" aria-label="Preview view">
            {views.map(([id, name]) => (
              <button
                key={id}
                type="button"
                aria-pressed={view === id}
                className={view === id ? 'on' : ''}
                onClick={() => {
                  setView(id);
                  setDrawing(false);
                }}
              >
                {name}
              </button>
            ))}
          </div>
          <div className="row tools">
            {shake.state === 'ask' && (
              <button type="button" className="link small" onClick={shake.enable}>
                Shake to undo
              </button>
            )}
            {history.length > 0 && (
              <button type="button" className="ghost" onClick={undo} aria-label="Undo the last change">
                Undo
              </button>
            )}
          </div>
        </div>
        {view === 'sketch' && draft && (
          <div className="row between wrap">
            <div className="seg" role="group" aria-label="Sketch side">
              {(['front', 'back'] as const).map((s) => (
                <button key={s} type="button" aria-pressed={side === s} className={side === s ? 'on' : ''} onClick={() => setSide(s)}>
                  {s}
                </button>
              ))}
            </div>
            <button type="button" className={drawing ? 'ghost on' : 'ghost'} aria-pressed={drawing} onClick={() => setDrawing(!drawing)}>
              {drawing ? 'Done' : 'Draw neck'}
            </button>
          </div>
        )}
        <div className="preview">
          {error && <p className="msg error">{error}</p>}
          {draft && view === 'sketch' && (
            <BodiceShape
              draft={draft}
              m={m}
              choices={choices}
              side={side}
              drawing={drawing}
              label={`${title}, ${side} view. Drag the hem to change the length, or the side to change the fit.`}
              onLive={onChoices}
              onDone={(before, after) => change(after, before)}
            />
          )}
          {flat && view === 'flat' && <TechFlatView flat={flat} title={title} />}
          {draft && sheet && view === 'pattern' && (
            <PatternPreview sheet={sheet} play={play} names={pieces.map((pc) => pc.name)} label={`Front and back pattern pieces for a ${title}`} />
          )}
          {view === 'ease' && easeMap && <EaseMapView views={easeMap} label={`Ease map of the ${title}`} />}
          {toast && (
            <p className="toast" role="status">
              {toast}
            </p>
          )}
        </div>
        {view === 'sketch' && (
          <p className="muted small">
            {drawing
              ? side === 'front'
                ? 'Draw the neckline across the front, from the shoulder down to where you want it. Both sides match, and it’s smoothed into a curve that sews.'
                : 'Draw down the back to set how low the back neckline goes.'
              : hip
                ? 'Drag the hem up or down for length, or the side out and in for a looser or closer fit.'
                : 'Drag the side out and in for a looser or closer fit.'}
            {chosen.length !== 'none' ? ' Sleeves show on the flat.' : ''}
            {shake.state === 'on' ? ' Shake your phone to undo.' : ''}
          </p>
        )}
        {view === 'flat' && <p className="muted small">The technical flat, front and back, drawn to scale.</p>}
        {view === 'pattern' && draft && (
          <div className="row between wrap">
            <button type="button" className="ghost" onClick={() => setPlay(play + 1)}>
              Watch it draft
            </button>
            <p className="muted small">Drafted to your measurements as you choose.</p>
          </div>
        )}
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
          <span className="muted">You</span>
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
          The bodice is {ease.bust + extra.bust} cm bigger than you at the bust and {ease.waist + extra.waist} cm at the waist, so you can move and breathe
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
          </ul>
        </div>
        {draft && (
          <FabricCard metres={bodiceFabricMetres(draft, sleeve)} advice={bodiceFabrics(choices)} fabric={fabric} />
        )}
        <button type="button" className="primary" disabled={!draft} onClick={onNext}>
          Print my pattern
        </button>
        <SaveControl state={saveState} disabled={!draft} onSave={onSave} onAccount={onAccount} />
        <button type="button" className="link" onClick={onEditMeasurements}>
          Edit measurements
        </button>
      </aside>
    </div>
    </>
  );
}

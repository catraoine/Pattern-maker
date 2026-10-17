import { useMemo, useRef, useState } from 'react';
import type { Choices } from '../App';
import { layout } from '../engine/export';
import { piecesLengthCm, toMetres } from '../engine/fabric';
import { layPlan } from '../engine/layplan';
import { waistbandPiece } from '../engine/finishing';
import { FIT_EASE, SkirtDraft, SkirtMeasurements } from '../engine/skirt';
import { isShaped } from '../engine/hem';
import type { Garment, MeasurementValues } from '../measurements';
import { GarmentSwitch } from '../ui/GarmentSwitch';
import { PatternPreview } from '../ui/Preview';
import { ShapeSketch, Side } from '../ui/ShapeSketch';
import { useShake } from '../ui/shake';
import { SaveControl } from '../ui/SaveControl';
import { FinishChoices } from '../ui/FinishChoices';
import type { Finish } from '../App';
import { BAND_ACROSS_MAX } from '../engine/instructions';
import { ERAS, findLook } from '../engine/eras';
import { shapeLine } from '../photo/shape';
import { MyFabric, fabricEase, skirtFabrics } from '../engine/fabrics';
import { FabricCard } from '../ui/FabricCard';

import { EaseMapView } from '../ui/EaseMapView';
import type { EaseView } from '../engine/easeMap';

interface Props {
  finish: Finish;
  onFinish: (f: Finish) => void;
  choices: Choices;
  onChoices: (c: Choices) => void;
  values: MeasurementValues;
  draft?: SkirtDraft;
  error?: string;
  onEditMeasurements: () => void;
  onNext: () => void;
  saveState: 'can' | 'saved' | 'full';
  onSave: () => void;
  onAccount: () => void;
  onPhoto: () => void;
  onGarment: (g: Garment) => void;
  /** The fabric recorded on the print screen, if any. */
  fabric?: MyFabric;
  /** Room over the body at every level, for the ease map. */
  easeMap?: EaseView[];
}

type Group<K extends keyof Choices> = { id: K; label: string; options: [Choices[K], string][] };

export const GROUPS: [Group<'fit'>, Group<'silhouette'>, Group<'length'>] = [
  { id: 'fit', label: 'Fit', options: [['fitted', 'Fitted'], ['regular', 'Regular'], ['relaxed', 'Relaxed']] },
  {
    id: 'silhouette',
    label: 'Silhouette',
    options: [['pencil', 'Pencil'], ['straight', 'Straight'], ['a_line', 'A-line'], ['trumpet', 'Trumpet'], ['half_circle', 'Half circle'], ['circle', 'Full circle']],
  },
  {
    id: 'length',
    label: 'Length',
    options: [['mini', 'Mini'], ['above_knee', 'Above knee'], ['knee', 'Knee'], ['midi', 'Midi'], ['maxi', 'Maxi']],
  },
];

/** True when the skirt has been shaped by hand: a dragged length or flare, or a drawn hem. */
export const handShaped = (c: Choices) => c.lengthCm !== undefined || c.flareCm !== undefined || isShaped(c.hem);

/** The era look the choices came from, if they still have its shape and length. */
export function currentLook(c: Choices) {
  const look = findLook(c.look);
  return look && look.silhouette === c.silhouette && look.length === c.length && !handShaped(c) ? look : undefined;
}

export function describe(c: Choices) {
  const look = currentLook(c);
  if (look) return look.name;
  if (c.shape) return `Skirt matched to a photo${isShaped(c.hem) ? ', with a shaped hem' : ''}`;
  const len = c.lengthCm !== undefined ? `${Math.round(c.lengthCm)} cm` : GROUPS[2].options.find((o) => o[0] === c.length)![1];
  const sil = GROUPS[1].options.find((o) => o[0] === c.silhouette)![1];
  return `${len} ${sil.toLowerCase()} skirt${isShaped(c.hem) ? ' with a shaped hem' : ''}`;
}

const UNDO_LIMIT = 40;

/** Fabric needed on 140 cm wide fabric, from the cutting layout of the pieces and the waistband. A
 * rough estimate where the pieces are too wide to lay out. */
export function fabricMetres(draft: SkirtDraft): number {
  const lay = layPlan([...draft.pieces, waistbandPiece(draft, 1.5)], 140);
  if (lay) return lay.metres;
  const { cutLength, cutWidth } = draft.waistband;
  const band = cutLength <= BAND_ACROSS_MAX ? cutWidth : cutLength;
  return toMetres(piecesLengthCm(draft.pieces) + band + 15);
}

export function StyleScreen({ choices, onChoices, values, draft, error, onEditMeasurements, onNext, saveState, onSave, onAccount, onPhoto, onGarment, finish, onFinish, easeMap, fabric }: Props) {
  const [view, setView] = useState<'sketch' | 'pattern' | 'ease'>('sketch');
  const [side, setSide] = useState<Side>('front');
  const [drawing, setDrawing] = useState(false);
  const [play, setPlay] = useState(0);
  const [toast, setToast] = useState<string>();
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const [history, setHistory] = useState<Choices[]>([]);
  const m = values as SkirtMeasurements;

  const say = (text: string) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(undefined), 1800);
  };
  /** Every change goes through here, so it can be undone. */
  const change = (next: Choices, before: Choices = choices) => {
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
  const sheet = useMemo(() => (draft ? layout(draft.pieces, '', []) : undefined), [draft]);
  const ease = FIT_EASE[choices.fit];
  const extra = fabricEase(fabric, 'skirt');
  const title = describe(choices);
  const look = currentLook(choices);
  const [eraId, setEraId] = useState<string | undefined>(() => ERAS.find((e) => e.looks.includes(look!))?.id);
  const era = ERAS.find((e) => e.id === eraId);
  // Changing the shape or length by hand leaves the era look behind; changing the fit keeps it.
  // Picking a named length or silhouette replaces a dragged one; a drawn hem stays. A shape matched
  // from a photo stays until the shape or length is changed by hand.
  const choose = (c: Choices, group: keyof Choices) => {
    const { lengthCm, flareCm, look, shape: photo, ...rest } = c;
    const shape = c.silhouette === choices.silhouette && c.length === choices.length ? photo : undefined;
    change({
      ...rest,
      ...(shape ? { shape } : {}),
      ...(group !== 'length' && lengthCm !== undefined ? { lengthCm } : {}),
      ...(group !== 'silhouette' && flareCm !== undefined ? { flareCm } : {}),
      ...(currentLook(c) ? { look } : {}),
    });
  };

  return (
    <>
    <div className="screen-head">
      <h1 id="opts">Style your skirt</h1>
      <GarmentSwitch garment="skirt" onGarment={onGarment} />
    </div>
    <div className="split three">
      <section className="card" aria-labelledby="opts">
        <button type="button" className="secondary" onClick={onPhoto}>
          Start from a photo
        </button>
        <fieldset className="group">
          <legend>Era</legend>
          {!era && <p className="muted small">Pick an era to see its looks. A look sets the fit, shape and length, and you can change any of them after.</p>}
          <div className="chips">
            {ERAS.map((e) => (
              <button
                key={e.id}
                type="button"
                className={eraId === e.id ? 'chip on' : 'chip'}
                aria-pressed={eraId === e.id}
                onClick={() => setEraId(eraId === e.id ? undefined : e.id)}
              >
                {e.name}
              </button>
            ))}
          </div>
          {era && (
            <div className="looks">
              <p className="muted small">
                {era.years}. {era.about}
              </p>
              {era.looks.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className={look?.id === l.id ? 'look on' : 'look'}
                  aria-pressed={look?.id === l.id}
                  onClick={() => change({ fit: l.fit, silhouette: l.silhouette, length: l.length, look: l.id })}
                >
                  <strong>{l.name}</strong>
                  <span>{l.about}</span>
                  <span className="muted">Try: {l.fabric}</span>
                </button>
              ))}
            </div>
          )}
        </fieldset>
        {GROUPS.map((g) => (
          <fieldset key={g.id} className="group">
            <legend>{g.label}</legend>
            <div className="chips">
              {g.options.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={choices[g.id] === id && !(g.id === 'length' && choices.lengthCm !== undefined) ? 'chip on' : 'chip'}
                  aria-pressed={choices[g.id] === id && !(g.id === 'length' && choices.lengthCm !== undefined)}
                  onClick={() => choose({ ...choices, [g.id]: id }, g.id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
        ))}
        {choices.shape && (
          <div className="msg small">
            <p>Matched to your photo. {shapeLine(choices.shape)}</p>
            <button type="button" className="link inline-link" onClick={() => change({ ...choices, shape: undefined })}>
              Use the standard shape instead
            </button>
          </div>
        )}
        <p className="eyebrow">Inside the skirt</p>
        <FinishChoices garment="skirt" finish={finish} onFinish={onFinish} />
      </section>

      <section className="card grow" aria-label="Preview">
        <div className="row between wrap">
          <div className="seg" role="group" aria-label="Preview view">
            {(
              [
                ['sketch', 'Sketch'],
                ['pattern', 'Pieces'],
                ['ease', 'Ease'],
              ] as const
            ).map(([id, name]) => (
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
            <div className="row tools">
              {isShaped(choices.hem) && !drawing && (
                <button type="button" className="link small" onClick={() => change({ ...choices, hem: undefined })}>
                  Straighten hem
                </button>
              )}
              <button type="button" className={drawing ? 'ghost on' : 'ghost'} aria-pressed={drawing} onClick={() => setDrawing(!drawing)}>
                {drawing ? 'Done' : 'Draw hem'}
              </button>
            </div>
          </div>
        )}
        <div className="preview">
          {error && <p className="msg error">{error}</p>}
          {draft && sheet && view === 'sketch' && (
            <ShapeSketch
              draft={draft}
              m={m}
              choices={choices}
              side={side}
              drawing={drawing}
              label={`${title}, ${side} view. Drag the hem to change the length, or the side to change the flare.`}
              onLive={onChoices}
              onDone={(before, after) => change(after, before)}
            />
          )}
          {draft && sheet && view === 'pattern' && (
            <PatternPreview sheet={sheet} play={play} names={draft.pieces.map((pc) => pc.name)} label={`Front and back pattern pieces for a ${title}`} />
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
              ? `Draw across the ${side} of the skirt where you want the hem. Switch to the back to make a high-low hem.`
              : 'Drag the hem up or down for length, or the side out and in for flare.'}
            {shake.state === 'on' ? ' Shake your phone to undo.' : ''}
          </p>
        )}
        {view === 'pattern' && draft && (
          <div className="row between wrap">
            <button type="button" className="ghost" onClick={() => setPlay(play + 1)}>
              Watch it draft
            </button>
            <p className="muted small">Drafted to your measurements as you choose.</p>
          </div>
        )}
      </section>

      <aside className="card" aria-labelledby="sum">
        <h2 id="sum">Summary</h2>
        <div className="sumgrid">
          <span />
          <span className="muted">You</span>
          <span className="muted">Skirt</span>
          <span>Waist</span>
          <span>{values.waist} cm</span>
          <strong>{draft ? draft.finishedWaist : '–'} cm</strong>
          <span>Hip</span>
          <span>{values.full_hip} cm</span>
          <strong>{draft ? draft.finishedHip : '–'} cm</strong>
          <span>Length</span>
          <span />
          <strong>{draft ? draft.lengthCm : '–'} cm</strong>
          <span>Hem</span>
          <span />
          <strong>{draft ? draft.hemCm : '–'} cm</strong>
        </div>
        <p className="muted small">
          The skirt is {ease.waist + extra.waist} cm bigger than you at the waist and {ease.hip + extra.hip} cm at the hip, so you can move and sit
          {extra.hip ? `, including ${extra.waist} cm and ${extra.hip} cm for your heavy fabric` : ''}.
        </p>
        <div>
          <p className="eyebrow">Pattern pieces</p>
          <ul className="pieces">
            {(draft?.pieces ?? []).map((pc) => (
              <li key={pc.name}>
                {pc.name}: {pc.cut.replace(' (1 pair)', '').toLowerCase()}
              </li>
            ))}
            {draft && (
              <li>
                Waistband: cut 1, {draft.waistband.cutLength} × {draft.waistband.cutWidth} cm
              </li>
            )}
          </ul>
        </div>
        {draft && (
          <FabricCard metres={fabricMetres(draft)} advice={skirtFabrics(choices)} look={currentLook(choices)} fabric={fabric} />
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

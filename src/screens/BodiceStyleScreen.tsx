import { useMemo, useRef, useState } from 'react';
import { layout } from '../engine/export';
import { BodiceDraft, BodiceMeasurements, bodiceEase, needsHip } from '../engine/bodice';
import { piecesLengthCm, toMetres } from '../engine/fabric';
import { BODICE_GROUPS, BodiceChoices, DARTS_FOR_FIT, describeBodice } from '../garments';
import { Garment, MeasurementValues, hasHip } from '../measurements';
import { PatternPreview } from '../ui/Preview';
import { BodiceShape } from '../ui/BodiceShape';
import { BodiceFigure } from '../ui/BodiceFigure';
import type { Side } from '../ui/ShapeSketch';
import { useShake } from '../ui/shake';
import { GarmentSwitch } from '../ui/GarmentSwitch';
import { SaveControl } from '../ui/SaveControl';
import { FinishChoices } from '../ui/FinishChoices';
import type { Finish } from '../App';

interface Props {
  finish: Finish;
  onFinish: (f: Finish) => void;
  choices: BodiceChoices;
  onChoices: (c: BodiceChoices) => void;
  onGarment: (g: Garment) => void;
  values: MeasurementValues;
  draft?: BodiceDraft;
  error?: string;
  onEditMeasurements: () => void;
  onNext: () => void;
  saveState: 'can' | 'saved' | 'full';
  onSave: () => void;
  onAccount: () => void;
}

export const bodiceFabricMetres = (draft: BodiceDraft) => toMetres(piecesLengthCm(draft.pieces) + 10);

/** Bias binding for the neckline and both armholes, with some to spare for joins. */
export const bindingMetres = (draft: BodiceDraft) => toMetres(draft.neck + 2 * draft.armhole + 20);

const NECK_NAMES: Record<BodiceChoices['neckline'], string> = { crew: 'crew neck', scoop: 'scoop neck', v: 'V-neck', square: 'square neck', boat: 'boat neck' };

/** The engine's warnings are written for the pattern cutter; this turns the common ones into a nudge. */
function friendly(w: string) {
  if (w.startsWith('shoulder width')) return 'Your shoulder width and shoulder length don’t quite agree. The pattern still drafts, but re-measuring both will make the shoulders fit better.';
  if (w.startsWith('front length')) return 'Your front length came out shorter than your back length, which usually means a tape slip. It’s drafted with a little extra; please re-measure it.';
  return 'Something in your measurements looks unusual. Please double-check them.';
}

const UNDO_LIMIT = 40;

/** Which hand-shaped value a chip group replaces: picking a named choice lets go of the dragged or drawn one. */
const REPLACES = { fit: 'bustEase', length: 'dropCm', neckline: 'neck' } as const;

/** True when a chip shows as picked: a dragged or drawn value stands in for its group's chips. */
const picked = (c: BodiceChoices, id: keyof BodiceChoices, opt: string) =>
  c[id] === opt && !(id in REPLACES && c[REPLACES[id as keyof typeof REPLACES]] !== undefined);

export function BodiceStyleScreen({ choices, onChoices, onGarment, values, draft, error, onEditMeasurements, onNext, saveState, onSave, onAccount, finish, onFinish }: Props) {
  const [view, setView] = useState<'sketch' | 'figure' | 'pattern'>('sketch');
  const [side, setSide] = useState<Side>('front');
  const [drawing, setDrawing] = useState(false);
  const [play, setPlay] = useState(0);
  const [toast, setToast] = useState<string>();
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const [history, setHistory] = useState<BodiceChoices[]>([]);
  const sheet = useMemo(() => (draft ? layout(draft.pieces, '', []) : undefined), [draft]);
  const ease = bodiceEase(choices);
  const title = describeBodice(choices);
  const hip = hasHip(values);
  const m = values as BodiceMeasurements;

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

  const allowed = (id: string, opt: string) =>
    id === 'darts' ? DARTS_FOR_FIT[choices.fit].includes(opt as BodiceChoices['darts']) : id === 'length' ? hip || !needsHip(opt as BodiceChoices['length']) : true;

  const choose = (c: BodiceChoices, group: keyof BodiceChoices) => {
    // A tighter fit needs more shaping, so moving to it brings the darts back.
    const darts = DARTS_FOR_FIT[c.fit].includes(c.darts) ? c.darts : 'bust_waist';
    const next = { ...c, darts };
    if (group in REPLACES) delete next[REPLACES[group as keyof typeof REPLACES]];
    change(next);
  };

  return (
    <>
    <div className="screen-head">
      <h1 id="opts">Style your bodice</h1>
      <GarmentSwitch garment="bodice" onGarment={onGarment} />
    </div>
    <div className="split three">
      <section className="card" aria-labelledby="opts">
        {BODICE_GROUPS.map((g) => (
          <fieldset key={g.id} className="group">
            <legend>{g.label}</legend>
            <div className="chips">
              {g.options.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={picked(choices, g.id, id) ? 'chip on' : 'chip'}
                  aria-pressed={picked(choices, g.id, id)}
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
            {g.id === 'darts' && choices.fit !== 'relaxed' && (
              <p className="muted small">{choices.fit === 'fitted' ? 'A fitted bodice needs bust and waist darts.' : 'Choose a relaxed fit to go without darts.'}</p>
            )}
          </fieldset>
        ))}
        <p className="eyebrow">Inside the bodice</p>
        <FinishChoices garment="bodice" finish={finish} onFinish={onFinish} />
        <p className="muted small">Sleeveless, with a zip at the centre back.</p>
      </section>

      <section className="card grow" aria-label="Preview">
        <div className="row between wrap">
          <div className="seg" role="group" aria-label="Preview view">
            {(
              [
                ['sketch', 'Sketch'],
                ['figure', 'On you'],
                ['pattern', 'Pieces'],
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
            <button type="button" className={drawing ? 'ghost on' : 'ghost'} aria-pressed={drawing} onClick={() => setDrawing(!drawing)}>
              {drawing ? 'Done' : 'Draw neck'}
            </button>
          </div>
        )}
        <div className={view === 'figure' ? 'preview flush' : 'preview'}>
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
          {draft && view === 'figure' && <BodiceFigure draft={draft} m={m} label={`${title} on a dress form made from your measurements`} />}
          {draft && sheet && view === 'pattern' && (
            <PatternPreview sheet={sheet} play={play} names={draft.pieces.map((pc) => pc.name)} label={`Front and back pattern pieces for a ${title}`} />
          )}
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
        </div>
        <p className="muted small">
          The bodice is {ease.bust} cm bigger than you at the bust and {ease.waist} cm at the waist, so you can move and breathe.
        </p>
        <div>
          <p className="eyebrow">Pattern pieces</p>
          <ul className="pieces">
            {(draft?.pieces ?? []).map((pc) => (
              <li key={pc.name}>
                {pc.name}: {pc.cut.replace(' (1 pair)', '').toLowerCase()}
              </li>
            ))}
          </ul>
        </div>
        {draft && (
          <div className="fabric">
            <p className="eyebrow">Fabric</p>
            <p className="big">{bodiceFabricMetres(draft).toFixed(1)} m</p>
            <p className="muted small">of 140 cm wide woven fabric, rough estimate</p>
          </div>
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

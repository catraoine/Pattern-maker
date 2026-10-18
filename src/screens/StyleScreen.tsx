import { useMemo, useRef, useState } from 'react';
import type { Choices } from '../App';
import { layout } from '../engine/export';
import { piecesLengthCm, toMetres } from '../engine/fabric';
import { layPlan } from '../engine/layplan';
import { waistPieces } from '../engine/finishing';
import { FIT_EASE, PULL_ON_EASE, lengthRange, Silhouette, SkirtDraft, SkirtMeasurements } from '../engine/skirt';
import { isShaped } from '../engine/hem';
import { SLIP_FACING, SLIP_HIP_EASE_LESS, cutAllowed, elasticCutAllowed, validCut } from '../engine/slip';
import type { MeasurementValues } from '../measurements';
import { GarmentSwitch } from '../ui/GarmentSwitch';
import { PatternPreview } from '../ui/Preview';
import { PatternPane } from '../ui/PointEditor';
import { ShapeSketch, Side } from '../ui/ShapeSketch';
import { FabricSwatches, GarmentFabric } from '../ui/FabricFill';
import { useShake } from '../ui/shake';
import { SaveControl } from '../ui/SaveControl';
import { FinishChoices } from '../ui/FinishChoices';
import type { Finish } from '../App';
import { BAND_ACROSS_MAX } from '../engine/instructions';
import { ERAS, findLook } from '../engine/eras';
import { shapeLine } from '../photo/shape';
import { MyFabric, fabricEase, skirtFabrics } from '../engine/fabrics';
import { FabricCard } from '../ui/FabricCard';
import { GODET_OPTIONS, VOLUME_OPTIONS, layoutExtras, setVolume, volumeAllowed, volumeOf, volumeWords } from '../engine/skirtVolume';

import { EaseMapView } from '../ui/EaseMapView';
import type { EaseView } from '../engine/easeMap';
import { Mode, ProTool, shows } from '../mode';
import { ModeLink } from '../ui/ModeLink';
import { DrawOnForm, skirtForm } from '../ui/DrawOnForm';
import { readSkirtHem, readSkirtSide, skirtLines } from '../ui/formLines';
import { Title } from '../ui/Title';
import { ChoicePic, chipsClass } from '../ui/ChoicePic';

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
  /** The photo the skirt was matched to, while the app is open. */
  photo?: string;
  /** Open the list of what to make, to pick another garment. */
  onChooseGarment: () => void;
  /** The fabric recorded on the print screen, if any. */
  fabric?: MyFabric;
  /** Room over the body at every level, for the ease map. */
  easeMap?: EaseView[];
  /** Simple or all tools; all when not given. */
  mode?: Mode;
  onMode?: (m: Mode) => void;
}

type Group<K extends keyof Choices> = { id: K; label: string; options: [NonNullable<Choices[K]>, string][] };

export const GROUPS: [Group<'fit'>, Group<'silhouette'>, Group<'length'>, Group<'asymHem'>] = [
  { id: 'fit', label: 'Fit', options: [['fitted', 'Fitted'], ['regular', 'Regular'], ['relaxed', 'Relaxed']] },
  {
    id: 'silhouette',
    label: 'Silhouette',
    options: [['pencil', 'Pencil'], ['straight', 'Straight'], ['a_line', 'A-line'], ['trumpet', 'Trumpet'], ['half_circle', 'Half circle'], ['circle', 'Full circle'], ['slip', 'Bias slip']],
  },
  {
    id: 'length',
    label: 'Length',
    options: [['mini', 'Mini'], ['above_knee', 'Above knee'], ['knee', 'Knee'], ['midi', 'Midi'], ['maxi', 'Maxi']],
  },
  { id: 'asymHem', label: 'Hem', options: [['none', 'Level'], ['high_low', 'High-low'], ['diagonal', 'Diagonal']] },
];

/** The chosen option in a group: older saves have no hem choice, which is a level hem. */
export const chosen = (c: Choices, id: keyof Choices) => (id === 'asymHem' ? c.asymHem ?? 'none' : c[id]);
/** The skirt's details: in-seam pockets, and a zipped waistband or a pull-on elastic waist. */
export const DETAIL_GROUPS: [Group<'waist'>, Group<'pockets'>] = [
  { id: 'waist', label: 'Waist', options: [['band', 'Waistband with zip'], ['elastic', 'Elastic, pull-on']] },
  { id: 'pockets', label: 'Pockets', options: [['none', 'None'], ['inseam', 'In-seam']] },
];

/** A detail as saved: older saves have no pockets and a zipped waistband. */
const detailOf = (c: Choices, id: 'waist' | 'pockets') => (id === 'waist' ? (c.waist ?? 'band') : (c.pockets ?? 'none'));

/** A pencil skirt is shaped by its darts, so it can't be gathered onto elastic; nor can a bias slip, a
 * diagonal hem or pleats (see elasticCutAllowed). */
export const elasticAllowed = (c: Pick<Choices, 'silhouette' | 'asymHem' | 'pleats'> & { silhouette: Silhouette }) => c.silhouette !== 'pencil' && elasticCutAllowed(c);

/** In-seam pockets go in a plain side seam: not where pleats, godets, a flounce or tiers change the
 * skirt's pieces, nor on a skirt cut whole. */
export const pocketsAllowed = (c: Choices) => volumeWords(c) === '' && c.silhouette !== 'slip' && c.asymHem !== 'diagonal';

/** The choices with the zipped waistband back where an elastic waist isn't allowed. */
const keepWaist = (c: Choices): Choices => (elasticAllowed(c) ? c : { ...c, waist: undefined });

/** "a, b and c". */
const andList = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** What the skirt has besides its shape, for its name: " with a shaped hem, an elastic waist and pockets". */
function detailWords(c: Choices): string[] {
  return [c.waist === 'elastic' && elasticAllowed(c) ? 'an elastic waist' : '', c.pockets === 'inseam' && pocketsAllowed(c) ? 'pockets' : ''].filter(Boolean);
}

/** True when the skirt has been shaped by hand: a dragged length or flare, or a drawn hem. */
export const handShaped = (c: Choices) => c.lengthCm !== undefined || c.flareCm !== undefined || isShaped(c.hem);

/** The era look the choices came from, if they still have its shape and length. */
export function currentLook(c: Choices) {
  const look = findLook(c.look);
  return look && look.silhouette === c.silhouette && look.length === c.length && !handShaped(c) ? look : undefined;
}

export function describe(c: Choices) {
  const look = currentLook(c);
  const v = validCut(c);
  // Pleats, godets, a flounce or tiers: "with knife pleats". A drawn hem gives way to them; a high-low
  // or diagonal hem, an elastic waist and pockets go last: "with 6 godets and a high-low hem".
  const words = volumeWords(v);
  const hem = v.asymHem === 'high_low' ? 'a high-low hem' : v.asymHem === 'diagonal' ? 'a diagonal hem' : !words && isShaped(c.hem) && !look ? 'a shaped hem' : '';
  const parts = [words.replace(/^with /, ''), hem, ...detailWords(v)].filter(Boolean);
  const withTail = parts.length ? ` with ${andList(parts)}` : '';
  if (look) return `${look.name}${withTail}`;
  if (c.shape) return `Skirt matched to a photo${withTail.replace(' with', ', with')}`;
  const len = c.lengthCm !== undefined ? `${Math.round(c.lengthCm)} cm` : GROUPS[2].options.find((o) => o[0] === v.length)![1];
  const sil = v.silhouette === 'slip' ? 'Bias-cut slip' : GROUPS[1].options.find((o) => o[0] === v.silhouette)![1];
  return `${len} ${sil.toLowerCase()} skirt${withTail}`;
}

const UNDO_LIMIT = 40;

/** Fabric needed on 140 cm wide fabric, from the cutting layout of the pieces and the waistband. A
 * rough estimate where the pieces are too wide to lay out. */
export function fabricMetres(draft: SkirtDraft): number {
  const all = [...draft.pieces, ...layoutExtras(draft), ...waistPieces(draft, 1.5)];
  // Whole bias pieces too wide for 140 cm cloth are bought 150 cm wide (the fabric advice says so).
  const lay = layPlan(all, 140) ?? (draft.bias ? layPlan(all, 150) : undefined);
  if (lay) return lay.metres;
  if (draft.bias) {
    // Too wide even then: each piece end to end, turned to 45 degrees.
    const along = (pc: SkirtDraft['pieces'][number]) => {
      const ys = pc.outline.taggedPoints(8).pts.map((q) => (q.x + q.y) / Math.SQRT2);
      return (Math.max(...ys) - Math.min(...ys)) * (pc.meta.whole ? 1 : 2);
    };
    return toMetres(draft.pieces.reduce((t, pc) => t + along(pc), 0) + 25);
  }
  const { cutLength, cutWidth } = draft.waistband;
  const band = cutLength <= BAND_ACROSS_MAX ? cutWidth : cutLength;
  return toMetres(piecesLengthCm([...draft.pieces, ...layoutExtras(draft)]) + band + 15);
}

export function StyleScreen({ choices, onChoices, values, draft, error, onEditMeasurements, onNext, saveState, onSave, onAccount, onPhoto, photo, onChooseGarment, finish, onFinish, easeMap, fabric, mode = 'all', onMode }: Props) {
  const can = (t: ProTool) => shows(mode, t);
  const [picked, setView] = useState<'sketch' | 'pattern' | 'ease'>('sketch');
  const view = picked === 'ease' && !can('easeMap') ? 'sketch' : picked;
  const [side, setSide] = useState<Side>('front');
  const [drawing, setDrawing] = useState(false);
  const [play, setPlay] = useState(0);
  const [toast, setToast] = useState<string>();
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const [history, setHistory] = useState<Choices[]>([]);
  const m = values as SkirtMeasurements;
  /** The choices before drawing on the form, while it is open. */
  const [onForm, setOnForm] = useState<Choices>();

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
  const slipped = choices.silhouette === 'slip';
  const extra = fabricEase(fabric, 'skirt');
  const title = describe(choices);
  const look = currentLook(choices);
  const [eraId, setEraId] = useState<string | undefined>(() => ERAS.find((e) => e.looks.includes(look!))?.id);
  const era = ERAS.find((e) => e.id === eraId);
  // Changing the shape or length by hand leaves the era look behind; changing the fit keeps it.
  // Picking a named length or silhouette replaces a dragged one; a drawn hem stays. A shape matched
  // from a photo stays until the shape or length is changed by hand.
  // A high-low or diagonal hem replaces a drawn one; picking a pencil skirt, a slip, a diagonal hem or
  // pleats goes back to the zipped waistband.
  const choose = (picked: Choices, group: keyof Choices) => {
    const c = elasticAllowed(picked) ? picked : { ...picked, waist: undefined };
    const { lengthCm, flareCm, look, shape: photo, ...valid } = validCut(c);
    const rest = group === 'asymHem' && valid.asymHem !== 'none' ? { ...valid, hem: undefined } : valid;
    const shape = c.silhouette === choices.silhouette && c.length === choices.length ? photo : undefined;
    change({
      ...rest,
      ...(shape ? { shape } : {}),
      ...(group !== 'length' && lengthCm !== undefined ? { lengthCm } : {}),
      ...(group !== 'silhouette' && flareCm !== undefined ? { flareCm } : {}),
      ...(currentLook(c) ? { look } : {}),
    });
  };

  if (onForm && draft) {
    return (
      <DrawOnForm<Choices>
        body={skirtForm(m)}
        m={m}
        legs
        bottom={lengthRange(m).max + 4}
        kinds={[
          ['hem', 'Hem'],
          ['fit', 'Side'],
        ]}
        lines={(s) => skirtLines(draft, choices, m, s, 0)}
        choices={choices}
        onChoices={onChoices}
        read={(kind, s, stroke) => (kind === 'hem' ? readSkirtHem(stroke, 0, draft, m, choices, s, 'skirt') : readSkirtSide(stroke, 0, draft, m, choices))}
        onDone={() => {
          change(choices, onForm);
          setOnForm(undefined);
          setView('pattern');
        }}
        onCancel={() => {
          onChoices(onForm);
          setOnForm(undefined);
        }}
      />
    );
  }

  return (
    <>
    <div className="screen-head">
      <Title id="opts" big="Style" label="your skirt" />
      <GarmentSwitch onChoose={onChooseGarment} />
    </div>
    {choices.shape ? (
      <div className="photo-matched">
        {photo && <img src={photo} alt="Your photo" />}
        <div>
          <p>Matched to your photo</p>
          <p className="muted small">{shapeLine(choices.shape)}</p>
        </div>
        <button type="button" className="link" onClick={() => change({ ...choices, shape: undefined })}>
          Undo
        </button>
      </div>
    ) : (
      <button type="button" className="secondary photo-entry" onClick={onPhoto}>
        Start from a photo
      </button>
    )}
    <div className="split three">
      <section className="card numbered" aria-labelledby="opts">
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
            <div className={chipsClass('skirt', g.id)}>
              {g.options.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={chosen(choices, g.id) === id && !(g.id === 'length' && choices.lengthCm !== undefined) ? 'chip on' : 'chip'}
                  aria-pressed={chosen(choices, g.id) === id && !(g.id === 'length' && choices.lengthCm !== undefined)}
                  disabled={g.id !== 'fit' && !cutAllowed(choices, g.id, id ?? 'none')}
                  onClick={() => choose({ ...choices, [g.id]: id }, g.id)}
                >
                  <ChoicePic set="skirt" group={g.id} id={id} />
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
        ))}
        <fieldset className="group">
          <legend>Details</legend>
          <div className="chips">
            {VOLUME_OPTIONS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={volumeOf(choices) === id ? 'chip on' : 'chip'}
                aria-pressed={volumeOf(choices) === id}
                disabled={!volumeAllowed(choices, id)}
                onClick={() => change(keepWaist(setVolume(choices, id)))}
              >
                {label}
              </button>
            ))}
          </div>
          {volumeOf(choices) === 'godets' && (
            <div className="chips">
              {GODET_OPTIONS.map(([n, label]) => (
                <button key={n} type="button" className={choices.godets === n ? 'chip on' : 'chip'} aria-pressed={choices.godets === n} onClick={() => change(setVolume(choices, 'godets', n))}>
                  {label}
                </button>
              ))}
            </div>
          )}
          {choices.silhouette === 'slip' ? (
            <p className="muted small">A bias slip hangs from the hip without pleats, godets, flounces or tiers.</p>
          ) : !volumeAllowed({ ...choices, asymHem: 'none' }, 'knife') ? (
            <p className="muted small">Pleats, godets, flounces and tiers go on a pencil, straight or A-line skirt.</p>
          ) : choices.asymHem === 'diagonal' ? (
            <p className="muted small">A diagonal hem is cut in whole pieces, so it takes no pleats, godets, flounces or tiers.</p>
          ) : choices.asymHem === 'high_low' ? (
            <p className="muted small">
              A high-low hem takes godets{volumeAllowed(choices, 'godets') ? '' : ' on a skirt to the knee or longer'}. Pleats, flounces and tiers need a level hem.
            </p>
          ) : !volumeAllowed(choices, 'godets') ? (
            <p className="muted small">Godets and tiers need a skirt to the knee or longer.</p>
          ) : null}
        </fieldset>
        {DETAIL_GROUPS.map((g) => (
          <fieldset key={g.id} className="group">
            <legend>{g.label}</legend>
            <div className="chips">
              {g.options.map(([id, label]) => {
                const allowed = g.id === 'waist' ? id !== 'elastic' || elasticAllowed(choices) : id !== 'inseam' || pocketsAllowed(choices);
                return (
                  <button
                    key={id}
                    type="button"
                    className={detailOf(choices, g.id) === id ? 'chip on' : 'chip'}
                    aria-pressed={detailOf(choices, g.id) === id}
                    disabled={!allowed}
                    onClick={() => change({ ...choices, [g.id]: id })}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {g.id === 'waist' && !elasticAllowed(choices) && (
              <p className="muted small">
                {choices.silhouette === 'pencil'
                  ? 'A pencil skirt is shaped close by its darts, so it keeps its zip. Choose another shape for an elastic waist.'
                  : choices.silhouette === 'slip'
                    ? 'A bias slip has a narrow faced waist and a side zip, so it takes no elastic.'
                    : choices.asymHem === 'diagonal'
                      ? 'A diagonal hem is cut in whole pieces with a side zip, so it keeps its waistband.'
                      : 'Pleats take the waist in themselves, so a pleated skirt keeps its waistband and zip.'}
              </p>
            )}
            {g.id === 'waist' && choices.waist === 'elastic' && (
              <p className="muted small">
                Pulls on over your hips, so there is no zip and no darts: the waist is cut {draft ? `${draft.finishedWaist} cm round` : 'as wide as your hips'}, at least{' '}
                {PULL_ON_EASE} cm over them, and gathered onto {draft?.elastic ? `${draft.elastic.finishedCm} cm of elastic` : 'elastic'}
                {draft?.elastic?.forHips ? ', cut a little long so it stretches over your hips.' : ', your waist less 6 cm.'}
              </p>
            )}
            {g.id === 'pockets' && !pocketsAllowed(choices) && (
              <p className="muted small">In-seam pockets go in a plain side seam, so not with pleats, godets, a flounce, tiers, a bias slip or a diagonal hem.</p>
            )}
            {g.id === 'pockets' && pocketsAllowed(choices) && choices.pockets === 'inseam' && draft && !draft.pocket && (
              <p className="muted small">This skirt is too short for a pocket a hand fits in, so it is left off.</p>
            )}
          </fieldset>
        ))}
        {can('insideFinish') && (
          <>
            <p className="eyebrow">Inside the skirt</p>
            <FinishChoices garment="skirt" finish={finish} onFinish={onFinish} />
          </>
        )}
        <ModeLink mode={mode} onMode={onMode} />
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
            ).filter(([id]) => id !== 'ease' || can('easeMap')).map(([id, name]) => (
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
              {!drawing && (
                <button type="button" className="link small" onClick={() => setOnForm(choices)}>
                  Draw on your form
                </button>
              )}
              {isShaped(choices.hem) && !drawing && (
                <button type="button" className="link small" onClick={() => change({ ...choices, hem: undefined })}>
                  Straighten hem
                </button>
              )}
              {/* Pleats, godets and flounces are drafted on a level hem. */}
              {volumeOf(choices) === 'none' && (
                <button type="button" className={drawing ? 'ghost on' : 'ghost'} aria-pressed={drawing} onClick={() => setDrawing(!drawing)}>
                  {drawing ? 'Done' : 'Draw hem'}
                </button>
              )}
            </div>
          </div>
        )}
        <div className="preview">
          {error && <p className="msg error">{error}</p>}
          {draft && sheet && view === 'sketch' && (
            <GarmentFabric fabric={fabric}>
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
            </GarmentFabric>
          )}
          {draft && sheet && view === 'pattern' && (
            <PatternPane><PatternPreview paper sheet={sheet} play={play} names={draft.pieces.map((pc) => pc.name)} label={`Front and back pattern pieces for a ${title}`} /></PatternPane>
          )}
          {view === 'ease' && easeMap && <EaseMapView views={easeMap} label={`Ease map of the ${title}`} />}
          {toast && (
            <p className="toast" role="status">
              {toast}
            </p>
          )}
        </div>
        {view === 'sketch' && draft && <FabricSwatches finish={finish} onFinish={onFinish} />}
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
        {draft?.elastic ? (
          <p className="muted small">
            The waist is cut to pass over your hips and gathered onto {draft.elastic.finishedCm} cm of elastic. The skirt is{' '}
            {Math.round((draft.finishedHip - (values.full_hip ?? 0)) * 10) / 10} cm bigger than you at the hip, so you can move and sit.
          </p>
        ) : (
          <p className="muted small">
            The skirt is {ease.waist + extra.waist} cm bigger than you at the waist and {ease.hip + extra.hip - (slipped ? SLIP_HIP_EASE_LESS : 0)} cm at the hip, so you can move and sit
            {extra.hip ? `, including ${extra.waist} cm and ${extra.hip} cm for your heavy fabric` : ''}.
            {slipped ? ` That is ${SLIP_HIP_EASE_LESS} cm less at the hip than on the straight grain: cut on the bias, the cloth gives and moulds to you.` : ''}
          </p>
        )}
        <div>
          <p className="eyebrow">Pattern pieces</p>
          <ul className="pieces">
            {(draft?.pieces ?? []).map((pc) => (
              <li key={pc.name}>
                {pc.name}: {pc.cut.replace(' (1 pair)', '').toLowerCase()}
              </li>
            ))}
            {draft && draft.faced && <li>Waist facings: cut 1 front and 1 back, {SLIP_FACING} cm deep</li>}
            {draft && !draft.faced && (
              <li>
                Waistband{draft.elastic ? ' (elastic casing)' : ''}: cut 1, {draft.waistband.cutLength} × {draft.waistband.cutWidth} cm
              </li>
            )}
            {draft?.elastic && (
              <li>
                Elastic, {draft.elastic.widthCm} cm wide: cut {draft.elastic.cutCm} cm
              </li>
            )}
            {draft?.volume?.tiers?.bands.map((b) => (
              <li key={b.name}>
                {b.name}: cut {b.panels}, {b.cutLength} × {b.cutWidth} cm
              </li>
            ))}
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

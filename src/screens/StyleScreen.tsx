import { useMemo, useState } from 'react';
import { BELTS, Belt, beltAllowed, beltPieces, beltWords, skirtBelt } from '../engine/belt';
import type { Choices } from '../App';
import { layout } from '../engine/export';
import { piecesLengthCm, toMetres } from '../engine/fabric';
import { layPlan } from '../engine/layplan';
import { waistPieces } from '../engine/finishing';
import { FIT_EASE, PULL_ON_EASE, lengthRange, Silhouette, SkirtDraft, SkirtMeasurements } from '../engine/skirt';
import { isShaped } from '../engine/hem';
import { SLIP_FACING, SLIP_HIP_EASE_LESS, cutAllowed, elasticCutAllowed, validCut } from '../engine/slip';
import type { MeasurementValues } from '../measurements';
import { PatternPreview } from '../ui/Preview';
import { PatternPane } from '../ui/PointEditor';
import { ShapeSketch, Side } from '../ui/ShapeSketch';
import { FabricSwatches, GarmentFabric } from '../ui/FabricFill';
import { UndoToast, useUndo } from '../ui/useUndo';
import { DrawMenu } from '../ui/DrawMenu';
import { wrapSkirtAllowed } from '../engine/wrapSkirt';
import { SLIT_PLACES, slitAllowed, slitOf } from '../engine/slit';
import { FACING_DEPTH, HIGH, facedAllowed, highAllowed, sideZipAllowed } from '../engine/skirtWaist';
import { NO_SLIT, SlitSlider } from '../ui/SlitSlider';
import { BUTTONS_STOP_ABOVE_HEM, buttonsBlocked, buttonsOf, yokeBlocked, yokeOf } from '../engine/skirtFront';
import { SaveControl } from '../ui/SaveControl';
import { FinishChoices } from '../ui/FinishChoices';
import type { Finish } from '../App';
import { BAND_ACROSS_MAX } from '../engine/instructions';
import { ERAS, findLook } from '../engine/eras';
import { shapeLine } from '../photo/shape';
import { MyFabric, fabricEase, skirtFabrics } from '../engine/fabrics';
import { FabricCard, FabricSummary } from '../ui/FabricCard';
import { GODET_OPTIONS, VOLUME_OPTIONS, layoutExtras, setVolume, volumeAllowed, volumeOf, volumeWords } from '../engine/skirtVolume';

import { EaseMapView } from '../ui/EaseMapView';
import { FitSwitch, GarmentViews, PreviewSwitch } from '../ui/PreviewSwitch';
import type { EaseView } from '../engine/easeMap';
import { Mode, ProTool, shows } from '../mode';
import { FABRIC, Group, PRO, StyleLayout, TabPanel } from '../ui/StyleLayout';
import { DrawOnForm, skirtForm } from '../ui/DrawOnForm';
import { readSkirtHem, readSkirtSide, skirtLines } from '../ui/formLines';
import { ChoicePic, chipsClass } from '../ui/ChoicePic';
import { Explain } from '../ui/Explain';
import { AllRound } from '../ui/AllRound';
import { DemoButton } from '../ui/DemoButton';
import { roundSkirt } from '../engine/allRound';

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
    options: [['pencil', 'Pencil'], ['straight', 'Straight'], ['a_line', 'A-line'], ['gathered', 'Gathered'], ['trumpet', 'Trumpet'], ['half_circle', 'Half circle'], ['circle', 'Full circle'], ['slip', 'Bias slip']],
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
/** The skirt's details: in-seam pockets, and a zipped waistband, a faced or high faced waist, a pull-on
 * elastic waist or a wrap that ties. */
export const DETAIL_GROUPS: [{ id: 'waist'; label: string; options: [NonNullable<Choices['waist']> | 'wrap', string][] }, Group<'pockets'>] = [
  { id: 'waist', label: 'Waist', options: [['band', 'Waistband with zip'], ['faced', 'Faced, no band'], ['high', 'High waist'], ['elastic', 'Elastic, pull-on'], ['wrap', 'Wrap, tied']] },
  { id: 'pockets', label: 'Pockets', options: [['none', 'None'], ['inseam', 'In-seam']] },
];

/** The front: plain and darted, a yoke that takes the darts, or buttoned down the centre front. */
export const FRONT_GROUP: { id: 'front'; label: string; options: ['plain' | 'yoke' | 'buttons', string][] } = {
  id: 'front',
  label: 'Front',
  options: [
    ['plain', 'Plain'],
    ['yoke', 'Yoke'],
    ['buttons', 'Buttoned'],
  ],
};

/** The front as it will be made: a yoke or buttons only where the skirt can take them. */
export const frontOf = (c: Choices): 'plain' | 'yoke' | 'buttons' => (yokeOf(c) ? 'yoke' : buttonsOf(c) ? 'buttons' : 'plain');

/** Where the zip goes, on a skirt with one: the centre back, or the left side with the back on the fold. */
export const ZIP_PLACES: ['back' | 'side', string][] = [
  ['back', 'Centre back'],
  ['side', 'Left side'],
];

/** The waist a skirt can have: a faced or high waist falls back to the band where the shape can't take it. */
const waistOf = (c: Choices): string => {
  const w = c.waist ?? 'band';
  return (w === 'faced' && !facedAllowed(c)) || (w === 'high' && !highAllowed(c)) ? 'band' : w;
};
/** A detail as saved: older saves have no pockets and a zipped waistband. A wrap is kept apart from the waist. */
const detailOf = (c: Choices, id: 'waist' | 'pockets'): string => (id === 'waist' ? (c.wrap && wrapSkirtAllowed(c) ? 'wrap' : waistOf(c)) : (c.pockets ?? 'none'));
/** Where the zip is, or none on a pull-on or wrap skirt. */
const zipOf = (c: Choices): 'back' | 'side' | undefined => {
  const w = detailOf(c, 'waist');
  if (w === 'elastic' || w === 'wrap' || buttonsOf(c)) return undefined;
  return c.zip === 'side' && sideZipAllowed(c) ? 'side' : 'back';
};
/** Picking a waist: the wrap is its own flag, so picking it puts the waistband back, and the others let it go. */
const withWaist = (c: Choices, id: string): Choices =>
  id === 'wrap' ? { ...c, waist: undefined, wrap: true } : { ...c, waist: id === 'band' ? undefined : (id as Choices['waist']), wrap: undefined };
/** The choices without the wrap where the skirt can no longer wrap. */
const keepWrap = (c: Choices): Choices => (c.wrap && !wrapSkirtAllowed(c) ? { ...c, wrap: undefined } : c);

/** A pencil skirt is shaped by its darts, so it can't be gathered onto elastic; nor can a bias slip, a
 * diagonal hem or pleats (see elasticCutAllowed). */
export const elasticAllowed = (c: Pick<Choices, 'silhouette' | 'asymHem' | 'pleats'> & { silhouette: Silhouette }) => c.silhouette !== 'pencil' && elasticCutAllowed(c);

/** In-seam pockets go in a plain side seam: not where pleats, godets, a flounce or tiers change the
 * skirt's pieces, nor on a skirt cut whole. */
export const pocketsAllowed = (c: Choices) => volumeWords(c) === '' && !yokeOf(c) && c.silhouette !== 'slip' && c.asymHem !== 'diagonal' && !(c.wrap && wrapSkirtAllowed(c));

/** The choices with the zipped waistband back where an elastic waist isn't allowed. */
const keepWaist = (c: Choices): Choices => (elasticAllowed(c) ? c : { ...c, waist: undefined });

/** "a, b and c". */
const andList = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** What the skirt has besides its shape, for its name: " with a shaped hem, an elastic waist and pockets". */
function detailWords(c: Choices): string[] {
  // A slit chosen is named; the walking slit a narrow skirt gets unasked is not.
  const slit = c.slit && c.slit !== 'none' ? slitOf(c) : undefined;
  const waist = detailOf(c, 'waist');
  return [
    slit ? `a ${slit.at} slit` : '',
    waist === 'faced' ? 'a faced waist' : '',
    yokeOf(c) ? 'a yoke' : buttonsOf(c) ? 'a button front' : '',
    zipOf(c) === 'side' ? 'a side zip' : '',
    c.waist === 'elastic' && elasticAllowed(c) ? 'an elastic waist' : '',
    c.pockets === 'inseam' && pocketsAllowed(c) ? 'pockets' : '',
    beltWords(beltOf_(c))].filter(Boolean);
}

/** The belt as it will be made: none on a wrap, and no loops on a pull-on elastic waist. */
const beltOf_ = (c: Choices): Belt => {
  const w = detailOf(c, 'waist');
  const b = c.belt ?? 'none';
  return beltAllowed(b, { wrap: w === 'wrap', elastic: w === 'elastic' }) ? b : 'none';
};

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
  return `${len} ${detailOf(v, 'waist') === 'high' ? 'high-waisted ' : ''}${sil === 'A-line' ? sil : sil.toLowerCase()} ${c.wrap && wrapSkirtAllowed(v) ? 'wrap ' : ''}skirt${withTail}`;
}

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
  const [view, setView] = useState<'sketch' | 'round' | 'pattern'>('sketch');
  const [fit, setFit] = useState(false);
  const canFit = !!easeMap?.length && can('easeMap');
  const [side, setSide] = useState<Side>('front');
  const [drawing, setDrawing] = useState(false);
  const [play, setPlay] = useState(0);
  const undoer = useUndo(choices, onChoices);
  const change: typeof undoer.change = (c, ...rest) => undoer.change(keepWrap(c), ...rest);
  // The slit as it is drafted, or as chosen while the draft catches up; unchosen, a narrow skirt's walking slit.
  const slitValue = draft?.slit?.at ?? slitOf(choices)?.at ?? 'none';
  const m = values as SkirtMeasurements;
  /** The choices before drawing on the form, while it is open. */
  const [onForm, setOnForm] = useState<Choices>();

  const sheet = useMemo(() => (draft ? layout(draft.pieces, '', []) : undefined), [draft]);
  const round = useMemo(() => (draft ? roundSkirt(draft) : undefined), [draft]);
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

  const looks = (
    <>
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
        <fieldset className="group era">
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
    </>
  );

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
    <StyleLayout
      onEditMeasurements={onEditMeasurements}
      undo={undoer}
      label="your skirt"
      garment="skirt"
      name={title}
      metres={draft ? fabricMetres(draft) : undefined}
      ready={!!draft}
      onChooseGarment={onChooseGarment}
      looks={looks}
      mode={mode}
      onMode={onMode}
    >
      <section className="card numbered" aria-labelledby="opts">
        {/* The length is set on the drawing, with the hem dot and the lengths named beside the legs (Cat, 2026-10-24). */}
        {GROUPS.filter((g) => g.id !== 'length').map((g) => (
          <Group key={g.id} label={g.label}>
            <div className={chipsClass('skirt', g.id)}>
              {g.options.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={chosen(choices, g.id) === id ? 'chip on' : 'chip'}
                  aria-pressed={chosen(choices, g.id) === id}
                  disabled={g.id !== 'fit' && !cutAllowed(choices, g.id, id ?? 'none')}
                  onClick={() => choose({ ...choices, [g.id]: id }, g.id)}
                >
                  <ChoicePic set="skirt" group={g.id} id={id} />
                  {label}
                </button>
              ))}
            </div>
            <Explain set="skirt" group={g.id} options={g.options} pick={chosen(choices, g.id)} />
          </Group>
        ))}
        <Group label="Slit">
          <div className={chipsClass('skirt', 'slit')}>
            {SLIT_PLACES.map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={slitValue === id ? 'chip on' : 'chip'}
                aria-pressed={slitValue === id}
                disabled={id !== 'none' && !slitAllowed(choices)}
                onClick={() => change({ ...choices, slit: id, slitCm: undefined })}
              >
                <ChoicePic set="skirt" group="slit" id={id} />
                {label}
              </button>
            ))}
          </div>
          <Explain set="skirt" group="slit" options={SLIT_PLACES} pick={slitValue} />
          <SlitSlider slit={draft?.slit} onCm={(slitCm) => change({ ...choices, slitCm })} />
          {!slitAllowed(choices) && <p className="muted small">{NO_SLIT}</p>}
        </Group>
        <Group label="Details">
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
          <Explain set="skirt" group="volume" options={VOLUME_OPTIONS} pick={volumeOf(choices)} />
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
        </Group>
        {DETAIL_GROUPS.map((g) => (
          <Group key={g.id} label={g.label}>
            <div className="chips">
              {g.options.map(([id, label]) => {
                const allowed =
                  g.id === 'waist'
                    ? id === 'elastic'
                      ? elasticAllowed(choices)
                      : id === 'faced'
                        ? facedAllowed(choices)
                        : id === 'high'
                          ? highAllowed(choices)
                          : id !== 'wrap' || wrapSkirtAllowed({ ...choices, waist: undefined })
                    : id !== 'inseam' || pocketsAllowed(choices);
                return (
                  <button
                    key={id}
                    type="button"
                    className={detailOf(choices, g.id) === id ? 'chip on' : 'chip'}
                    aria-pressed={detailOf(choices, g.id) === id}
                    disabled={!allowed}
                    onClick={() => change(g.id === 'waist' ? withWaist(choices, id) : { ...choices, pockets: id as Choices['pockets'] })}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <Explain set="skirt" group={g.id} options={g.options} pick={detailOf(choices, g.id)} />
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
            {g.id === 'waist' && detailOf(choices, 'waist') === 'wrap' && (
              <p className="muted small">
                Wraps round with no zip: the front is cut as a pair that crosses over, and the waistband runs on past each front edge into a tie, one passing through a buttonhole at the side to knot with the other.
              </p>
            )}
            {g.id === 'waist' && !wrapSkirtAllowed({ ...choices, waist: undefined }) && (
              <p className="muted small">A wrap needs a straight or A-line skirt with a level hem, and no pleats, godets, flounce or pockets.</p>
            )}
            {g.id === 'waist' && choices.waist === 'elastic' && (
              <p className="muted small">
                Pulls on over your hips, so there is no zip and no darts: the waist is cut {draft ? `${draft.finishedWaist} cm round` : 'as wide as your hips'}, at least{' '}
                {PULL_ON_EASE} cm over them, and gathered onto {draft?.elastic ? `${draft.elastic.finishedCm} cm of elastic` : 'elastic'}
                {draft?.elastic?.forHips ? ', cut a little long so it stretches over your hips.' : ', your waist less 6 cm.'}
              </p>
            )}
            {g.id === 'waist' && detailOf(choices, 'waist') === 'faced' && (
              <p className="muted small">
                No band: the skirt ends at your waist, finished inside with a facing cut to its own curve, so the top sits smooth and flat.
              </p>
            )}
            {g.id === 'waist' && detailOf(choices, 'waist') === 'high' && (
              <p className="muted small">
                The skirt carries on {HIGH.rise} cm up past your waist, its darts running up to the top, and is finished inside with a facing as deep, so it holds its shape.
              </p>
            )}
            {g.id === 'waist' && (!facedAllowed(choices) || !highAllowed(choices)) && (
              <p className="muted small">
                {!facedAllowed(choices)
                  ? 'A faced or high waist needs a plain skirt in two halves: gathers, pleats, godets, a flounce, a bias slip or a diagonal hem keep the band.'
                  : 'A high waist rises from a darted skirt: pencil, straight, A-line or trumpet.'}
              </p>
            )}
            {g.id === 'waist' && zipOf(choices) && (
              <div className="chips" role="group" aria-label="Zip">
                {ZIP_PLACES.map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={zipOf(choices) === id ? 'chip on' : 'chip'}
                    aria-pressed={zipOf(choices) === id}
                    disabled={id === 'side' && !sideZipAllowed(choices)}
                    onClick={() => change({ ...choices, zip: id === 'side' ? 'side' : undefined })}
                  >
                    Zip: {label}
                  </button>
                ))}
              </div>
            )}
            {g.id === 'waist' && zipOf(choices) === 'side' && (
              <p className="muted small">The zip goes in the left side seam, so the back is cut whole on the fold{choices.slit === 'back' ? ', or keeps its centre seam for the slit' : ''}.</p>
            )}
            {g.id === 'waist' && zipOf(choices) && !sideZipAllowed(choices) && (
              <p className="muted small">A side zip goes in a plain darted skirt (pencil, straight, A-line or trumpet) with no in-seam pockets.</p>
            )}
            {g.id === 'pockets' && !pocketsAllowed(choices) && (
              <p className="muted small">In-seam pockets go in a plain side seam, so not with pleats, godets, a flounce, tiers, a bias slip or a diagonal hem.</p>
            )}
            {g.id === 'pockets' && pocketsAllowed(choices) && choices.pockets === 'inseam' && draft && !draft.pocket && (
              <p className="muted small">This skirt is too short for a pocket a hand fits in, so it is left off.</p>
            )}
          </Group>
        ))}
        <Group label={FRONT_GROUP.label}>
          <div className="chips">
            {FRONT_GROUP.options.map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={frontOf(choices) === id ? 'chip on' : 'chip'}
                aria-pressed={frontOf(choices) === id}
                disabled={id === 'yoke' ? !!yokeBlocked({ ...choices, buttons: undefined }) : id === 'buttons' ? !!buttonsBlocked(choices) : false}
                onClick={() => change({ ...choices, yoke: id === 'yoke' || undefined, buttons: id === 'buttons' || undefined })}
              >
                {label}
              </button>
            ))}
          </div>
          <Explain set="skirt" group="front" options={FRONT_GROUP.options} pick={frontOf(choices)} />
          {frontOf(choices) === 'yoke' && <p className="muted small">The yoke line runs through the point of each dart, so the darts close up inside it and the skirt below is cut without them.</p>}
          {frontOf(choices) === 'buttons' && (
            <p className="muted small">
              {draft?.buttons ? `${draft.buttons.count} buttons` : 'Buttons'} from the waistband to {BUTTONS_STOP_ABOVE_HEM} cm above the hem, so it opens a little to walk in, and one on the band. No zip.
            </p>
          )}
          {(yokeBlocked({ ...choices, buttons: undefined }) || buttonsBlocked(choices)) && (
            <p className="muted small">{yokeBlocked({ ...choices, buttons: undefined }) ?? buttonsBlocked(choices)}</p>
          )}
        </Group>
        <Group label="Belt">
          <div className="chips">
            {BELTS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={beltOf_(choices) === id ? 'chip on' : 'chip'}
                aria-pressed={beltOf_(choices) === id}
                disabled={!beltAllowed(id, { wrap: detailOf(choices, 'waist') === 'wrap', elastic: detailOf(choices, 'waist') === 'elastic' })}
                onClick={() => change({ ...choices, belt: id === 'none' ? undefined : id })}
              >
                {label}
              </button>
            ))}
          </div>
          <Explain set="skirt" group="belt" options={BELTS} pick={beltOf_(choices)} />
          {detailOf(choices, 'waist') === 'wrap' && <p className="muted small">A wrap ties at the waist already, so it takes no sash or loops.</p>}
          {detailOf(choices, 'waist') === 'elastic' && <p className="muted small">On a pull-on elastic waist a sash ties over the gathers; loops would stop it stretching.</p>}
        </Group>
        {draft && (
          <TabPanel tab={FABRIC}>
            <FabricCard metres={fabricMetres(draft)} advice={skirtFabrics(choices)} look={currentLook(choices)} fabric={fabric}>
              <FabricSwatches finish={finish} onFinish={onFinish} garment="skirt" details />
            </FabricCard>
          </TabPanel>
        )}
        {can('insideFinish') && (
          <TabPanel tab={PRO}>
            <p className="eyebrow">Inside the skirt</p>
            <FinishChoices garment="skirt" finish={finish} onFinish={onFinish} />
          </TabPanel>
        )}
      </section>

      <section className="card grow" aria-label="Preview">
        <PreviewSwitch
          look={view === 'pattern' ? 'pattern' : 'garment'}
          onLook={(l) => {
            setView(l === 'pattern' ? 'pattern' : 'sketch');
            setDrawing(false);
          }}
        />
        <div className="row between wrap">
          {view !== 'pattern' && draft ? (
            <GarmentViews<Side | 'round'>
              views={[['front', 'Front'], ['back', 'Back'], ...(round ? ([['round', 'All round']] as [Side | 'round', string][]) : [])]}
              view={view === 'round' ? 'round' : side}
              onView={(v) => {
                if (v === 'round') setView('round');
                else {
                  setSide(v);
                  setView('sketch');
                }
                setDrawing(false);
              }}
            />
          ) : canFit ? (
            <FitSwitch on={fit} onChange={setFit} />
          ) : (
            <span />
          )}
          {view === 'sketch' && draft &&
            (drawing ? (
              <button type="button" className="ghost on" aria-pressed="true" onClick={() => setDrawing(false)}>
                Done
              </button>
            ) : (
              <DrawMenu>
                <button type="button" onClick={() => setOnForm(choices)}>
                  Draw on your form
                </button>
                {/* Pleats, godets and flounces are drafted on a level hem. */}
                {volumeOf(choices) === 'none' && (
                  <button type="button" onClick={() => setDrawing(true)}>
                    Draw hem
                  </button>
                )}
                {isShaped(choices.hem) && (
                  <button type="button" onClick={() => change({ ...choices, hem: undefined })}>
                    Straighten hem
                  </button>
                )}
              </DrawMenu>
            ))}
        </div>
        <div className="preview">
          <DemoButton demo="style" />
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
          {draft && round && view === 'round' && (
            <AllRound
              round={round}
              m={values}
              striped={fabric?.checks ? (fabric.checks.stripes ? 'stripes' : 'checks') : false}
              label={`The ${title} on your form, turning, with its seams, darts and hem all the way round. Drag to turn it.`}
            />
          )}
          {draft && sheet && view === 'pattern' && !(fit && canFit) && (
            <PatternPane><PatternPreview paper sheet={sheet} play={play} names={draft.pieces.map((pc) => pc.name)} label={`Front and back pattern pieces for a ${title}`} /></PatternPane>
          )}
          {view === 'pattern' && fit && canFit && <EaseMapView views={easeMap!} label={`The fit of the ${title}, on its pattern pieces`} />}
          <UndoToast undo={undoer} />
        </div>
        {view === 'sketch' && (
          <p className={drawing ? 'muted small keep' : 'muted small'}>
            {drawing
              ? `Draw across the ${side} of the skirt where you want the hem. Switch to the back to make a high-low hem.`
              : 'Drag the hem up or down for length, or the side out and in for flare.'}
          </p>
        )}
        {view === 'pattern' && draft && (
          <div className="row between wrap">
            {!(fit && canFit) && (
              <button type="button" className="ghost" onClick={() => setPlay(play + 1)}>
                Watch it draft
              </button>
            )}
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
            {[...(draft?.pieces ?? []), ...(draft ? beltPieces(skirtBelt(choices.belt, draft), 1.5) : [])].map((pc) => (
              <li key={pc.name}>
                {pc.name}: {pc.cut.replace(' (1 pair)', '').toLowerCase()}
              </li>
            ))}
            {draft && draft.faced && <li>Waist facings: cut 1 front and 1 back, {SLIP_FACING} cm deep</li>}
            {draft?.waistFinish && (
              <li>
                Waist facings: cut 1 front and 1 back, {draft.waistFinish === 'high' ? HIGH.rise : FACING_DEPTH} cm deep, and again in interfacing
              </li>
            )}
            {draft && !draft.faced && !draft.waistFinish && (
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
        {draft && <FabricSummary metres={fabricMetres(draft)} fabric={fabric} />}
        <button type="button" className="primary" disabled={!draft} onClick={onNext}>
          Print my pattern
        </button>
        <SaveControl state={saveState} disabled={!draft} onSave={onSave} onAccount={onAccount} />
        <button type="button" className="link edit-measure" onClick={onEditMeasurements}>
          Edit measurements
        </button>
      </aside>
    </StyleLayout>
  );
}

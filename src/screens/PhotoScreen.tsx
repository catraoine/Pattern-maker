import { useEffect, useRef, useState } from 'react';
import type { Choices } from '../savedWork';
import { LENGTHS, type Length, type SkirtMeasurements } from '../engine/skirt';
import type { Unit } from '../measurements';
import { photoToJpeg } from '../photo/image';
import type { BackReading, BackResponse, Confidence, PhotoError, PhotoReading, PhotoResponse, PieceKind, TopReading, TrousersReading, UnsureGroup } from '../photo/types';
import { GROUPS } from '../skirtChoices';
import { PIECE_KINDS, PIECE_WORDS, aPiece, backMissing, backWords, choicesFor, withBack, fabricFor, pieceName, mainPiece, pieceNote, piecesToPick, skirtChoices, type PhotoBody } from '../photo/garments';
import type { MyFabric } from '../engine/fabrics';
import { isBodice, isDress, type PatternChoices } from '../garments';
import { describePattern } from './describe';
import { bodyOutline } from '../ui/bodyOutline';
import { testerHeaders } from '../ui/TesterCode';
import { DemoButton } from '../ui/DemoButton';
import type { PhotoSource } from '../photo/check';

interface Props {
  /** Sent with the photo, for a fit tester's larger daily allowance. */
  testerCode?: string;
  measured: boolean;
  /** The wearer's measurements in cm, when taken: the laid-flat length question draws on them. */
  body?: SkirtMeasurements & PhotoBody;
  unit: Unit;
  /** Leave for the style screen without a photo. */
  onByHand: () => void;
  /** The photo's preview goes along, so the style screen can show it while the app is open, and the cloth the photo showed. */
  onApply: (c: PatternChoices, preview: string, fabric?: MyFabric, source?: PhotoSource) => void;
  /** "How your pattern is made", for the AI line. */
  onMade?: () => void;
}

type Phase = 'start' | 'reading' | 'pick' | 'result' | 'length' | 'error';
type Problem = PhotoError | 'network' | 'no_garment';

// Each problem says what happened, and whether another photo can help or the way on is styling by hand.
const PROBLEMS: Record<Problem, { title: string; text: string; byHand?: boolean }> = {
  not_configured: { title: "Photo reading isn't on yet", text: 'You can still style it by hand.', byHand: true },
  too_large: { title: 'That photo is too large', text: 'Try another one, or a screenshot of it.' },
  bad_image: { title: "We couldn't open that photo", text: 'Try a JPEG or PNG.' },
  declined: { title: "We couldn't read that photo", text: 'Try a different one.' },
  failed: { title: 'Something went wrong', text: 'Please try again.' },
  limit_reached: { title: "That's today's photo readings", text: 'They come back tomorrow. You can style it by hand now.', byHand: true },
  busy: { title: 'Photo reading is resting', text: 'It comes back tomorrow. You can style it by hand now.', byHand: true },
  network: { title: "We couldn't reach the server", text: 'Check your connection and try again.' },
  no_garment: { title: "We couldn't find a garment", text: 'Try a photo with the whole garment in view.' },
};

// What makes a photo easy to match: the hem and fullness are read against the wearer's body, or,
// laid flat, from the garment's own outline.
const TIPS: { title: string; tips: string[] }[] = [
  { title: 'Worn', tips: ['Show it from the waist to the feet.', 'Stand straight on, with the camera at hip height.', 'Stand still: twirling makes a skirt look fuller.'] },
  { title: 'Laid flat', tips: ['Smooth it out flat, or hang it straight.', 'Shoot from straight above.', "For a skirt or dress, you'll choose where it ends on you."] },
  { title: 'Either way', tips: ['Keep the whole garment in the frame.', 'Good light and a plain background help.', 'A whole outfit works: tap the piece you want. Shop photos and screenshots work too.'] },
];

const SIL_NAME: Record<PhotoReading['silhouette']['value'], string> = {
  pencil: 'Pencil',
  straight: 'Straight',
  a_line: 'A-line',
  trumpet: 'Trumpet',
  half_circle: 'Half circle',
  circle: 'Full circle',
  slip: 'Bias slip',
  gathered: 'Gathered',
};
const WHERE: Record<Length, string> = { mini: 'mini length', above_knee: 'above the knee', knee: 'to the knee', midi: 'midi length', maxi: 'maxi length' };
const SURE: Record<Confidence, string> = { high: 'clear in the photo', medium: 'fairly sure', low: 'a best guess' };
const STAGES = ['Shape', 'Length', 'Fit'];
const SAMPLE_BODY: SkirtMeasurements = { waist: 76, full_hip: 102, waist_to_hip: 20.5, waist_to_knee: 58, waist_to_floor: 104 } as SkirtMeasurements;
// Where each named length falls on the sample body, waist (0) to floor (1), as the photo reading measures it.
const HEM_AT = Object.fromEntries((Object.keys(LENGTHS) as Length[]).map((l) => [l, LENGTHS[l](SAMPLE_BODY) / SAMPLE_BODY.waist_to_floor])) as Record<Length, number>;
const IN = 2.54;
// The hem's fullness each shape usually has, for a shape the sewist picked when the photo was unsure.
const USUAL_FULLNESS: Partial<Record<PhotoReading['silhouette']['value'], number>> = { pencil: 0.9, straight: 1, a_line: 1.5, trumpet: 1.8, half_circle: 3, circle: 5 };

const NECK_NAME: Record<TopReading['neckline'], string> = {
  crew: 'Crew neck',
  scoop: 'Scoop neck',
  v: 'V-neck',
  square: 'Square neck',
  boat: 'Boat neck',
  one_shoulder: 'One shoulder',
  cowl: 'Cowl neck',
  strapless: 'Strapless',
  sweetheart: 'Sweetheart',
  cami: 'Cami straps',
  halter: 'Halter',
};
const SLEEVE_NAME: Record<TopReading['sleeve'], string> = { none: 'Sleeveless', short: 'Short sleeves', elbow: 'Elbow sleeves', three_quarter: 'Three-quarter sleeves', long: 'Long sleeves' };
const LEG_NAME: Record<TrousersReading['leg'], string> = { straight: 'Straight leg', wide: 'Wide leg', tapered: 'Tapered leg', culotte: 'Culottes' };
const LENGTH_NAME: Record<Length, string> = { mini: 'Mini', above_knee: 'Above the knee', knee: 'Knee', midi: 'Midi', maxi: 'Maxi' };

/**
 * The question to ask when the reading was torn between its pick and one other option: the two names,
 * the photo's pick first, and the reading with either one set. Undefined when there's nothing to ask
 * for this garment, or the other option isn't one the app has.
 */
export function tornBetween(r: PhotoReading, piece: PieceKind): { group: UnsureGroup; options: [string, string][]; set: (v: string) => PhotoReading } | undefined {
  const u = r.unsure;
  if (!u) return undefined;
  const skirtish = piece === 'skirt' || piece === 'dress';
  const topish = (piece === 'top' || piece === 'tee' || piece === 'dress') && r.top;
  const two = (names: Record<string, string>, pick: string): [string, string][] | undefined =>
    u.other !== pick && names[u.other] && names[pick] ? [[pick, names[pick]], [u.other, names[u.other]]] : undefined;
  const ask = (options: [string, string][] | undefined, set: (v: string) => PhotoReading) => (options ? { group: u.group, options, set } : undefined);
  const silNames = Object.fromEntries(Object.entries(SIL_NAME).filter(([k]) => !['slip', 'gathered'].includes(k)));
  switch (u.group) {
    case 'silhouette':
      // A new shape lets go of the photo's exact proportions, which were read for the other one.
      return skirtish ? ask(two(silNames, r.silhouette.value), (v) => ({ ...r, silhouette: { value: v as PhotoReading['silhouette']['value'], confidence: 'high' }, shape: undefined as unknown as PhotoReading['shape'] })) : undefined;
    case 'length':
      return skirtish ? ask(two(LENGTH_NAME, r.length.value), (v) => ({ ...r, length: { value: v as Length, confidence: 'high' }, shape: r.shape && { ...r.shape, hemAt: HEM_AT[v as Length] } })) : undefined;
    case 'neckline':
      return topish ? ask(two(NECK_NAME, r.top!.neckline), (v) => ({ ...r, top: { ...r.top!, neckline: v as TopReading['neckline'] }, measures: r.measures && { ...r.measures, neckDepthCm: null } })) : undefined;
    case 'sleeve':
      return topish ? ask(two(SLEEVE_NAME, r.top!.sleeve), (v) => ({ ...r, top: { ...r.top!, sleeve: v as TopReading['sleeve'] }, measures: r.measures && { ...r.measures, sleeveEndsAt: null } })) : undefined;
    case 'leg':
      return piece === 'trousers' && r.trousers ? ask(two(LEG_NAME, r.trousers.leg), (v) => ({ ...r, trousers: { ...r.trousers!, leg: v as TrousersReading['leg'] } })) : undefined;
  }
}

/** "a shoulder bow", "a shoulder bow and tiered hem", "a, b and c". */
export const listWords = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** "V back, back slit." as a line, or what to say when the back adds nothing the app drafts. */
const backLine = (words: string, listed: boolean) =>
  words ? `${words[0].toUpperCase()}${words.slice(1)}.` : listed ? 'Its back details are listed below.' : 'A plain back, as drafted.';

/** Skirts and dresses show the shape, length and fit to change here; the rest change on their style screen. */
const hasSkirt = (g: PieceKind) => g === 'skirt' || g === 'dress';

/** The one thing that would make an unsure reading exact, or nothing when the photo was clear. */
function tipFor(r: PhotoReading): string | undefined {
  if (r.worn === false) return undefined; // laid flat: the length is asked next, and the shape reads from the outline
  if (r.length.confidence === 'low' || r.shape?.confidence === 'low') return 'The hem is hard to see in this photo. For an exact length, show the whole garment down to the feet.';
  if (r.silhouette.confidence === 'low') return 'The shape is hard to see in this photo. For a closer match, stand straight on and keep still.';
  return undefined;
}

function Tips() {
  return (
    <details className="small phototips">
      <summary>Tips</summary>
      {TIPS.map((g) => (
        <div key={g.title}>
          <p className="eyebrow">{g.title}</p>
          <ul>
            {g.tips.map((t) => (
              <li key={t} className="muted">
                {t}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </details>
  );
}

/** A small figure with the hem at the chosen length, for the laid-flat question. */
function WhereItEnds({ body, lengthCm, fullness }: { body: SkirtMeasurements; lengthCm: number; fullness: number }) {
  const cx = body.full_hip / 4 + 14;
  const hipQ = body.full_hip / 4 + 2;
  const waistQ = body.waist / 4 + 1;
  const hemQ = Math.max(hipQ * 0.9, Math.min(hipQ * fullness, hipQ * 2.4));
  const hipY = body.waist_to_hip;
  const y = Math.min(lengthCm, body.waist_to_floor - 2);
  const skirt =
    y > hipY
      ? `M${cx - waistQ} 0 L${cx + waistQ} 0 Q${cx + hipQ} ${hipY * 0.6} ${cx + hipQ} ${hipY} L${cx + hemQ} ${y} Q${cx} ${y + 3} ${cx - hemQ} ${y} L${cx - hipQ} ${hipY} Q${cx - hipQ} ${hipY * 0.6} ${cx - waistQ} 0 Z`
      : '';
  return (
    <svg viewBox={`0 -6 ${2 * cx} ${body.waist_to_floor + 10}`} className="preview-svg sketch shape whereends" aria-hidden="true">
      <path d={bodyOutline(body, cx)} className="body-outline" fill="none" strokeWidth={0.35} />
      <line x1={2} x2={2 * cx - 2} y1={body.waist_to_knee} y2={body.waist_to_knee} className="guide" strokeWidth={0.2} strokeDasharray="1 1.2" />
      <path d={skirt} style={{ fill: 'var(--garment, var(--fill))', stroke: 'var(--ink)' }} strokeWidth={0.45} strokeLinejoin="round" />
    </svg>
  );
}

export function PhotoScreen({ testerCode, measured, body, unit, onByHand, onApply, onMade }: Props) {
  const [phase, setPhase] = useState<Phase>('start');
  const [preview, setPreview] = useState<string>();
  const [problem, setProblem] = useState<Problem>();
  const [reading, setReading] = useState<PhotoReading>();
  const [choices, setChoices] = useState<Choices>();
  // The garment to draft (G1): the one the photo shows, or another picked from the list, or a piece tapped on an outfit photo (G3).
  const [piece, setPiece] = useState<PieceKind>('skirt');
  const [choosing, setChoosing] = useState(false);
  const [open, setOpen] = useState<'fit' | 'silhouette' | 'length'>();
  const [stage, setStage] = useState(0);
  const [tape, setTape] = useState('');
  // The one question an unsure reading asks, once answered, stays answered for this photo.
  const [answered, setAnswered] = useState(false);
  // The photo as sent, kept for the self-check on the next screen.
  const [sent, setSent] = useState<{ image: string; mediaType: string }>();
  const [back, setBack] = useState<BackReading>();
  const [backPreview, setBackPreview] = useState<string>();
  const [backState, setBackState] = useState<'none' | 'reading' | 'done' | 'unseen' | 'limit' | 'failed'>('none');
  const pending = useRef<AbortController>();
  const top = useRef<HTMLElement>(null);

  // Each step replaces the last in the same card, so bring its top into view on a phone.
  useEffect(() => {
    if (phase !== 'start') top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [phase]);

  // While reading, shape, length and fit light up in turn. The last one waits for the answer.
  useEffect(() => {
    if (phase !== 'reading') return;
    setStage(0);
    const t = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 1400);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => () => pending.current?.abort(), []);

  const fail = (p: Problem) => {
    setProblem(p);
    setPhase('error');
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setReading(undefined);
    setOpen(undefined);
    setChoosing(false);
    setTape('');
    let img;
    try {
      img = await photoToJpeg(file);
    } catch {
      setPreview(undefined);
      return fail('bad_image');
    }
    setPreview(img.preview);
    setSent({ image: img.image, mediaType: img.mediaType });
    setPhase('reading');
    const ctrl = new AbortController();
    pending.current = ctrl;
    try {
      const res = await fetch('/.netlify/functions/analyze-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...testerHeaders(testerCode) },
        body: JSON.stringify({ image: img.image, mediaType: img.mediaType }),
        signal: ctrl.signal,
      });
      const data = (await res.json().catch(() => ({ ok: false, error: 'failed' }))) as PhotoResponse;
      if (ctrl.signal.aborted) return;
      if (!data.ok) return fail(data.error in PROBLEMS ? data.error : 'failed');
      const r = data.reading;
      if (r.garment === 'none') return fail('no_garment');
      setReading(r);
      const g = mainPiece(r) ?? 'skirt';
      setPiece(g);
      setChoices(skirtChoices(r, g === 'dress' ? 'dress' : 'skirt'));
      setAnswered(false);
      setBack(undefined);
      setBackPreview(undefined);
      setBackState('none');
      setPhase(piecesToPick(r).length > 1 ? 'pick' : 'result');
    } catch {
      if (!ctrl.signal.aborted) fail('network');
    } finally {
      if (pending.current === ctrl) pending.current = undefined;
    }
  };

  const cancel = () => {
    pending.current?.abort();
    pending.current = undefined;
    setPreview(undefined);
    setPhase('start');
  };

  const chooser = (label: string, className: string) => (
    <label className={className === 'link' ? 'filelink' : `${className} filebtn big`}>
      {label}
      <input type="file" accept="image/*" onChange={(e) => pick(e.target.files?.[0]).finally(() => (e.target.value = ''))} />
    </label>
  );

  const thumb = preview && <img src={preview} alt="Your photo" className="photothumb" />;

  if (phase === 'start')
    return (
      <section ref={top} className="card photostart" aria-labelledby="phtitle">
        <h1 id="phtitle">Snap something you love.</h1>
        <p className="muted">
          Worn or laid flat, any size.
          <br />
          We draft it to yours.
        </p>
        <div className="photostart-actions">
          {chooser('Take or choose a photo', 'primary')}
          <Tips />
        </div>
        {/* Say it plainly, right where it happens (Cat's AI stance, 2026-10-28). */}
        <p className="muted small">
          We use AI to read the style from your photo. You check it, then we draft.{' '}
          {onMade && (
            <button type="button" className="inline-link" onClick={onMade}>
              How your pattern is made
            </button>
          )}
        </p>
        <DemoButton demo="photo" />
      </section>
    );

  if (phase === 'reading')
    return (
      <section ref={top} className="card photoread" aria-labelledby="readtitle" aria-busy="true">
        <h1 id="readtitle" className="visually-hidden">
          Reading your photo
        </h1>
        <div className="photoframe">
          <img src={preview} alt="Your photo" />
          <span className="sweep" aria-hidden="true" />
        </div>
        <p className="stages" aria-hidden="true">
          {STAGES.map((s, i) => (
            <span key={s} className={i <= stage ? 'on' : undefined}>
              {s}
            </span>
          ))}
        </p>
        <p className="muted center" role="status">
          Reading your photo…
        </p>
        <button type="button" className="link" onClick={cancel}>
          Cancel
        </button>
      </section>
    );

  if (phase === 'error' && problem) {
    const p = PROBLEMS[problem];
    return (
      <section ref={top} className="card photoerror" aria-labelledby="errtitle">
        {preview && (
          <div className="photoframe dim">
            <img src={preview} alt="Your photo" />
          </div>
        )}
        <h1 id="errtitle" role="alert">
          {p.title}
        </h1>
        <p className="muted">{p.text}</p>
        <div className="stack">
          {p.byHand ? (
            <button type="button" className="primary" onClick={onByHand}>
              Style it by hand
            </button>
          ) : (
            chooser('Try another photo', 'primary')
          )}
          {p.byHand ? null : (
            <button type="button" className="link" onClick={onByHand}>
              Style it by hand
            </button>
          )}
        </div>
      </section>
    );
  }

  if (!reading || !choices || !preview) return null;
  const flat = reading.worn === false;
  const word = PIECE_WORDS[piece];

  /** Switch garment: the skirt part is read again for a dress (no waistband) or a skirt. */
  const choose = (g: PieceKind) => {
    setPiece(g);
    setChoosing(false);
    setOpen(undefined);
    setChoices(skirtChoices(reading, g === 'dress' ? 'dress' : 'skirt'));
    setPhase('result');
  };

  /** The whole garment's choices: a skirt as changed here, a dress with its skirt as changed here, the rest as read. */
  const front = (skirt: Choices = choices): PatternChoices => {
    if (piece === 'skirt') return skirt;
    const c = choicesFor(reading, piece, body);
    return isDress(c) ? { ...c, skirt: { ...skirt, fit: c.fit } } : c;
  };
  /**
   * What the self-check needs, unless the sewist changed the shape, length or fit here: then the pattern is theirs,
   * not the photo's, and there's nothing to check it against. A shape asked about starts from its usual proportions.
   */
  const source = (): PhotoSource | undefined => {
    if (!sent) return undefined;
    const changed = hasSkirt(piece) && (choices.silhouette !== reading.silhouette.value || (reading.worn !== false && choices.length !== reading.length.value) || choices.fit !== skirtChoices(reading).fit);
    if (changed) return undefined;
    const shape = reading.shape ?? { hemAt: HEM_AT[reading.length.value], hemFullness: USUAL_FULLNESS[reading.silhouette.value] ?? 1.4, flareAt: null, confidence: 'low' as const };
    return { ...sent, reading: { ...reading, shape }, back, garment: piece };
  };
  /** With what the back photo showed, when there is one. */
  const final = (skirt: Choices = choices): PatternChoices => withBack(front(skirt), back);

  /** A second, optional photo of the back, read for its back details only. */
  const pickBack = async (file: File | undefined) => {
    if (!file) return;
    setBackState('reading');
    try {
      const img = await photoToJpeg(file);
      setBackPreview(img.preview);
      const res = await fetch('/.netlify/functions/analyze-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...testerHeaders(testerCode) },
        body: JSON.stringify({ image: img.image, mediaType: img.mediaType, view: 'back', garment: piece }),
      });
      const data = (await res.json().catch(() => ({ ok: false, error: 'failed' }))) as BackResponse;
      if (!data.ok) return setBackState(data.error === 'limit_reached' || data.error === 'busy' ? 'limit' : 'failed');
      setBack(data.back);
      setBackState(data.back.shown ? 'done' : 'unseen');
    } catch {
      setBackState('failed');
    }
  };

  if (phase === 'pick') {
    const pieces = piecesToPick(reading);
    return (
      <section ref={top} className="card photopick" aria-labelledby="picktitle">
        <h1 id="picktitle">Which piece shall we draft?</h1>
        <div className="photoframe">
          <img src={preview} alt="Your photo" />
          {pieces.map((p) => (
            <button
              key={p.garment}
              type="button"
              className={p.garment === piece ? 'piecetag on' : 'piecetag'}
              style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
              onClick={() => choose(p.garment)}
            >
              {pieceName(p.garment)}
            </button>
          ))}
        </div>
        <p className="muted small">Tap a piece. You can draft the others from this photo after.</p>
      </section>
    );
  }

  if (phase === 'length') {
    const b = body ?? SAMPLE_BODY;
    const typed = Number(tape.replace(',', '.'));
    const tapeCm = typed > 0 ? (unit === 'in' ? typed * IN : typed) : undefined;
    const lengthCm = tapeCm ?? HEM_AT[choices.length] * b.waist_to_floor;
    const pickLength = (length: Length) => {
      setTape('');
      setChoices({ ...choices, length, lengthCm: undefined, shape: choices.shape && { ...choices.shape, hemAt: HEM_AT[length] } });
    };
    const done = () => onApply(final(tapeCm ? { ...choices, lengthCm: Math.round(tapeCm * 10) / 10 } : choices), preview, fabricFor(reading), source());
    return (
      <section ref={top} className="card photolength" aria-labelledby="lentitle">
        <p className="eyebrow">One more thing</p>
        <h1 id="lentitle">Where should it end on you?</h1>
        <WhereItEnds body={b} lengthCm={lengthCm} fullness={choices.shape?.hemFullness ?? 1.4} />
        <fieldset className="group">
          <legend className="visually-hidden">Length</legend>
          <div className="chips">
            {GROUPS[2].options.map(([id, label]) => (
              <button key={id} type="button" className={!tapeCm && choices.length === id ? 'chip on' : 'chip'} aria-pressed={!tapeCm && choices.length === id} onClick={() => pickLength(id)}>
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="tapeline small">
          <span className="muted">Have a tape? Waist to hem</span>
          <input type="text" inputMode="decimal" value={tape} onChange={(e) => setTape(e.target.value)} aria-label={`Waist to hem, in ${unit}`} />
          <span className="muted">{unit}</span>
        </label>
        <button type="button" className="primary" onClick={done}>
          {measured ? `Draft my ${word}` : 'Next: add my measurements'}
        </button>
      </section>
    );
  }

  const tip = hasSkirt(piece) || piece === 'trousers' ? tipFor(reading) : undefined;
  const torn = answered ? undefined : tornBetween(reading, piece);
  const answer = (v: string) => {
    if (!torn) return;
    const r = torn.set(v);
    setReading(r);
    setChoices(skirtChoices(r, piece === 'dress' ? 'dress' : 'skirt'));
    setAnswered(true);
  };
  const missing = [...(reading.missing ?? []), ...backMissing(back)].map((m) => m.trim().toLowerCase()).filter(Boolean).slice(0, 5);
  // A dress takes its fit from the bodice, so only the skirt's shape and length change here.
  const groups = piece === 'dress' ? (flat ? [GROUPS[1]] : [GROUPS[1], GROUPS[2]]) : flat ? [GROUPS[1], GROUPS[0]] : [GROUPS[1], GROUPS[2], GROUPS[0]];
  const conf = { silhouette: reading.silhouette.confidence, length: reading.length.confidence, fit: reading.fit.confidence };
  const label = (id: 'fit' | 'silhouette' | 'length') => GROUPS.find((g) => g.id === id)!.options.find(([v]) => v === choices[id])?.[1] ?? '';
  const sil = SIL_NAME[choices.silhouette];
  const others = piecesToPick(reading).length > 1;
  const note = reading.garment === 'other' ? `This isn't something we draft yet, so here it is as ${aPiece(piece)}.` : pieceNote(reading, piece);
  const needsLength = flat && hasSkirt(piece);
  // The name, without the dress skirt's "matched to a photo".
  const named = final();
  // A neckline the photo deepened is still named as the photo's ("V-neck"), with its depth below.
  const bodiceOf = isDress(named) ? named.bodice : isBodice(named) ? named : undefined;
  const plainName = (c: PatternChoices): PatternChoices =>
    isDress(c) ? { ...c, bodice: { ...c.bodice, neck: undefined }, skirt: { ...c.skirt, shape: undefined } } : isBodice(c) ? { ...c, neck: undefined } : c;
  const title = piece !== 'skirt' ? describePattern(plainName(named)) : flat ? `A ${sil.toLowerCase()} skirt` : `${sil}, ${WHERE[choices.length]}`;
  const depth = bodiceOf?.neck ? `Neckline ${unit === 'in' ? `${Math.round((bodiceOf.neck.frontDepth / IN) * 4) / 4} in` : `${bodiceOf.neck.frontDepth} cm`} deep, as in the photo` : '';
  const sub = piece !== 'skirt' ? (needsLength ? 'The length is up to you' : depth) : flat ? `${label('fit')} fit · the length is up to you` : `${label('fit')} fit · ${SURE[reading.shape?.confidence ?? reading.length.confidence]}`;

  return (
    <section ref={top} className="card photoresult" aria-labelledby="seetitle">
      <div className="photohead">
        {thumb}
        <div>
          <p className="eyebrow">{`We see ${aPiece(piece)}${flat ? ' · laid flat' : ''}`}</p>
          <h1 id="seetitle">{title}</h1>
          {sub && <p className="muted small">{sub}</p>}
        </div>
      </div>
      {note && <p className="msg small">{note}</p>}
      {tip && <p className="msg small">{tip}</p>}
      {torn && (
        <fieldset className="group photoask">
          <legend>{`${torn.options[0][1]} or ${torn.options[1][1].toLowerCase()}?`}</legend>
          <p className="muted small">The photo could be either. Which is it?</p>
          <div className="chips">
            {torn.options.map(([id, text]) => (
              <button key={id} type="button" className="chip" onClick={() => answer(id)}>
                {text}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {hasSkirt(piece) && (
      <div className="photorows">
        {groups.map((g) => (
          <div key={g.id} className="photorow">
            <div className="photorow-line">
              <span className="eyebrow">{g.label}</span>
              <span>
                {label(g.id)}
                {conf[g.id] === 'low' && <span className="muted small"> · best guess</span>}
              </span>
              <button type="button" className="link small" aria-expanded={open === g.id} onClick={() => setOpen(open === g.id ? undefined : g.id)}>
                {open === g.id ? 'Done' : 'Change'}
              </button>
            </div>
            {open === g.id && (
              <fieldset className="group">
                <legend className="visually-hidden">{g.label}</legend>
                <div className="chips">
                  {g.options.map(([id, text]) => (
                    <button
                      key={id}
                      type="button"
                      className={choices[g.id] === id ? 'chip on' : 'chip'}
                      aria-pressed={choices[g.id] === id}
                      onClick={() => setChoices({ ...choices, [g.id]: id, ...(g.id === 'fit' ? {} : { shape: undefined }) })}
                    >
                      {text}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
          </div>
        ))}
      </div>
      )}
      <div className="photoback">
        {backPreview && <img src={backPreview} alt="The back" className="photothumb small" />}
        <div>
          {backState === 'none' && (
            <>
              <label className="filelink small">
                Add a photo of the back
                <input type="file" accept="image/*" onChange={(e) => pickBack(e.target.files?.[0]).finally(() => (e.target.value = ''))} />
              </label>
              <p className="muted small">Optional. For vents, slits, zips and low backs.</p>
            </>
          )}
          {backState === 'reading' && (
            <p className="muted small" role="status">
              Reading the back…
            </p>
          )}
          {backState === 'done' && (
            <p className="small">
              <span className="eyebrow">From the back</span>
              {backLine(backWords(front(), final()), backMissing(back).length > 0)}
            </p>
          )}
          {backState === 'unseen' && <p className="muted small">That photo doesn't show this piece from the back, so nothing from it is used.</p>}
          {backState === 'limit' && <p className="muted small">That's today's photo readings, so the back stays as usual. You can change it on the next screen.</p>}
          {backState === 'failed' && <p className="muted small">We couldn't read the back. You can change it on the next screen.</p>}
        </div>
      </div>
      {missing.length > 0 ? (
        <div className="photomissing">
          <p className="small">
            <span className="eyebrow">Not in the app yet</span> {listWords(missing)[0].toUpperCase() + listWords(missing).slice(1)}.
          </p>
          <p className="muted small">
            We've noted {missing.length > 1 ? 'them' : 'it'} for what we add next. Seams, necklines and hems you can draw on your form after drafting.
          </p>
        </div>
      ) : (
        reading.details && <p className="muted small">{reading.details}</p>
      )}
      {piece === 'skirt' && choices.shape && !flat && <p className="muted small">Your pattern copies these proportions, drafted to your measurements.</p>}
      {!hasSkirt(piece) && <p className="muted small">Drafted to your measurements. You can change any detail on the next screen.</p>}
      <div className="stack">
        {needsLength ? (
          <button type="button" className="primary" onClick={() => setPhase('length')}>
            Next: where it ends
          </button>
        ) : (
          <button type="button" className="primary" onClick={() => onApply(final(), preview, fabricFor(reading), source())}>
            {measured ? `Draft my ${word}` : 'Next: add my measurements'}
          </button>
        )}
        {others && (
          <button type="button" className="link small" onClick={() => setPhase('pick')}>
            Draft another piece from this photo
          </button>
        )}
        <button type="button" className="link small" aria-expanded={choosing} onClick={() => setChoosing(!choosing)}>
          {`Not ${aPiece(piece)}? Choose the garment`}
        </button>
        {choosing && (
          <fieldset className="group">
            <legend className="visually-hidden">Garment</legend>
            <div className="chips">
              {PIECE_KINDS.map((g) => (
                <button key={g} type="button" className={g === piece ? 'chip on' : 'chip'} aria-pressed={g === piece} onClick={() => choose(g)}>
                  {pieceName(g)}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        {chooser('Try another photo', 'link')}
      </div>
    </section>
  );
}

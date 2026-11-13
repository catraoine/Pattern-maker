import { Children, createContext, ReactNode, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Mode } from '../mode';
import type { Garment } from '../measurements';
import { canGoBack, goBack, usePageHistory } from '../nav';
import type { Flat } from '../engine/flat';
import { DemoButton } from './DemoButton';
import { EnlargeSketch, useEnlarged } from './EnlargeSketch';
import { Envelope } from './Envelope';
import { CollectionEntry, ExampleTag, GarmentDrop } from './GarmentSwitch';
import { ModeLink } from './ModeLink';
import { PhotoEntry } from './PhotoEntry';
import { Title } from './Title';
import { UndoTools, type Undo } from './useUndo';
import type { MyFabric } from '../engine/fabrics';

/** Whether the style window has lit up yet in this visit. */
let litOnce = false;

// Every style screen, laid out as Cat's B Pinned Sketch with a Looks tab (2026-10-18): the sketch stays
// pinned at the top, a row of tabs sits under it, and only one tab's choices show at a time, so choosing
// never means scrolling away from the drawing. The summary is its own Review page before Print, and the
// pro tools live together in one Pro tab, so switching them on shows that one tab appear.
// On a computer it is Cat's D1 Drafting Table (2026-10-18): the tabs run down the left, the sketch fills the
// middle, and the choices sit on the right above the summary with Print, so there's no separate Review page.
// Cat's D The Journey (2026-10-24) walks it as a fitting: the tabs are numbered steps with Next at the end of
// each, Looks is a link by the title rather than a step, and inside a step one question is open at a time, the
// rest folded to a line with their pick. Picking a choice opens the next question.

/** The tab showing now. Groups and panels outside it are hidden, not removed, so the tab row can list them. */
const ActiveTab = createContext<string | undefined>(undefined);

/** Ways in that come before any choice: always the first tab. */
export const LOOKS = 'Looks';
/** The fabric to see the sketch in. */
export const FABRIC = 'Fabric';
/** The tools the simple view tucks away: always the last tab. */
export const PRO = 'Pro';

/** A tab to open the next time a style screen opens, such as Fabric from the print screen's "Change fabric". */
let nextTab: string | undefined;
export const openTabNext = (tab: string) => {
  nextTab = tab;
};
/** The step last open on a garment's style screen, so coming back to it (from Review, Print or anywhere) opens there. */
let leftOn: { name: string; tab: string; q?: string } | undefined;


// The choices sit on a few tabs (Cat, 2026-10-18), so the whole row fits on a phone and the tailor's words
// (darts, structure) sit beside the plain ones they belong to. A group not listed keeps a tab of its own.
const SHAPE = 'Shape';
const NECK = 'Neck & sleeves';
const LENGTH = 'Length & hem';
const DETAILS = 'Details';
// One order of steps for every garment (Cat, 2026-10-31): Shape, Neck & sleeves, Length & hem, Details, then any
// step of a garment's own, Fabric, and the pro tools last. A garment skips the steps it has no questions for.
const ORDER = [LOOKS, SHAPE, NECK, LENGTH, DETAILS];
const rank = (t: string) => (t === PRO ? 7 : t === FABRIC ? 6 : ORDER.includes(t) ? ORDER.indexOf(t) : 5);
const SECTIONS: Record<string, string> = {
  Fit: SHAPE,
  Silhouette: SHAPE,
  Darts: SHAPE,
  'Bust dart from': SHAPE,
  Shaping: SHAPE,
  'Princess seams': SHAPE,
  Structure: SHAPE,
  'Waist seam': SHAPE,
  Leg: SHAPE,
  // The knit's stretch is about the fabric, so it opens the Fabric step, not Shape (Cat, 2026-10-31).
  'Your knit’s stretch': FABRIC,
  Neckline: NECK,
  Neck: NECK,
  Collar: NECK,
  Back: NECK,
  Sleeves: NECK,
  'Sleeve shape': NECK,
  'Sleeve cut': NECK,
  Cuffs: NECK,
  'Shoulder pads': NECK,
  Shoulder: NECK,
  Length: LENGTH,
  Hem: LENGTH,
  Slit: LENGTH,
  Peplum: LENGTH,
  // The jacket's rib bands sit with its length and hem, not on a step of their own (Cat, 2026-10-31).
  'Hem and cuffs': LENGTH,
  'Below the hip': LENGTH,
  Waist: DETAILS,
  Pockets: DETAILS,
  'Chest pocket': DETAILS,
  'Back pockets': DETAILS,
  Belt: DETAILS,
  Fullness: DETAILS,
  Opening: DETAILS,
  Front: DETAILS,
  'Back vent': DETAILS,
};
/** A garment's own grouping on top of the usual one, such as the dress's skirt choices on one Skirt tab. */
const Sections = createContext<Record<string, string>>({});

/**
 * Which question is open on each step (Cat's D, 2026-10-24), and a way to open one. Steady, when set, holds the
 * open question still after a pick instead of moving on to the next (the click-throughs, which pick and check).
 */
/** Whether the step that sets the length is open (or there are no steps at all, as on a plain page): the named
 *  lengths sit beside the drawing there, where the Length buttons were before the hem dot replaced them (Cat's L1,
 *  2026-10-24). On every other step the drawing is framed close to the garment (Cat's D5, 2026-10-26). */
export function useLengthStep(): boolean {
  const active = useContext(ActiveTab);
  const own = useContext(Sections);
  return active === undefined || active === (own.Length ?? SECTIONS.Length);
}

const Fold = createContext<{ open: Record<string, string>; set: (tab: string, label: string) => void; steady: boolean; one?: boolean } | undefined>(undefined);

/** Set by the click-throughs, so a pick doesn't fold its question away while a test is still checking it. */
const STEADY = 'maison-trace-steady';
const steadyNow = () => {
  try {
    return localStorage.getItem(STEADY) === '1';
  } catch {
    return false;
  }
};

/**
 * A group of choices, shown on its section's tab with the others there, or on `tab` (the Pro tab). Alone on a
 * tab of its own, the legend repeats the tab's name, so it is only read out, not shown. On a shared step only one
 * group is open at a time; the others fold to their name and their pick, and a tap on that line opens it.
 */
/** `shaped` names the choice a dragged or drawn value tunes (an oversized top given its own ease): no chip is pressed
 *  then, since tapping one would let go of the hand-shaped value, but the folded line still says what the piece is. */
export function Group({ label, tab, children, className, shaped }: { label: string; tab?: string; children: ReactNode; className?: string; shaped?: string }) {
  const active = useContext(ActiveTab);
  const own = useContext(Sections);
  const fold = useContext(Fold);
  const section = own[label] ?? SECTIONS[label];
  const t = tab ?? section ?? label;
  const solo = !tab && !section;
  const ref = useRef<HTMLFieldSetElement>(null);
  const [pick, setPick] = useState('');
  // The picked choice's name, for the folded line: a picked chip, or any pressed button when there are none.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reads the page after every render; the check stops a loop
  useLayoutEffect(() => {
    const el = ref.current;
    const text = (el ? pickIn(el) : '') || (shaped ?? '');
    if (text !== pick) setPick(text);
  });
  const folds = !!fold && !solo && t !== PRO;
  const open = !folds || fold.open[t] === label;
  // A pick opens the next question on the step, after a beat to see it land on the drawing.
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const onPick = (e: React.MouseEvent) => {
    // One question at a time on a phone (Cat's K, 2026-11-08): a pick stays put, and the bar's Next moves on.
    if (!folds || fold.steady || fold.one || !(e.target as HTMLElement).closest('.chips button')) return;
    const all = [...(ref.current?.parentElement?.querySelectorAll<HTMLFieldSetElement>(`fieldset.group[data-tab="${t}"]`) ?? [])];
    const next = all[all.indexOf(ref.current!) + 1];
    window.clearTimeout(timer.current);
    // A pick made from the keyboard (or a screen reader) carries the focus on to the next question, which opens
    // folded to the chip the focus was on; otherwise the focus would fall back to the top of the page.
    const keys = e.detail === 0;
    if (next)
      timer.current = window.setTimeout(() => {
        fold.set(t, next.dataset.label!);
        if (keys) requestAnimationFrame(() => next.querySelector<HTMLElement>('.fold-head')?.focus());
      }, 700);
  };
  return (
    <fieldset
      ref={ref}
      className={['group', solo ? 'solo' : '', folds ? (open ? 'fold open' : 'fold') : '', className].filter(Boolean).join(' ')}
      data-tab={t}
      data-label={label}
      aria-label={label}
      hidden={active !== t}
      onClick={folds ? onPick : undefined}
    >
      <legend>
        {folds ? (
          <button type="button" className="fold-head" aria-expanded={open} onClick={() => fold.set(t, label)}>
            <span className="fold-name">{label}</span>
            {/* Shown, not read out: the picked choice says so itself, and the line's name stays the question's. */}
            {pick && (
              <span className="fold-pick" aria-hidden="true">
                {pick}
              </span>
            )}
          </button>
        ) : (
          label
        )}
      </legend>
      <div className="fold-body" hidden={!open}>
        {children}
      </div>
    </fieldset>
  );
}

/** The drawing's top-left corner, where its tools stand stacked in square frames: Enlarge, then Draw (Cat, 2026-10-29). */
const Corner = createContext<HTMLElement | null>(null);

/** Puts the garment's style back to how it started, measurements untouched: given by the app around the style screens. */
/** Puts the garment's choices back to how they started, and hands back a way to undo that. */
export const StartOver = createContext<(() => () => void) | undefined>(undefined);

/** "Back to the original style", a quiet link on Review (journey review, Nov 10: testers had to go back to the start to
 *  reset). One tap asks first, since it takes away every pick. */
function StartOverLink() {
  const startOver = useContext(StartOver);
  const [asking, setAsking] = useState(false);
  const [done, setDone] = useState<() => void>();
  if (!startOver) return null;
  if (done)
    return (
      <p className="small muted start-over" role="status">
        Back to the original style.{' '}
        <button
          type="button"
          className="link quiet"
          onClick={() => {
            done();
            setDone(undefined);
          }}
        >
          Undo
        </button>
      </p>
    );
  return asking ? (
    <div className="start-over" role="group" aria-label="Back to the original style">
      <p className="small">Put every style choice back to how it started? Your measurements stay.</p>
      <p className="review-edits">
        <button
          type="button"
          className="later"
          onClick={() => {
            const undo = startOver();
            setAsking(false);
            setDone(() => undo);
          }}
        >
          Yes, start over
        </button>
        <button type="button" className="later" onClick={() => setAsking(false)}>
          Keep my choices
        </button>
      </p>
    </div>
  ) : (
    <p className="small start-over">
      <button type="button" className="link quiet" onClick={() => setAsking(true)}>
        Back to the original style
      </button>
    </p>
  );
}

/** A tool for the drawing, such as Draw on your form: stood in the drawing's corner, or in place where there is none. */
export function InCorner({ children }: { children: ReactNode }) {
  const corner = useContext(Corner);
  return corner ? createPortal(children, corner) : <>{children}</>;
}

/** Undo and Redo inside the enlarged drawing, under it: enlarged, the step's own Undo is covered, so a hem dragged too
 *  far there couldn't be taken back (Cat, Nov 12: "we need an undo button here"). Named words, as Draw on your form has. */
function BigUndo({ undo, host }: { undo: Undo; host: HTMLElement | null }) {
  const big = useEnlarged();
  const card = host?.closest<HTMLElement>('section[aria-label="Preview"]');
  if (!big || !card) return null;
  return createPortal(
    <div className="form-undo big-undo">
      <button type="button" onClick={undo.undo} disabled={!undo.canUndo} aria-label="Undo the last change">
        ↶ Undo
      </button>
      <button type="button" onClick={undo.redo} disabled={!undo.canRedo} aria-label="Redo the change you undid">
        ↷ Redo
      </button>
    </div>,
    card,
  );
}

/** Undo and Redo as two named words across from the step's number, on a phone. */
function StepUndo({ undo }: { undo: Undo }) {
  return (
    <div className="step-undo">
      <button type="button" onClick={undo.undo} disabled={!undo.canUndo} aria-label="Undo the last change" title="Undo">
        <span aria-hidden="true">↶</span>
        <small>Undo</small>
      </button>
      <button type="button" onClick={undo.redo} disabled={!undo.canRedo} aria-label="Redo the change you undid" title="Redo">
        <span aria-hidden="true">↷</span>
        <small>Redo</small>
      </button>
    </div>
  );
}

/**
 * The picked choice's name in a question: a picked chip, or any pressed button when there are none.
 * A length set on a slider between the named ones presses no chip, so it reads as the slider's cm.
 */
function pickIn(el: HTMLElement): string {
  const on = el.querySelector<HTMLElement>('.chips [aria-pressed="true"]') ?? el.querySelector<HTMLElement>('[aria-pressed="true"]');
  // The chip's own name, without an In testing tag inside it ("Boxy", not "BoxyIn testing").
  if (on) return [...on.childNodes].map((n) => (n instanceof HTMLElement && n.classList.contains('testing-tag') ? '' : n.textContent)).join('').replace(/\s+/g, ' ').trim();
  const slider = el.querySelector<HTMLInputElement>('input[type="range"][aria-label*="in cm"]');
  return slider ? `${slider.value} cm` : '';
}

/** Tailor's words the list of steps leaves to the step itself, so its picks name what changes the look. */
const TAG_SKIP = ['Cut', 'Darts', 'Structure', 'Bust dart from', 'Princess seams', 'Shaping'];

/** Anything else that belongs on one tab, such as the inside finish on the Pro tab. */
export function TabPanel({ tab, children }: { tab: string; children: ReactNode }) {
  const active = useContext(ActiveTab);
  return (
    <div className="tab-part" data-tab={tab} hidden={active !== tab}>
      {children}
    </div>
  );
}

/** The computer layout's width: the same as the min-width in styles.css. */
const WIDE = '(min-width: 1100px)';

/** Whether the screen is wide enough for the computer layout, kept up to date as the window resizes. */
export function useWide() {
  return useMedia(WIDE);
}

/** A tablet's screen (an iPad upright, or a mini on its side): too narrow for the computer layout, too big for the
 *  phone's single column. A phone on its side is under 700px tall, so it keeps the phone layout. */
const TABLET = '(min-width: 700px) and (max-width: 1099px) and (min-height: 700px)';

/** Whether the screen is a tablet's, as in TABLET. */
export function useTablet() {
  return useMedia(TABLET);
}


/** Whether the screen is a phone's width, where the picks are in the list of steps. */
export function useNarrow() {
  return useMedia('(max-width: 760px)');
}

function useMedia(q: string) {
  const query = () => typeof window !== 'undefined' && !!window.matchMedia?.(q).matches;
  const [wide, setWide] = useState(query);
  useEffect(() => {
    const list = window.matchMedia?.(q);
    if (!list) return;
    const change = () => setWide(list.matches);
    list.addEventListener('change', change);
    return () => list.removeEventListener('change', change);
  }, [q]);
  return wide;
}

/** Whether a swipe that starts here should scroll something sideways rather than change the tab. */
function scrollsSideways(el: EventTarget | null, stop: HTMLElement) {
  for (let n = el as HTMLElement | null; n && n !== stop; n = n.parentElement) if (n.scrollWidth > n.clientWidth + 2) return true;
  return false;
}

interface Props {
  /** The three parts every style screen draws: its choices, its preview and its summary. */
  children: ReactNode;
  /** "your skirt", under the screen's title. */
  label: string;
  /** The garment as chosen so far: "Knee A-line skirt". */
  name: string;
  /** Which garment (kept for the screens that pass it; the "In testing" note is on the list of what to make). */
  garment?: Garment;
  /** Fabric needed, when the pattern is drafted (shown on the Fabric step's card now, not in the bar). */
  metres?: number;
  /** Fabric width the metres are for. */
  width?: number;
  ready: boolean;
  onChooseGarment: () => void;
  /** The Looks tab's way in from a photo; the skirt brings its own card in `looks`. */
  onPhoto?: () => void;
  photo?: string;
  /** More for the Looks tab, such as the skirt's eras. */
  looks?: ReactNode;
  mode: Mode;
  onMode?: (m: Mode) => void;
  /** Edit measurements, next to Edit style at the top of the Review page. */
  onEditMeasurements?: () => void;
  /** Which tab a choice goes on, where this garment groups them its own way. */
  sections?: Record<string, string>;
  /** Undo and Redo, in the bar at the bottom beside Review. */
  undo?: Undo;
  /** The garment's technical flat: the Review page shows it as the pattern's envelope (R1, 2026-10-24). */
  flat?: Flat;
  /** Print my pattern, hoisted above the folded numbers on Review and on the computer's side. */
  onPrint?: () => void;
  /** The finished measurements and ease, open above Print rather than folded (F1, 2026-10-28). */
  finished?: ReactNode;
  /** The picked fabric (its card beside the form was taken out, Cat Nov 8; the fabric shows on the form). */
  fabric?: MyFabric;
}

const NO_SECTIONS: Record<string, string> = {};

/** One question on a phone's screen: its step, its name, and its pick for the list of questions. */
interface Question {
  tab: string;
  label: string;
  pick: string;
}

/** Where a question falls on a phone, one question per screen (the Style choices index, Cat's K, Nov 8). */
const STEP_RANK: Record<string, number> = {
  Shape: 0,
  Fit: 0,
  Leg: 0,
  Rise: 0,
  'Neck & sleeves': 1,
  Neckline: 1,
  Sleeves: 1,
  Shoulder: 1,
  Lapels: 1,
  'Length & hem': 2,
  Hem: 2,
  'Below the waist': 2,
  Details: 3,
  Waist: 3,
  Opening: 3,
  Pockets: 3,
  'Back pockets': 3,
  'Front pleats': 3,
  'Belt loops': 3,
  Fabric: 5,
};
/** Questions that move off their step: Structure and the dress's pockets and belt are details. */
const QUESTION_RANK: Record<string, number> = { Structure: 4, Pockets: 3, Belt: 3 };
/** Round the neck first, then the collar and its lapels, the back, and the sleeves. */
const NECK_ORDER = ['Neckline', 'Collar', 'Lapels', 'Back', 'Sleeves', 'Shoulder pads', 'Shoulder'];
function questionRank(q: Question): [number, number] {
  const at = QUESTION_RANK[q.label] ?? STEP_RANK[q.tab] ?? 3.5;
  const sub = at === 1 ? NECK_ORDER.indexOf(q.label) : -1;
  return [at, sub < 0 ? 0 : sub];
}

/** Past this many letters ("your trousers"), the garment's name and the example note don't share a phone's line. */
const LONG_NAME = 13;

export function StyleLayout({ children, label, name, ready, onChooseGarment, onPhoto, photo, looks, mode, onMode, onEditMeasurements, sections = NO_SECTIONS, undo, flat, onPrint, finished }: Props) {
  const [options, preview, summary] = Children.toArray(children);
  const [page, setPage] = usePageHistory<'edit' | 'review'>(() => 'edit', (s) => s === 'edit' || s === 'review');
  // Read here and cleared once mounted: React may run this twice, and the second run must see it too.
  const [active, setActive] = useState<string | undefined>(() => nextTab ?? (leftOn?.name === name ? leftOn.tab : undefined));
  useEffect(() => {
    nextTab = undefined;
  }, []);
  const [tabs, setTabs] = useState<string[]>([]);
  const root = useRef<HTMLDivElement>(null);
  // The first time Style opens in a visit, its picture window lights up from black to chalk (Cat, Nov 11), easing the
  // black of measuring into the chalk the garment sits on. Once only, and never with reduced motion (the CSS skips it).
  useEffect(() => {
    if (litOnce) return;
    litOnce = true;
    root.current?.classList.add('lights-up');
  }, []);
  const panel = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ x: number; y: number; sideways: boolean }>();
  const wide = useWide();
  const exampleTag = useContext(ExampleTag);
  // The open question on each step. Every question starts folded (Cat, 2026-11-06: the first one stood open, so
  // See the choices didn't show the whole list); a tap on one opens it.
  // The question open on that step too (Cat's K, Nov 8: on a phone each question is its own screen).
  const [folds, setFolds] = useState<Record<string, string>>(() => (!nextTab && leftOn?.name === name && leftOn.q ? { [leftOn.tab]: leftOn.q } : {}));
  useEffect(() => {
    if (active) leftOn = { name, tab: active, q: folds[active] };
  }, [name, active, folds]);
  const [steady] = useState(steadyNow);
  const fold = { open: folds, set: (t: string, l: string) => setFolds((f) => (f[t] === l ? f : { ...f, [t]: l })), steady, one: !wide };

  // The tab row lists every tab something on the page belongs to, in the order they're drawn: Looks first,
  // the choices, Fabric, then Pro. Switching the pro tools on opens the Pro tab, so the change is seen.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reads the page after every render; the checks stop a loop
  useLayoutEffect(() => {
    if (page !== 'edit' || !panel.current) return;
    const found: string[] = [];
    panel.current.querySelectorAll<HTMLElement>('[data-tab]').forEach((el) => {
      const t = el.dataset.tab!;
      if (!found.includes(t)) found.push(t);
    });
    const next = found.map((t, i) => [t, i] as const).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(([t]) => t);
    if (next.join('|') !== tabs.join('|')) {
      setTabs(next);
      if (tabs.length && !tabs.includes(PRO) && next.includes(PRO)) setActive(PRO);
    }
    // It opens on the first step; Looks is there for the link by the title.
    if (!active || !next.includes(active)) setActive(next.find((t) => t !== LOOKS) ?? next[0]);
  });

  // The sketch pins under the app's header, whatever height the header is.
  useLayoutEffect(() => {
    const bar = document.querySelector<HTMLElement>('.topbar');
    root.current?.style.setProperty('--pin-top', `${bar?.offsetHeight ?? 0}px`);
  });

  // A preview too tall to leave room for the choices (the turning form with its notes) scrolls with the page instead.
  const pin = useRef<HTMLDivElement>(null);
  // Whether the tab strip is scrolled to its end: until it is, the right edge fades to say there is more.
  const strip = useRef<HTMLDivElement>(null);
  const chapter = useRef<HTMLDivElement>(null);
  const [atEnd, setAtEnd] = useState(false);
  // On a phone the list of steps opens from "Step 1 of 5".
  const [jump, setJump] = useState(false);
  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    const check = () => setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tabs.length]);
  const [tall, setTall] = useState(false);
  // The preview's drawing area, where the Enlarge button sits.
  const [host, setHost] = useState<HTMLElement | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reads the page after every render; the check stops a loop
  useLayoutEffect(() => {
    const el = pin.current?.querySelector<HTMLElement>('.preview') ?? null;
    if (el !== host) setHost(el);
  });
  useEffect(() => {
    const el = pin.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const preview = el.querySelector<HTMLElement>('.preview');
    const strip = el.querySelector<HTMLElement>('.row.between.wrap');
    const check = () => {
      setTall(el.offsetHeight > window.innerHeight * 0.66);
      // On a phone only the drawing and the tab strip stay pinned (the aesthetic review, 2026-10-21); the view
      // switches above them scroll away. The strip sits under the drawing, and anything brought into view in the
      // choices (by a finger, a key or a test) lands below both.
      const pv = preview?.offsetHeight ?? 0;
      root.current?.style.setProperty('--pv-h', `${pv}px`);
      root.current?.style.setProperty('--pin-h', `${Math.max(el.offsetHeight, pv + (strip?.offsetHeight ?? 0))}px`);
    };
    const watch = new ResizeObserver(check);
    watch.observe(el);
    if (preview) watch.observe(preview);
    if (strip) watch.observe(strip);
    return () => watch.disconnect();
  }, [page]);

  // Bring the open tab into the row's view, without scrolling the page. The computer's list shows every tab.
  useEffect(() => {
    if (wide) return;
    const tab = active && document.getElementById(`tab-${active}`);
    const row = tab && tab.parentElement;
    if (tab && row) row.scrollTo({ left: tab.offsetLeft - row.offsetLeft - row.clientWidth / 2 + tab.offsetWidth / 2, behavior: 'smooth' });
  }, [active, tabs, wide]);

  // A swipe across the choices to the next tab moves only sideways: once the finger is plainly going across,
  // the page holds still instead of drifting up and down with it (Cat, 2026-10-20). React's touch handlers
  // can't hold the page, so this one is added by hand.
  useEffect(() => {
    const el = panel.current;
    if (!el) return;
    const hold = (e: TouchEvent) => {
      const s = swipe.current;
      const p = e.touches[0];
      if (!s || s.sideways || !p || !e.cancelable) return;
      const dx = Math.abs(p.clientX - s.x);
      if (dx > 10 && dx > 2 * Math.abs(p.clientY - s.y)) e.preventDefault();
    };
    el.addEventListener('touchmove', hold, { passive: false });
    return () => el.removeEventListener('touchmove', hold);
  }, [page]);

  // The numbered steps: every tab but Looks (a link by the title) and Pro (the pro tools, at the end).
  const steps = tabs.filter((t) => t !== LOOKS && t !== PRO);
  const strip_ = tabs.filter((t) => t !== LOOKS);
  const choose = (t: string) => {
    setActive(t);
    setJump(false);
  };
  const scrollBehavior = (): ScrollBehavior => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');
  // Next and back open the new step as the page first opens (Cat's N3, 2026-11-06): the page back at the top, the
  // drawing full size, the step's name, and "See the choices" in the bar.
  const goStep = (t: string) => {
    choose(t);
    if (!wide && window.scrollY > 0) window.scrollTo({ top: 0, behavior: scrollBehavior() });
  };
  // On a phone the step's name ends the screen, not the top of its first question peeking in under it (Cat,
  // 2026-11-06): a space under the name reaches down to the bar at the bottom, so the first question starts just out
  // of sight. Until the page has been pulled up to the end of the step's choices, the bar's button says "See the
  // choices" and scrolls right to the end; there it turns into Next (Cat's N3, and Cat 2026-11-06 live: it turned
  // into Next as soon as the page moved, and stayed so back at the top). It follows where the page is, so back up
  // at the step's name it asks to choose again.
  const more = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const seenStep = wide || inView;
  useLayoutEffect(() => {
    const b = more.current;
    if (!b) return;
    const bar = () => document.querySelector<HTMLElement>('.style-bar');
    // Measured with the page at the top, as it opens: scrolled, the drawing eases smaller and the sums change.
    const fit = () => {
      // The bar's height, for the list of steps, which opens just above it.
      document.documentElement.style.setProperty('--style-bar-h', `${bar()?.offsetHeight ?? 0}px`);
      if (window.scrollY > 1) return;
      b.style.minHeight = '';
      const room = window.innerHeight - (bar()?.offsetHeight ?? 0) - (b.getBoundingClientRect().top + window.scrollY);
      b.style.minHeight = `${Math.max(44, Math.ceil(room))}px`;
    };
    // At the end once the page is scrolled down as far as it goes (give or take a finger's slip). At the top it
    // never is: that's where the space under the step's name keeps the questions out of sight.
    const look = () => {
      fit();
      const end = document.documentElement.scrollHeight - window.innerHeight;
      setInView(window.scrollY >= 2 && window.scrollY >= end - 24);
    };
    look();
    window.addEventListener('resize', fit);
    window.addEventListener('scroll', look, { passive: true });
    return () => {
      window.removeEventListener('resize', fit);
      window.removeEventListener('scroll', look);
    };
  }, [active, wide, jump]);
  // Pulls the page up to the end of the step's choices. The drawing eases smaller once the page scrolls, which
  // shortens the page as it goes, so the browser is kept from holding its place on the page while it does, and
  // where it lands is checked again once the page has stopped, and taken on to the end if it fell short.
  // A touch, wheel or key of the person's own stops the chase, so a quick scroll back up isn't pulled down again.
  const chase = useRef(0);
  useEffect(() => {
    const stop = () => chase.current++;
    const on = ['touchstart', 'wheel', 'keydown'] as const;
    on.forEach((e) => window.addEventListener(e, stop, { passive: true }));
    return () => on.forEach((e) => window.removeEventListener(e, stop));
  }, []);
  const showChoices = (tries = 3, id = ++chase.current) => {
    const by = document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
    const html = document.documentElement.style;
    if (id !== chase.current) {
      html.removeProperty('overflow-anchor');
      return;
    }
    if (by < 4 || !tries) {
      html.removeProperty('overflow-anchor');
      // At the end of the choices now (or as near as the page goes): the bar turns into Next.
      setInView(true);
      return;
    }
    html.setProperty('overflow-anchor', 'none');
    window.scrollTo({ top: window.scrollY + by, behavior: scrollBehavior() });
    let done = false;
    const again = () => {
      if (done) return;
      done = true;
      window.removeEventListener('scrollend', again);
      // A beat later, so the drawing has finished easing smaller.
      setTimeout(() => showChoices(tries - 1, id), 250);
    };
    window.addEventListener('scrollend', again);
    setTimeout(again, 900);
  };
  // "Start from a look" in the name's drop-down (Cat, 2026-11-08 live: tapping it did nothing). On a phone the
  // step's choices sit just out of sight under its name, so picking it when it was already the step changed nothing
  // on screen. It now opens the step and pulls up its choices (a photo, the collection), as See the choices does.
  const openLooks = () => {
    choose(LOOKS);
    if (!wide) requestAnimationFrame(() => requestAnimationFrame(() => showChoices()));
  };
  const step = (by: number) => {
    if (!wide && qAt >= 0) return goQ(qAt + by);
    const i = strip_.indexOf(active ?? '');
    const to = strip_[i + by];
    if (to) choose(to);
  };
  const at = steps.indexOf(active ?? '');
  // The drawing's corner for its tools, made inside the drawing's area.
  const [corner, setCorner] = useState<HTMLElement | null>(null);
  // Each step's picks, for the list of steps on a phone (Cat's P3, 2026-11-06, in place of "Your picks"): its first
  // two questions' picks, such as "Regular · At the waist".
  const [stepPicks, setStepPicks] = useState<Record<string, string>>({});
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reads the page after every render; the check stops a loop
  useLayoutEffect(() => {
    if (wide || page !== 'edit' || !panel.current) return;
    const picks = Object.fromEntries(
      steps.map((t) => [
        t,
        [...panel.current!.querySelectorAll<HTMLElement>(`fieldset.group[data-tab="${t}"]`)]
          .filter((el) => !TAG_SKIP.includes(el.dataset.label!))
          .slice(0, 2)
          .map((el) => pickIn(el.querySelector<HTMLElement>('.fold-body') ?? el))
          .filter(Boolean)
          .join(' · '),
      ]),
    );
    if (JSON.stringify(picks) !== JSON.stringify(stepPicks)) setStepPicks(picks);
  });

  // Straight to the questions on a phone (Cat's K, 2026-11-08: "my brain gets confused seeing all these sub sub
  // categories"). The steps stay as the order, but each question is a screen of its own, named by itself, with
  // Next naming the question after it. A step whose page holds more than its questions (Fabric's swatches) is one
  // question named by the step, as is a step that is one question already.
  const [qs, setQs] = useState<Question[]>([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reads the page after every render; the check stops a loop
  useLayoutEffect(() => {
    if (wide || page !== 'edit' || !panel.current) return;
    const el = panel.current;
    const found: Question[] = [];
    for (const t of steps) {
      const groups = [...el.querySelectorAll<HTMLElement>(`fieldset.group.fold[data-tab="${CSS.escape(t)}"]`)];
      if (el.querySelector(`.tab-part[data-tab="${CSS.escape(t)}"]`) || !groups.length) found.push({ tab: t, label: t, pick: stepPicks[t] ?? '' });
      else for (const g of groups) found.push({ tab: t, label: g.dataset.label!, pick: pickIn(g.querySelector<HTMLElement>('.fold-body') ?? g) });
    }
    // In the order of the Style choices index (Cat's K, Nov 8): shape, then neck and sleeves, length and hem,
    // the details, and the fabric last, whatever step the question sits on.
    const order = found
      .map((q, i) => ({ q, i, at: questionRank(q) }))
      .sort((a, b) => a.at[0] - b.at[0] || a.at[1] - b.at[1] || a.i - b.i)
      .map((o) => o.q);
    if (JSON.stringify(order) !== JSON.stringify(qs)) setQs(order);
  });
  const split = (t?: string) => !!t && qs.some((q) => q.tab === t && q.label !== t);
  const qAt = qs.findIndex((q) => q.tab === active && (q.label === active || q.label === folds[active ?? '']));
  // Opening a step on a phone opens its first question.
  useLayoutEffect(() => {
    if (wide || !active || !qs.some((q) => q.tab === active && q.label !== active) || qs.some((q) => q.tab === active && q.label === folds[active])) return;
    const first = qs.find((q) => q.tab === active);
    if (first) setFolds((f) => ({ ...f, [active]: first.label }));
  }, [wide, active, qs, folds]);
  // On a phone each question is its own short screen (Cat's K), so the bar is Next straight away.
  const seen = seenStep || qs.length > 0;
  const goQ = (i: number) => {
    const q = qs[i];
    if (!q) return;
    if (q.label !== q.tab) setFolds((f) => ({ ...f, [q.tab]: q.label }));
    goStep(q.tab);
  };

  // On a phone the drawing stands tall at the top, then eases back once the page scrolls into the choices, so they
  // keep their room under it.
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    if (wide || page !== 'edit') return;
    const check = () => {
      const edit = root.current?.querySelector<HTMLElement>('.style-edit');
      const top = parseFloat(root.current?.style.getPropertyValue('--pin-top') || '0');
      setCompact(!!edit && edit.getBoundingClientRect().top < top - 8);
    };
    check();
    window.addEventListener('scroll', check, { passive: true });
    return () => window.removeEventListener('scroll', check);
  }, [wide, page]);

  const Name = name.charAt(0).toUpperCase() + name.slice(1);
  // The summary folded under one line, with its own Print and Edit measurements hidden (they're drawn here instead).
  const folded = (
    <details className="review-fold">
      <summary>Pieces and fabric</summary>
      {summary}
    </details>
  );

  // The Review page as the pattern's envelope (R1, look and feel review, 2026-10-24): the garment's name, the
  // front-and-back drawing, the finished measurements open (F1, 2026-10-28), one Print, and the pieces folded under a line.
  if (page === 'review')
    return (
      <div className="style-review">
        <h1 className="review-title">
          <span className="eyebrow">Review · {label}</span>
          {Name}
        </h1>
        {flat && <Envelope name={Name} flat={flat} foot="Drafted to you" />}
        {finished}
        {onPrint && (
          <button type="button" className="primary review-print" disabled={!ready} onClick={onPrint}>
            Print my pattern
          </button>
        )}
        {folded}
        {/* Both ways to change it, together under the fold. */}
        <p className="review-edits">
          <button type="button" className="later" onClick={() => (canGoBack() ? goBack() : setPage('edit'))}>
            Edit style
          </button>
          {onEditMeasurements && (
            <button type="button" className="later" onClick={onEditMeasurements}>
              Edit measurements
            </button>
          )}
        </p>
        <StartOverLink />
        {/* The pro tools (seam allowances, lining, ease) are offered here, at the end, not under the fabric (Cat,
            2026-10-31). Turning them on goes back to the steps, where they open on a tab of their own. */}
        {onMode && (
          <ModeLink
            mode={mode}
            onMode={(m) => {
              onMode(m);
              if (m === 'all') setPage('edit');
            }}
          />
        )}
      </div>
    );
  // The step after this one: the bar's Next goes there, and says only "Next" (Cat, 2026-11-06).
  const next = active === LOOKS ? steps[0] : steps[at + 1];
  // Back a step names the step it goes to, to the left of the way on (Cat's B, 2026-11-02, after a plain arrow from
  // 2026-10-31 was taken for the header's back): "‹ Shape", on every step after the first.
  const backArrow = at > 0 && (
    <button type="button" className="step-back-arrow named" aria-label={`Back to ${steps[at - 1]}`} title={steps[at - 1]} onClick={() => goStep(steps[at - 1])}>
      <span aria-hidden="true">‹</span> {steps[at - 1].split(/\s/)[0]}
    </button>
  );

  return (
    <div className={compact ? 'style-layout compact' : 'style-layout'} data-long-name={label.length > LONG_NAME || undefined} ref={root}>
      {/* The garment's name is the page's one big heading (Cat's K3, 2026-10-28): the word Style is only read out
          (the top bar says it), Start from a look is in the name's drop-down, and the example note is one soft line. */}
      <div className="screen-head">
        <Title id="opts" big="Style" label={label} hideLabel />
        <GarmentDrop label={label} onChoose={onChooseGarment} onLooks={tabs.includes(LOOKS) ? openLooks : undefined} />
      </div>
      {exampleTag}
      <div className="style-edit">
        <div className={['style-pin', tall && 'tall'].filter(Boolean).join(' ')} ref={pin}>
          {/* The drawing knows which step is open: on the length step it reaches down to the longest length. */}
          <ActiveTab.Provider value={active}>
            <Sections.Provider value={sections}>
              <Corner.Provider value={corner}>{preview}</Corner.Provider>
            </Sections.Provider>
          </ActiveTab.Provider>
          {host &&
            createPortal(
              <>
                <div className="preview-corner" ref={setCorner} />
                {/* No fabric card beside the form (Cat, Nov 8): the fabric tapped is on the form itself. */}
              </>,
              host,
            )}
          <EnlargeSketch host={host} corner={corner} name={name} />
          {undo && <BigUndo undo={undo} host={host} />}
        </div>
        <div
          className={!wide && split(active) ? 'style-panel one-q' : 'style-panel'}
          ref={panel}
          role="tabpanel"
          aria-label={active}
          onTouchStart={(e) => {
            const p = e.touches[0];
            swipe.current = { x: p.clientX, y: p.clientY, sideways: scrollsSideways(e.target, e.currentTarget) };
          }}
          onTouchEnd={(e) => {
            const s = swipe.current;
            swipe.current = undefined;
            if (!s || s.sideways) return;
            const p = e.changedTouches[0];
            const dx = p.clientX - s.x;
            if (Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(p.clientY - s.y)) step(dx < 0 ? 1 : -1);
          }}
        >
          {/* The open step as a chapter (Cat's H4 + N3, 2026-10-28): "Step 1 of 5", the step's name set large, and the
              steps as a thin line of bars to tap under it. The next step's name is only on the Next button. */}
          <div className="chapter" ref={chapter}>
            {/* Watch demo sits across from the step on a computer (Cat's D3, 2026-10-29). On a phone the step bars are
                gone and Watch demo is a link at the end of the step (Cat's P1, 2026-10-31): "Step 1 of 5" opens the
                list of steps instead, to jump to one. */}
            <div className="chapter-top">
              {wide ? (
                at >= 0 && (
                  <p className="chapter-step">
                    Step <b>{at + 1}</b> of {steps.length}
                  </p>
                )
              ) : null}
              {wide && <DemoButton demo="style" />}
              {/* On a phone, Undo and Redo are named, across from "Step 2 of 4", once there is something to undo:
                  well away from the step's back arrow in the bar (Cat, 2026-10-31). */}
              {!wide && undo && (undo.canUndo || undo.canRedo) && <StepUndo undo={undo} />}
            </div>
            {wide ? (
              <h2 className="chapter-name">{active === LOOKS ? 'Start from a look' : active}</h2>
            ) : (
              // The question's own name is the heading (Cat's K): a tap lists every question, to jump to any one.
              <h2 className="chapter-name">
                <button type="button" className="chapter-step q-head" aria-expanded={jump} aria-controls="style-steps" onClick={() => setJump((j) => !j)}>
                  {active === LOOKS ? 'Start from a look' : (qs[qAt]?.label ?? active)}
                  <span className="chapter-step-mark" aria-hidden="true" />
                </button>
              </h2>
            )}
            <div
              id="style-steps"
              className={['style-tabs', atEnd && 'at-end', jump && 'open'].filter(Boolean).join(' ')}
              role="tablist"
              aria-label="Style choices"
              ref={strip}
              onScroll={(e) => setAtEnd(e.currentTarget.scrollLeft + e.currentTarget.clientWidth >= e.currentTarget.scrollWidth - 2)}
            >
              {!wide && qs.length > 0
                ? qs.map((q, i) => (
                    <button
                      key={`${q.tab}|${q.label}`}
                      id={`q-${i}`}
                      type="button"
                      role="tab"
                      aria-selected={i === qAt}
                      aria-label={q.label}
                      title={q.label}
                      data-step={q.tab}
                      tabIndex={i === qAt ? 0 : -1}
                      className={i === qAt ? 'on' : ''}
                      onClick={() => goQ(i)}
                      onKeyDown={(e) => {
                        const by = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number | undefined>)[e.key];
                        const to = e.key === 'Home' ? 0 : e.key === 'End' ? qs.length - 1 : by && i + by;
                        if (to === undefined || to < 0 || to >= qs.length) return;
                        e.preventDefault();
                        // As with the steps: the arrow keys move along the questions with the list held open.
                        const q = qs[to];
                        if (q.label !== q.tab) setFolds((f) => ({ ...f, [q.tab]: q.label }));
                        setActive(q.tab);
                        requestAnimationFrame(() => document.getElementById(`q-${to}`)?.focus());
                      }}
                    >
                      <span className="tab-full">{q.label}</span>
                      {q.pick && <span className="step-pick">{q.pick}</span>}
                    </button>
                  ))
                : strip_.map((t) => (
                <button
                  key={t}
                  id={`tab-${t}`}
                  type="button"
                  role="tab"
                  aria-selected={active === t}
                  aria-label={t}
                  title={t}
                  tabIndex={active === t ? 0 : -1}
                  className={[active === t ? 'on' : '', t === PRO ? 'pro' : ''].filter(Boolean).join(' ')}
                  onClick={() => choose(t)}
                  onKeyDown={(e) => {
                    // One stop in the tab order for the steps; the arrow keys move along them, as tabs do.
                    const by = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number | undefined>)[e.key];
                    const to = e.key === 'Home' ? 0 : e.key === 'End' ? strip_.length - 1 : by && strip_.indexOf(t) + by;
                    if (to === undefined || to < 0 || to >= strip_.length) return;
                    e.preventDefault();
                    // The arrow keys move along the steps with the phone's list held open; a tap picks one and shuts it.
                    setActive(strip_[to]);
                    requestAnimationFrame(() => document.getElementById(`tab-${strip_[to]}`)?.focus());
                  }}
                >
                  {steps.includes(t) && (
                    <span className="step-no" aria-hidden="true">
                      {steps.indexOf(t) + 1}
                    </span>
                  )}
                  {/* On a phone the strip ran off the screen (the tester walk, 2026-10-27): there each tab is its first word. */}
                  <span className="tab-full">{t}</span>
                  <span className="tab-short">{t.split(/\s/)[0]}</span>
                  {!wide && stepPicks[t] && <span className="step-pick">{stepPicks[t]}</span>}
                </button>
              ))}
            </div>
            {!wide && (
              <div className="chapter-more" ref={more} aria-hidden="true" />
            )}
          </div>
          <Fold.Provider value={fold}>
          <ActiveTab.Provider value={active}>
            <Sections.Provider value={sections}>
            <TabPanel tab={LOOKS}>
              {/* The house looks first: the fit testers sew one of them (tester journey, Nov 11). */}
              <CollectionEntry />
              {looks ?? <PhotoEntry onPhoto={onPhoto} photo={photo} />}
            </TabPanel>
            {options}
            {mode === 'all' ? (
              <TabPanel tab={PRO}>
                <p className="muted small">The Ease view by the sketch is a pro tool too.</p>
                <ModeLink mode={mode} onMode={onMode} />
              </TabPanel>
            ) : (
              // Once, on the last tab, so it isn't repeated under every choice.
              // On a computer under every step; on a phone it is on the Review page (Cat, 2026-10-31).
              wide && <ModeLink mode={mode} onMode={onMode} />
            )}
            </Sections.Provider>
          </ActiveTab.Provider>
          </Fold.Provider>
          {/* The way on: the next step, or Review after the last (on a computer the summary is already beside it). */}
          {wide && (active === LOOKS || at >= 0) && (
            <div className="step-next">
              {backArrow}
              {/* On a phone the one box is in the bar at the bottom (F1, 2026-10-24); the computer has no bar. */}
              {active === LOOKS && steps[0] ? (
                  <button type="button" className="step-go" onClick={() => goStep(steps[0])}>
                    Start with {steps[0]} ›
                  </button>
                ) : (
                  steps[at + 1] && (
                    <button type="button" className="step-go" aria-label={`Next: ${steps[at + 1]}`} onClick={() => goStep(steps[at + 1])}>
                      Next ›
                    </button>
                  )
                )}
            </div>
          )}
          {/* On a phone the step ends with two quiet links (Cat's P1, 2026-10-31): Review, which left the bar so it
              holds one button, and Watch demo. */}
          {/* On a phone the list of questions holds every pick, so Review comes after the last question, and Watch
              demo stands with the drawing's tools, under Enlarge and Draw (Cat's B combo and K, 2026-11-08). */}
          {!wide && corner && createPortal(<DemoButton demo="style" />, corner)}
        </div>
        {wide ? (
          <div className="style-side">
            <div className="row between">
              <p className="eyebrow">{name}</p>
              {undo && <UndoTools undo={undo} />}
            </div>
            {finished}
            {onPrint && (
              <button type="button" className="primary review-print" disabled={!ready} onClick={onPrint}>
                Print my pattern
              </button>
            )}
            {folded}
            {onEditMeasurements && (
              <p className="review-edits side-edits">
                <button type="button" className="later" onClick={onEditMeasurements}>
                  Edit measurements
                </button>
              </p>
            )}
            <StartOverLink />
          </div>
        ) : (
          // One box in the bar (Cat's N3, 2026-10-28, and P1, 2026-10-31): Next in champagne, or Review after the
          // last; Review before then is a link at the end of the step. Back a step is the arrow to its left; undo
          // and redo moved up to the drawing's corner so the two arrows are never mixed up (2026-10-31).
          <div className="style-bar">
            {/* The garment's name is read out as it changes, not shown: the drawing shows it (Cat's N3). */}
            <p className="visually-hidden" role="status">
              {Name}
            </p>
            {qAt > 0 ? (
              // Back a question is a bare arrowhead (Cat, 2026-11-08), so the bar's only words are Next's.
              <button type="button" className="step-back-arrow" aria-label={`Back to ${qs[qAt - 1].label}`} title={qs[qAt - 1].label} onClick={() => goQ(qAt - 1)}>
                <span aria-hidden="true">‹</span>
              </button>
            ) : (
              qAt < 0 && backArrow
            )}
            {qAt >= 0 && qs[qAt + 1] ? (
              <button type="button" className="primary" aria-label={`Next: ${qs[qAt + 1].label}`} onClick={() => goQ(qAt + 1)}>
                Next: {qs[qAt + 1].label} <span aria-hidden="true">›</span>
              </button>
            ) : qAt >= 0 ? (
              <button type="button" className="primary" disabled={!ready} onClick={() => setPage('review')}>
                Review <span aria-hidden="true">›</span>
              </button>
            ) : !seen ? (
              <button type="button" className="primary" onClick={() => showChoices()}>
                See the choices <span aria-hidden="true">↓</span>
              </button>
            ) : next ? (
              // Just "Next" on the button (Cat, 2026-11-06): the step's name is read out, not shown.
              <button type="button" className="primary" aria-label={`Next: ${next}`} onClick={() => goStep(next)}>
                Next <span aria-hidden="true">›</span>
              </button>
            ) : (
              <button type="button" className="primary" disabled={!ready} onClick={() => setPage('review')}>
                Review <span aria-hidden="true">›</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

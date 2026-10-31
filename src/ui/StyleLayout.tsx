import { Children, createContext, ReactNode, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Mode } from '../mode';
import type { Garment } from '../measurements';
import { canGoBack, goBack, usePageHistory } from '../nav';
import type { Flat } from '../engine/flat';
import { DemoButton } from './DemoButton';
import { EnlargeSketch } from './EnlargeSketch';
import { Envelope } from './Envelope';
import { CollectionEntry, ExampleTag, GarmentDrop } from './GarmentSwitch';
import { ModeLink } from './ModeLink';
import { PhotoEntry } from './PhotoEntry';
import { Title } from './Title';
import { UndoTools, type Undo } from './useUndo';

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
let leftOn: { name: string; tab: string } | undefined;

const rank = (t: string) => (t === LOOKS ? 0 : t === PRO ? 3 : t === FABRIC ? 2 : 1);

// The choices sit on a few tabs (Cat, 2026-10-18), so the whole row fits on a phone and the tailor's words
// (darts, structure) sit beside the plain ones they belong to. A group not listed keeps a tab of its own.
const SHAPE = 'Shape';
const NECK = 'Neck & sleeves';
const LENGTH = 'Length & hem';
const DETAILS = 'Details';
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
  'Your knit’s stretch': SHAPE,
  Neckline: NECK,
  Neck: NECK,
  Collar: NECK,
  Back: NECK,
  Sleeves: NECK,
  'Sleeve shape': NECK,
  'Sleeve cut': NECK,
  Cuffs: NECK,
  'Shoulder pads': NECK,
  Length: LENGTH,
  Hem: LENGTH,
  Slit: LENGTH,
  Peplum: LENGTH,
  'Below the hip': LENGTH,
  Waist: DETAILS,
  Pockets: DETAILS,
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

const Fold = createContext<{ open: Record<string, string>; set: (tab: string, label: string) => void; steady: boolean } | undefined>(undefined);

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
export function Group({ label, tab, children, className }: { label: string; tab?: string; children: ReactNode; className?: string }) {
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
    const text = el ? pickIn(el) : '';
    if (text !== pick) setPick(text);
  });
  const folds = !!fold && !solo && t !== PRO;
  const open = !folds || fold.open[t] === label;
  // A pick opens the next question on the step, after a beat to see it land on the drawing.
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const onPick = (e: React.MouseEvent) => {
    if (!folds || fold.steady || !(e.target as HTMLElement).closest('.chips button')) return;
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

/** A tool for the drawing, such as Draw on your form: stood in the drawing's corner, or in place where there is none. */
export function InCorner({ children }: { children: ReactNode }) {
  const corner = useContext(Corner);
  return corner ? createPortal(children, corner) : <>{children}</>;
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

/** The tag's names for the questions, where the question's own is longer than the tag has room for. */
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

const TAG_NAMES: Record<string, string> = { 'Waist seam': 'Waist', Neckline: 'Neck', 'Sleeve shape': 'Sleeve', 'Your knit’s stretch': 'Stretch' };
/** Tailor's words the tag leaves to the step itself, so its lines name what changes the look. */
const TAG_SKIP = ['Cut', 'Darts', 'Structure', 'Bust dart from', 'Princess seams', 'Shaping'];
/** How many lines the tag beside the drawing holds. */
const TAG_LINES = 6;
interface TagLine {
  label: string;
  pick: string;
  mine: boolean;
}

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

/** Whether the screen is a phone's width, where the drawing stands beside its tag of picks. */
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
}

const NO_SECTIONS: Record<string, string> = {};

// Preview only: ?back=head puts the back arrow beside "Step 2 of 5" instead of beside Next, to compare the two.
const backInHead = typeof location !== 'undefined' && new URLSearchParams(location.search).get('back') === 'head';

export function StyleLayout({ children, label, name, ready, onChooseGarment, onPhoto, photo, looks, mode, onMode, onEditMeasurements, sections = NO_SECTIONS, undo, flat, onPrint, finished }: Props) {
  const [options, preview, summary] = Children.toArray(children);
  const [page, setPage] = usePageHistory<'edit' | 'review'>(() => 'edit', (s) => s === 'edit' || s === 'review');
  // Read here and cleared once mounted: React may run this twice, and the second run must see it too.
  const [active, setActive] = useState<string | undefined>(() => nextTab ?? (leftOn?.name === name ? leftOn.tab : undefined));
  useEffect(() => {
    nextTab = undefined;
  }, []);
  useEffect(() => {
    if (active) leftOn = { name, tab: active };
  }, [name, active]);
  const [tabs, setTabs] = useState<string[]>([]);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ x: number; y: number; sideways: boolean }>();
  const wide = useWide();
  const exampleTag = useContext(ExampleTag);
  // The open question on each step: the first one until another is opened.
  const [folds, setFolds] = useState<Record<string, string>>({});
  const [steady] = useState(steadyNow);
  const fold = { open: folds, set: (t: string, l: string) => setFolds((f) => (f[t] === l ? f : { ...f, [t]: l })), steady };

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
    if (active && !folds[active]) {
      const first = panel.current.querySelector<HTMLElement>(`fieldset.group.fold[data-tab="${active}"]`);
      if (first) setFolds((f) => ({ ...f, [active]: first.dataset.label! }));
    }
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
  // Next and back bring the new step's start up under the drawing, if the page had scrolled past it.
  const goStep = (t: string) => {
    choose(t);
    const head = chapter.current;
    if (!head || wide) return;
    // The step's chapter lands just under the pinned drawing and its row of views.
    const pinned = Math.max(0, ...[...(pin.current?.querySelectorAll<HTMLElement>('.preview, .row.between.wrap') ?? [])].map((e) => parseFloat(getComputedStyle(e).top) + e.offsetHeight || 0));
    const top = window.scrollY + head.getBoundingClientRect().top - pinned;
    if (window.scrollY > top) window.scrollTo({ top, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  const step = (by: number) => {
    const i = strip_.indexOf(active ?? '');
    const to = strip_[i + by];
    if (to) choose(to);
  };
  const at = steps.indexOf(active ?? '');

  // The drawing's corner for its tools, made inside the drawing's area.
  const [corner, setCorner] = useState<HTMLElement | null>(null);
  // The tag beside the drawing on a phone (Cat's L4 + T2, 2026-10-29): a line for the main questions, each with its
  // pick, bright once it is yours (tapped, or its step passed) and soft while it is still the starting choice.
  const [touched, setTouched] = useState<{ of: string; labels: string[] }>({ of: label, labels: [] });
  const mine = touched.of === label ? touched.labels : [];
  const [tag, setTag] = useState<TagLine[]>([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reads the page after every render; the check stops a loop
  useLayoutEffect(() => {
    if (wide || page !== 'edit' || !panel.current) return;
    const groups = steps
      .filter((t) => t !== FABRIC)
      .map((t, i) => [...panel.current!.querySelectorAll<HTMLElement>(`fieldset.group[data-tab="${t}"]`)].filter((el) => !TAG_SKIP.includes(el.dataset.label!)).map((el, j) => ({ el, i, j })));
    // The first question of every step, then the second ones, in the order they are asked.
    const picked = [0, 1]
      .flatMap((j) => groups.map((g) => g[j]).filter(Boolean))
      .slice(0, TAG_LINES)
      .sort((a, b) => a.i - b.i || a.j - b.j);
    const lines = picked.map(({ el, i }) => {
      const name = el.dataset.label!;
      return { label: TAG_NAMES[name] ?? name, pick: pickIn(el.querySelector<HTMLElement>('.fold-body') ?? el), mine: i < at || mine.includes(name) };
    });
    if (JSON.stringify(lines) !== JSON.stringify(tag)) setTag(lines);
  });
  const touch = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    const group = t.closest<HTMLElement>('fieldset.group');
    if (!group || !t.closest('.fold-body button, .fold-body input')) return;
    const name = group.dataset.label!;
    if (!mine.includes(name)) setTouched({ of: label, labels: [...mine, name] });
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
      </div>
    );
  // The step after this one, and its first word for the narrow bar at the bottom ("Next: Neck").
  const next = active === LOOKS ? steps[0] : steps[at + 1];
  // Back a step is a plain arrow to the left of the way on (Cat, 2026-10-31), on every step after the first, so the
  // way back is there on the last step too. Its name is read out, not shown.
  const backArrow = at > 0 && (
    <button type="button" className="step-back-arrow" aria-label={`Back to ${steps[at - 1]}`} title={steps[at - 1]} onClick={() => goStep(steps[at - 1])}>
      <span aria-hidden="true">←</span>
    </button>
  );

  return (
    <div className={compact ? 'style-layout compact' : 'style-layout'} ref={root}>
      {/* The garment's name is the page's one big heading (Cat's K3, 2026-10-28): the word Style is only read out
          (the top bar says it), Start from a look is in the name's drop-down, and the example note is one soft line. */}
      <div className="screen-head">
        <Title id="opts" big="Style" label={label} hideLabel />
        <GarmentDrop label={label} onChoose={onChooseGarment} onLooks={tabs.includes(LOOKS) ? () => choose(LOOKS) : undefined} />
      </div>
      {exampleTag}
      <div className="style-edit">
        <div className={tall ? 'style-pin tall' : 'style-pin'} ref={pin}>
          {/* The drawing knows which step is open: the named lengths sit beside it only on the length step. */}
          <ActiveTab.Provider value={active}>
            <Sections.Provider value={sections}>
              <Corner.Provider value={corner}>{preview}</Corner.Provider>
            </Sections.Provider>
          </ActiveTab.Provider>
          {host &&
            createPortal(
              <>
                <div className="preview-corner" ref={setCorner} />
                {tag.length > 0 && (
                  <dl className="spec-tag" aria-label="Your choices so far">
                    {tag.map((l) => (
                      <div key={l.label} className={l.mine ? 'mine' : undefined}>
                        <dt>{l.label}</dt>
                        <dd>{l.pick}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </>,
              host,
            )}
          <EnlargeSketch host={host} corner={corner} name={name} />
        </div>
        <div
          className="style-panel"
          ref={panel}
          role="tabpanel"
          aria-label={active}
          onClickCapture={touch}
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
            <div className={backInHead && at > 0 ? 'chapter-top with-back' : 'chapter-top'}>
              {backInHead && backArrow}
              {wide ? (
                at >= 0 && (
                  <p className="chapter-step">
                    Step <b>{at + 1}</b> of {steps.length}
                  </p>
                )
              ) : (
                <button type="button" className="chapter-step" aria-expanded={jump} aria-controls="style-steps" onClick={() => setJump((j) => !j)}>
                  {at >= 0 ? (
                    <>
                      Step <b>{at + 1}</b> of {steps.length}
                    </>
                  ) : (
                    'The steps'
                  )}
                  <span className="chapter-step-mark" aria-hidden="true" />
                </button>
              )}
              {wide && <DemoButton demo="style" />}
              {/* On a phone, Undo and Redo are named, across from "Step 2 of 4", once there is something to undo:
                  well away from the step's back arrow in the bar (Cat, 2026-10-31). */}
              {!wide && undo && (undo.canUndo || undo.canRedo) && <StepUndo undo={undo} />}
            </div>
            <h2 className="chapter-name">{active === LOOKS ? 'Start from a look' : active}</h2>
            <div
              id="style-steps"
              className={['style-tabs', atEnd && 'at-end', jump && 'open'].filter(Boolean).join(' ')}
              role="tablist"
              aria-label="Style choices"
              ref={strip}
              onScroll={(e) => setAtEnd(e.currentTarget.scrollLeft + e.currentTarget.clientWidth >= e.currentTarget.scrollWidth - 2)}
            >
              {strip_.map((t) => (
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
                </button>
              ))}
            </div>
          </div>
          <Fold.Provider value={fold}>
          <ActiveTab.Provider value={active}>
            <Sections.Provider value={sections}>
            <TabPanel tab={LOOKS}>
              {looks ?? <PhotoEntry onPhoto={onPhoto} photo={photo} />}
              <CollectionEntry />
            </TabPanel>
            {options}
            {mode === 'all' ? (
              <TabPanel tab={PRO}>
                <p className="muted small">The Ease view by the sketch is a pro tool too.</p>
                <ModeLink mode={mode} onMode={onMode} />
              </TabPanel>
            ) : (
              // Once, on the last tab, so it isn't repeated under every choice.
              (wide || active === tabs[tabs.length - 1]) && <ModeLink mode={mode} onMode={onMode} />
            )}
            </Sections.Provider>
          </ActiveTab.Provider>
          </Fold.Provider>
          {/* The way on: the next step, or Review after the last (on a computer the summary is already beside it). */}
          {wide && (active === LOOKS || at >= 0) && (
            <div className="step-next">
              {!backInHead && backArrow}
              {/* On a phone the one box is in the bar at the bottom (F1, 2026-10-24); the computer has no bar. */}
              {active === LOOKS && steps[0] ? (
                  <button type="button" className="step-go" onClick={() => goStep(steps[0])}>
                    Start with {steps[0]} ›
                  </button>
                ) : (
                  steps[at + 1] && (
                    <button type="button" className="step-go" onClick={() => goStep(steps[at + 1])}>
                      Next: {steps[at + 1]} ›
                    </button>
                  )
                )}
            </div>
          )}
          {/* On a phone the step ends with two quiet links (Cat's P1, 2026-10-31): Review, which left the bar so it
              holds one button, and Watch demo. */}
          {!wide && (
            <div className="step-links">
              {next && ready && (
                <button type="button" className="later go step-review" onClick={() => setPage('review')}>
                  Review all choices <span aria-hidden="true">›</span>
                </button>
              )}
              <DemoButton demo="style" />
            </div>
          )}
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
            {!backInHead && backArrow}
            {next ? (
              <button type="button" className="primary" onClick={() => goStep(next)}>
                Next: {next.split(/\s/)[0]} <span aria-hidden="true">›</span>
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

import { Children, createContext, ReactNode, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Mode } from '../mode';
import type { Garment } from '../measurements';
import { canGoBack, goBack, usePageHistory } from '../nav';
import { EnlargeSketch } from './EnlargeSketch';
import { CollectionEntry, GarmentDrop } from './GarmentSwitch';
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
  Details: DETAILS,
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
  useLayoutEffect(() => {
    const el = ref.current;
    const on = el?.querySelector<HTMLElement>('.chips [aria-pressed="true"]') ?? el?.querySelector<HTMLElement>('[aria-pressed="true"]');
    const text = (on?.textContent ?? '').replace(/\s+/g, ' ').trim();
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
    if (next) timer.current = window.setTimeout(() => fold.set(t, next.dataset.label!), 700);
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
  const query = () => typeof window !== 'undefined' && !!window.matchMedia?.(WIDE).matches;
  const [wide, setWide] = useState(query);
  useEffect(() => {
    const list = window.matchMedia?.(WIDE);
    if (!list) return;
    const change = () => setWide(list.matches);
    list.addEventListener('change', change);
    return () => list.removeEventListener('change', change);
  }, []);
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
  /** Fabric needed, when the pattern is drafted. */
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
}

const NO_SECTIONS: Record<string, string> = {};

export function StyleLayout({ children, label, name, metres, width = 140, ready, onChooseGarment, onPhoto, photo, looks, mode, onMode, onEditMeasurements, sections = NO_SECTIONS, undo }: Props) {
  const [options, preview, summary] = Children.toArray(children);
  const [page, setPage] = usePageHistory<'edit' | 'review'>(() => 'edit');
  // Read here and cleared once mounted: React may run this twice, and the second run must see it too.
  const [active, setActive] = useState<string | undefined>(() => nextTab);
  useEffect(() => {
    nextTab = undefined;
  }, []);
  const [tabs, setTabs] = useState<string[]>([]);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ x: number; y: number; sideways: boolean }>();
  const wide = useWide();
  // The open question on each step: the first one until another is opened.
  const [folds, setFolds] = useState<Record<string, string>>({});
  const [steady] = useState(steadyNow);
  const fold = { open: folds, set: (t: string, l: string) => setFolds((f) => (f[t] === l ? f : { ...f, [t]: l })), steady };

  // The tab row lists every tab something on the page belongs to, in the order they're drawn: Looks first,
  // the choices, Fabric, then Pro. Switching the pro tools on opens the Pro tab, so the change is seen.
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
  const [atEnd, setAtEnd] = useState(false);
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
  useLayoutEffect(() => {
    const el = pin.current?.querySelector<HTMLElement>('.preview') ?? null;
    if (el !== host) setHost(el);
  });
  useEffect(() => {
    const el = pin.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const preview = el.querySelector<HTMLElement>('.preview');
    const strip = el.querySelector<HTMLElement>('.style-tabs');
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
  const choose = (t: string) => setActive(t);
  // Next and back bring the new step's start up under the drawing, if the page had scrolled past it.
  const goStep = (t: string) => {
    choose(t);
    const row = strip.current;
    if (!row || wide) return;
    const pinned = parseFloat(getComputedStyle(row).top) || 0;
    const top = window.scrollY + row.getBoundingClientRect().top - pinned;
    if (window.scrollY > top) window.scrollTo({ top, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  const step = (by: number) => {
    const i = strip_.indexOf(active ?? '');
    const to = strip_[i + by];
    if (to) choose(to);
  };
  const at = steps.indexOf(active ?? '');

  if (page === 'review')
    return (
      <div className="style-review">
        <div className="screen-head">
          <Title big="Review" label={label} />
        </div>
        <p className="review-name">{name}</p>
        {/* Both ways to change it, together under the name; the summary's own Edit measurements is for the computer layout. */}
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
        {summary}
      </div>
    );

  return (
    <div className="style-layout" ref={root}>
      <div className="screen-head">
        <Title id="opts" big="Style" label={label} hideLabel />
        <GarmentDrop label={label} onChoose={onChooseGarment} />
        {tabs.includes(LOOKS) && (
          <button type="button" className="later looks-link" aria-pressed={active === LOOKS} onClick={() => choose(LOOKS)}>
            Start from a look
          </button>
        )}
      </div>
      <div className="style-edit">
        <div className={tall ? 'style-pin tall' : 'style-pin'} ref={pin}>
          {preview}
          <EnlargeSketch host={host} name={name} />
          <div
            className={atEnd ? 'style-tabs at-end' : 'style-tabs'}
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
                className={[active === t ? 'on' : '', t === PRO ? 'pro' : ''].filter(Boolean).join(' ')}
                onClick={() => choose(t)}
              >
                {steps.includes(t) && (
                  <span className="step-no" aria-hidden="true">
                    {steps.indexOf(t) + 1}
                  </span>
                )}
                {t}
              </button>
            ))}
          </div>
        </div>
        <div
          className="style-panel"
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
          {(active === LOOKS || at >= 0) && (
            <div className="step-next">
              {at > 0 && (
                <button type="button" className="later step-back" onClick={() => goStep(steps[at - 1])}>
                  ‹ {steps[at - 1]}
                </button>
              )}
              {active === LOOKS && steps[0] ? (
                <button type="button" className="step-go" onClick={() => goStep(steps[0])}>
                  Start with {steps[0]} ›
                </button>
              ) : steps[at + 1] ? (
                <button type="button" className="step-go" onClick={() => goStep(steps[at + 1])}>
                  Next: {steps[at + 1]} ›
                </button>
              ) : (
                !wide && (
                  <button type="button" className="step-go" disabled={!ready} onClick={() => setPage('review')}>
                    Review ›
                  </button>
                )
              )}
            </div>
          )}
        </div>
        {wide ? (
          <div className="style-side">
            <div className="row between">
              <p className="eyebrow">{name}</p>
              {undo && <UndoTools undo={undo} />}
            </div>
            {summary}
          </div>
        ) : (
          <div className="style-bar">
            <p className="style-bar-meta">
              <strong>{name.charAt(0).toUpperCase() + name.slice(1)}</strong>
              {metres !== undefined && (
                <span className="muted">
                  {metres} m of {width} cm fabric
                </span>
              )}
            </p>
            {undo && <UndoTools undo={undo} />}
            <button type="button" className="primary" disabled={!ready} onClick={() => setPage('review')}>
              Review
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

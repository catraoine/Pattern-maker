import { Children, createContext, ReactNode, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Mode } from '../mode';
import { canGoBack, goBack, usePageHistory } from '../nav';
import { CollectionEntry, GarmentSwitch } from './GarmentSwitch';
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
  Leg: SHAPE,
  'Your knit’s stretch': SHAPE,
  Neckline: NECK,
  Neck: NECK,
  Collar: NECK,
  Sleeves: NECK,
  'Sleeve shape': NECK,
  'Shoulder pads': NECK,
  Length: LENGTH,
  Hem: LENGTH,
  Peplum: LENGTH,
  'Below the hip': LENGTH,
  Waist: DETAILS,
  Pockets: DETAILS,
  Details: DETAILS,
  Opening: DETAILS,
  Front: DETAILS,
  'Back vent': DETAILS,
};
/** A garment's own grouping on top of the usual one, such as the dress's skirt choices on one Skirt tab. */
const Sections = createContext<Record<string, string>>({});

/**
 * A group of choices, shown on its section's tab with the others there, or on `tab` (the Pro tab). Alone on a
 * tab of its own, the legend repeats the tab's name, so it is only read out, not shown.
 */
export function Group({ label, tab, children, className }: { label: string; tab?: string; children: ReactNode; className?: string }) {
  const active = useContext(ActiveTab);
  const own = useContext(Sections);
  const section = own[label] ?? SECTIONS[label];
  const t = tab ?? section ?? label;
  return (
    <fieldset className={['group', tab || section ? '' : 'solo', className].filter(Boolean).join(' ')} data-tab={t} hidden={active !== t}>
      <legend>{label}</legend>
      {children}
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
function useWide() {
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
    if (!active || !next.includes(active)) setActive(next[0]);
  });

  // The sketch pins under the app's header, whatever height the header is.
  useLayoutEffect(() => {
    const bar = document.querySelector<HTMLElement>('.topbar');
    root.current?.style.setProperty('--pin-top', `${bar?.offsetHeight ?? 0}px`);
  });

  // A preview too tall to leave room for the choices (the turning form with its notes) scrolls with the page instead.
  const pin = useRef<HTMLDivElement>(null);
  const [tall, setTall] = useState(false);
  useEffect(() => {
    const el = pin.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const check = () => setTall(el.offsetHeight > window.innerHeight * 0.66);
    const watch = new ResizeObserver(check);
    watch.observe(el);
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

  const choose = (t: string) => setActive(t);
  const step = (by: number) => {
    const i = tabs.indexOf(active ?? '');
    const to = tabs[i + by];
    if (to) choose(to);
  };

  if (page === 'review')
    return (
      <div className="style-review">
        <div className="screen-head">
          <Title big="Review" label={label} />
        </div>
        <p className="review-name">{name}</p>
        {/* Both ways to change it, together under the name; the summary's own Edit measurements is for the computer layout. */}
        <p className="review-edits">
          <button type="button" className="link" onClick={() => (canGoBack() ? goBack() : setPage('edit'))}>
            Edit style
          </button>
          {onEditMeasurements && (
            <button type="button" className="link" onClick={onEditMeasurements}>
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
        <Title id="opts" big="Style" label={label} />
        <GarmentSwitch onChoose={onChooseGarment} />
      </div>
      <div className="style-edit">
        <div className={tall ? 'style-pin tall' : 'style-pin'} ref={pin}>
          {preview}
          <div className="style-tabs" role="tablist" aria-label="Style choices">
            {tabs.map((t) => (
              <button
                key={t}
                id={`tab-${t}`}
                type="button"
                role="tab"
                aria-selected={active === t}
                className={[active === t ? 'on' : '', t === PRO ? 'pro' : ''].filter(Boolean).join(' ')}
                onClick={() => choose(t)}
              >
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
              <strong>{name}</strong>
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

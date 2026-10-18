import { Children, createContext, ReactNode, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Mode } from '../mode';
import { canGoBack, goBack, usePageHistory } from '../nav';
import { CollectionEntry, GarmentSwitch } from './GarmentSwitch';
import { ModeLink } from './ModeLink';
import { PhotoEntry } from './PhotoEntry';
import { Title } from './Title';

// Every style screen, laid out as Cat's B Pinned Sketch with a Looks tab (2026-10-18): the sketch stays
// pinned at the top, a row of tabs sits under it, and only one tab's choices show at a time, so choosing
// never means scrolling away from the drawing. The summary is its own Review page before Print, and the
// pro tools live together in one Pro tab, so switching them on shows that one tab appear.

/** The tab showing now. Groups and panels outside it are hidden, not removed, so the tab row can list them. */
const ActiveTab = createContext<string | undefined>(undefined);

/** Ways in that come before any choice: always the first tab. */
export const LOOKS = 'Looks';
/** The fabric to see the sketch in. */
export const FABRIC = 'Fabric';
/** The tools the simple view tucks away: always the last tab. */
export const PRO = 'Pro';

const rank = (t: string) => (t === LOOKS ? 0 : t === PRO ? 3 : t === FABRIC ? 2 : 1);

/**
 * A group of choices, shown on its own tab named after it, or on `tab` with others (the Pro tab). On its own
 * tab the legend repeats the tab's name, so it is only read out, not shown.
 */
export function Group({ label, tab, children, className }: { label: string; tab?: string; children: ReactNode; className?: string }) {
  const active = useContext(ActiveTab);
  const t = tab ?? label;
  return (
    <fieldset className={['group', tab ? '' : 'solo', className].filter(Boolean).join(' ')} data-tab={t} hidden={active !== t}>
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
}

export function StyleLayout({ children, label, name, metres, width = 140, ready, onChooseGarment, onPhoto, photo, looks, mode, onMode }: Props) {
  const [options, preview, summary] = Children.toArray(children);
  const [page, setPage] = usePageHistory<'edit' | 'review'>(() => 'edit');
  const [active, setActive] = useState<string>();
  const [tabs, setTabs] = useState<string[]>([]);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ x: number; y: number; sideways: boolean }>();

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

  // Bring the open tab into the row's view, without scrolling the page.
  useEffect(() => {
    const tab = active && document.getElementById(`tab-${active}`);
    const row = tab && tab.parentElement;
    if (tab && row) row.scrollTo({ left: tab.offsetLeft - row.offsetLeft - row.clientWidth / 2 + tab.offsetWidth / 2, behavior: 'smooth' });
  }, [active, tabs]);

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
          <button type="button" className="link quiet" onClick={() => (canGoBack() ? goBack() : setPage('edit'))}>
            Edit style
          </button>
        </div>
        <p className="review-name">{name}</p>
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
        <div className="style-pin">
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
              <ModeLink mode={mode} onMode={onMode} />
            )}
          </ActiveTab.Provider>
        </div>
        <div className="style-bar">
          <p className="style-bar-meta">
            <strong>{name}</strong>
            {metres !== undefined && (
              <span className="muted">
                {metres} m of {width} cm fabric
              </span>
            )}
          </p>
          <button type="button" className="primary" disabled={!ready} onClick={() => setPage('review')}>
            Review
          </button>
        </div>
      </div>
    </div>
  );
}

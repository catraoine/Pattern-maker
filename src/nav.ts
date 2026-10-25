import { useEffect, useRef, useState } from 'react';

// Every screen, and every page inside the guided measuring, is an entry in the browser's history, so the
// phone's back gesture, the browser's back button and the header's ← all step back the same way and
// never leave the app mid-journey (Cat's navigation pick A Steady Header, 2026-10-17).
//
// The history is kept as a fixed ladder (Cat's B Fixed Ladder, 2026-10-24): whatever way a screen was reached,
// the entries behind it are the screens it hangs off, Welcome, Measurements, Style, Print, so back always goes
// one rung up and never ping-pongs between two screens. Going to a screen already on the ladder behind steps
// back to it; going to one on another branch steps back to where the two meet, then on.

interface NavState {
  view: string;
  /** A page inside a screen, such as one measurement in the guided measuring. */
  sub?: unknown;
  /** How many in-app entries sit behind this one; 0 means back would leave the app. */
  depth: number;
  /** The screens from the first entry down to this one, one per rung. */
  trail?: string[];
  /** The depth of each rung's first entry, a screen's own pages sitting above it. */
  bases?: number[];
  /** Which opening of the app made this entry: a reload leaves the old entries behind in the browser. */
  visit?: string;
}

const VISIT = Math.random().toString(36).slice(2);

const current = (): NavState | null => (window.history.state && typeof window.history.state.view === 'string' ? window.history.state : null);

const toTop = () => window.scrollTo(0, 0);

/** Back or forward events the ladder made itself, while rearranging history: the screens leave them alone. */
const ours = new WeakSet<Event>();
/** Whether a back or forward event is the ladder's own, rather than the sewist's. */
export const isLadderStep = (e: Event) => ours.has(e);

/** What to do once the browser has stepped back to where two branches meet. */
let pending: { replace?: NavState; push: NavState[]; then: () => void } | null = null;

if (typeof window !== 'undefined')
  window.addEventListener('popstate', (e) => {
    if (pending) {
      ours.add(e);
      const { replace, push, then } = pending;
      pending = null;
      if (replace) window.history.replaceState(replace, '');
      for (const s of push) window.history.pushState(s, '');
      toTop();
      then();
      return;
    }
    // An entry from before a reload: skip past that whole visit, so back from the welcome leaves the app.
    const s = e.state as NavState | null;
    if (s && typeof s.view === 'string' && s.visit !== VISIT) {
      ours.add(e);
      window.history.go(-(s.depth + 1));
    }
  });

/** The entries a ladder makes, from `from` (kept) on. */
function entries(chain: string[], keep: number, base: NavState | null): NavState[] {
  const out: NavState[] = [];
  let depth = base ? base.depth : -1;
  let trail = base ? (base.trail ?? [base.view]).slice(0, keep) : [];
  let bases = base ? (base.bases ?? [base.depth]).slice(0, keep) : [];
  for (const view of chain.slice(keep)) {
    depth += 1;
    trail = [...trail, view];
    bases = [...bases, depth];
    out.push({ view, depth, trail, bases, visit: VISIT });
  }
  return out;
}

/** Whether there's an in-app screen to go back to. */
export const canGoBack = () => (current()?.depth ?? 0) > 0;

export const goBack = () => window.history.back();

/** Swap the current entry for another screen, for redirects that shouldn't leave a step behind. */
export function replaceView(view: string) {
  const now = current();
  const trail = [...(now?.trail ?? []).slice(0, -1), view];
  window.history.replaceState({ view, depth: now?.depth ?? 0, trail, bases: now?.bases ?? [0], visit: VISIT } satisfies NavState, '');
}

/**
 * The app's screen, kept in step with history. `onPop` sees where back or forward landed and may redirect.
 * `ladder` names the screens a screen hangs off, given the rungs of the one showing now.
 */
export function useViewHistory<V extends string>(start: V, onPop: (view: V) => V, ladder: (to: V, trail: V[]) => V[]) {
  const [view, setView] = useState<V>(() => {
    // Before any screen reads it: this opening's first entry.
    window.history.replaceState({ view: start, depth: 0, trail: [start], bases: [0], visit: VISIT } satisfies NavState, '');
    return start;
  });
  const pop = useRef(onPop);
  pop.current = onPop;
  useEffect(() => {
    const on = (e: PopStateEvent) => {
      if (ours.has(e)) return;
      const landed = (e.state as NavState | null)?.view as V | undefined;
      const to = pop.current(landed ?? start);
      if (to !== landed) replaceView(to);
      // The browser puts the scroll back where it was on that screen.
      setView(to);
    };
    window.addEventListener('popstate', on);
    return () => window.removeEventListener('popstate', on);
  }, [start]);
  const go = (to: V) => {
    const now = current();
    const trail = (now?.trail ?? (now ? [now.view] : [])) as V[];
    const bases = now?.bases ?? (now ? [now.depth] : []);
    const chain = ladder(to, trail);
    let keep = 0;
    while (keep < chain.length && keep < trail.length && chain[keep] === trail[keep]) keep++;
    // Already there, on the screen's first page: nothing to do.
    if (now && keep === chain.length && keep === trail.length && now.depth === bases[keep - 1]) {
      setView(to);
      return;
    }
    // Stepping back to where the ladders meet (the first entry, rewritten, when they share nothing), then on.
    const meet = keep > 0 ? bases[keep - 1] : 0;
    const steps = (now?.depth ?? 0) - meet;
    if (keep === 0) {
      const replace = entries(chain, 0, null)[0];
      const push = entries(chain, 1, replace);
      if (steps > 0) {
        pending = { replace, push, then: () => setView(to) };
        window.history.go(-steps);
        return;
      }
      window.history.replaceState(replace, '');
      for (const s of push) window.history.pushState(s, '');
      toTop();
      setView(to);
      return;
    }
    const meeting: NavState = { view: chain[keep - 1], depth: meet, trail: trail.slice(0, keep), bases: bases.slice(0, keep), visit: VISIT };
    const push = entries(chain, keep, meeting);
    if (steps > 0) {
      // The screen changes once the browser has stepped back, so it opens on its own entry.
      pending = { push, then: () => setView(to) };
      window.history.go(-steps);
      return;
    }
    for (const s of push) window.history.pushState(s, '');
    toTop();
    setView(to);
  };
  return [view, go] as const;
}

/**
 * Pages inside one screen, each its own history entry, so back steps through them one at a time.
 * `isPage` tells this screen's pages from other entries on the same screen, such as an open drawing.
 */
export function usePageHistory<P>(initial: () => P, isPage: (sub: unknown) => boolean = () => true) {
  const [page, setPage] = useState<P>(() => {
    const sub = current()?.sub;
    return sub !== undefined && isPage(sub) ? (sub as P) : initial();
  });
  useEffect(() => {
    // Mark where this screen opened, so coming back to it lands on the same page.
    const now = current();
    if (now && now.sub === undefined) window.history.replaceState({ ...now, sub: page } satisfies NavState, '');
    const on = (e: PopStateEvent) => {
      if (ours.has(e)) return;
      const s = e.state as NavState | null;
      if (s?.sub !== undefined && isPage(s.sub)) setPage(s.sub as P);
    };
    window.addEventListener('popstate', on);
    return () => window.removeEventListener('popstate', on);
    // Only on opening: later pages are pushed by `go`.
  }, []);
  const go = (p: P) => {
    const now = current();
    window.history.pushState({ ...(now ?? { view: '' }), sub: p, depth: (now?.depth ?? 0) + 1, visit: VISIT } satisfies NavState, '');
    setPage(p);
    toTop();
  };
  return [page, go] as const;
}

/** An overlay (a drawing to draw on, a picture full size) as its own entry, so back closes it first. */
export function pushOverlay(sub: string) {
  const now = current();
  if (now?.sub === sub) return;
  window.history.pushState({ ...(now ?? { view: '' }), sub, depth: (now?.depth ?? 0) + 1, visit: VISIT } satisfies NavState, '');
}

/** Start a screen's pages over on a new entry, such as the guided measuring opened again from one of its own pages. */
export function pushFresh() {
  const now = current();
  if (!now) return;
  const { sub: _, ...rest } = now;
  window.history.pushState({ ...rest, depth: now.depth + 1, visit: VISIT } satisfies NavState, '');
}

/** Whether the entry showing is this overlay's. */
export const onOverlay = (sub: string) => current()?.sub === sub;

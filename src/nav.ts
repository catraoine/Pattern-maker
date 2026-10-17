import { useEffect, useRef, useState } from 'react';

// Every screen, and every page inside the guided measuring, is an entry in the browser's history, so the
// phone's back gesture, the browser's back button and the header's ← all step back the same way and
// never leave the app mid-journey (Cat's navigation pick A Steady Header, 2026-10-17).

interface NavState {
  view: string;
  /** A page inside a screen, such as one measurement in the guided measuring. */
  sub?: unknown;
  /** How many in-app entries sit behind this one; 0 means back would leave the app. */
  depth: number;
}

const current = (): NavState | null => (window.history.state && typeof window.history.state.view === 'string' ? window.history.state : null);

const toTop = () => window.scrollTo(0, 0);

/** Go to a screen as a new history entry. Going to the screen already showing does nothing. */
export function pushView(view: string) {
  const now = current();
  if (now?.view === view && now.sub === undefined) return;
  window.history.pushState({ view, depth: (now?.depth ?? 0) + 1 } satisfies NavState, '');
  toTop();
}

/** Swap the current entry for another screen, for redirects that shouldn't leave a step behind. */
export function replaceView(view: string) {
  window.history.replaceState({ view, depth: current()?.depth ?? 0 } satisfies NavState, '');
}

/** Whether there's an in-app screen to go back to. */
export const canGoBack = () => (current()?.depth ?? 0) > 0;

export const goBack = () => window.history.back();

/** The app's screen, kept in step with history. `onPop` sees where back or forward landed and may redirect. */
export function useViewHistory<V extends string>(start: V, onPop: (view: V) => V) {
  const [view, setView] = useState<V>(start);
  const pop = useRef(onPop);
  pop.current = onPop;
  useEffect(() => {
    window.history.replaceState({ view: start, depth: 0 } satisfies NavState, '');
    const on = (e: PopStateEvent) => {
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
    pushView(to);
    setView(to);
  };
  return [view, go] as const;
}

/** Pages inside one screen, each its own history entry, so back steps through them one at a time. */
export function usePageHistory<P>(initial: () => P) {
  const [page, setPage] = useState<P>(() => (current()?.sub as P | undefined) ?? initial());
  useEffect(() => {
    // Mark where this screen opened, so coming back to it lands on the same page.
    const now = current();
    if (now && now.sub === undefined) window.history.replaceState({ ...now, sub: page } satisfies NavState, '');
    const on = (e: PopStateEvent) => {
      const s = e.state as NavState | null;
      if (s?.sub !== undefined) setPage(s.sub as P);
    };
    window.addEventListener('popstate', on);
    return () => window.removeEventListener('popstate', on);
    // Only on opening: later pages are pushed by `go`.
  }, []);
  const go = (p: P) => {
    const now = current();
    window.history.pushState({ view: now?.view ?? '', sub: p, depth: (now?.depth ?? 0) + 1 } satisfies NavState, '');
    setPage(p);
    toTop();
  };
  return [page, go] as const;
}

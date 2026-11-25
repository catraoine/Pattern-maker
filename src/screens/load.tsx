// Every screen past the welcome loads when first opened, so a visitor who only sees the welcome or the waitlist
// downloads the welcome alone. Once someone is past the waitlist, the rest load quietly in the background, so a
// screen they open has usually arrived and shows at once, with no blank beat while its file comes in.
import { ComponentType, lazy, useState } from 'react';

const KEY = 'pattern-maker-reloaded';

let reloading = false;

/** True once this page has started reloading for a new release: what's on screen is about to go, so no error shows. */
export const reloadPending = () => reloading;

/**
 * A release went out while the app was open, so a file this page asks for is gone: reload once to fetch the new
 * release (progress is saved as you go, and a reload keeps your place). Returns false when the page already reloaded
 * for this in the last minute, so a file that is really missing shows its error instead of reloading forever. Before
 * Nov 11 this was once per tab, so a tab left open across two releases hung on "Making your PDF…" (Anna, Nov 10).
 */
export function reloadForNewRelease(): boolean {
  if (reloading) return true;
  try {
    const last = Number(sessionStorage.getItem(KEY));
    if (last && Date.now() - last < 60_000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return false;
  }
  reloading = true;
  window.location.reload();
  return true;
}

/**
 * A file one part of a screen loads for itself (the label sheet, the 3D view). When a release went out while the page
 * was open, main.tsx starts the reload and the file comes back empty: this then waits for the reload, rather than
 * failing on the empty file (a tester's Print screen reported that as a crash, Nov 23). An empty file with no reload
 * under way is still an error.
 */
export function partFile<M>(load: Promise<M>): Promise<M> {
  return load.then((m) => {
    if (m) return m;
    if (reloading) return new Promise<never>(() => {});
    throw new Error('A file the page needs came back empty');
  });
}

function fresh<M>(load: Promise<M>): Promise<M> {
  return load.catch((e) => {
    if (!reloadForNewRelease()) throw e;
    return new Promise<never>(() => {});
  });
}

const preloads: (() => void)[] = [];

/** A screen loaded from its own file: shown at once when its file has already arrived, else when it does. */
export function screen<P extends object>(load: () => Promise<ComponentType<P>>): ComponentType<P> {
  let loaded: ComponentType<P> | undefined;
  let pending: Promise<ComponentType<P>> | undefined;
  const get = () => (pending ??= fresh(load()).then((c) => (loaded = c)));
  // A background load that fails is forgotten, so opening the screen later tries again (and reloads if need be).
  preloads.push(() => {
    if (!pending) load().then((c) => (loaded ??= c), () => {});
  });
  // Typed as the screen itself: React's lazy wrapper adds ref typing these function screens don't use.
  const Lazy = lazy(() => get().then((c) => ({ default: c }))) as unknown as ComponentType<P>;
  function Screen(props: P) {
    // Fixed for the screen's life, so it never swaps from the loading form to the loaded one and loses its state.
    const [Ready] = useState(() => loaded);
    return Ready ? <Ready {...props} /> : <Lazy {...props} />;
  }
  return Screen;
}

/** Fetch every screen's file in the background, once the browser is idle. */
export function preloadScreens() {
  const go = () => preloads.forEach((p) => p());
  if ('requestIdleCallback' in window) window.requestIdleCallback(go, { timeout: 1000 });
  else setTimeout(go, 1000);
}

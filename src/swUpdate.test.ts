import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('virtual:pwa-register', () => ({ registerSW: () => undefined }));

// A page with a service worker, on screen or not, and a count of reloads and checks for a new release.
function page() {
  const sw = new EventTarget() as EventTarget & { controller: object | null; getRegistration: () => Promise<{ update: () => Promise<void> }> };
  const doc = new EventTarget() as EventTarget & { visibilityState: string };
  doc.visibilityState = 'visible';
  const counts = { reloads: 0, checks: 0 };
  sw.controller = {};
  sw.getRegistration = () => Promise.resolve({ update: () => (counts.checks++, Promise.resolve()) });
  vi.stubGlobal('navigator', { serviceWorker: sw });
  vi.stubGlobal('document', doc);
  vi.stubGlobal('window', { location: { reload: () => counts.reloads++ } });
  return { sw, doc, counts };
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe('an app left open on screen picks up a new release', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllGlobals());

  it('checks on a new screen, and shows a release that came while on screen at the next one a reload reopens', async () => {
    vi.useFakeTimers();
    try {
      const { sw, counts } = page();
      const { keepUpToDate, atNewScreen } = await import('./swUpdate');
      keepUpToDate();
      // Opening the page has just asked; a few minutes on, a new screen asks again.
      atNewScreen(true);
      await vi.advanceTimersByTimeAsync(0);
      expect(counts.checks).toBe(0);
      await vi.advanceTimersByTimeAsync(6 * 60 * 1000);
      atNewScreen(true);
      await vi.advanceTimersByTimeAsync(0);
      expect(counts.checks).toBe(1);
      // A release takes over while the maker is working on this screen: nothing redraws under them.
      sw.dispatchEvent(new Event('controllerchange'));
      expect(counts.reloads).toBe(0);
      // A screen a reload can't reopen (an imported file, Help) keeps it waiting.
      atNewScreen(false);
      expect(counts.reloads).toBe(0);
      atNewScreen(true);
      expect(counts.reloads).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('asks at most once every few minutes on screen changes', async () => {
    vi.useFakeTimers();
    try {
      const { counts } = page();
      const { keepUpToDate, atNewScreen } = await import('./swUpdate');
      keepUpToDate();
      await vi.advanceTimersByTimeAsync(6 * 60 * 1000);
      for (let i = 0; i < 5; i++) atNewScreen(true);
      await vi.advanceTimersByTimeAsync(0);
      expect(counts.checks).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a release that came while the app was away reloads it at once, and coming back checks', async () => {
    const { sw, doc, counts } = page();
    const { keepUpToDate } = await import('./swUpdate');
    keepUpToDate();
    doc.dispatchEvent(new Event('visibilitychange'));
    await settle();
    expect(counts.checks).toBe(1);
    doc.visibilityState = 'hidden';
    sw.dispatchEvent(new Event('controllerchange'));
    expect(counts.reloads).toBe(1);
  });

  it('asks every half hour while left open', async () => {
    vi.useFakeTimers();
    try {
      const { counts } = page();
      const { keepUpToDate } = await import('./swUpdate');
      keepUpToDate();
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
      expect(counts.checks).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

// A Firefox private tab has no service worker, so only the site can say a release went out. On Nov 26 one such page,
// open since Nov 13, crashed on the steps screen with a fault the app had lost on Nov 14.
describe('an app with no service worker picks up a new release from the site', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllGlobals());

  function bare(live: string, controlled = false) {
    const doc = new EventTarget() as EventTarget & { visibilityState: string; querySelectorAll: () => { getAttribute: () => string }[] };
    doc.visibilityState = 'visible';
    doc.querySelectorAll = () => [{ getAttribute: () => '/assets/index-OLD123.js' }];
    const counts = { reloads: 0, fetches: 0 };
    const store = new Map<string, string>();
    vi.stubGlobal('navigator', controlled ? { serviceWorker: Object.assign(new EventTarget(), { controller: {}, getRegistration: () => Promise.resolve(undefined) }) } : {});
    vi.stubGlobal('document', doc);
    vi.stubGlobal('window', { location: { reload: () => counts.reloads++ } });
    vi.stubGlobal('sessionStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) });
    vi.stubGlobal('fetch', () => (counts.fetches++, Promise.resolve({ ok: true, text: () => Promise.resolve(`<script type="module" src="${live}"></script>`) })));
    return { doc, counts, store };
  }

  it('shows a newer release at the next screen a reload reopens', async () => {
    vi.useFakeTimers();
    try {
      const { counts } = bare('/assets/index-NEW456.js');
      const { keepUpToDate, atNewScreen } = await import('./swUpdate');
      keepUpToDate();
      await vi.advanceTimersByTimeAsync(6 * 60 * 1000);
      atNewScreen(true);
      await vi.advanceTimersByTimeAsync(0);
      expect(counts.fetches).toBe(1);
      expect(counts.reloads).toBe(0);
      atNewScreen(false);
      expect(counts.reloads).toBe(0);
      atNewScreen(true);
      expect(counts.reloads).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('stays put when the site has the same release', async () => {
    vi.useFakeTimers();
    try {
      const { counts } = bare('/assets/index-OLD123.js');
      const { keepUpToDate, atNewScreen } = await import('./swUpdate');
      keepUpToDate();
      await vi.advanceTimersByTimeAsync(6 * 60 * 1000);
      atNewScreen(true);
      await vi.advanceTimersByTimeAsync(0);
      atNewScreen(true);
      expect(counts.fetches).toBe(1);
      expect(counts.reloads).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reloads only once for a release, should the reload still open the old page', async () => {
    vi.useFakeTimers();
    try {
      const { counts, store } = bare('/assets/index-NEW456.js');
      store.set('pattern-maker:reloaded-for-release', '/assets/index-NEW456.js');
      const { keepUpToDate, atNewScreen } = await import('./swUpdate');
      keepUpToDate();
      await vi.advanceTimersByTimeAsync(6 * 60 * 1000);
      atNewScreen(true);
      await vi.advanceTimersByTimeAsync(0);
      atNewScreen(true);
      expect(counts.fetches).toBe(1);
      expect(counts.reloads).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('leaves a page its service worker looks after to the worker', async () => {
    vi.useFakeTimers();
    try {
      const { counts } = bare('/assets/index-NEW456.js', true);
      const { keepUpToDate, atNewScreen } = await import('./swUpdate');
      keepUpToDate();
      await vi.advanceTimersByTimeAsync(6 * 60 * 1000);
      atNewScreen(true);
      await vi.advanceTimersByTimeAsync(0);
      expect(counts.fetches).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

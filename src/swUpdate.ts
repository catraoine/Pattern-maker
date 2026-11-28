import { registerSW } from 'virtual:pwa-register';

let registered = false;

/**
 * Saves the app on this device for offline use (about 1.2 MB). Only for people past the waitlist: a stranger who only
 * sees the waitlist page doesn't download the whole app, which keeps a busy sign-up day light on Netlify bandwidth.
 */
export function keepOffline() {
  if (registered || !('serviceWorker' in navigator)) return;
  registered = true;
  registerSW({ immediate: true });
}

/** How often an app left open on screen asks for a new release, and the least time between two asks. */
const OPEN_CHECK = 30 * 60 * 1000;
const CHECK_GAP = 5 * 60 * 1000;

let lastCheck = 0;
/** A new release has taken over while the page was on screen, and waits for the next screen to show it. */
let waiting = false;
let reloading = false;

function reload() {
  if (reloading) return;
  reloading = true;
  window.location.reload();
}

const RELOADED_FOR = 'pattern-maker:reloaded-for-release';

/** The app's own script, as a page's HTML names it: a new release always gives it a new name. */
const APP_SCRIPT = /\/assets\/index-[\w-]+\.js/;

/** The app script this page is running, or undefined where there's none to compare (the dev server). */
function runningScript() {
  for (const s of Array.from(document.querySelectorAll?.('script[src]') ?? [])) {
    const m = APP_SCRIPT.exec(s.getAttribute('src') ?? '');
    if (m) return m[0];
  }
  return undefined;
}

/**
 * True the first time this tab is sent to a given release. Should a reload still open the old page (a cache between
 * the phone and the site), the tab is left as it is rather than reloading at every screen.
 */
function firstReloadFor(live: string) {
  try {
    if (sessionStorage.getItem(RELOADED_FOR) === live) return false;
    sessionStorage.setItem(RELOADED_FOR, live);
    return true;
  } catch {
    // Storage blocked: a reload couldn't remember having tried, so it could go round at every screen. Stay put; the
    // next visit opens the new release anyway.
    return false;
  }
}

/**
 * A page no service worker looks after never hears of a release from one: Firefox keeps service workers out of private
 * tabs, and some phones refuse to save them. Such a page left open kept running the release it opened with, and on
 * Nov 26 one on Firefox for Android crashed on the steps screen with a fault that had been gone from the app since
 * Nov 14. So it asks the site itself which app script is current, past every cache, and a different one waits for
 * the next screen like a release a service worker brought. A page a service worker does look after leaves this to it,
 * since reloading would only open the worker's copy again.
 */
function askSite() {
  const mine = runningScript();
  if (!mine || navigator.serviceWorker?.controller) return;
  fetch(`/?release=${Date.now()}`, { cache: 'no-store' })
    .then((r) => (r.ok ? r.text() : ''))
    .then((html) => {
      const live = APP_SCRIPT.exec(html)?.[0];
      if (!live || live === mine || !firstReloadFor(live)) return;
      if (document.visibilityState === 'visible') waiting = true;
      else reload();
    })
    .catch(() => {
      // Offline or blocked: the next check tries again.
    });
}

function check(now = false) {
  if (waiting) return;
  if (!now && Date.now() - lastCheck < CHECK_GAP) return;
  lastCheck = Date.now();
  askSite();
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker
    .getRegistration()
    .then((r) => r?.update())
    .catch(() => {
      // Offline or blocked: the next check tries again.
    });
}

/**
 * Called on each move to another screen. An app left open on screen used to check for a release only when it was left
 * and come back to, so a tester could sew from a pattern a release had already fixed (Nov 16). Moving on is a natural
 * break: a release that arrived meanwhile is shown now, but only on a screen a reload opens again (`reopens`, see
 * PLACE_KEY); a screen holding something only in memory (an imported file, a link just followed) or one a reload can't
 * reopen keeps it waiting for the next. Otherwise it asks again.
 */
export function atNewScreen(reopens: boolean) {
  if (waiting) {
    if (reopens) reload();
  } else check();
}

// Brings an installed copy up to date. The service worker takes over as soon as a new release has
// downloaded, but the page on screen was loaded from the old one, so it reloads once to show the new
// release (progress is saved as you go, so nothing is lost). A home-screen app on a phone is often
// resumed rather than restarted, so coming back to it also checks for a new release, and one left open
// asks every OPEN_CHECK and on each new screen. A release that arrives while the page is on screen waits
// for the next screen rather than redrawing the one being worked on.
export function keepUpToDate() {
  // Opening the page has just loaded the newest page and asked for the newest service worker.
  lastCheck = Date.now();
  if ('serviceWorker' in navigator) {
    const sw = navigator.serviceWorker;
    let controlled = !!sw.controller;
    sw.addEventListener('controllerchange', () => {
      // The first install takes control of a page that is already new: nothing to reload.
      if (!controlled) {
        controlled = true;
        return;
      }
      if (document.visibilityState === 'visible') waiting = true;
      else reload();
    });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (waiting) reload();
    else check(true);
  });
  setInterval(() => {
    if (document.visibilityState === 'visible') check(true);
  }, OPEN_CHECK);
}

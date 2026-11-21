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

function check(now = false) {
  if (!('serviceWorker' in navigator) || waiting) return;
  if (!now && Date.now() - lastCheck < CHECK_GAP) return;
  lastCheck = Date.now();
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
  if (!('serviceWorker' in navigator)) return;
  const sw = navigator.serviceWorker;
  let controlled = !!sw.controller;
  // Opening the page already asks for the newest service worker.
  lastCheck = Date.now();
  sw.addEventListener('controllerchange', () => {
    // The first install takes control of a page that is already new: nothing to reload.
    if (!controlled) {
      controlled = true;
      return;
    }
    if (document.visibilityState === 'visible') waiting = true;
    else reload();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (waiting) reload();
    else check(true);
  });
  setInterval(() => {
    if (document.visibilityState === 'visible') check(true);
  }, OPEN_CHECK);
}

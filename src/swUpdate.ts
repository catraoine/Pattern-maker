// Brings an installed copy up to date. The service worker takes over as soon as a new release has
// downloaded, but the page on screen was loaded from the old one, so it reloads once to show the new
// release (progress is saved as you go, so nothing is lost). A home-screen app on a phone is often
// resumed rather than restarted, so coming back to it also checks for a new release.
export function keepUpToDate() {
  if (!('serviceWorker' in navigator)) return;
  const sw = navigator.serviceWorker;
  let controlled = !!sw.controller;
  let reloading = false;
  sw.addEventListener('controllerchange', () => {
    // The first install takes control of a page that is already new: nothing to reload.
    if (!controlled) {
      controlled = true;
      return;
    }
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    sw.getRegistration()
      .then((r) => r?.update())
      .catch(() => {
        // Offline or blocked: the next visit checks again.
      });
  });
}

// Lingerie and swimwear are drafted but held back until the sewist fit test passes (Cat, 2026-10-18).
// Until then they show only once the address has had ?lingerie=preview, remembered on this device so the
// home-screen app keeps it; ?lingerie=off hides them again. Turn them on for everyone with VITE_LINGERIE=on.
const KEY = 'pattern-maker:lingerie-preview';

export const LINGERIE_ON = import.meta.env.VITE_LINGERIE === 'on';

export function lingeriePreview(search = typeof location === 'undefined' ? '' : location.search): boolean {
  const asked = new URLSearchParams(search).get('lingerie');
  try {
    if (asked === 'preview') localStorage.setItem(KEY, '1');
    if (asked === 'off') localStorage.removeItem(KEY);
    return asked === 'preview' || (asked !== 'off' && localStorage.getItem(KEY) === '1');
  } catch {
    return asked === 'preview';
  }
}

/** Whether lingerie shows in the list of what to make. Read once, when the app loads, before it tidies the address. */
export const lingerieShown = LINGERIE_ON || lingeriePreview();

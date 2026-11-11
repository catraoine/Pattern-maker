import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { startReports } from './report/report';
import { keepUpToDate } from './swUpdate';
// The typefaces ship with the app, so no visitor's browser has to ask Google for them.
import '@fontsource/chakra-petch/400.css';
import '@fontsource/chakra-petch/500.css';
// Instrument Sans for reading (Cat's pick A, Nov 11): it has no 300, so light text shows at 400.
import '@fontsource/instrument-sans/400.css';
import '@fontsource/instrument-sans/500.css';
import '@fontsource-variable/archivo/wdth.css';
import './styles.css';
import { PLACE_KEY } from './navigation';
import { reloadForNewRelease } from './screens/load';

// Review link: opening the site with ?fresh clears this browser's saved progress, so the app starts
// at the welcome screen like a first visit. The flag is then dropped from the address bar, so a reload
// carries on normally.
const url = new URL(window.location.href);
if (url.searchParams.has('fresh')) {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('pattern-maker:'))
      .forEach((k) => localStorage.removeItem(k));
    sessionStorage.removeItem(PLACE_KEY);
  } catch {
    // Storage blocked: nothing was saved, so the app already starts fresh.
  }
  url.searchParams.delete('fresh');
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
}

// Any other file loaded on the way (the PDF maker, the 3D view, the label sheet) gets the same treatment as a screen: if
// a release went out while the page was open and the file is gone, reload once rather than wait forever.
window.addEventListener('vite:preloadError', (e) => {
  if (reloadForNewRelease()) e.preventDefault();
});

startReports(__APP_VERSION__);
keepUpToDate();

// Dev only: ?crash-test shows the error screen.
function CrashTest(): never {
  throw new Error('Crash test');
}
const crashTest = import.meta.env.DEV && url.searchParams.has('crash-test');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>{crashTest ? <CrashTest /> : <App />}</ErrorBoundary>
  </StrictMode>,
);

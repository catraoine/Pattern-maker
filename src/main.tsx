import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { startReports } from './report/report';
import { keepUpToDate } from './swUpdate';
// The typefaces ship with the app, so no visitor's browser has to ask Google for them.
import '@fontsource/chakra-petch/400.css';
import '@fontsource/chakra-petch/500.css';
import '@fontsource/space-grotesk/300.css';
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource-variable/archivo/wdth.css';
import './styles.css';

// Review link: opening the site with ?fresh clears this browser's saved progress, so the app starts
// at the welcome screen like a first visit. The flag is then dropped from the address bar, so a reload
// carries on normally.
const url = new URL(window.location.href);
if (url.searchParams.has('fresh')) {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('pattern-maker:'))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    // Storage blocked: nothing was saved, so the app already starts fresh.
  }
  url.searchParams.delete('fresh');
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
}

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

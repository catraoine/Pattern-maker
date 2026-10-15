import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// The typefaces ship with the app, so no visitor's browser has to ask Google for them.
import '@fontsource/chakra-petch/400.css';
import '@fontsource/chakra-petch/500.css';
import '@fontsource/space-grotesk/300.css';
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

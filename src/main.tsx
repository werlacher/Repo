import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { DEFAULT_SETTINGS, getState, setState } from './store';
import { loadAutosave, loadAutosaveMeta, loadSettings } from './lib/io';
import './styles.css';

// Restore the last session from this browser's storage.
const saved = loadAutosave();
setState({ settings: { ...DEFAULT_SETTINGS, ...loadSettings() } });
if (saved) {
  setState({ doc: saved, pageId: saved.pages[0].id, fileName: loadAutosaveMeta().fileName, dirty: false });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Center the restored diagram once the canvas has measured itself.
if (saved) requestAnimationFrame(() => requestAnimationFrame(() => {
  if (getState().doc === saved) import('./store').then((m) => m.fitToContent());
}));

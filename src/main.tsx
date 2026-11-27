import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { applyPrefs, setUpdate } from './prefs';
import './styles.css';

applyPrefs();
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh: () => setUpdate(() => updateSW(true)),
});
navigator.storage?.persist?.();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

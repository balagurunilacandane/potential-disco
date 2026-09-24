import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { INITIAL_RENDER_MODE, applyModeClass } from './lib/device.ts';
import { captureErrors } from './lib/diagnostics.ts';
import { connect } from './lib/store.ts';
import './styles.css';

captureErrors();
applyModeClass(INITIAL_RENDER_MODE);
connect();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

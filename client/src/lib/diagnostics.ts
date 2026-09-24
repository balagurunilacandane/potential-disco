// Collects what we need to debug a blank 3D view on a device we can't test on:
// recent errors, GPU details and a readback of what the canvas actually drew.
import { create } from 'zustand';

export interface Diagnostics {
  checked: boolean;
  black: boolean;
  gpu: string;
  webgl: string;
  buffer: string;
  samples: string;
  errors: string[];
  showPanel: boolean;
}

export const useDiagnostics = create<Diagnostics>(() => ({
  checked: false,
  black: false,
  gpu: 'unknown',
  webgl: 'unknown',
  buffer: '',
  samples: '',
  errors: [],
  showPanel: false,
}));

function push(message: string) {
  const text = message.slice(0, 300);
  useDiagnostics.setState((s) => ({ errors: [...s.errors, text].slice(-6) }));
}

/** Start recording errors as early as possible (call before rendering). */
export function captureErrors() {
  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    try {
      push(args.map((a) => (a instanceof Error ? a.message : String(a))).join(' '));
    } catch {
      // Never let diagnostics break logging.
    }
    original(...args);
  };
  window.addEventListener('error', (e) => push(e.message || 'Unknown error'));
  window.addEventListener('unhandledrejection', (e) => push(String(e.reason)));
}

export function describe(d: Diagnostics, mode: string) {
  return [
    `Mode: ${mode}`,
    `WebGL: ${d.webgl}`,
    `GPU: ${d.gpu}`,
    `Canvas: ${d.buffer}`,
    `Pixels: ${d.samples}`,
    `Device: ${navigator.userAgent}`,
    ...d.errors.map((e) => `Error: ${e}`),
  ].join('\n');
}

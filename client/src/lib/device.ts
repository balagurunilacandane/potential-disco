// Device capability check and render-mode selection.
//
// full  — desktop: bloom post-processing, high-res shadows.
// light — phones/tablets: no post-processing (its HDR buffers can exhaust mobile graphics memory),
//         opaque canvas that keeps its drawing buffer, no frosted-glass panels over the canvas.
// safe  — last resort chosen automatically when the 3D view reads back black: no shadows, 1x pixels.
export type RenderMode = 'full' | 'light' | 'safe';

const STORAGE_KEY = 'agent-world:render-mode';

function detectLowPower(): boolean {
  try {
    const ua = navigator.userAgent;
    const touchMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1; // iPadOS reports as a Mac
    const mobile = /iPhone|iPad|iPod|Android|Mobile/i.test(ua) || touchMac;
    const smallScreen = Math.min(screen.width, screen.height) < 700;
    return mobile || smallScreen;
  } catch {
    return false;
  }
}

export const LOW_POWER = detectLowPower();

function initialMode(): RenderMode {
  try {
    const params = new URLSearchParams(location.search);
    const hash = location.hash;
    if (hash === '#hq' || params.get('quality') === 'high') return 'full';
    if (hash === '#lq' || params.get('quality') === 'low') return 'light';
    if (hash === '#safe' || params.get('quality') === 'safe') return 'safe';
  } catch {
    // Fall through to detection.
  }
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved === 'safe') return 'safe';
  } catch {
    // Storage can be blocked; detection still works.
  }
  return LOW_POWER ? 'light' : 'full';
}

export const INITIAL_RENDER_MODE = initialMode();

export function rememberMode(mode: RenderMode) {
  try {
    if (mode === 'safe') sessionStorage.setItem(STORAGE_KEY, mode);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Not critical.
  }
}

/** Frosted-glass panels over a WebGL canvas are a known cause of black canvases on iOS. */
export function applyModeClass(mode: RenderMode) {
  document.documentElement.classList.toggle('plain-panels', mode !== 'full');
}

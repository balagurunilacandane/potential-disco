// Rough device capability check. Phones and tablets get a lighter renderer: no post-processing
// (its full-screen HDR buffers can exhaust mobile graphics memory and blank the canvas), a lower
// pixel ratio and smaller shadow maps.
function detectLowPower(): boolean {
  try {
    const params = new URLSearchParams(location.search);
    if (location.hash === '#hq' || params.get('quality') === 'high') return false;
    if (location.hash === '#lq' || params.get('quality') === 'low') return true;
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

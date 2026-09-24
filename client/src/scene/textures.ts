// Canvas-drawn textures (no font or image downloads needed).
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';

const cache = new Map<string, Texture>();

function canvasTexture(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d')!);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  cache.set(key, tex);
  return tex;
}

const FONT = '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif';

export function floorTexture(dark = false) {
  const tex = canvasTexture(`floor-${dark}`, 128, 128, (ctx) => {
    ctx.fillStyle = dark ? '#252b36' : '#f6f4f0';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = dark ? 'rgba(90,200,255,0.35)' : 'rgba(0,0,0,0.07)';
    ctx.lineWidth = dark ? 2 : 3;
    ctx.strokeRect(0, 0, 128, 128);
    if (!dark) {
      ctx.fillStyle = 'rgba(0,0,0,0.018)';
      ctx.fillRect(4, 4, 58, 58);
      ctx.fillRect(66, 66, 58, 58);
    }
  });
  tex.wrapS = tex.wrapT = RepeatWrapping;
  return tex;
}

/** Room sign: team icon in a coloured square followed by the team name. */
export function signTexture(name: string, icon: string, color: string) {
  return canvasTexture(`sign-${name}-${icon}-${color}`, 1024, 256, (ctx) => {
    ctx.fillStyle = '#1b1d22';
    roundRect(ctx, 0, 0, 1024, 256, 36);
    ctx.fill();
    ctx.fillStyle = color;
    roundRect(ctx, 28, 28, 200, 200, 28);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 ${icon.length > 1 ? 88 : 120}px ${FONT}`;
    ctx.fillText(icon, 128, 134);
    ctx.textAlign = 'left';
    ctx.font = `800 118px ${FONT}`;
    fitText(ctx, name.toUpperCase(), 260, 138, 740);
  });
}

/** Whiteboard with the team name, a sketched chart and sticky notes. */
export function whiteboardTexture(name: string, color: string) {
  return canvasTexture(`wb-${name}-${color}`, 512, 240, (ctx) => {
    ctx.fillStyle = '#fbfbf9';
    ctx.fillRect(0, 0, 512, 240);
    ctx.strokeStyle = '#2b2d31';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(40, 200);
    ctx.lineTo(40, 60);
    ctx.moveTo(40, 200);
    ctx.lineTo(300, 200);
    ctx.stroke();
    ctx.fillStyle = color;
    [60, 95, 80, 130, 150].forEach((h, i) => ctx.fillRect(62 + i * 46, 196 - h, 30, h));
    ctx.strokeStyle = '#e5484d';
    ctx.beginPath();
    ctx.moveTo(60, 150);
    ctx.lineTo(130, 120);
    ctx.lineTo(190, 130);
    ctx.lineTo(280, 55);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(262, 52);
    ctx.lineTo(282, 53);
    ctx.lineTo(276, 72);
    ctx.stroke();
    const notes = ['#ffe066', '#9be7c4', '#ffb3c7', '#a5c8ff'];
    notes.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(340 + (i % 2) * 78, 40 + Math.floor(i / 2) * 80, 64, 64);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(350 + (i % 2) * 78, 58 + Math.floor(i / 2) * 80, 40, 5);
      ctx.fillRect(350 + (i % 2) * 78, 72 + Math.floor(i / 2) * 80, 30, 5);
    });
    ctx.fillStyle = '#2b2d31';
    ctx.font = `700 26px ${FONT}`;
    fitText(ctx, name, 40, 34, 280);
  });
}

/** Glowing glyph used on monitor lids and the brain sign. */
export function glyphTexture(icon: string, color: string) {
  return canvasTexture(`glyph-${icon}-${color}`, 128, 128, (ctx) => {
    ctx.fillStyle = '#111317';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 ${icon.length > 1 ? 50 : 76}px ${FONT}`;
    ctx.fillText(icon, 64, 70);
  });
}

/** What the agent sees: code-ish lines and a chart in the team colour. */
export function screenTexture(color: string) {
  return canvasTexture(`screen-${color}`, 128, 80, (ctx) => {
    ctx.fillStyle = '#0f1420';
    ctx.fillRect(0, 0, 128, 80);
    ctx.fillStyle = color;
    for (let i = 0; i < 6; i++) ctx.fillRect(8 + (i % 2) * 8, 8 + i * 11, 30 + ((i * 37) % 50), 5);
    ctx.fillStyle = '#e6edf7';
    [20, 34, 26, 48].forEach((h, i) => ctx.fillRect(84 + i * 9, 72 - h, 6, h));
  });
}

export function brainSignTexture() {
  return canvasTexture('brain-sign', 1024, 200, (ctx) => {
    ctx.fillStyle = '#0d1118';
    roundRect(ctx, 0, 0, 1024, 200, 30);
    ctx.fill();
    ctx.strokeStyle = '#39d0ff';
    ctx.lineWidth = 8;
    roundRect(ctx, 8, 8, 1008, 184, 26);
    ctx.stroke();
    ctx.fillStyle = '#7fe3ff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 104px ${FONT}`;
    ctx.fillText('CENTRAL BRAIN', 512, 106);
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number) {
  const size = parseInt(ctx.font.match(/(\d+)px/)?.[1] ?? '40', 10);
  let s = size;
  while (s > 12 && ctx.measureText(text).width > maxWidth) {
    s -= 4;
    ctx.font = ctx.font.replace(/\d+px/, `${s}px`);
  }
  ctx.fillText(text, x, y);
}

/** Soft vertical sky gradient used as the scene background. */
export function skyTexture() {
  return canvasTexture('sky', 4, 512, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#c9d8ea');
    g.addColorStop(0.55, '#e4ebf3');
    g.addColorStop(1, '#f4efe7');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 512);
  });
}

/** Large pale stone tiles for the building floor between rooms. */
export function plazaTexture() {
  const tex = canvasTexture('plaza', 256, 256, (ctx) => {
    ctx.fillStyle = '#ece8e1';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillRect(6, 6, 244, 3);
    ctx.fillRect(6, 6, 3, 244);
    ctx.strokeStyle = 'rgba(120, 110, 95, 0.14)';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, 253, 253);
  });
  tex.wrapS = tex.wrapT = RepeatWrapping;
  return tex;
}

/** Radial falloff used as a soft shadow under the floating office. */
export function softShadowTexture() {
  return canvasTexture('soft-shadow', 256, 256, (ctx) => {
    const g = ctx.createRadialGradient(128, 128, 30, 128, 128, 128);
    g.addColorStop(0, 'rgba(40, 52, 72, 0.32)');
    g.addColorStop(0.6, 'rgba(40, 52, 72, 0.14)');
    g.addColorStop(1, 'rgba(40, 52, 72, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  });
}

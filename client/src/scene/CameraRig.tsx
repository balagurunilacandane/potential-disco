// Camera director: smooth moves, 90° isometric rotations, view presets, framing around the HUD, and a guided tour.
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Spherical, Vector3, type OrthographicCamera } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { VIEW_ANGLES, moveCamera, select, setTouring, setViewAngle, useWorld } from '../lib/store.ts';
import { damp, dampAngle } from './VoxelPerson.tsx';

export const MIN_ZOOM = 5;
export const MAX_ZOOM = 110;
const QUARTER = Math.PI / 2;
/** Isometric views sit on the diagonals: 45°, 135°, ... */
const DIAGONAL = Math.PI / 4;

/** Screen space covered by HUD panels, so framing centres things in the visible gap. */
export function hudInsets(width: number, inspectorOpen: boolean) {
  if (width <= 760) return { left: 0, right: 0, top: 70, bottom: 150 };
  return { left: 306, right: inspectorOpen ? 392 : 0, top: 92, bottom: 76 };
}

interface Goal {
  x: number;
  z: number;
  zoom: number;
  azimuth: number;
  polar: number;
}

/** Smallest absolute difference between two angles. */
function angleGap(a: number, b: number) {
  const d = Math.abs(b - a) % (Math.PI * 2);
  return d > Math.PI ? Math.PI * 2 - d : d;
}

const offset = new Vector3();
const spherical = new Spherical();

export function CameraRig({ extent, stops }: { extent: number; stops: { x: number; z: number; label: string }[] }) {
  const focus = useWorld((s) => s.focus);
  const touring = useWorld((s) => s.touring);
  const inspectorOpen = useWorld((s) => s.selection !== null);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const camera = useThree((s) => s.camera) as OrthographicCamera;
  const size = useThree((s) => s.size);
  const goal = useRef<Goal | null>(null);
  const tour = useRef({ index: 0, next: 0 });
  const view = useRef({ x: 0, y: 0 });

  const current = (): Goal => {
    const target = controls?.target ?? new Vector3();
    spherical.setFromVector3(offset.copy(camera.position).sub(target));
    return { x: target.x, z: target.z, zoom: camera.zoom, azimuth: spherical.theta, polar: spherical.phi };
  };

  const fitZoom = () => {
    const inset = hudInsets(size.width, false);
    const w = Math.max(200, size.width - inset.left - inset.right);
    const h = Math.max(200, size.height - inset.top - inset.bottom);
    // An isometric view of a square of half-size e spans ~2.9e across and ~1.9e high.
    return Math.max(MIN_ZOOM, Math.min(40, Math.min(w / (extent * 2.9), h / (extent * 1.9))));
  };

  // Turn each request into an absolute camera goal.
  useEffect(() => {
    if (!focus || !controls) return;
    if (useWorld.getState().touring) setTouring(false);
    const base = goal.current ?? current();
    let zoom = base.zoom;
    if (focus.fit) zoom = fitZoom();
    else if (focus.zoom) zoom = focus.zoom;
    else if (focus.zoomScale) zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, base.zoom * focus.zoomScale));
    let azimuth = base.azimuth;
    if (focus.rotate) azimuth = Math.round((base.azimuth - DIAGONAL) / QUARTER) * QUARTER + DIAGONAL + focus.rotate;
    goal.current = {
      x: focus.fit ? 0 : (focus.x ?? base.x),
      z: focus.fit ? 0 : (focus.z ?? base.z),
      zoom,
      azimuth,
      polar: focus.polar ?? base.polar,
    };
  }, [focus, controls]);

  // Any drag, pinch or scroll hands control back to the user.
  useEffect(() => {
    if (!controls) return;
    const takeOver = () => {
      goal.current = null;
      if (useWorld.getState().touring) setTouring(false);
    };
    controls.addEventListener('start', takeOver);
    return () => controls.removeEventListener('start', takeOver);
  }, [controls]);

  useEffect(() => {
    tour.current = { index: 0, next: 0 };
    if (!touring) {
      goal.current = null;
      useWorld.setState({ tourLabel: null });
    }
  }, [touring]);

  // Keyboard shortcuts (ignored while typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select, [contenteditable]') || useWorld.getState().modal) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'q' || k === 'arrowleft') moveCamera({ rotate: -QUARTER });
      else if (k === 'e' || k === 'arrowright') moveCamera({ rotate: QUARTER });
      else if (k === '+' || k === '=') moveCamera({ zoomScale: 1.35 });
      else if (k === '-' || k === '_') moveCamera({ zoomScale: 1 / 1.35 });
      else if (k === 'f' || k === '0') moveCamera({ fit: true });
      else if (k === '1') setViewAngle('classic');
      else if (k === '2') setViewAngle('top');
      else if (k === '3') setViewAngle('low');
      else if (k === 't') setTouring(!useWorld.getState().touring);
      else if (k === 'escape') select(null);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.1);

    // Shift the projection so the focus point sits in the middle of the area the HUD leaves free.
    const inset = hudInsets(size.width, inspectorOpen);
    const vx = damp(view.current.x, (inset.left - inset.right) / 2, 6, dt);
    const vy = damp(view.current.y, (inset.top - inset.bottom) / 2, 6, dt);
    if (Math.abs(vx - view.current.x) > 0.01 || Math.abs(vy - view.current.y) > 0.01 || !camera.view) {
      view.current = { x: vx, y: vy };
      camera.setViewOffset(size.width, size.height, -vx, -vy, size.width, size.height);
    }

    if (!controls) return;

    // Keep the view over the building so nobody gets lost panning into empty sky.
    const limit = extent + 4;
    const t = controls.target;
    const cx = Math.max(-limit, Math.min(limit, t.x));
    const cz = Math.max(-limit, Math.min(limit, t.z));
    if (cx !== t.x || cz !== t.z) {
      camera.position.x += cx - t.x;
      camera.position.z += cz - t.z;
      t.x = cx;
      t.z = cz;
    }

    if (touring && stops.length) {
      const t = state.clock.elapsedTime;
      if (t >= tour.current.next) {
        const stop = stops[tour.current.index % stops.length];
        const base = goal.current ?? current();
        goal.current = { x: stop.x, z: stop.z, zoom: tour.current.index % stops.length === 0 ? 24 : 32, azimuth: base.azimuth, polar: 0.98 };
        useWorld.setState({ tourLabel: stop.label });
        tour.current = { index: tour.current.index + 1, next: t + 7 };
      }
      if (goal.current) goal.current.azimuth += dt * 0.12;
    }

    const g = goal.current;
    if (!g) return;
    const k = 1 - Math.exp(-dt * 3.5);
    const target = controls.target;
    spherical.setFromVector3(offset.copy(camera.position).sub(target));
    target.x += (g.x - target.x) * k;
    target.z += (g.z - target.z) * k;
    target.y += -target.y * k;
    spherical.theta = dampAngle(spherical.theta, g.azimuth, 3.5, dt);
    spherical.phi = damp(spherical.phi, g.polar, 3.5, dt);
    camera.position.copy(target).add(offset.setFromSpherical(spherical));
    camera.zoom += (g.zoom - camera.zoom) * k;
    camera.updateProjectionMatrix();
    controls.update();

    const settled =
      Math.hypot(g.x - target.x, g.z - target.z) < 0.02 &&
      Math.abs(g.zoom - camera.zoom) < 0.05 &&
      angleGap(spherical.theta, g.azimuth) < 0.002 &&
      Math.abs(g.polar - spherical.phi) < 0.002;
    if (settled && !touring) goal.current = null;
  });

  return null;
}

/** Polar limits the user can orbit within; presets sit inside them. */
export const POLAR_LIMITS = {
  min: VIEW_ANGLES.top.polar - 0.05,
  max: VIEW_ANGLES.low.polar + 0.05,
};

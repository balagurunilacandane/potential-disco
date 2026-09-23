// The whole isometric office: camera, lights, ground, brain, team rooms and data links.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Bloom, EffectComposer, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { MOUSE, TOUCH, type DirectionalLight, type OrthographicCamera } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useShallow } from 'zustand/react/shallow';
import { select, useWorld } from '../lib/store.ts';
import { Brain } from './Brain.tsx';
import { Links, Packets } from './Links.tsx';
import { Room } from './Room.tsx';
import { worldExtent } from './layout.ts';

/** Isometric view direction (equal x/z, slightly steeper than true isometric). */
const VIEW = [1, 1.08, 1] as const;

function CameraRig() {
  const focus = useWorld((s) => s.focus);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const camera = useThree((s) => s.camera) as OrthographicCamera;
  const goal = useRef<{ x: number; z: number; zoom?: number } | null>(null);

  useEffect(() => {
    if (focus) goal.current = { x: focus.x, z: focus.z, zoom: focus.zoom };
  }, [focus]);

  useEffect(() => {
    if (!controls) return;
    const cancel = () => (goal.current = null);
    controls.addEventListener('start', cancel);
    return () => controls.removeEventListener('start', cancel);
  }, [controls]);

  useFrame((_, dt) => {
    const g = goal.current;
    if (!g || !controls) return;
    const k = 1 - Math.exp(-dt * 5);
    const dx = (g.x - controls.target.x) * k;
    const dz = (g.z - controls.target.z) * k;
    const dy = -controls.target.y * k;
    controls.target.x += dx;
    controls.target.y += dy;
    controls.target.z += dz;
    camera.position.x += dx;
    camera.position.y += dy;
    camera.position.z += dz;
    let zoomDone = true;
    if (g.zoom) {
      camera.zoom += (g.zoom - camera.zoom) * k;
      camera.updateProjectionMatrix();
      zoomDone = Math.abs(g.zoom - camera.zoom) < 0.05;
    }
    controls.update();
    if (Math.abs(dx) + Math.abs(dz) < 0.002 && zoomDone) goal.current = null;
  });
  return null;
}

/** Fits the camera to the office once the first snapshot arrives. */
function InitialFit({ extent }: { extent: number }) {
  const loaded = useWorld((s) => s.loaded);
  const size = useThree((s) => s.size);
  const done = useRef(false);
  useEffect(() => {
    if (!loaded || done.current) return;
    done.current = true;
    // An isometric view of a square of half-size e spans ~2.9e horizontally.
    const zoom = Math.min(size.width / (extent * 2.9), size.height / (extent * 1.9));
    select(null, { x: 0, z: 0, zoom: Math.max(6, Math.min(40, zoom * 1.1)) });
  }, [loaded, extent, size]);
  return null;
}

function Sun({ extent }: { extent: number }) {
  const light = useRef<DirectionalLight>(null!);
  useLayoutEffect(() => {
    const cam = light.current.shadow.camera;
    const e = extent + 6;
    cam.left = -e;
    cam.right = e;
    cam.top = e;
    cam.bottom = -e;
    cam.near = 1;
    cam.far = 300;
    cam.updateProjectionMatrix();
    const res = Math.min(4096, Math.max(2048, Math.round(e * 40)));
    if (light.current.shadow.mapSize.x !== res) {
      light.current.shadow.mapSize.set(res, res);
      light.current.shadow.map?.dispose();
      light.current.shadow.map = null;
    }
  }, [extent]);
  return (
    <directionalLight
      ref={light}
      position={[45, 90, 30]}
      intensity={2.3}
      color="#fff6ea"
      castShadow
      shadow-bias={-0.0004}
      shadow-normalBias={0.03}
    />
  );
}

function World() {
  const teams = useWorld(useShallow((s) => Object.values(s.teams).sort((a, b) => a.slot - b.slot)));
  const extent = useMemo(() => Math.max(worldExtent(teams.map((t) => t.slot)), 22), [teams]);

  return (
    <>
      <color attach="background" args={['#e6eaf0']} />
      <hemisphereLight args={['#ffffff', '#aeb8c6', 1.35]} />
      <Sun extent={extent} />
      <mesh rotation-x={-Math.PI / 2} position-y={-0.01} receiveShadow onClick={(e) => e.delta < 5 && select(null)}>
        <planeGeometry args={[1200, 1200]} />
        <meshStandardMaterial color="#dfe4ea" roughness={1} />
      </mesh>
      <Brain />
      {teams.map((t) => (
        <Room key={t.id} team={t} />
      ))}
      <Links teams={teams} />
      <Packets />
      <CameraRig />
      <InitialFit extent={extent} />
    </>
  );
}

export function Office() {
  return (
    <Canvas
      shadows
      orthographic
      dpr={[1, 2]}
      camera={{ position: [VIEW[0] * 90, VIEW[1] * 90, VIEW[2] * 90], zoom: 14, near: 0.1, far: 1000 }}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      onPointerMissed={(e) => e.type === 'click' && select(null)}
    >
      <World />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.1}
        minZoom={5}
        maxZoom={110}
        minPolarAngle={0.35}
        maxPolarAngle={1.15}
        zoomToCursor
        screenSpacePanning={false}
        mouseButtons={{ LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE }}
        touches={{ ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_ROTATE }}
      />
      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur luminanceThreshold={1.05} luminanceSmoothing={0.2} intensity={0.9} />
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      </EffectComposer>
    </Canvas>
  );
}

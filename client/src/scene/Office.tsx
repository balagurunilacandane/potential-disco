// The whole isometric office: camera, lights, building, brain, team rooms and data links.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Bloom, EffectComposer, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { MOUSE, TOUCH, type DirectionalLight } from 'three';
import { useShallow } from 'zustand/react/shallow';
import { VIEW_ANGLES, moveCamera, select, useWorld } from '../lib/store.ts';
import { Brain } from './Brain.tsx';
import { CameraRig, MAX_ZOOM, MIN_ZOOM, POLAR_LIMITS } from './CameraRig.tsx';
import { Grounds } from './Grounds.tsx';
import { Links, Packets } from './Links.tsx';
import { Room } from './Room.tsx';
import { slotPosition, worldExtent } from './layout.ts';
import { skyTexture } from './textures.ts';

/** Isometric view direction (equal x/z, slightly steeper than true isometric). */
const VIEW = [1, 1.08, 1] as const;

/** Frames the whole office once the first snapshot arrives. */
function InitialFit() {
  const loaded = useWorld((s) => s.loaded);
  const done = useRef(false);
  useEffect(() => {
    if (!loaded || done.current) return;
    done.current = true;
    moveCamera({ fit: true, polar: VIEW_ANGLES.classic.polar });
  }, [loaded]);
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
  const stops = useMemo(
    () => [
      { x: 0, z: 0, label: 'Central Brain' },
      ...teams.map((t) => {
        const [x, z] = slotPosition(t.slot);
        return { x, z, label: t.name };
      }),
    ],
    [teams],
  );
  const sky = useMemo(() => skyTexture(), []);

  return (
    <>
      <primitive attach="background" object={sky} />
      <hemisphereLight args={['#ffffff', '#b3bdcc', 1.35]} />
      <Sun extent={extent} />
      <Grounds teams={teams} extent={extent} />
      <Brain />
      {teams.map((t) => (
        <Room key={t.id} team={t} />
      ))}
      <Links teams={teams} />
      <Packets />
      <CameraRig extent={extent} stops={stops} />
      <InitialFit />
    </>
  );
}

export function Office() {
  return (
    <Canvas
      shadows
      orthographic
      dpr={[1, 2]}
      camera={{ position: [VIEW[0] * 90, VIEW[1] * 90, VIEW[2] * 90], zoom: 10, near: 0.1, far: 1000 }}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      onPointerMissed={(e) => e.type === 'click' && select(null)}
    >
      <World />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.1}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        minPolarAngle={POLAR_LIMITS.min}
        maxPolarAngle={POLAR_LIMITS.max}
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

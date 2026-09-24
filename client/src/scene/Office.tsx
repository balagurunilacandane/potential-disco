// The whole isometric office: camera, lights, building, brain, team rooms and data links.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Bloom, EffectComposer, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { MOUSE, NeutralToneMapping, TOUCH, type DirectionalLight } from 'three';
import { useShallow } from 'zustand/react/shallow';
import type { RenderMode } from '../lib/device.ts';
import { useDiagnostics } from '../lib/diagnostics.ts';
import { VIEW_ANGLES, moveCamera, select, setRenderMode, toast, useWorld } from '../lib/store.ts';
import { Brain } from './Brain.tsx';
import { CameraRig, MAX_ZOOM, MIN_ZOOM, POLAR_LIMITS } from './CameraRig.tsx';
import { Grounds } from './Grounds.tsx';
import { Links } from './Links.tsx';
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

function Sun({ extent, mode }: { extent: number; mode: RenderMode }) {
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
    const res = mode === 'full' ? Math.min(4096, Math.max(2048, Math.round(e * 40))) : 2048;
    if (light.current.shadow.mapSize.x !== res) {
      light.current.shadow.mapSize.set(res, res);
      light.current.shadow.map?.dispose();
      light.current.shadow.map = null;
    }
  }, [extent, mode]);
  return (
    <directionalLight
      ref={light}
      position={[45, 90, 30]}
      intensity={2.3}
      color="#fff6ea"
      castShadow={mode !== 'safe'}
      shadow-bias={-0.0004}
      shadow-normalBias={0.03}
    />
  );
}

function World({ mode }: { mode: RenderMode }) {
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
      <Sun extent={extent} mode={mode} />
      <Grounds teams={teams} extent={extent} />
      <Brain />
      {teams.map((t) => (
        <Room key={t.id} team={t} />
      ))}
      <Links teams={teams} />
      <CameraRig extent={extent} stops={stops} />
      <InitialFit />
    </>
  );
}

/**
 * Reads a few pixels back once the office has had time to draw. Some mobile GPUs silently
 * render nothing; when every sample is black we fall back to a simpler renderer, and if that is
 * black too we show a diagnostics card instead of an empty screen.
 */
function HealthCheck({ mode }: { mode: RenderMode }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);

  useEffect(() => {
    const ctx = gl.getContext();
    const info = ctx.getExtension('WEBGL_debug_renderer_info');
    useDiagnostics.setState({
      webgl: typeof WebGL2RenderingContext !== 'undefined' && ctx instanceof WebGL2RenderingContext ? 'WebGL 2' : 'WebGL 1',
      gpu: String(info ? ctx.getParameter(info.UNMASKED_RENDERER_WEBGL) : ctx.getParameter(ctx.RENDERER)),
    });

    let frames = 0;
    let done = false;
    const previous = scene.onAfterRender;
    scene.onAfterRender = function (...args) {
      previous.apply(this, args);
      // With post-processing the scene is drawn off-screen first; only sample the real canvas.
      if (done || gl.getRenderTarget() !== null || ++frames < 40) return;
      done = true;
      const w = ctx.drawingBufferWidth;
      const h = ctx.drawingBufferHeight;
      const px = new Uint8Array(4);
      const points = [[0.5, 0.5], [0.15, 0.15], [0.85, 0.15], [0.15, 0.85], [0.85, 0.85], [0.5, 0.25], [0.5, 0.75]];
      const samples = points.map(([u, v]) => {
        ctx.readPixels(Math.floor(u * w), Math.floor(v * h), 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, px);
        return [px[0], px[1], px[2]];
      });
      const black = samples.every(([r, g, b]) => r + g + b < 24);
      useDiagnostics.setState({
        checked: true,
        black,
        buffer: `${w}×${h} @ ${window.devicePixelRatio}x`,
        samples: samples.map((c) => c.join(',')).join(' | '),
      });
      if (black && mode !== 'safe') {
        setRenderMode('safe');
        toast('Switched to simple graphics so the office shows on this device.');
      }
      else if (black) useDiagnostics.setState({ showPanel: true });
    };
    return () => {
      scene.onAfterRender = previous;
    };
  }, [gl, scene, mode]);

  return null;
}

export function Office() {
  const mode = useWorld((s) => s.renderMode);
  const full = mode === 'full';
  return (
    <Canvas
      // Remount with fresh GL settings whenever the render mode changes.
      key={mode}
      shadows={mode !== 'safe'}
      orthographic
      dpr={full ? [1, 2] : mode === 'light' ? [1, 1.5] : 1}
      camera={{ position: [VIEW[0] * 90, VIEW[1] * 90, VIEW[2] * 90], zoom: 10, near: 0.1, far: 1000 }}
      gl={
        full
          ? { antialias: false, powerPreference: 'high-performance' }
          : // An opaque canvas that keeps its drawing buffer avoids blank compositing on iOS.
            { antialias: mode === 'light', alpha: false, preserveDrawingBuffer: true, powerPreference: 'default' }
      }
      onCreated={({ gl }) => {
        // Without post-processing the renderer tone maps directly.
        if (!full) gl.toneMapping = NeutralToneMapping;
        const canvas = gl.domElement;
        canvas.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          useWorld.setState({ graphicsLost: true });
        });
        canvas.addEventListener('webglcontextrestored', () => useWorld.setState({ graphicsLost: false }));
      }}
      onPointerMissed={(e) => e.type === 'click' && select(null)}
    >
      <World mode={mode} />
      <HealthCheck mode={mode} />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.1}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        minPolarAngle={POLAR_LIMITS.min}
        maxPolarAngle={POLAR_LIMITS.max}
        zoomToCursor={full}
        screenSpacePanning={false}
        mouseButtons={{ LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE }}
        touches={{ ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_ROTATE }}
      />
      {full && (
        <EffectComposer multisampling={4}>
          <Bloom mipmapBlur luminanceThreshold={1.05} luminanceSmoothing={0.2} intensity={0.9} />
          <ToneMapping mode={ToneMappingMode.NEUTRAL} />
        </EffectComposer>
      )}
    </Canvas>
  );
}

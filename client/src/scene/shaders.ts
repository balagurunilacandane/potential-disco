// Small custom materials for glowing, flowing light (cables, floor strips, the hologram beam).
import { AdditiveBlending, Color, DoubleSide, ShaderMaterial } from 'three';

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const flowFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uTip;
  uniform float uTime;
  uniform float uLength;
  uniform float uBoost;
  uniform float uAlpha;
  uniform float uAxis;
  uniform float uSpeed;
  varying vec2 vUv;
  void main() {
    float along = mix(vUv.x, vUv.y, uAxis);
    float s = along * uLength;
    float phase = fract((s - uTime * uSpeed) / 2.6);
    float dash = smoothstep(0.0, 0.08, phase) * (1.0 - smoothstep(0.08, 0.5, phase));
    float ends = smoothstep(0.0, 0.03, along) * (1.0 - smoothstep(0.97, 1.0, along));
    vec3 col = mix(uColor, uTip, smoothstep(0.6, 1.0, along));
    float glow = 0.45 + dash * 1.6 + uBoost * 1.8;
    gl_FragColor = vec4(col * glow * 1.8, uAlpha * ends * (0.4 + dash * 0.6 + uBoost * 0.6));
  }
`;

export interface FlowOptions {
  color: string;
  tip?: string;
  length: number;
  alpha: number;
  /** 0 when the length runs along uv.x (tubes), 1 along uv.y (planes). */
  axis?: 0 | 1;
  speed?: number;
}

/** Light pulses streaming along a strip or tube, from uv 0 towards uv 1. */
export function flowMaterial({ color, tip, length, alpha, axis = 0, speed = 5 }: FlowOptions) {
  return new ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: flowFragment,
    uniforms: {
      uColor: { value: new Color(color) },
      uTip: { value: new Color(tip ?? color) },
      uTime: { value: 0 },
      uLength: { value: length },
      uBoost: { value: 0 },
      uAlpha: { value: alpha },
      uAxis: { value: axis },
      uSpeed: { value: speed },
    },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    toneMapped: false,
  });
}

const beamFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uBoost;
  varying vec2 vUv;
  void main() {
    float fade = pow(1.0 - vUv.y, 1.4);
    float scan = smoothstep(0.82, 1.0, sin(vUv.y * 26.0 - uTime * 4.0));
    float streak = smoothstep(0.9, 1.0, sin(vUv.x * 62.83 + uTime * 0.8));
    float a = fade * (0.16 + scan * 0.18 + streak * 0.08) * (1.0 + uBoost * 2.0);
    gl_FragColor = vec4(uColor * (1.4 + uBoost * 2.0), a);
  }
`;

/** Hologram projector beam: bright at the base, scan lines rising. */
export function beamMaterial(color: string) {
  return new ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: beamFragment,
    uniforms: { uColor: { value: new Color(color) }, uTime: { value: 0 }, uBoost: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    toneMapped: false,
  });
}

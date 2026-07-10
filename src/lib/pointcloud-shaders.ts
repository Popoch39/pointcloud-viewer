/**
 * ShaderMaterial for baked pointclouds: one program per cloud, compiled with
 * defines for the attributes it actually has, switching color mode through a
 * uniform so the UI can toggle without rebuilding the geometry.
 */

import * as THREE from 'three'
import type { BakedPointCloud } from './baked-pointcloud.ts'

export type ColorMode = 'rgb' | 'intensity' | 'classification' | 'altitude'

const MODE_INDEX: Record<ColorMode, number> = {
  rgb: 0,
  intensity: 1,
  classification: 2,
  altitude: 3,
}

export function availableModes(cloud: BakedPointCloud): ColorMode[] {
  const modes: ColorMode[] = []
  if (cloud.rgb) modes.push('rgb')
  if (cloud.intensity) modes.push('intensity')
  if (cloud.classification) modes.push('classification')
  modes.push('altitude')
  return modes
}

export function defaultMode(cloud: BakedPointCloud): ColorMode {
  if (cloud.rgb) return 'rgb'
  if (cloud.intensity) return 'intensity'
  return 'altitude'
}

/** Standard ASPRS classification colors (0-18), Potree-like. */
const CLASS_PALETTE: [number, number, number][] = [
  [0.53, 0.53, 0.53], // 0 never classified
  [0.4, 0.4, 0.4], // 1 unclassified
  [0.63, 0.44, 0.26], // 2 ground
  [0.47, 0.77, 0.46], // 3 low vegetation
  [0.25, 0.63, 0.29], // 4 medium vegetation
  [0.11, 0.44, 0.16], // 5 high vegetation
  [0.85, 0.24, 0.21], // 6 building
  [0.87, 0.44, 0.63], // 7 low point (noise)
  [0.66, 0.66, 0.66], // 8 reserved
  [0.19, 0.44, 0.85], // 9 water
  [0.85, 0.71, 0.19], // 10 rail
  [0.3, 0.3, 0.32], // 11 road surface
  [0.66, 0.66, 0.66], // 12 reserved
  [0.95, 0.85, 0.28], // 13 wire guard
  [0.95, 0.65, 0.18], // 14 wire conductor
  [0.55, 0.31, 0.66], // 15 transmission tower
  [0.85, 0.55, 0.75], // 16 wire connector
  [0.28, 0.78, 0.82], // 17 bridge deck
  [0.9, 0.2, 0.75], // 18 high noise
]

const VERTEX_SHADER = /* glsl */ `
  uniform int uMode;
  uniform float uPointSize;
  uniform float uZMin;
  uniform float uZMax;
  uniform float uIntensityScale;
  uniform vec3 uClassPalette[19];
  #ifdef HAS_INTENSITY
  attribute float intensity;
  #endif
  #ifdef HAS_CLASSIFICATION
  attribute float classification;
  #endif
  varying vec3 vColor;

  // Polynomial approximation of the turbo colormap (Google AI research).
  vec3 turbo(float t) {
    t = clamp(t, 0.0, 1.0);
    vec4 v4 = vec4(1.0, t, t * t, t * t * t);
    vec2 v2 = v4.zw * v4.z;
    return vec3(
      dot(v4, vec4(0.13572138, 4.61539260, -42.66032258, 132.13108234)) +
        dot(v2, vec2(-152.94239396, 59.28637943)),
      dot(v4, vec4(0.09140261, 2.19418839, 4.84296658, -14.18503333)) +
        dot(v2, vec2(4.27729857, 2.82956604)),
      dot(v4, vec4(0.10667330, 12.64194608, -60.58204836, 110.36276771)) +
        dot(v2, vec2(-89.90310912, 27.34824973))
    );
  }

  void main() {
    vec3 shade = turbo((position.z - uZMin) / max(uZMax - uZMin, 1e-6));
    #ifdef HAS_RGB
    if (uMode == 0) shade = color;
    #endif
    #ifdef HAS_INTENSITY
    if (uMode == 1) shade = vec3(clamp(intensity * uIntensityScale, 0.0, 1.0));
    #endif
    #ifdef HAS_CLASSIFICATION
    if (uMode == 2) shade = uClassPalette[int(clamp(classification, 0.0, 18.0))];
    #endif
    vColor = shade;
    gl_Position = projectionMatrix * vec4(position, 1.0);
    gl_PointSize = uPointSize;
  }
`

const FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vColor;

  void main() {
    vec2 fromCenter = gl_PointCoord - 0.5;
    if (dot(fromCenter, fromCenter) > 0.25) discard;
    gl_FragColor = vec4(vColor, 1.0);
  }
`

/**
 * LAS intensity rarely spans the full u16 range: rescale by the actual
 * maximum so the grayscale stays readable.
 */
function intensityScale(intensity: Uint16Array | null): number {
  if (!intensity || intensity.length === 0) return 1
  let max = 0
  for (const value of intensity) {
    if (value > max) max = value
  }
  return max > 0 ? 65535 / max : 1
}

export function createPointsMaterial(
  cloud: BakedPointCloud,
  mode: ColorMode,
  pointSize: number,
): THREE.ShaderMaterial {
  const defines: Record<string, string> = {}
  if (cloud.rgb) {
    defines.HAS_RGB = ''
    defines.USE_COLOR = '' // makes ShaderMaterial declare the color attribute
  }
  if (cloud.intensity) defines.HAS_INTENSITY = ''
  if (cloud.classification) defines.HAS_CLASSIFICATION = ''
  return new THREE.ShaderMaterial({
    defines,
    uniforms: {
      uMode: { value: MODE_INDEX[mode] },
      uPointSize: { value: pointSize },
      uZMin: { value: cloud.bboxMin.z },
      uZMax: { value: cloud.bboxMax.z },
      uIntensityScale: { value: intensityScale(cloud.intensity) },
      uClassPalette: { value: CLASS_PALETTE.map(([r, g, b]) => new THREE.Vector3(r, g, b)) },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
  })
}

export function setMaterialMode(material: THREE.ShaderMaterial, mode: ColorMode): void {
  material.uniforms.uMode.value = MODE_INDEX[mode]
}

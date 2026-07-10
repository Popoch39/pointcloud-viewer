/**
 * MapLibre custom layer rendering a baked pointcloud with three.js on the
 * map's own WebGL context.
 *
 * The cloud's f32 local positions are uploaded untouched; each frame composes
 * MapLibre's mercator projection matrix with the anchor's model matrix in JS
 * doubles, so the huge mercator translations cancel out before the f32 GPU
 * upload (no jitter at high zoom).
 */

import * as THREE from 'three'
import type {
  CustomLayerInterface,
  CustomRenderMethodInput,
  Map as MapLibreMap,
} from 'maplibre-gl'
import type { BakedPointCloud } from './baked-pointcloud.ts'
import type { Anchor } from './map-anchor.ts'
import {
  createPointsMaterial,
  setMaterialMode,
  type ColorMode,
} from './pointcloud-shaders.ts'

export class PointCloudLayer implements CustomLayerInterface {
  readonly id = 'pointcloud'
  readonly type = 'custom' as const
  readonly renderingMode = '3d' as const

  private readonly cloud: BakedPointCloud
  /** Local meters (x east, y north, z up) → mercator units, in f64. */
  private readonly modelMatrix: THREE.Matrix4
  private readonly camera = new THREE.Camera()
  private map: MapLibreMap | null = null
  private renderer: THREE.WebGLRenderer | null = null
  private scene: THREE.Scene | null = null
  private geometry: THREE.BufferGeometry | null = null
  private material: THREE.ShaderMaterial | null = null
  private colorMode: ColorMode
  private pointSize: number

  constructor(cloud: BakedPointCloud, anchor: Anchor, colorMode: ColorMode, pointSize: number) {
    this.cloud = cloud
    this.colorMode = colorMode
    this.pointSize = pointSize
    const scale = anchor.meterScale
    const { x, y, z } = anchor.mercator
    // Mercator Y grows southward, hence the -scale on the local north axis.
    // prettier-ignore
    this.modelMatrix = new THREE.Matrix4().set(
      scale, 0, 0, x,
      0, -scale, 0, y,
      0, 0, scale, z,
      0, 0, 0, 1,
    )
  }

  onAdd(map: MapLibreMap, gl: WebGL2RenderingContext | WebGLRenderingContext): void {
    this.map = map
    this.renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl })
    this.renderer.autoClear = false

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(this.cloud.positions, 3))
    if (this.cloud.rgb) {
      geometry.setAttribute('color', new THREE.BufferAttribute(this.cloud.rgb, 3, true))
    }
    if (this.cloud.intensity) {
      geometry.setAttribute('intensity', new THREE.BufferAttribute(this.cloud.intensity, 1, true))
    }
    if (this.cloud.classification) {
      geometry.setAttribute(
        'classification',
        new THREE.BufferAttribute(this.cloud.classification, 1),
      )
    }
    this.geometry = geometry
    this.material = createPointsMaterial(this.cloud, this.colorMode, this.pointSize)

    const points = new THREE.Points(geometry, this.material)
    // The camera is a bare projection matrix: skip three's frustum test.
    points.frustumCulled = false
    this.scene = new THREE.Scene()
    this.scene.add(points)
  }

  render(_gl: WebGL2RenderingContext | WebGLRenderingContext, args: CustomRenderMethodInput): void {
    if (!this.renderer || !this.scene) return
    this.camera.projectionMatrix
      .fromArray(args.defaultProjectionData.mainMatrix)
      .multiply(this.modelMatrix)
    // MapLibre trashes GL state between frames; three must resync.
    this.renderer.resetState()
    this.renderer.render(this.scene, this.camera)
    // No triggerRepaint here: the cloud is static, repaints come from the map
    // and the setters.
  }

  onRemove(): void {
    this.geometry?.dispose()
    this.material?.dispose()
    this.renderer?.dispose()
    this.geometry = null
    this.material = null
    this.renderer = null
    this.scene = null
    this.map = null
  }

  setColorMode(mode: ColorMode): void {
    this.colorMode = mode
    if (this.material) setMaterialMode(this.material, mode)
    this.map?.triggerRepaint()
  }

  setPointSize(pixels: number): void {
    this.pointSize = pixels
    if (this.material) this.material.uniforms.uPointSize.value = pixels
    this.map?.triggerRepaint()
  }
}

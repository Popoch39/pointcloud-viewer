/**
 * Parser for the PCBK format produced by the Rust baker (webassembly/).
 *
 * Layout (little-endian): 64-byte header (magic "PCBK", version u32, count
 * u32, flags u32, world offset f64x3, local bbox f32x6) followed by planar
 * blocks: positions f32x3, intensity u16, rgb u8x3, classification u8.
 * The typed arrays returned are zero-copy views over the input buffer.
 */

const HEADER_SIZE = 64
// "PCBK" read as a little-endian u32
const MAGIC = 0x4b424350
const PCBK_VERSION = 1

const FLAG_RGB = 1
const FLAG_INTENSITY = 1 << 1
const FLAG_CLASSIFICATION = 1 << 2

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface BakedPointCloud {
  count: number
  /** World-space translation removed from the positions, in f64 precision. */
  worldOffset: Vec3
  /** Bounding box of the recentered (local) positions. */
  bboxMin: Vec3
  bboxMax: Vec3
  positions: Float32Array
  intensity: Uint16Array | null
  rgb: Uint8Array | null
  classification: Uint8Array | null
}

export function parseBakedPointCloud(buffer: ArrayBuffer): BakedPointCloud {
  if (buffer.byteLength < HEADER_SIZE) {
    throw new Error('PCBK buffer is smaller than its header')
  }
  const view = new DataView(buffer)
  if (view.getUint32(0, true) !== MAGIC) {
    throw new Error('not a PCBK buffer (bad magic)')
  }
  const version = view.getUint32(4, true)
  if (version !== PCBK_VERSION) {
    throw new Error(`unsupported PCBK version ${version}`)
  }
  const count = view.getUint32(8, true)
  const flags = view.getUint32(12, true)
  const vec3 = (at: number, get: (offset: number) => number, stride: number): Vec3 => ({
    x: get(at),
    y: get(at + stride),
    z: get(at + stride * 2),
  })
  const worldOffset = vec3(16, (at) => view.getFloat64(at, true), 8)
  const bboxMin = vec3(40, (at) => view.getFloat32(at, true), 4)
  const bboxMax = vec3(52, (at) => view.getFloat32(at, true), 4)

  const intensitySize = flags & FLAG_INTENSITY ? count * 2 : 0
  const rgbSize = flags & FLAG_RGB ? count * 3 : 0
  const classificationSize = flags & FLAG_CLASSIFICATION ? count : 0
  if (buffer.byteLength < HEADER_SIZE + count * 12 + intensitySize + rgbSize + classificationSize) {
    throw new Error('PCBK buffer is truncated')
  }

  let at = HEADER_SIZE
  const positions = new Float32Array(buffer, at, count * 3)
  at += count * 12
  let intensity: Uint16Array | null = null
  if (flags & FLAG_INTENSITY) {
    intensity = new Uint16Array(buffer, at, count)
    at += count * 2
  }
  let rgb: Uint8Array | null = null
  if (flags & FLAG_RGB) {
    rgb = new Uint8Array(buffer, at, count * 3)
    at += count * 3
  }
  let classification: Uint8Array | null = null
  if (flags & FLAG_CLASSIFICATION) {
    classification = new Uint8Array(buffer, at, count)
  }

  return { count, worldOffset, bboxMin, bboxMax, positions, intensity, rgb, classification }
}

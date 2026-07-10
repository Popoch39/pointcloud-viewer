/// <reference lib="webworker" />
import init, { bake } from '../../webassembly/pkg/pointcloud_baker'

export interface BakeRequest {
  file: File
}

export type BakeWorkerMessage =
  | { type: 'progress'; done: number; total: number }
  | { type: 'done'; bin: ArrayBuffer; durationMs: number }
  | { type: 'error'; message: string }

let wasmReady: Promise<unknown> | null = null

self.onmessage = async (event: MessageEvent<BakeRequest>) => {
  const post = (message: BakeWorkerMessage, transfer: Transferable[] = []) =>
    self.postMessage(message, transfer)
  try {
    const lasBytes = new Uint8Array(await event.data.file.arrayBuffer())
    try {
      wasmReady ??= init()
      await wasmReady
    } catch (error) {
      wasmReady = null
      throw error
    }
    const started = performance.now()
    const bin = bake(lasBytes, (done: number, total: number) => {
      post({ type: 'progress', done, total })
    })
    // wasm-bindgen returns a fresh Uint8Array over a plain (non-shared) buffer
    const buffer = bin.buffer as ArrayBuffer
    post({ type: 'done', bin: buffer, durationMs: performance.now() - started }, [buffer])
  } catch (error) {
    post({ type: 'error', message: error instanceof Error ? error.message : String(error) })
  }
}

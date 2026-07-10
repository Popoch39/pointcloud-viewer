import { useCallback, useEffect, useRef, useState } from 'react'
import { parseBakedPointCloud, type BakedPointCloud } from '../lib/baked-pointcloud.ts'
import type { BakeWorkerMessage } from '../workers/bake-worker.ts'

export type BakeState =
  | { status: 'idle' }
  | { status: 'baking'; fileName: string; done: number; total: number }
  | { status: 'loading'; fileName: string }
  | {
      status: 'done'
      fileName: string
      cloud: BakedPointCloud
      binByteLength: number
      /** null when the file was an already-baked .bin. */
      durationMs: number | null
    }
  | { status: 'error'; fileName: string; message: string }

/**
 * Turns a picked file into a parsed cloud: .las/.laz go through the WASM
 * baker in a Web Worker, already-baked .bin/.pcbk are parsed in place
 * (zero-copy, no worker needed).
 */
export function useBake() {
  const workerRef = useRef<Worker | null>(null)
  const [state, setState] = useState<BakeState>({ status: 'idle' })

  useEffect(() => () => workerRef.current?.terminate(), [])

  const openBin = useCallback(async (file: File) => {
    workerRef.current?.terminate()
    workerRef.current = null
    setState({ status: 'loading', fileName: file.name })
    try {
      const buffer = await file.arrayBuffer()
      setState({
        status: 'done',
        fileName: file.name,
        cloud: parseBakedPointCloud(buffer),
        binByteLength: buffer.byteLength,
        durationMs: null,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setState({ status: 'error', fileName: file.name, message })
    }
  }, [])

  const bakeFile = useCallback((file: File) => {
    workerRef.current?.terminate()
    const worker = new Worker(new URL('../workers/bake-worker.ts', import.meta.url), {
      type: 'module',
    })
    workerRef.current = worker
    setState({ status: 'baking', fileName: file.name, done: 0, total: 0 })
    worker.onmessage = (event: MessageEvent<BakeWorkerMessage>) => {
      const message = event.data
      if (message.type === 'progress') {
        setState({ status: 'baking', fileName: file.name, done: message.done, total: message.total })
      } else if (message.type === 'done') {
        setState({
          status: 'done',
          fileName: file.name,
          cloud: parseBakedPointCloud(message.bin),
          binByteLength: message.bin.byteLength,
          durationMs: message.durationMs,
        })
      } else {
        setState({ status: 'error', fileName: file.name, message: message.message })
      }
    }
    worker.onerror = (event) => {
      setState({ status: 'error', fileName: file.name, message: event.message || 'worker error' })
    }
    worker.postMessage({ file })
  }, [])

  const openFile = useCallback(
    (file: File) => {
      if (/\.(bin|pcbk)$/i.test(file.name)) {
        void openBin(file)
      } else {
        bakeFile(file)
      }
    },
    [openBin, bakeFile],
  )

  return { state, openFile }
}

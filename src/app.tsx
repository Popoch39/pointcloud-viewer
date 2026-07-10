import { useCallback, useState } from 'react'
import { BakePanel } from './components/bake-panel.tsx'
import { EpsgPrompt } from './components/epsg-prompt.tsx'
import { MapView } from './components/map-view.tsx'
import { ViewerSettings } from './components/viewer-settings.tsx'
import { useBake } from './hooks/use-bake.ts'
import { isSupportedEpsg } from './lib/epsg-registry.ts'
import { defaultMode, type ColorMode } from './lib/pointcloud-shaders.ts'

function App() {
  const { state, openFile } = useBake()
  const [epsgOverride, setEpsgOverride] = useState<number | null>(null)
  const [colorMode, setColorMode] = useState<ColorMode | null>(null)
  const [pointSize, setPointSize] = useState(2)

  const cloud = state.status === 'done' ? state.cloud : null

  // Per-cloud settings must not leak onto the next file: reset synchronously
  // at pick time, before the new cloud can render with a stale EPSG override.
  const handleFile = useCallback(
    (file: File) => {
      setEpsgOverride(null)
      setColorMode(null)
      openFile(file)
    },
    [openFile],
  )

  if (!cloud) {
    return <BakePanel state={state} onFile={handleFile} />
  }

  const epsg = epsgOverride ?? cloud.epsg
  if (!isSupportedEpsg(epsg)) {
    return (
      <main className="mx-auto flex min-h-svh max-w-2xl flex-col items-center gap-6 px-6 py-12">
        <EpsgPrompt fileEpsg={cloud.epsg} onSubmit={setEpsgOverride} />
        <BakePanel state={state} onFile={handleFile} overlay />
      </main>
    )
  }

  const mode = colorMode ?? defaultMode(cloud)
  return (
    <>
      <MapView cloud={cloud} epsg={epsg} colorMode={mode} pointSize={pointSize} />
      <div className="pointer-events-none fixed top-3 right-[60px] left-3 flex items-start justify-between gap-3 [&>*]:pointer-events-auto">
        <BakePanel state={state} onFile={handleFile} overlay />
        <ViewerSettings
          cloud={cloud}
          colorMode={mode}
          pointSize={pointSize}
          onColorMode={setColorMode}
          onPointSize={setPointSize}
        />
      </div>
    </>
  )
}

export default App

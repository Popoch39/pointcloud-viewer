import type { BakeState } from '../hooks/use-bake.ts'
import type { BakedPointCloud, Vec3 } from '../lib/baked-pointcloud.ts'

function formatCount(value: number): string {
  return value.toLocaleString('fr-FR')
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(2)} Go`
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(2)} Mo`
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(2)} Ko`
  return `${bytes} o`
}

function formatVec3({ x, y, z }: Vec3, digits = 2): string {
  return `(${x.toFixed(digits)}, ${y.toFixed(digits)}, ${z.toFixed(digits)})`
}

function downloadBin(cloud: BakedPointCloud, fileName: string) {
  // The parse is zero-copy (ADR 0001): the positions view is backed by the
  // complete PCBK buffer, header included.
  const blob = new Blob([cloud.positions.buffer as ArrayBuffer], {
    type: 'application/octet-stream',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName.replace(/\.(las|laz)$/i, '') + '.bin'
  link.click()
  URL.revokeObjectURL(url)
}

interface BakePanelProps {
  state: BakeState
  onFile: (file: File) => void
  /** Rendered as a collapsible panel on top of the map. */
  overlay?: boolean
}

export function BakePanel({ state, onFile, overlay = false }: BakePanelProps) {
  const content = (
    <>
      {!overlay && (
        <>
          <h1>Bake .las / .laz</h1>
          <p>
            Convertit un nuage de points en <code>.bin</code> (PCBK) via Rust/WASM, en mémoire,
            puis l'affiche sur la carte. Les <code>.bin</code> déjà bakés s'ouvrent directement.
          </p>
        </>
      )}
      <label className="file-picker">
        <input
          type="file"
          accept=".las,.laz,.bin,.pcbk"
          disabled={state.status === 'baking' || state.status === 'loading'}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onFile(file)
            event.target.value = ''
          }}
        />
      </label>

      {state.status === 'baking' && (
        <section className="bake-progress">
          <progress value={state.total > 0 ? state.done / state.total : undefined} />
          <p>
            {state.fileName} — {formatCount(state.done)}
            {state.total > 0 && <> / {formatCount(state.total)} points</>}
          </p>
        </section>
      )}

      {state.status === 'loading' && (
        <section className="bake-progress">
          <p>Ouverture de {state.fileName}…</p>
        </section>
      )}

      {state.status === 'done' && (
        <section className="bake-stats">
          <h2>{state.fileName}</h2>
          <dl>
            <dt>Points</dt>
            <dd>{formatCount(state.cloud.count)}</dd>
            <dt>Taille du .bin</dt>
            <dd>{formatBytes(state.binByteLength)}</dd>
            {state.durationMs !== null && (
              <>
                <dt>Durée du bake</dt>
                <dd>{(state.durationMs / 1000).toFixed(2)} s</dd>
              </>
            )}
            <dt>CRS</dt>
            <dd>{state.cloud.epsg > 0 ? `EPSG:${state.cloud.epsg}` : 'inconnu'}</dd>
            <dt>Offset monde</dt>
            <dd>{formatVec3(state.cloud.worldOffset)}</dd>
            <dt>Bbox locale</dt>
            <dd>
              {formatVec3(state.cloud.bboxMin)} → {formatVec3(state.cloud.bboxMax)}
            </dd>
            <dt>Attributs</dt>
            <dd>
              positions
              {state.cloud.intensity && ', intensité'}
              {state.cloud.rgb && ', RGB'}
              {state.cloud.classification && ', classification'}
            </dd>
          </dl>
          {state.durationMs !== null && (
            <button type="button" onClick={() => downloadBin(state.cloud, state.fileName)}>
              Télécharger le .bin
            </button>
          )}
        </section>
      )}

      {state.status === 'error' && (
        <section className="bake-error">
          <p>
            Échec de l'ouverture de {state.fileName} : {state.message}
          </p>
        </section>
      )}
    </>
  )

  if (overlay) {
    return (
      <details className="bake-panel bake-panel-overlay">
        <summary>{state.status === 'done' ? state.fileName : 'Fichier'}</summary>
        {content}
      </details>
    )
  }
  return <main className="bake-panel">{content}</main>
}

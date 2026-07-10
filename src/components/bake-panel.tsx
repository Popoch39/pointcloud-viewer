import { useBake } from '../hooks/use-bake.ts'
import type { Vec3 } from '../lib/baked-pointcloud.ts'

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

export function BakePanel() {
  const { state, bakeFile } = useBake()

  return (
    <main className="bake-panel">
      <h1>Bake .las / .laz</h1>
      <p>
        Convertit un nuage de points en <code>.bin</code> (PCBK) via Rust/WASM, en mémoire.
      </p>
      <label className="file-picker">
        <input
          type="file"
          accept=".las,.laz"
          disabled={state.status === 'baking'}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) bakeFile(file)
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

      {state.status === 'done' && (
        <section className="bake-stats">
          <h2>{state.fileName}</h2>
          <dl>
            <dt>Points</dt>
            <dd>{formatCount(state.cloud.count)}</dd>
            <dt>Taille du .bin</dt>
            <dd>{formatBytes(state.binByteLength)}</dd>
            <dt>Durée du bake</dt>
            <dd>{(state.durationMs / 1000).toFixed(2)} s</dd>
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
        </section>
      )}

      {state.status === 'error' && (
        <section className="bake-error">
          <p>
            Échec du bake de {state.fileName} : {state.message}
          </p>
        </section>
      )}
    </main>
  )
}

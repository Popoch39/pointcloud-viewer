import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
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
  const filePicker = (
    <div className="grid w-full max-w-sm items-center gap-1.5">
      <Label htmlFor="bake-file">Fichier</Label>
      <Input
        id="bake-file"
        type="file"
        accept=".las,.laz,.bin,.pcbk"
        disabled={state.status === 'baking' || state.status === 'loading'}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onFile(file)
          event.target.value = ''
        }}
      />
    </div>
  )

  const status = (
    <>
      {state.status === 'baking' && (
        <section className="w-full max-w-xl space-y-2">
          {state.total > 0 && (
            <Progress value={(state.done / state.total) * 100} />
          )}
          <p className="text-sm text-muted-foreground">
            {state.fileName} — {formatCount(state.done)}
            {state.total > 0 && <> / {formatCount(state.total)} points</>}
          </p>
        </section>
      )}

      {state.status === 'loading' && (
        <p className="text-sm text-muted-foreground">
          Ouverture de {state.fileName}…
        </p>
      )}

      {state.status === 'done' && (
        <Card className="w-full max-w-xl text-left">
          <CardHeader>
            <CardTitle className="font-mono text-lg">{state.fileName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2">
              <dt className="text-muted-foreground">Points</dt>
              <dd className="font-mono">{formatCount(state.cloud.count)}</dd>
              <dt className="text-muted-foreground">Taille du .bin</dt>
              <dd className="font-mono">{formatBytes(state.binByteLength)}</dd>
              {state.durationMs !== null && (
                <>
                  <dt className="text-muted-foreground">Durée du bake</dt>
                  <dd className="font-mono">
                    {(state.durationMs / 1000).toFixed(2)} s
                  </dd>
                </>
              )}
              <dt className="text-muted-foreground">CRS</dt>
              <dd className="font-mono">
                {state.cloud.epsg > 0 ? `EPSG:${state.cloud.epsg}` : 'inconnu'}
              </dd>
              <dt className="text-muted-foreground">Offset monde</dt>
              <dd className="font-mono">{formatVec3(state.cloud.worldOffset)}</dd>
              <dt className="text-muted-foreground">Bbox locale</dt>
              <dd className="font-mono">
                {formatVec3(state.cloud.bboxMin)} → {formatVec3(state.cloud.bboxMax)}
              </dd>
              <dt className="text-muted-foreground">Attributs</dt>
              <dd className="font-mono">
                positions
                {state.cloud.intensity && ', intensité'}
                {state.cloud.rgb && ', RGB'}
                {state.cloud.classification && ', classification'}
              </dd>
            </dl>
            {state.durationMs !== null && (
              <Button
                type="button"
                onClick={() => downloadBin(state.cloud, state.fileName)}
              >
                Télécharger le .bin
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {state.status === 'error' && (
        <p className="w-full max-w-xl text-sm text-destructive">
          Échec de l'ouverture de {state.fileName} : {state.message}
        </p>
      )}
    </>
  )

  if (overlay) {
    return (
      <Collapsible className="max-h-[calc(100svh-24px)] w-full max-w-[420px] overflow-y-auto rounded-lg border bg-background p-3 shadow-md">
        <CollapsibleTrigger className="cursor-pointer font-mono text-sm text-muted-foreground">
          {state.status === 'done' ? state.fileName : 'Fichier'}
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 flex flex-col gap-4">
          {filePicker}
          {status}
        </CollapsibleContent>
      </Collapsible>
    )
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col items-center gap-6 px-6 py-12 text-center">
      <h1 className="text-4xl font-medium tracking-tight">Bake .las / .laz</h1>
      <p className="text-muted-foreground">
        Convertit un nuage de points en{' '}
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground">
          .bin
        </code>{' '}
        (PCBK) via Rust/WASM, en mémoire, puis l'affiche sur la carte. Les{' '}
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground">
          .bin
        </code>{' '}
        déjà bakés s'ouvrent directement.
      </p>
      {filePicker}
      {status}
    </main>
  )
}

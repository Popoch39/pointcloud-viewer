import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { isSupportedEpsg, SUPPORTED_EPSG_HINT } from '../lib/epsg-registry.ts'

interface EpsgPromptProps {
  /** EPSG read from the file, shown when it exists but is unsupported. */
  fileEpsg: number
  onSubmit: (epsg: number) => void
}

/** Asks for the source CRS when the baked file has none (or an unsupported one). */
export function EpsgPrompt({ fileEpsg, onSubmit }: EpsgPromptProps) {
  const [value, setValue] = useState('')
  const [rejected, setRejected] = useState<string | null>(null)

  return (
    <Card className="w-full max-w-xl text-left">
      <CardHeader>
        <CardTitle>CRS requis</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            const epsg = Number(value)
            if (Number.isInteger(epsg) && isSupportedEpsg(epsg)) {
              onSubmit(epsg)
            } else {
              setRejected(value)
            }
          }}
        >
          <p className="text-muted-foreground">
            {fileEpsg > 0
              ? `Le CRS du fichier (EPSG:${fileEpsg}) n'est pas supporté.`
              : 'Ce nuage ne déclare pas de CRS.'}{' '}
            Indiquez le code EPSG de ses coordonnées pour le placer sur la carte.
          </p>
          <div className="flex items-center gap-3">
            <Label htmlFor="epsg-code">Code EPSG</Label>
            <Input
              id="epsg-code"
              type="text"
              inputMode="numeric"
              placeholder="2154"
              className="w-24 font-mono"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </div>
          {rejected !== null && (
            <p className="text-sm text-destructive">
              « {rejected} » n'est pas supporté — codes supportés : {SUPPORTED_EPSG_HINT}.
            </p>
          )}
          <Button type="submit" className="self-start">
            Afficher sur la carte
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

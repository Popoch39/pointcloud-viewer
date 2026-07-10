import { useState } from 'react'
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
    <form
      className="epsg-prompt"
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
      <h2>CRS requis</h2>
      <p>
        {fileEpsg > 0
          ? `Le CRS du fichier (EPSG:${fileEpsg}) n'est pas supporté.`
          : 'Ce nuage ne déclare pas de CRS.'}{' '}
        Indiquez le code EPSG de ses coordonnées pour le placer sur la carte.
      </p>
      <label>
        Code EPSG
        <input
          type="text"
          inputMode="numeric"
          placeholder="2154"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      {rejected !== null && (
        <p className="epsg-prompt-error">
          {rejected === '4326' || rejected === '3857'
            ? `EPSG:${rejected} est refusé comme CRS source : ses coordonnées ne sont pas des mètres projetés (degrés ou mètres Mercator distordus). `
            : `« ${rejected} » n'est pas supporté. `}
          Codes supportés : {SUPPORTED_EPSG_HINT}.
        </p>
      )}
      <button type="submit">Afficher sur la carte</button>
    </form>
  )
}

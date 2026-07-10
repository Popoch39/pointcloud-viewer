import type { BakedPointCloud } from '../lib/baked-pointcloud.ts'
import { availableModes, type ColorMode } from '../lib/pointcloud-shaders.ts'

const MODE_LABELS: Record<ColorMode, string> = {
  rgb: 'RGB',
  intensity: 'Intensité',
  classification: 'Classification',
  altitude: 'Altitude',
}

const ALL_MODES: ColorMode[] = ['rgb', 'intensity', 'classification', 'altitude']

interface ViewerSettingsProps {
  cloud: BakedPointCloud
  colorMode: ColorMode
  pointSize: number
  onColorMode: (mode: ColorMode) => void
  onPointSize: (pixels: number) => void
}

/** Map overlay: color mode selector + point size slider. */
export function ViewerSettings({
  cloud,
  colorMode,
  pointSize,
  onColorMode,
  onPointSize,
}: ViewerSettingsProps) {
  const available = availableModes(cloud)
  return (
    <section className="viewer-settings">
      <label>
        Couleur
        <select
          value={colorMode}
          onChange={(event) => onColorMode(event.target.value as ColorMode)}
        >
          {ALL_MODES.map((mode) => (
            <option key={mode} value={mode} disabled={!available.includes(mode)}>
              {MODE_LABELS[mode]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Points {pointSize}px
        <input
          type="range"
          min={1}
          max={8}
          step={1}
          value={pointSize}
          onChange={(event) => onPointSize(Number(event.target.value))}
        />
      </label>
    </section>
  )
}

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
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
    <section className="flex items-center gap-4 rounded-lg border bg-background px-4 py-2 shadow-md">
      <div className="flex items-center gap-2">
        <Label className="whitespace-nowrap text-muted-foreground">Couleur</Label>
        <Select
          value={colorMode}
          onValueChange={(value) => onColorMode(value as ColorMode)}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ALL_MODES.map((mode) => (
              <SelectItem
                key={mode}
                value={mode}
                disabled={!available.includes(mode)}
              >
                {MODE_LABELS[mode]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Label className="whitespace-nowrap text-muted-foreground">
          Points {pointSize}px
        </Label>
        <Slider
          className="w-28"
          min={1}
          max={8}
          step={1}
          value={[pointSize]}
          onValueChange={([value]) => onPointSize(value)}
        />
      </div>
    </section>
  )
}

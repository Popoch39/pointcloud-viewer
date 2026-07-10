import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { BakedPointCloud } from '../lib/baked-pointcloud.ts'
import { basemapStyle } from '../lib/basemap-style.ts'
import { computeAnchor } from '../lib/map-anchor.ts'
import { PointCloudLayer } from '../lib/pointcloud-layer.ts'
import type { ColorMode } from '../lib/pointcloud-shaders.ts'

interface MapViewProps {
  cloud: BakedPointCloud
  epsg: number
  colorMode: ColorMode
  pointSize: number
}

/** Full-screen MapLibre map rendering the cloud through a custom layer. */
export function MapView({ cloud, epsg, colorMode, pointSize }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const layerRef = useRef<PointCloudLayer | null>(null)
  const settingsRef = useRef({ colorMode, pointSize })
  settingsRef.current = { colorMode, pointSize }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const anchor = computeAnchor(cloud, epsg)
    const map = new maplibregl.Map({
      container,
      style: basemapStyle,
      canvasContextAttributes: { antialias: true },
      maxPitch: 80,
    })
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }))
    const layer = new PointCloudLayer(
      cloud,
      anchor,
      settingsRef.current.colorMode,
      settingsRef.current.pointSize,
    )
    layerRef.current = layer
    map.on('load', () => {
      map.addLayer(layer)
      map.fitBounds(anchor.bounds, { padding: 80, pitch: 45, duration: 0 })
    })
    return () => {
      layerRef.current = null
      map.remove()
    }
  }, [cloud, epsg])

  useEffect(() => {
    layerRef.current?.setColorMode(colorMode)
  }, [colorMode])
  useEffect(() => {
    layerRef.current?.setPointSize(pointSize)
  }, [pointSize])

  // `!fixed` beats maplibre-gl.css's `.maplibregl-map { position: relative }`,
  // whose single-class specificity ties Tailwind's `fixed` utility.
  return <div ref={containerRef} className="!fixed inset-0" />
}

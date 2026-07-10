/**
 * Georeferencing anchor: the cloud's world offset reprojected onto the map.
 *
 * Clouds span at most a few km, so a single anchor plus a linear
 * meters-to-mercator scale around it places every local position without
 * per-point reprojection (see docs/adr/0002).
 */

import maplibregl, { type LngLatBoundsLike } from 'maplibre-gl'
import type { BakedPointCloud } from './baked-pointcloud.ts'
import { toWgs84 } from './epsg-registry.ts'

export interface Anchor {
  lngLat: [number, number]
  mercator: maplibregl.MercatorCoordinate
  /** Mercator units per meter at the anchor's latitude. */
  meterScale: number
  /** WGS84 bounds of the local bbox, for fitBounds. */
  bounds: LngLatBoundsLike
}

export function computeAnchor(cloud: BakedPointCloud, epsg: number): Anchor {
  const { worldOffset, bboxMin, bboxMax } = cloud
  const lngLat = toWgs84(epsg, worldOffset.x, worldOffset.y)
  // The cloud rests on the basemap plane: altitude 0, worldOffset.z ignored.
  const mercator = maplibregl.MercatorCoordinate.fromLngLat(lngLat, 0)

  const corners = [
    [bboxMin.x, bboxMin.y],
    [bboxMin.x, bboxMax.y],
    [bboxMax.x, bboxMin.y],
    [bboxMax.x, bboxMax.y],
  ].map(([x, y]) => toWgs84(epsg, worldOffset.x + x, worldOffset.y + y))
  const lngs = corners.map(([lng]) => lng)
  const lats = corners.map(([, lat]) => lat)

  return {
    lngLat,
    mercator,
    meterScale: mercator.meterInMercatorCoordinateUnits(),
    bounds: [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ],
  }
}

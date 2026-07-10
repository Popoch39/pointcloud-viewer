/**
 * Minimal local EPSG registry: no network, covers the CRS a LAS file is
 * realistically baked from — Lambert-93 and the 120 WGS84 UTM zones.
 */

import proj4 from 'proj4'

const LAMBERT_93 =
  '+proj=lcc +lat_0=46.5 +lon_0=3 +lat_1=49 +lat_2=44 +x_0=700000 +y_0=6600000 ' +
  '+ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'

export function getProjDef(epsg: number): string | null {
  if (epsg === 2154) return LAMBERT_93
  if (epsg >= 32601 && epsg <= 32660) {
    return `+proj=utm +zone=${epsg - 32600} +datum=WGS84 +units=m +no_defs`
  }
  if (epsg >= 32701 && epsg <= 32760) {
    return `+proj=utm +zone=${epsg - 32700} +south +datum=WGS84 +units=m +no_defs`
  }
  return null
}

export function isSupportedEpsg(epsg: number): boolean {
  return getProjDef(epsg) !== null
}

/**
 * The anchor math assumes local positions are meters of a conformal-enough
 * projected CRS. Degrees (4326) and mercator-distorted meters (3857) would
 * silently misplace the cloud, so they are rejected as source CRS.
 */
export const SUPPORTED_EPSG_HINT = 'EPSG:2154 (Lambert-93) ou EPSG:326xx/327xx (UTM WGS84)'

/** Reprojects a source-CRS coordinate to WGS84 [lng, lat]. */
export function toWgs84(epsg: number, x: number, y: number): [number, number] {
  const key = `EPSG:${epsg}`
  const def = getProjDef(epsg)
  if (!def) {
    throw new Error(`EPSG:${epsg} non supporté — codes supportés : ${SUPPORTED_EPSG_HINT}`)
  }
  if (!proj4.defs(key)) proj4.defs(key, def)
  return proj4(key, 'EPSG:4326', [x, y]) as [number, number]
}

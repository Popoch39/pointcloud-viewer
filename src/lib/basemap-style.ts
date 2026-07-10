import type { StyleSpecification } from 'maplibre-gl'

/** IGN Géoplateforme orthophotos (webmercator WMTS, no API key needed). */
export const basemapStyle: StyleSpecification = {
  version: 8,
  sources: {
    'ign-ortho': {
      type: 'raster',
      tiles: [
        'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0' +
          '&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&TILEMATRIXSET=PM' +
          '&FORMAT=image/jpeg&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© IGN',
    },
  },
  layers: [{ id: 'ign-ortho', type: 'raster', source: 'ign-ortho' }],
}

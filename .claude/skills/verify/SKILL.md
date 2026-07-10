---
name: verify
description: Recette de vérification end-to-end de l'app (dev server + Chrome headless WebGL + screenshots)
---

# Vérifier l'app en conditions réelles

## Lancer

```bash
npm run build:wasm        # si le Rust a changé
npm run dev -- --port 5199
```

## Piloter en headless (WebGL2 requis par MapLibre)

`playwright-core` (npm, hors projet — l'installer dans un dossier scratch) + Chrome système :

```js
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
```

Sans les flags swiftshader, pas de WebGL2 en headless → carte noire.

## Flows à couvrir

1. Upload `sample.laz` (spirale Lambert-93, Paris — régénérer : `cd webassembly && cargo run --release --example generate-sample ..`) → la carte doit s'afficher sur l'ortho IGN au centre de Paris (lng 2.338, lat 48.847), nuage posé au sol.
2. Modes couleur (select) + slider taille de points.
3. Ouverture directe d'un `.bin` (en produire un : baker via le pkg wasm dans Node, `module_or_path` + `bake()`).
4. `sample-nocrs.las` → prompt EPSG ; code invalide rejeté ; `2154` → carte.
5. Zoom max par double-clics centrés sur le nuage : spires nettes = pas de jitter f32.

## Pièges

- Attendre ~5-6 s après le montage de la carte pour les tuiles IGN avant screenshot.
- `WheelEvent` sans `clientX/Y` zoome vers (0,0) — utiliser `dblclick` avec `position` pour zoomer sur le nuage.
- Le CSS `.map-view` doit gagner sur `.maplibregl-map { position: relative }` (ordre des bundles CSS) — symptôme : conteneur height 0, carte « hidden ».

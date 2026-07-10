# pointcloud-viewer

Visualisateur de nuages de points `.las` / `.laz` 100 % frontend (React + three.js à venir).
Le « bake » LAS/LAZ → `.bin` (format PCBK, voir [docs/adr/0001](docs/adr/0001-pcbk-custom-binary-format.md))
est écrit en Rust (`webassembly/`), compilé en WebAssembly et exécuté dans un Web Worker.

Vocabulaire du domaine : voir [CONTEXT.md](CONTEXT.md).

## Prérequis

- Node ≥ 20 (npm)
- Rust (le target `wasm32-unknown-unknown` est ajouté par rustup : `rustup target add wasm32-unknown-unknown`)
- `wasm-pack` est fourni en devDependency npm

## Développement

```bash
npm install
npm run build:wasm   # compile webassembly/ → webassembly/pkg/ (requis avant dev/build)
npm run dev
```

`npm run build` produit le bundle de production (rebuilder le wasm d'abord si le Rust a changé).

## Tests

```bash
cd webassembly && cargo test
```

Pour générer des fichiers d'essai (spirale colorée de 100 k points) :

```bash
cd webassembly && cargo run --release --example generate-sample .
```

## Structure

- `webassembly/` — crate Rust `pointcloud-baker` : bake LAS/LAZ → PCBK (`bake_to_pcbk`, export wasm `bake`)
- `src/lib/baked-pointcloud.ts` — parseur PCBK (vues TypedArray zero-copy)
- `src/workers/bake-worker.ts` — exécute le wasm hors du main thread, remonte la progression
- `src/hooks/use-bake.ts` / `src/components/bake-panel.tsx` — UI : input fichier, progression, stats

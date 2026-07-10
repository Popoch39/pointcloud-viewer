# 0001 — Format binaire maison (PCBK) pour les nuages bakés

## Statut

Accepté (2026-07-10)

## Contexte

Le viewer three.js a besoin d'un format de nuage de points directement consommable en `BufferAttribute`. Les fichiers sources sont des LAS/LAZ géoréférencés (coordonnées de l'ordre de 10⁵–10⁷ m), trop imprécis une fois castés naïvement en Float32, et trop coûteux à re-parser à chaque affichage. Des formats existants ont été considérés : PLY (pas d'offset monde, parsing texte/binaire générique), Draco (décodage coûteux, dépendance lourde), format tuilé Potree (conçu pour l'out-of-core, sur-dimensionné pour un bake tout-en-mémoire).

## Décision

Un format maison « PCBK », little-endian : header fixe de 64 octets (magic `PCBK`, version, count, flags d'attributs, **world offset f64×3**, bbox locale f32×6) suivi de blocs planaires `positions f32×3`, `intensity u16`, `rgb u8×3`, `classification u8`.

- Les positions sont recentrées sur le minimum par axe (world offset), gardant la précision f32.
- Les blocs sont planaires et ordonnés pour que chaque bloc soit naturellement aligné sur la taille de son élément (l'intensité u16 précède le RGB u8×3) : chaque bloc se mappe en zero-copy sur un TypedArray.
- Le RGB 16 bits LAS est réduit à 8 bits ; si le fichier stocke déjà des valeurs 8 bits (pratique courante non conforme), elles sont conservées telles quelles.

## Conséquences

- Le viewer crée ses `BufferAttribute` par simple vue sur le buffer, sans décodage.
- Toute évolution du format doit incrémenter `version` dans le header ; les `.bin` déjà produits deviennent invalides à chaque changement de layout — c'est le coût d'un format maison.
- Le format n'est pas interopérable avec d'autres outils (contrairement à PLY) ; l'échange se fait via les LAS/LAZ sources.
- Pas de compression ni de tuilage : les très gros nuages (sortie > mémoire wasm32) ne sont pas gérés — assumé à ce stade.

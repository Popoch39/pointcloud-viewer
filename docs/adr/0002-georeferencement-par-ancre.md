# 0002 — Géoréférencement par ancre unique et EPSG dans le header (PCBK v2)

## Statut

Accepté (2026-07-11)

## Contexte

Le viewer affiche les nuages sur une carte MapLibre (fond orthophoto IGN) via un custom layer three.js partageant le contexte WebGL. Pour placer un nuage il faut son CRS source, que PCBK v1 ne stockait pas — le baker ignorait les VLRs de projection du LAS. Par ailleurs, reprojeter chaque point en Mercator au chargement coûterait cher (dizaines de millions de points) et détruirait le bénéfice du Local Space f32 ; l'alternative est une approximation linéaire autour d'un point d'ancrage, dont l'erreur croît avec l'étendue du nuage.

## Décision

1. **PCBK v2** : le header passe de 64 à 72 octets — `epsg u32` (0 = inconnu) puis `reserved u32` de padding après la bbox. Le baker extrait l'EPSG des VLRs `LASF_Projection` : GeoKeyDirectory GeoTIFF (clé 3072, repli 2048, sentinelles 0/32767 rejetées) prioritaire sur le WKT (dernière `AUTHORITY["EPSG",…]`/`ID["EPSG",…]`). L'extraction n'échoue jamais un bake ; sans CRS, l'UI demande le code à l'affichage.
2. **Ancre unique** : seul le World Offset est reprojeté (proj4 → WGS84 → `MercatorCoordinate`). Les positions f32 locales sont envoyées telles quelles au GPU ; le placement est la matrice affine translate(ancre) × scale(s, −s, s) avec `s = meterInMercatorCoordinateUnits()`, composée en doubles JS avec la matrice de projection MapLibre à chaque frame.
3. **Registre EPSG local minimal** : Lambert-93 (2154) + zones UTM WGS84 (326xx/327xx, générées par formule). Pas de réseau, pas de base EPSG embarquée ; 4326 et 3857 sont refusés comme CRS source (degrés / mètres distordus).

## Conséquences

- Les nuages sont supposés couvrir **au plus quelques kilomètres** : l'erreur de l'approximation linéaire reste sub-centimétrique à cette échelle mais croît quadratiquement au-delà (corridor de plusieurs dizaines de km ⇒ reprojection par point ou ancres multiples, non gérées).
- Le bump v1 → v2 invalide les `.bin` existants (coût assumé par l'ADR 0001) ; le parseur les rejette avec un message demandant de re-baker.
- La composition des matrices en doubles côté CPU est ce qui évite le jitter au zoom élevé : ne jamais uploader séparément matrice de projection et matrice modèle.
- Un LAS dans un CRS hors registre est consultable en saisissant un code supporté équivalent, sinon pas du tout — extension du registre à la demande.

# Glossaire

- **Bake** : conversion d'un fichier LAS/LAZ en PCBK. Se fait entièrement côté navigateur (module Rust compilé en WebAssembly), jamais côté serveur.
- **PCBK** (BakedPointCloud) : format binaire maison produit par le bake, conçu pour être consommé directement par le viewer three.js. Un nuage baké contient les positions et les Point Attributes.
- **World Offset** : translation (en double précision) séparant l'espace monde géoréférencé du Local Space. C'est le minimum par axe du nuage.
- **Local Space** : espace de coordonnées recentré autour de l'origine dans lequel vivent les positions d'un nuage baké. Permet la simple précision sans jitter.
- **Point Attributes** : données par point autres que la position — couleur RGB, intensité (retour laser), classification (catégorie LAS : sol, végétation, bâtiment…). Chacun est optionnel dans un nuage baké.
- **EPSG** : code identifiant le CRS source des coordonnées du nuage, stocké dans le nuage baké au moment du bake. 0 signifie « inconnu » : le nuage reste consultable mais l'utilisateur doit fournir le code à l'affichage.
- **Ancre** : le World Offset reprojeté sur la carte. Tout le nuage est placé par approximation linéaire autour de l'ancre, sans reprojection par point — valable car un nuage couvre au plus quelques kilomètres.
- **Viewer** : la vue carte, seule partie affichage de l'application. Elle consomme exclusivement des nuages bakés, jamais du LAS/LAZ brut, et les affiche géoréférencés sur fond de carte.

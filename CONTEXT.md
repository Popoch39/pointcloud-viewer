# Glossaire

- **Bake** : conversion d'un fichier LAS/LAZ en PCBK. Se fait entièrement côté navigateur (module Rust compilé en WebAssembly), jamais côté serveur.
- **PCBK** (BakedPointCloud) : format binaire maison produit par le bake, conçu pour être consommé directement par le viewer three.js. Un nuage baké contient les positions et les Point Attributes.
- **World Offset** : translation (en double précision) séparant l'espace monde géoréférencé du Local Space. C'est le minimum par axe du nuage.
- **Local Space** : espace de coordonnées recentré autour de l'origine dans lequel vivent les positions d'un nuage baké. Permet la simple précision sans jitter.
- **Point Attributes** : données par point autres que la position — couleur RGB, intensité (retour laser), classification (catégorie LAS : sol, végétation, bâtiment…). Chacun est optionnel dans un nuage baké.
- **Viewer** : la partie affichage three.js (à venir), qui consomme exclusivement des nuages bakés, jamais du LAS/LAZ brut.

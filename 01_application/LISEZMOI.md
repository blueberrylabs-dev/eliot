# Eliot, l'application

Première version de l'éditeur (étape 1 du `BRIEF.md`). Une page, des textes, des formes et des
photos, manipulés à la souris comme dans Canva, puis exportés en PNG ou en JPEG.

**À lancer à la main, carte graphique libre** (règle 9 du `BRIEF.md`). Les commandes
complètes sont dans le `CLAUDE.md` à la racine du projet.

**Pas encore d'enregistrement du projet** : fermer la fenêtre efface la page. Les projets et
l'enregistrement automatique arrivent à l'étape 2. D'ici là, exporter avant de fermer.

## Ce qu'on peut faire

- Choisir le format de la page (carré, portrait 4:5, story 9:16, paysage 16:9, A4) et sa
  couleur de fond.
- Ajouter un titre, un sous-titre, un paragraphe, ou un titre déjà mis en forme dans l'une
  des huit polices libres embarquées ; double-clic ou Entrée pour écrire dedans.
- Ajouter un rectangle, un rectangle arrondi, un cercle, un triangle ou une étoile.
- Importer des photos (JPEG, PNG, WebP, GIF, BMP, TIFF). Le noyau Rust lit l'orientation de
  l'appareil photo, garde l'original intact et fabrique un aperçu de 2560 px et une miniature.
- Glisser, redimensionner, tourner par la poignée du bas (l'angle s'accroche tous les 45°).
  Des repères roses aimantent l'objet aux bords et au centre de la page et des autres objets.
- Régler couleur, police, taille, gras, italique, souligné, alignement, espacements, contour,
  arrondi des coins, transparence ; retourner une photo.
- Calques : masquer, verrouiller, avancer ou reculer d'un cran, passer tout devant ou tout
  derrière.
- Exporter en PNG (fond transparent possible) ou en JPEG, taille normale ou double, dans
  `~/Images/Eliot/` avec un nom daté, ou ailleurs par « Enregistrer sous ».

## Raccourcis

| Touches | Effet |
| --- | --- |
| Ctrl+Z, Ctrl+Maj+Z ou Ctrl+Y | annuler, rétablir |
| Ctrl+C, Ctrl+V, Ctrl+D | copier, coller, dupliquer |
| Ctrl+A, Échap | tout sélectionner, désélectionner |
| Suppr ou Retour arrière | supprimer (sauf objet verrouillé) |
| Flèches, Maj+flèches | déplacer de 1 px, de 10 px |
| Ctrl+↑, Ctrl+↓ (avec Maj : tout devant, tout derrière) | ordre d'empilement |
| Entrée | écrire dans le texte sélectionné |
| Maj+clic, rectangle tracé à la souris | sélection de plusieurs objets |

## Où vont les fichiers

- Photos importées : `~/.local/share/fr.alexandredo.eliot/ressources/` (originaux, aperçus,
  miniatures, fiches). Une photo importée deux fois n'est gardée qu'une fois.
- Exports : `~/Images/Eliot/AAAA-MM-JJ_HHMMSS_eliot.png` (ou `.jpg`), jamais d'écrasement
  (suffixe `_2` en cas de doublon).

## Plan du code

```
01_application/
├── noyau/            Rust sans Tauri : import des images, écriture des exports (tests : cargo test)
├── src-tauri/        la fenêtre et les commandes appelées par l'interface (src/commandes.rs)
├── src/
│   ├── modele/       le document (types.ts) et la fabrication des objets
│   ├── etat/         le store : document, sélection, historique d'annulation, notifications
│   ├── pont/         le seul fichier qui parle à Tauri (repli navigateur pour les tests)
│   ├── editeur/      la zone de travail Konva, les barres, les panneaux, les raccourcis
│   └── export/       rendu de la page en image
└── outils/           dessin de l'icône
```

Le document est un objet JSON, seule source de vérité ; Konva ne fait que le dessiner. Pendant
un geste, les objets saisis passent sur un calque à part et reviennent à leur place dans la
pile avant l'écriture dans le document (règle 11).

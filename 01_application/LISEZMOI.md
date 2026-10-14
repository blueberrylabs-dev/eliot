# Eliot, l'application

L'éditeur, étapes 1, 2 et 3 du `BRIEF.md` : un accueil qui range tes designs, des pages qu'on
compose à la souris comme dans Canva, une bibliothèque d'icônes, d'emojis, de personnages et
de polices, des photos libres de Pixabay, un kit de marque, des modèles de départ, un
enregistrement automatique et l'export en PNG ou en JPEG.

**À lancer à la main, carte graphique libre** (règle 9 du `BRIEF.md`). Les commandes
complètes sont dans le `CLAUDE.md` à la racine du projet.

## Ce qu'on peut faire

**Accueil**
- Créer un design dans un format prêt (carré, portrait 4:5, story 9:16 pour Reels, TikTok et
  Shorts, paysage 16:9, miniature YouTube, bannière, A4, A5) ou dans une taille libre.
- Retrouver ses designs, du plus récent au plus ancien, avec leur miniature ; chercher par
  nom ; renommer, copier, exporter en fichier `.eliot`, mettre à la corbeille.
- Mes modèles : un design enregistré comme modèle sert de point de départ ; un clic crée un
  nouveau design à partir de lui.
- Ouvrir un fichier `.eliot` (un design venu d'une autre machine), ou le déposer sur la
  fenêtre.

**Éditeur**
- Le design s'enregistre tout seul une seconde après chaque modification, et à la fermeture
  de la fenêtre ; l'état s'affiche à côté du nom, en haut. Le nom se change d'un clic.
- Textes, formes et images : clic pour poser au centre, ou glisser depuis le panneau jusqu'à
  l'endroit voulu. Une image peut aussi arriver par un dépôt de fichier sur la page ou par un
  coller (Ctrl+V d'une capture d'écran).
- Glisser, redimensionner, tourner par la poignée du bas (l'angle s'accroche tous les 45°).
  Des repères roses aimantent l'objet aux bords et au centre de la page et des autres objets.
- Régler couleur (unie ou dégradé), police, taille, gras, italique, souligné, alignement,
  espacements, contour, arrondi des coins, transparence ; retourner une photo.
- Position : aligner sur la page (un objet) ou entre eux (plusieurs), répartir l'espace
  entre trois objets ou plus.
- Grouper : les objets d'un groupe se sélectionnent et bougent ensemble ; Alt + clic en prend
  un seul.
- Copier le style d'un objet (pinceau de la barre, ou Ctrl+Alt+C), puis cliquer sur un autre.
- Plusieurs pages (carrousel, story en plusieurs écrans) : bande des pages en bas, vignettes à
  glisser pour changer l'ordre, vue en grille, dupliquer, supprimer.
- Zoom : curseur en bas, Ctrl + molette, Ctrl+0 pour ajuster ; molette pour défiler, barre
  d'espace maintenue ou bouton du milieu pour déplacer la vue.
- Redimensionner : passer le design dans un autre format, sur place ou sur une copie.
- Aperçu en plein écran (F11), flèches pour changer de page, Échap pour sortir.
- Exporter en PNG (fond transparent possible) ou en JPEG, taille normale ou double, la page
  affichée ou toutes les pages (une image par page), dans `~/Images/Eliot/`.

**Bibliothèque et mise en forme (étape 3)**
- Fabriquée sur le poste une fois : `npm run bibliotheque` (commande 8 bis du `CLAUDE.md`).
- Panneau Éléments : formes (dont polygone, cœur, badge), lignes et flèches, 7 750 icônes
  (Tabler, Phosphor), 4 047 emojis (Fluent Emoji, OpenMoji), QR code ; une recherche par mot,
  en français (« panier », « cœur », « fusée ») ou en anglais.
- Personnages (panneau Éléments) : 189 Open Peeps au trait (bustes, debout, assis, masques et
  soignants) et 32 Humaaans en aplats de couleur, plus 4 décors, de Pablo Stanley (CC0).
  Leurs couleurs se changent dans la barre du haut : par partie pour les Open Peeps (trait,
  tête, tenue, barbe, lunettes), couleur par couleur pour les Humaaans (la peau partout d'un
  coup). « Créer le tien » tire un personnage au hasard ; le bouton Personnage de la barre du
  haut change ensuite sa posture, sa tenue, sa coiffure, son visage, sa barbe et ses lunettes
  sur des vignettes. Il faut les deux archives .zip dans `Eliot/telechargements/` (commande
  8 bis du `CLAUDE.md`).
- Panneau Texte : 95 polices rangées par genre, avec leur usage (« luxe », « promo qui
  claque »…), 22 associations titre et texte, et les polices installées sur le poste (copiées
  dans le design qui s'en sert).
- Effets de texte : ombre, néon, contour, surlignage, capitales, barré. Ombre portée pour les
  formes, images, icônes et emojis.
- Cadres photo (rond, arche, cœur…), grilles qui remplissent la page, maquettes de téléphone,
  tablette, ordinateur et montre : on y glisse une photo depuis le panneau Importer ; double-clic
  pour la faire glisser dans son cadre, molette pour l'agrandir. Photos à coins arrondis, bordure.
- Panneau Photos : photos libres de Pixabay, cherchées en français, filtrées par orientation
  et par couleur. Rien ne part sur internet avant une recherche ; les résultats restent 24 h
  en cache. La photo choisie est copiée dans le design avec le nom de son auteur, visible dans
  la barre du haut quand elle est choisie. Il faut la clé Pixabay dans le `.env` du dossier
  Eliot (`PIXABAY_API_KEY=…`) ; Eliot la lit côté Rust et ne l'affiche jamais.
- Modèles de départ : 42 pages prêtes à modifier (soldes, nouveau produit, citation, événement,
  témoignage, menu, carrousel, comparatif, stories, miniatures YouTube, bannières, affiches A4
  et A5), avec des cadres photo vides à remplir. À l'accueil, « Partir d'un modèle » crée un
  design au bon format ; dans l'éditeur, l'onglet Modèles pose le modèle sur la page (ou sur
  une nouvelle page si elle est déjà remplie), mis à l'échelle si le format diffère.
- Panneau Dessin : stylo, marqueur, surligneur et gomme ; chaque trait devient un objet qu'on
  déplace, agrandit ou recolore ensuite. Échap pour revenir à la sélection.
- Graphiques (panneau Éléments) : colonnes, barres, courbe, aires, camembert, anneau, jauge de
  progression ; les chiffres se changent par le bouton Données, ou se collent depuis un
  tableur. Tableaux : double-clic sur une case pour écrire, Tab pour passer à la suivante (et
  ajouter une rangée après la dernière), rangées, colonnes, en-tête, rayures, couleurs.
- Panneau Marque : un kit de marque commun à tous les designs (`~/Documents/Eliot/Marque/`) :
  couleurs (un clic les donne aux objets choisis, ou au fond de la page), polices du titre, du
  sous-titre et du texte, logos. Les couleurs et les polices de la marque viennent en tête des
  sélecteurs.

**Laisser une IA piloter Eliot**
- Fichier, « Réglages et pont IA… » : un interrupteur ouvre le pont. Une IA comme Claude peut
  alors lire le design, poser et modifier des objets, gérer les pages, importer une image du
  poste, chercher et poser des photos de Pixabay, se servir du kit de marque, dessiner à main
  levée, poser des graphiques et des tableaux, partir d'un modèle de départ, regarder une
  capture de la page et exporter. On la voit travailler dans la fenêtre,
  et Ctrl+Z défait chacune de ses actions. Mise en place : commandes 13 à 15 bis du `CLAUDE.md`.

## Raccourcis

| Touches | Effet |
| --- | --- |
| Ctrl+Z, Ctrl+Maj+Z ou Ctrl+Y | annuler, rétablir |
| Ctrl+C, Ctrl+X, Ctrl+V, Ctrl+D | copier, couper, coller, dupliquer |
| Ctrl+A, Échap | tout sélectionner, désélectionner |
| Suppr ou Retour arrière | supprimer (sauf objet verrouillé) |
| Flèches, Maj+flèches | déplacer de 1 px, de 10 px |
| Ctrl+↑, Ctrl+↓ (avec Maj : tout devant, tout derrière) | ordre d'empilement |
| Ctrl+G, Ctrl+Maj+G | grouper, dégrouper |
| Ctrl+Alt+C, Ctrl+Alt+V | copier le style, le coller sur la sélection |
| Entrée | écrire dans le texte sélectionné |
| Ctrl+Entrée | ajouter une page |
| Page préc., Page suiv. | page précédente, suivante |
| Ctrl + molette, Ctrl+0, Ctrl+plus, Ctrl+moins | zoom |
| Espace maintenu + glisser | déplacer la vue |
| F11 | aperçu en plein écran |
| Maj+clic, rectangle tracé à la souris | sélection de plusieurs objets |
| Alt+clic | un seul objet d'un groupe |

## Où vont les fichiers

- Designs : `~/Documents/Eliot/Designs/<nom du design>/`, un dossier par design :
  `document.json` (le document), `document.precedent.json` (la version d'avant, en secours),
  `miniature.png` (pour l'accueil) et `ressources/` (originaux, aperçus et miniatures des
  images). Le dossier se copie tel quel d'une machine à l'autre ; le fichier `.eliot` en est
  une archive zip.
- Modèles maison : `~/Documents/Eliot/Modèles/`.
- Exports : `~/Images/Eliot/AAAA-MM-JJ_HHMMSS_eliot.png` (ou `.jpg`, avec `_page-01`… pour
  plusieurs pages), jamais d'écrasement.
- Un design supprimé part dans la corbeille d'Ubuntu.

## Plan du code

```
01_application/
├── noyau/            Rust sans Tauri : images, designs (projet.rs), exports, polices, Pixabay, kit de marque (cargo test)
├── src-tauri/        la fenêtre, les commandes de l'interface (src/commandes.rs), le pont IA (src/ia.rs)
├── eliot-mcp/        le programme que lance l'application Claude pour piloter Eliot (MCP)
├── public/bibliotheque/  icônes, emojis, polices, personnages : fabriqués par npm run bibliotheque, hors git
├── src/
│   ├── App.tsx       l'accueil ou l'éditeur
│   ├── bibliotheque/ catalogue des polices, associations, mots français, recherche, rendu des icônes et des personnages
│   ├── accueil/      l'accueil : formats, designs, modèles
│   ├── modele/       le document (types.ts), la fabrication des objets, la géométrie, les personnages composés
│   ├── modeles/      les modèles de départ, dessinés pour Eliot
│   ├── etat/         le store, l'enregistrement automatique, les opérations sur les designs
│   ├── pont/         le seul fichier qui parle à Tauri (repli navigateur pour les tests)
│   ├── editeur/      la zone de travail Konva, les barres, les panneaux, les pages
│   ├── export/       rendu d'une page hors écran, export
│   ├── ia/           les outils offerts à l'IA (outils.json, outils.ts) et leur pilote
│   └── reglages/     la fenêtre des réglages
└── outils/           fabrication de la bibliothèque (personnages : personnages.mjs), dessin de l'icône, prototype du texte animé
```

Le document est un objet JSON, seule source de vérité ; Konva ne fait que le dessiner. Pendant
un geste, les objets saisis passent sur un calque à part et reviennent à leur place dans la
pile avant l'écriture dans le document (règle 11). Tests de l'interface : `npm test`.

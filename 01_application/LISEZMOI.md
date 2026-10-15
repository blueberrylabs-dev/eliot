# Eliot, l'application

L'éditeur, étapes 1 à 3 du `BRIEF.md` et une bonne part de l'étape 4 : un accueil qui range tes
designs, des pages qu'on compose à la souris comme dans Canva, une bibliothèque d'icônes,
d'emojis, de personnages et de polices, des photos et des vidéos libres de Pixabay, un kit de
marque, des modèles de départ, des vidéos montées et animées sur une frise, avec leur musique,
leurs bruitages, ta voix enregistrée au micro et nettoyée ou une voix de synthèse, un
enregistrement automatique, l'export en PNG ou en JPEG et l'export des vidéos en MP4 ou en GIF.

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
  sous-titre et du texte, logos, jingles d'ouverture et de fin. Les couleurs et les polices de
  la marque viennent en tête des sélecteurs.

**Vidéos dans le design (étape 4, lot 1)**
- Importer une vidéo (MP4, MOV, M4V, WebM, MKV, AVI, MPG) par le bouton du panneau Importer
  ou en la déposant sur la page. Eliot range l'original sans y toucher et prépare, par le
  `ffmpeg` du poste et sur le processeur, une copie légère pour l'écran (VP9, 720 px sur le
  petit côté, une image clé par demi-seconde), les vignettes de la future frise et la forme
  d'onde du son. Une bande en bas de la fenêtre montre l'avancement.
- La vidéo se pose comme une photo : déplacer, redimensionner, tourner, retourner, coins
  arrondis, bordure, ombre, transparence. Sa carte du panneau Importer montre sa durée.
- Barre du haut : Lire et Pause, la durée qui joue, le son (volume, couper), la vitesse (de
  0,25× à 4×) et Couper (début et fin, en secondes). Poser une vidéo fait de la page une page
  vidéo, avec sa frise (plus bas). Revenue en photo (bascule Photo), la page garde ses vidéos,
  qui jouent en boucle quand on les lance : un post animé. L'aperçu plein écran (F11) fait
  jouer les vidéos avec le son ; une page vidéo s'y lit du début à la fin.
- Panneau Photos, bouton Vidéos : vidéos libres de Pixabay, cherchées en français ; le tri
  Paysage ou Portrait se fait sur les résultats. La vidéo choisie se télécharge en 1080p, se
  prépare comme une vidéo du poste et garde le nom de son auteur.
- L'export en PNG ou en JPEG d'une page fixe montre la couverture de chaque vidéo (une image
  prise vers la première seconde) ; une page vidéo s'exporte en film (MP4 ou GIF, plus bas).

**La frise d'une page vidéo (étape 4, lot 2)**
- La bascule Photo ou Vidéo, en haut, dit ce qu'est la page affichée. Vidéo : la frise
  s'ouvre en bas, chaque élément déjà posé sur sa piste (l'empilement gardé). Photo : la page
  redevient une image fixe (Ctrl+Z pour revenir).
- Les pistes : la principale en bas, où les vidéos se suivent bout à bout, sans trou
  (supprimer un clip resserre la suite) ; au-dessus, les superpositions (textes, formes,
  photos, vidéos en incrustation), la plus haute devant. Une vidéo importée va sur la
  principale et remplit la page ; un texte, une forme ou une photo se pose à la tête de
  lecture, pour 3 s, au-dessus de ce qui se voit.
- Lire et Pause (Espace, appui bref ; maintenu, Espace déplace toujours la vue), la règle
  (un clic y met la tête, un glisser fait défiler), le temps affiché, le zoom (boutons, ou
  Ctrl + molette), « toute la vidéo dans la largeur », la hauteur de la frise (tirer son bord
  du haut), la replier.
- Les clips : une vidéo montre ses vignettes et la forme de son son. Glisser un clip le
  déplace dans le temps ou sur une autre piste (lâché au-dessus de la plus haute : une piste
  neuve ; sur une piste occupée à cet endroit : une piste neuve juste au-dessus) ; tirer un
  bord coupe le début ou la fin (une vidéo garde la partie de son fichier qui suit), et la
  page montre l'image du bord. Les bords des clips et la tête aimantent.
- Scinder à la tête (Ctrl+B, ou le bouton Scinder), dupliquer (la copie suit l'original),
  supprimer. Ctrl+↑ et Ctrl+↓ font monter ou descendre un clip d'une piste.
- La page montre l'instant de la tête : chaque élément n'apparaît que pendant son temps.
  L'export en image d'une page vidéo sort l'instant de la tête de lecture, avec l'image exacte
  de chaque vidéo. Sous la principale, les pistes des sons (lot 5, plus bas).

**L'animation (étape 4, lot 3)**
- Animer, dans la barre juste au-dessus de la page, pour les éléments choisis d'une page
  vidéo : une entrée, une sortie et une boucle. Survoler une animation la joue sur la page ;
  un clic la pose. Un texte peut aussi entrer ou sortir par morceaux : machine à écrire,
  lettre par lettre, mot par mot, ligne par ligne.
- Dans la frise, une zone claire au début (ou au bout) du clip montre l'entrée (ou la
  sortie) : tirer son bord change sa durée. Une boucle se signale par une petite icône.
- L'élément choisi s'affiche tel qu'il est posé, sans ses effets, tant que la page ne joue
  pas : on le règle tranquillement ; les effets se voient à la lecture.
- Images clés : le losange de la barre de la frise pose une clé à la tête de lecture (la
  position, la taille, la rotation et l'opacité de cet instant). Ensuite, déplacer, agrandir,
  tourner l'élément ou changer son opacité à un autre instant pose une autre clé : l'élément
  passe de l'une à l'autre. Les clés se voient en losanges jaunes au bas du clip (un clic y
  mène, un glisser les déplace) ; les flèches à côté du losange vont à la précédente ou à la
  suivante ; sur une clé, le losange la retire.
- Transitions : entre deux clips de la piste principale, le petit bouton ajoute un fondu
  enchaîné, un glissement, un zoom ou un volet, et montre le passage. Les deux clips se
  chevauchent pendant la transition (hachures) : la vidéo raccourcit d'autant.
- Son d'une vidéo : la bulle Son règle aussi un fondu d'entrée et un fondu de sortie.
- Styles pour la vidéo, dans le panneau Texte (page vidéo) : huit textes prêts, avec leur
  police, leurs couleurs et leurs animations, posés à la tête. Pour un texte déjà posé :
  Effets, en haut de la bulle.

**Le son (étape 4, lot 5)**
- Onglet Audio : « Importer un son » (MP3, WAV, OGG, OPUS, M4A, AAC, FLAC, AIFF, WMA), ou un
  son déposé sur la fenêtre. Eliot range l'original sans y toucher, prépare une copie
  d'écoute légère et la forme d'onde, et mesure le niveau sonore (LUFS). Les sons du design
  sont listés là : un clic pose le son à la tête de lecture, sur la piste des sons qui
  convient ; un glisser le pose où l'on veut dans la frise ; le bouton rond l'écoute. Une page
  fixe devient une page vidéo.
- Un son de 20 s et plus se pose comme une musique : il couvre la page jusqu'au bout, répété
  s'il est trop court, avec un fondu de fin de 2 s. Un son plus court est un bruitage.
- Dans la frise, sous la principale : une piste par ligne de sons, la musique en vert, la voix
  en orange, les bruitages en indigo, avec leur forme d'onde (elle montre aussi le volume, les
  fondus et la musique qui baisse). Glisser, tirer un bord, Ctrl+B, Ctrl+D et Suppr comme pour
  les clips.
- Un son choisi : la barre du haut règle son rôle (musique, voix, bruitage), son volume, ses
  fondus, « Jusqu'à la fin » pour une musique, « Répéter » pour un bruitage (tirer ensuite son
  bord droit pour la durée voulue), et montre son crédit.
- La musique baisse toute seule quand un son au rôle Voix parle : elle garde 30 % de son
  volume (réglable), en commençant un peu avant la voix et en remontant un peu après.
- Le son d'une vidéo se détache (bulle Son, « Détacher le son », vitesse 1×) : il devient une
  voix sur une piste des sons, et la vidéo devient muette.
- Freesound, dans l'onglet Audio : bruitages (30 s au plus), musiques (20 s et plus) ou tout,
  cherchés en anglais de préférence. Seulement les sons CC0 (libres) et CC BY (citer
  l'auteur). Écouter un extrait, puis un clic télécharge le son, le range avec son crédit et
  sa licence et le pose. « Crédits des sons » prépare la liste à coller dans la description
  de la vidéo. Il faut la clé Freesound dans le `.env` (`FREESOUND_API_KEY=…`), lue côté Rust,
  jamais affichée.
- Jingles : rangés dans l'onglet Marque (ouverture et fin), posés d'un clic au début ou à la
  fin de la vidéo, depuis l'onglet Marque ou l'onglet Audio.
- Pixabay Musique, YouTube Audio Library, Free Music Archive : à télécharger sur leur site,
  puis « Importer un son » ; la licence de chaque titre est à vérifier.

**La voix (étape 4, lot 6)**
- Onglet Audio, « Ta voix », « Enregistrer au micro » : le micro s'ouvre (celui choisi dans
  les réglages d'Ubuntu, ou un autre dans la liste) et son niveau s'affiche ; la barre doit
  monter dans le vert en parlant, sans toucher le rouge.
- « Enregistrer » : un compte à rebours 3, 2, 1 en grand sur la page, puis la tête de lecture
  part et l'on parle en suivant la vidéo. Un témoin rouge et un clip rouge dans la frise
  montrent la prise. Espace (ou « Arrêter ») la finit, Échap l'abandonne. La prise se pose au
  rôle Voix, là où la tête était au top, et la musique baisse dessous. Le compte à rebours
  reste dans le fichier : tirer le bord gauche du clip le retrouve si l'on a parlé trop tôt.
  Prise suivante : la tête reste où la prise s'est arrêtée.
- Deux cases : « Couper le son du montage pendant la prise » (cochée d'office : sans casque,
  le micro entendrait la musique) et « Voix nette sur chaque prise » (cochée d'office).
- « Voix nette », dans la barre d'un son au rôle Voix : bruit de fond réduit (RNNoise), graves
  coupés sous 80 Hz, un peu de chaleur et de présence, compresseur, dé-esseur, voix calée sur
  -16 LUFS. L'original n'est jamais touché : Eliot prépare une version nettoyée à côté, que la
  fenêtre et l'export jouent (l'originale joue le temps qu'elle se prépare). Le bouton voisin
  ouvre les réglages un par un ; « Aucun nettoyage » revient à la voix telle qu'enregistrée.
  Une petite étoile sur le clip dit qu'il est nettoyé.
- « Voix de synthèse » : écrire un texte, choisir une voix et une vitesse, « Écouter », puis
  « Ajouter » le pose à la tête de lecture, au rôle Voix, calé sur -16 LUFS. Il faut Piper et au
  moins une voix (commandes 16 et 17 du `CLAUDE.md`, une fois). Les voix conseillées : siwis
  (une femme, CC BY 4.0) et upmc (Jessica et Pierre, CC BY-SA 4.0) ; la licence de la voix
  choisie part dans « Crédits des sons ». Les auteurs de Piper le destinent à un usage
  personnel, ce qui convient à Eliot tant qu'il reste un outil d'apprentissage.

**L'export en MP4 et en GIF (étape 4, lot 4)**
- Exporter, en haut à droite, sur une page vidéo : MP4 (vidéo avec le son) ou GIF (image
  animée, sans son). Le film entier de la page affichée, fait image par image par le noyau,
  depuis les originaux des photos et des vidéos ; une barre suit l'avancement, Annuler
  l'arrête sans rien laisser sur le disque.
- MP4 : « Pour » YouTube, Shorts, TikTok, Reels ou Autre règle l'encodage comme la plateforme
  le recommande (H.264, son AAC 48 kHz, débit, images clés), avec la définition (1080p ou
  720p) et la cadence (24 à 60 images par seconde). La fenêtre prévient si la page n'a pas les
  proportions attendues (16:9 pour YouTube, 9:16 pour les autres) ou dure trop longtemps.
- Le son du MP4 : les vidéos et les sons de la page, mixés par le noyau. « Caler le niveau
  sonore » (coché d'office) le monte ou le baisse jusqu'à -14 LUFS, le niveau des plateformes,
  sans dépasser -1 dBTP en crête. « Aussi une version sans musique » écrit à côté un second
  film, `…_sans-musique.mp4`, avec la voix et les bruitages : pour ajouter le son tendance de
  TikTok ou d'Instagram au moment de publier.
- GIF : largeur (320, 480 ou 640 px) et cadence (10, 15 ou 20 images par seconde), en boucle.
- Le film ressemble à l'écran au pixel près : les mêmes formules d'animation, les mêmes
  polices, le même dessin des textes et des formes.
- Zones sûres, dans la barre de la frise (page verticale 9:16) : TikTok, Reels ou Shorts
  teintent en rouge les bandes où l'application pose ses boutons, le nom du compte et la
  légende ; le cadre pointillé est la zone sûre pour les textes. Un calque d'aide seulement :
  il ne passe jamais dans l'export.

**Laisser une IA piloter Eliot**
- Fichier, « Réglages et pont IA… » : un interrupteur ouvre le pont. Une IA comme Claude peut
  alors lire le design, poser et modifier des objets, gérer les pages, importer une image du
  poste, chercher et poser des photos de Pixabay, importer ou chercher des vidéos et les poser
  (coupe, vitesse, volume), monter une page vidéo (temps et pistes des clips, scinder,
  tête de lecture, capture à un instant), animer (entrées, sorties, boucles, images clés,
  transitions, styles de texte pour la vidéo), importer, chercher (Freesound) et poser des
  sons, les régler, nettoyer une voix, faire dire un texte par une voix de synthèse, détacher
  le son d'une vidéo, se servir du kit de marque, dessiner à main
  levée, poser des graphiques et des tableaux, partir d'un modèle de départ, regarder une
  capture de la page et exporter (en image, ou en MP4 et en GIF pour une page vidéo, avec la
  version sans musique). On la
  voit travailler dans la fenêtre,
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
| Espace (appui bref, page vidéo) | lire, mettre en pause |
| Ctrl+B (page vidéo) | scinder à la tête de lecture |
| Espace, Échap (pendant une prise de voix) | finir la prise, l'abandonner |
| ←, → sans sélection (Maj : d'une seconde), Début, Fin | tête de lecture d'une image, au début, à la fin |
| F11 | aperçu en plein écran |
| Maj+clic, rectangle tracé à la souris | sélection de plusieurs objets |
| Alt+clic | un seul objet d'un groupe |

## Où vont les fichiers

- Designs : `~/Documents/Eliot/Designs/<nom du design>/`, un dossier par design :
  `document.json` (le document), `document.precedent.json` (la version d'avant, en secours),
  `miniature.png` (pour l'accueil) et `ressources/` (originaux, aperçus et miniatures des
  images ; pour les vidéos, aussi `copies/`, `vignettes/` et `ondes/` ; pour les sons,
  `copies/` et `ondes/` ; pour les voix nettoyées, `traitees/`, refait au besoin). Le dossier
  se copie tel quel d'une machine à l'autre ; le fichier `.eliot` en est une archive zip (sans
  `traitees/`).
- Les prises de voix : rangées dans le design comme les sons importés (`Prise 1`, `Prise 2`, et ainsi de suite).
- Les voix de Piper : `Eliot/telechargements/voix/` (commande 17), hors git ; les textes dits,
  en cache dans `~/.cache/fr.alexandredo.eliot/piper/`.
- Modèles maison : `~/Documents/Eliot/Modèles/`.
- Exports : `~/Images/Eliot/AAAA-MM-JJ_HHMMSS_eliot.png` (ou `.jpg`, avec `_page-01`… pour
  plusieurs pages), jamais d'écrasement. Les films : `~/Vidéos/Eliot/AAAA-MM-JJ_HHMMSS_eliot.mp4`
  (ou `.gif`), écrits sous un nom provisoire puis renommés une fois finis ; la version sans
  musique à côté, `…_sans-musique.mp4`.
- Un design supprimé part dans la corbeille d'Ubuntu.

## Plan du code

```
01_application/
├── noyau/            Rust sans Tauri : images, vidéos (videos.rs), sons (sons.rs, son.rs), la voix (micro.rs, voix.rs, piper.rs), designs (projet.rs), exports, export vidéo (montage.rs, animation.rs), polices, Pixabay, Freesound (freesound.rs), kit de marque (cargo test)
├── src-tauri/        la fenêtre, les commandes de l'interface (src/commandes.rs), le pont IA (src/ia.rs)
├── eliot-mcp/        le programme que lance l'application Claude pour piloter Eliot (MCP)
├── public/bibliotheque/  icônes, emojis, polices, personnages : fabriqués par npm run bibliotheque, hors git
├── src/
│   ├── App.tsx       l'accueil ou l'éditeur
│   ├── bibliotheque/ catalogue des polices, associations, mots français, recherche, rendu des icônes et des personnages
│   ├── accueil/      l'accueil : formats, designs, modèles
│   ├── modele/       le document (types.ts), la fabrication des objets, la géométrie, les personnages composés, les règles de la frise (frise.ts), les animations (animation.ts), les sons (son.ts) et le nettoyage de la voix (voix.ts), avec leurs tableaux de valeurs attendues communs avec le Rust, les styles de texte pour la vidéo, les zones sûres (zonesSures.ts)
│   ├── modeles/      les modèles de départ, dessinés pour Eliot
│   ├── etat/         le store, l'enregistrement automatique, les opérations sur les designs, la prise de voix (prise.ts), les voix nettoyées (nettoyage.ts)
│   ├── pont/         le seul fichier qui parle à Tauri (repli navigateur pour les tests)
│   ├── editeur/      la zone de travail Konva, les barres, les panneaux, les pages, la lecture des vidéos (videos.ts) et des sons (sons.ts), la frise (frise/)
│   ├── export/       rendu d'une page hors écran, export en image ; export vidéo : la page décrite en calques SVG pour le noyau (calques.ts, contexteSvg.ts), réglages par plateforme (plateformes.ts)
│   ├── ia/           les outils offerts à l'IA (outils.json, outils.ts) et leur pilote
│   └── reglages/     la fenêtre des réglages
└── outils/           fabrication de la bibliothèque (personnages : personnages.mjs), dessin de l'icône, prototype du texte animé
```

Le document est un objet JSON, seule source de vérité ; Konva ne fait que le dessiner. Pendant
un geste, les objets saisis passent sur un calque à part et reviennent à leur place dans la
pile avant l'écriture dans le document (règle 11). Tests de l'interface : `npm test`.

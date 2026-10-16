# PLAN.md — Eliot

Plan vivant, source de vérité de l'avancement. Version du 2026-10-16, alignée sur le
`BRIEF.md` (révision 7, validée le 2026-10-14 ; la révision 5 ajoute la bibliothèque, le
labo photo, le mode vidéo façon CapCut, le pont vers une IA, et renumérote les étapes 2 à 6 ;
la révision 6 met Pixabay avant Pexels ; la révision 7 ajoute la création de contenu pour
YouTube, TikTok et Instagram et fait passer la vidéo avant le labo photo).

## Étape 0. Banc d'essai (ouverte le 2026-10-14, poste principal fait le 2026-10-14)

Résultat visible attendu : deux fichiers de résultats (fenêtre Tauri et Chrome) sur le poste
principal, lus par Claude, et la décision Tauri ou Electron inscrite au JOURNAL.

- [x] Écrire le banc d'essai (`00_banc_essai/`) et le vérifier dans le conteneur de Claude
- [x] Installer les prérequis sur le poste principal (commandes dans `CLAUDE.md`)
- [x] Générer les fichiers de test sur le poste (commande 4 bis)
- [x] Compiler le banc (processeur seulement, pas de carte graphique)
- [x] Première série dans la fenêtre Tauri (2026-10-14, sans les fichiers de test)
- [x] Variantes de montage du glisser ajoutées au banc
- [x] Seconde série complète dans la fenêtre Tauri, avec les variantes (2026-10-14)
- [x] Même série dans le navigateur intégré de Claude, Chrome 152 (2026-10-14)
- [x] Claude lit les résultats (JOURNAL du 2026-10-14) ; règle 11 ajoutée au BRIEF
- [x] Alexandre tranche : démarrer sur Tauri, Electron en repli (2026-10-14)
- [x] Alexandre valide le BRIEF (2026-10-14)
- [ ] Mini PC : même série, quand il sera disponible ; décision définitive Tauri ou Electron avant l'étape 4 (vidéo)
- [ ] Comprendre la lecture au ralenti de la vidéo H.264 dans Tauri (avant l'étape 4)

## Étape 1. L'éditeur (ouverte le 2026-10-14, livrée sur le poste le 2026-10-14)

Résultat visible attendu : Eliot s'ouvre sur le poste, on compose une page avec des textes,
des formes et des images importées, on la manipule à la souris comme dans Canva et on
l'exporte en PNG ou JPEG dans `~/Images/Eliot/`. Détail : `BRIEF.md` § 6 et § 7.

- [x] Squelette `01_application/` : Tauri 2.12, React 19, Vite 8, Tailwind 4, Konva 10 et
      react-konva, zustand ; noyau Rust `noyau/` sans dépendance à Tauri
- [x] Modèle de document versionné, fabriques d'éléments, store avec historique
- [x] Zone de travail : page à l'échelle, quatre calques, sélection (clic, Maj+clic,
      rectangle), poignées selon le type, calque de geste (règle 11), étiquette de taille et
      d'angle
- [x] Repères magnétiques (bords et centres de la page et des objets)
- [x] Textes : titre, sous-titre, paragraphe, édition en place, polices libres embarquées
- [x] Formes : rectangle, rectangle arrondi, cercle, triangle, étoile
- [x] Images : import par le noyau Rust (décodage, orientation, empreinte, aperçu,
      miniature), panneau des images importées
- [x] Barre contextuelle (texte, forme, image, page), mini-barre flottante, menu au clic
      droit, ordre d'empilement, dupliquer, supprimer, copier-coller, raccourcis clavier
- [x] Export PNG (fond transparent possible) et JPEG, x1 ou x2, dans `~/Images/Eliot/` ou
      « Enregistrer sous », écrit par le noyau Rust ; « Afficher dans le dossier »
- [x] Vérification : tests Rust, compilation, essai complet dans le conteneur de Claude
      (2026-10-14, chiffres au JOURNAL)
- [x] Essai par Alexandre sur le poste (« Pour tous tes points, c'est bon », 2026-10-14)
- [x] Alexandre valide la révision 5 du `BRIEF.md` (2026-10-14)

## Étape 2. Les projets et l'édition complète (ouverte le 2026-10-14)

Résultat visible attendu : Eliot s'ouvre sur un accueil qui liste les designs ; un design
s'enregistre tout seul, se rouvre, se renomme, se duplique, part à la corbeille, voyage dans
un fichier `.eliot` ; il a plusieurs pages ; on zoome, on colle une capture, on dépose une
photo, on groupe, on aligne, on pose un dégradé ; puis Claude pilote Eliot par MCP.
Détail : `BRIEF.md` § 6 et § 7.

Choix par défaut de Claude, modifiables sur simple demande :

- Designs dans `~/Documents/Eliot/Designs/`, un dossier par design au nom du design (suffixe
  `_2` en cas de doublon, renommé avec lui) ; modèles maison dans `~/Documents/Eliot/Modèles/`.
- Dans ce dossier : `document.json`, `document.precedent.json` (la version d'avant, en
  secours), `miniature.png` (pour l'accueil) et `ressources/` (originaux, aperçus et
  miniatures des images du design). Il se copie tel quel d'une machine à l'autre.
- Enregistrement automatique une seconde après la dernière modification, et à la fermeture
  de la fenêtre ; son état s'affiche à côté du nom.
- Fichier `.eliot` : le dossier du design en archive zip, pour le transporter ; à l'import,
  le noyau vérifie chaque chemin de l'archive.
- Un design supprimé part dans la corbeille du système, d'où on peut le récupérer.
- Document version 2 : nom, format, pages. Le noyau convertit un document de version 1.
- Grouper : les objets d'un groupe portent la même étiquette ; un clic sur l'un sélectionne
  tout le groupe, Alt + clic un seul objet.
- Tests : vitest pour la logique de l'interface (store, conversions, géométrie), en plus des
  tests Rust et du script Playwright.

- [x] Noyau `projet.rs` : créer, lister, ouvrir (avec conversion), enregistrer, renommer,
      dupliquer, corbeille, miniature, archive `.eliot`, modèles maison ; tests
- [x] Commandes Tauri et pont ; images rangées dans le dossier du design
- [x] Document version 2 dans l'interface, store par page
- [x] Accueil : créer un design (formats, taille libre), designs récents, modèles maison,
      ouvrir un `.eliot`
- [x] Barre du haut : accueil, menu Fichier, nom modifiable, état de l'enregistrement
- [x] Enregistrement automatique, et à la fermeture
- [x] Plusieurs pages : barre du bas avec vignettes, ajouter, dupliquer, supprimer,
      réordonner, vue en grille
- [x] Zoom (curseur, Ctrl + molette, Ajuster), défilement, aperçu plein écran
- [x] Redimensionner (ce design ou une copie)
- [x] Coller une image, déposer un fichier, glisser depuis le panneau
- [x] Grouper et dégrouper, aligner et répartir, copier le style
- [x] Dégradés : formes, textes, fond de page
- [x] Vérification : tests Rust et vitest, Playwright, essai Tauri sur écran virtuel
      (2026-10-14, chiffres au JOURNAL)
- [x] Livraison sur le poste (2026-10-14)
- [ ] Essai par Alexandre (commandes 8 à 10 du `CLAUDE.md`)
- [x] Pont IA : programme `eliot-mcp`, 22 outils calqués sur le store, capture de la page,
      réglage pour l'activer ; vérifié de bout en bout dans le conteneur (2026-10-14)
- [x] Alexandre compile `eliot-mcp` et le déclare dans le fichier de l'application Claude
      (2026-10-14) ; le paquet non officiel ne le charge pas
- [x] Extension `.mcpb` en secours (`eliot-mcp/emballer_mcpb.py`, commande 15 bis) ;
      installée, elle se charge, mais ne trouvait pas Eliot (environnement réduit) : pont
      corrigé le 2026-10-14, à recompiler et réemballer
- [x] Pont IA : l'application Claude charge `eliot` par l'extension ; depuis une session liée
      au poste, Claude liste les designs, en ouvre un et en prend une capture (2026-10-14)
- [ ] Premier vrai design composé par Claude dans Eliot, sous les yeux d'Alexandre

## Étape 3. La bibliothèque et la mise en forme publicitaire (ouverte le 2026-10-14)

Résultat visible attendu : le rail de Canva au complet (Modèles, Éléments, Texte, Photos,
Importer, Marque, Dessin, Calques), une recherche par mot en français dans chaque panneau,
des milliers d'icônes et d'emojis, une centaine de polices, des photos Pixabay, des cadres,
des maquettes d'appareils, des graphiques ; pour finir, une quarantaine de modèles de départ ;
et Claude peut se servir de tout cela par le pont. Détail : `BRIEF.md` § 6 et § 7.

Choix par défaut de Claude, modifiables sur simple demande :

- La bibliothèque se fabrique sur le poste par une commande (`npm run bibliotheque`), à
  partir de paquets npm à version fixe et des polices de Google Fonts (fichiers TTF, chacun
  contrôlé par son empreinte SHA-256). Elle va dans `01_application/public/bibliotheque/`,
  hors git ; les licences sont recopiées dans `01_application/LICENCES-TIERS.md`.
- Icônes : Tabler 3.49.0 (5 184 au trait, 1 054 pleines) et Phosphor 2.1.1 (1 512, en six
  épaisseurs). Emojis : Fluent Emoji de Microsoft en version plate (paquet
  `@iconify-json/fluent-emoji-flat` 1.2.6, MIT ; la version en relief pèse 103 Mo, écartée)
  et OpenMoji 17.0.0 (CC-BY-SA, crédit affiché dans le panneau). Noms français des emojis
  tirés du CLDR 48.2 (Unicode) ; pour les icônes, un dictionnaire de mots français vers les
  mots-clés anglais des paquets.
- Polices : une centaine de familles libres (OFL) choisies pour la publicité, rangées par
  genre (sans empattement, impact, avec empattement, manuscrite, à chasse fixe), avec une
  ligne « à quoi elle sert » ; une vingtaine d'associations titre et texte ; les polices du
  poste listées par le Rust et copiées dans le design qui s'en sert.
- Document version 3 : nouveaux types `icone`, `emoji`, `cadre`, `maquette`, `dessin`,
  `graphique`, `tableau`, `qr`, `personnage` ; lignes, flèches et polygones rejoignent les formes ; ombre
  sur tous les éléments ; contour, surlignage, majuscules et barré pour les textes. Le noyau
  convertit un document de version 2 sans rien changer d'autre que le numéro.
- Icônes et emojis restent vectoriels dans le document (collection et nom) ; l'écran et
  l'export les dessinent à la taille voulue.
- Photos Pixabay : la recherche, les aperçus et le téléchargement passent par le Rust, qui lit
  la clé dans le `.env` ; résultats gardés 24 h ; la photo choisie est copiée dans le design
  avec le nom et le lien de son auteur. Recherche de vidéos Pixabay : avec l'étape 4, quand
  Eliot saura poser une vidéo. Pexels : même panneau, dès qu'une clé existera.
- Kit de marque : un seul kit, dans `~/Documents/Eliot/Marque/` (couleurs, polices du titre et
  du texte, logos), proposé partout où l'on choisit une couleur ou une police.
- Personnages : Open Peeps et Humaaans ne se téléchargent que depuis leurs sites, à la main.
  Alexandre range les deux archives .zip dans `Eliot/telechargements/` (hors git) ;
  `npm run bibliotheque` les lit telles quelles et en tire les personnages tout faits et les
  pièces détachées d'un composeur (posture, tenue, coiffure, visage, barbe, lunettes).

- [x] Fabrication de la bibliothèque, licences, document version 3 (lot 1, 2026-10-14)
- [x] Panneau Éléments : formes, lignes et flèches, icônes, emojis, QR code, recherche (lot 1)
- [x] Texte : polices et associations, effets (ombre, contour, surlignage), polices du poste (lot 1)
- [x] Ombre portée (lot 1), cadres (une photo dans une forme), grilles photo, maquettes
      d'appareils (lot 2, 2026-10-14)
- [x] Photos Pixabay (noyau Rust), kit de marque (lot 3, 2026-10-14 ; la vraie recherche reste
      à essayer sur le poste)
- [x] Dessin à main levée, graphiques, tableaux (lot 4, 2026-10-14)
- [x] Outils du pont IA pour tout ce qui précède (lot 1 : chercher_bibliotheque, ajouter_icone,
      ajouter_emoji, ajouter_qr, lister_polices, effets par modifier ; lot 2 : ajouter_cadre,
      ajouter_grille, ajouter_maquette, remplir_photo ; lot 3 : chercher_photos,
      ajouter_photo_pixabay, marque, modifier_marque, ajouter_logo ; lot 4 : dessiner,
      ajouter_graphique, ajouter_tableau ; lot 5 : lister_modeles_depart, utiliser_modele_depart ;
      lot 6 : lister_personnages, ajouter_personnage)
- [x] Une quarantaine de modèles de départ (lot 5, 2026-10-14 : 42, tous les formats)
- [x] Personnages (lot 6, 2026-10-14 : 189 Open Peeps et 32 Humaaans tout faits, 4 décors,
      composeur à 207 pièces, couleurs par partie ou couleur par couleur)
- [x] Vérification : tests Rust et vitest, Playwright, essai Tauri sur écran virtuel (fin du
      lot 6, 2026-10-14 : tout repassé, détail au JOURNAL)
- [ ] Livraison sur le poste, puis essai par Alexandre

## Étape 4. La vidéo façon CapCut (ouverte le 2026-10-15)

Résultat visible attendu : la bascule Vidéo ouvre une frise à pistes sous la page ; on y pose
des vidéos, des photos, des textes animés, de la musique, des bruitages et sa propre voix
nettoyée ; on coupe, on scinde, on anime, on sous-titre mot par mot ; on exporte un MP4 ou un
GIF réglé pour YouTube, Shorts, TikTok ou Reels. Claude peut tout faire par le pont. Détail :
`BRIEF.md` § 6 (« Ce que Eliot reprend de CapCut », « Le son ») et § 7. Clé Freesound dans le
`.env` depuis le 2026-10-15 (essai de recherche réussi, clé jamais affichée).

Choix par défaut de Claude, modifiables sur simple demande :

- Enveloppe : Tauri reste. Le banc du lot 0 a trouvé sur le poste principal des copies qui
  jouent sans à-coup dans la fenêtre, même à deux et dans la page redessinée ; le repli
  Electron n'est pas nécessaire. Le mini PC confirmera quand il sera là.
- Copies d'aperçu : la fenêtre ne lit jamais l'original d'une vidéo (règle 5). À l'import, le
  Rust fait fabriquer par `ffmpeg` (celui du système, commande 2 du `CLAUDE.md`, processeur
  seulement) une copie légère, avec une image clé toutes les demi-secondes pour que la tête de
  lecture réponde vite, plus les vignettes de la frise et la forme d'onde du son. Format
  choisi par le banc du lot 0 : VP9, 720 px sur le petit côté (540 en réglage pour une
  machine modeste). L'original ne sert qu'à l'export.
- Document version 4, comme au § 6 du BRIEF : une page qui a une `duree` (millisecondes) est
  une vidéo ; ses éléments portent `temps` (début, fin) et `piste` ; un clip vidéo porte
  `coupe`, `vitesse`, `volume` ; les sons vont dans `audio` avec leur rôle (musique, voix,
  bruitage) et leurs traitements. Tous les nouveaux champs sont facultatifs : le noyau
  convertit un document de version 3 en ne changeant que le numéro.
- Export : l'interface décrit chaque calque en SVG (les textes avec leurs coupures de lignes,
  les mêmes fichiers de police), le Rust le rend avec `resvg`, le pose sur les images de la
  vidéo décodées par `ffmpeg` depuis les originaux, mixe le son, et `ffmpeg` encode en H.264
  sur le processeur (jamais l'encodeur de la carte graphique, règle 9). Les animations sont
  calculées par les mêmes formules en TypeScript et en Rust, vérifiées par un tableau de
  valeurs attendues commun. Ce SVG servira aussi à l'étape 5 (SVG, PDF vectoriel, PNG haute
  définition).
- Son : traitements calculés une fois et gardés en cache : réduction du bruit par RNNoise
  dans le noyau, coupe des graves, égaliseur, compresseur et dé-esseur par les filtres de
  `ffmpeg`, niveau EBU R128 mesuré par `ebur128` (lots 5 et 6, JOURNAL). Micro lu par
  `ffmpeg`, lancé par le noyau (lot 6).
- Sous-titres : Whisper sur le processeur (`whisper-ctranslate2`, programme installé par
  Alexandre ; modèle `faster-whisper-small` téléchargé une fois, comme les archives des
  personnages) ; voix de synthèse : Piper, même principe (lots 6 et 7, commandes 16 à 19).
  La coupe des silences et des hésitations se fait en morceaux visibles dans la frise (lot 7,
  JOURNAL).

- [x] Lot 0 : banc des copies d'aperçu dans `00_banc_essai/` (VP9, VP8 et H.264, en 1080p,
      720p et 540p, une image clé par demi-seconde) : lecture sur un calque à part avec la
      page de 200 objets, deux vidéos à la fois, temps de saut de la tête de lecture, durée de
      fabrication et poids de chaque copie. Série d'Alexandre sur le poste le 2026-10-15
      (`00_banc_essai/resultats/2026-10-15_081343_tauri-webkitgtk_copies.json`) : tout est
      fluide, VP9 en 720 retenu pour sa tête de lecture (saut de 8 ms, glisser à pleine
      cadence), Tauri confirmé. Détail au `JOURNAL.md`.
- [x] Lot 1 : la vidéo dans le design : import (glisser, Importer, vidéos Pixabay), copie
      d'aperçu, vignettes, forme d'onde ; élément vidéo qui joue sur son calque ; post animé ;
      document version 4. Livré le 2026-10-15 : noyau `videos.rs` (copie VP9 en 720, image
      clé par demi-seconde, couverture, vignettes, onde), vidéos Pixabay en 1080p, élément
      `video` (coupe, vitesse, volume, retournement, coins, bordure), lecture dans la page,
      barre Lire, Son, Vitesse, Couper, aperçu plein écran qui joue, quatre outils pour le
      pont IA (47 en tout), archive `.eliot` écrite sans passer par la mémoire. Vérifié :
      noyau 42, interface 66, Chromium (vidéo 40, suites des étapes 2 et 3), Tauri par le pont
      (vidéo 25 dont la lecture à l'écran, suites 3a à 3f). Reste l'essai d'Alexandre.
- [x] Lot 2 : la frise : bascule Vidéo, règle, tête de lecture, lecture et pause, zoom, pistes
      (principale bout à bout, superpositions, son), clips avec vignettes et formes d'onde,
      couper, déplacer, changer de piste, scinder (Ctrl+B), dupliquer, supprimer, aimantation.
      Livré le 2026-10-15 : règles de la frise en fonctions pures (`modele/frise.ts`, 18
      essais), tête de lecture et horloge, page montrée à l'instant de la tête, vidéos
      calées sur la tête, frise à pistes avec gestes à la souris, rendu et export d'un instant
      avec l'image exacte des vidéos (tirée par le Rust), trois outils de plus pour le pont IA
      (50 en tout). Les pistes de son viennent avec les sons (lot 5) ; d'ici là, le son d'une
      vidéo se voit dans son clip. Vérifié : noyau 42, interface 84, Chromium (frise 38, vidéo
      41, suites des étapes 2 et 3), Tauri par le pont (frise 21 dont la lecture et les
      vignettes à l'écran, vidéo 25, suites 3a à 3f). Reste l'essai d'Alexandre.
- [x] Lot 3 : l'animation : textes animés (entrée, sortie, boucle), styles de texte vidéo,
      images clés, transitions entre clips, vitesse, fondus, texte qui entre par lignes.
      Livré le 2026-10-15 : formules en fonctions pures (`modele/animation.ts`) et tableau de
      valeurs attendues commun avec le Rust du lot 4 (`animation.attendus.json`, 550 cas) ;
      bouton Animer (15 entrées, 15 sorties dont 4 par morceaux de texte, 8 boucles, aperçu au
      survol) ; zones des animations dans la frise, dont on tire le bord ; images clés (losange
      de la frise, gestes sur la page, clé précédente et suivante) ; transitions entre deux
      clips de la piste principale (bouton entre les clips, chevauchement) ; fondus du son ;
      8 styles de texte pour la vidéo ; trois outils de plus pour le pont IA (53 en tout). La
      vitesse d'un clip était déjà là (lot 1). Vérifié : interface 103, Chromium (animation
      44, suites d'avant), Tauri par le pont (animation 16 dont la lecture à l'écran, suites
      d'avant). Reste l'essai d'Alexandre.
- [x] Lot 4 : l'export MP4 et GIF par le Rust (calques en SVG, `resvg`, `ffmpeg`), barre de
      progression et annulation, réglages par plateforme (valeurs vérifiées le jour même),
      zones sûres TikTok, Reels et Shorts, comparaison au pixel entre l'écran et l'export.
      Livré le 2026-10-15 : la page décrite en calques SVG par Konva lui-même
      (`export/contexteSvg.ts`, `calques.ts`), rendue par `resvg` et composée image par image
      par le noyau (`montage.rs`, formules d'`animation.rs` contrôlées par le tableau commun) ;
      photos et vidéos depuis les originaux ; son mixé (volumes, fondus, transitions,
      vitesse) ; H.264 et AAC, ou GIF à palette ; fenêtre de suivi avec Annuler ; réglages
      YouTube, Shorts, TikTok, Reels (sources dans le JOURNAL) ; zones sûres dans la frise ;
      `exporter` du pont IA en MP4 et GIF. Comparaison au pixel : écart moyen 0,4 sur 255
      (noyau et écran), 0,9 à 1,9 (film H.264 et capture). Correction : les polices variables
      (Inter…) se chargent enfin avec `npm run tauri dev`. Vérifié : noyau 50, interface 121,
      Chromium (export 18, suites d'avant), Tauri (export 21, suites d'avant). Reste l'essai
      d'Alexandre.
- [x] Lot 5 : le son : onglet Audio, sons importés, Freesound (CC0 et CC BY seulement, crédits
      gardés et liste à coller), musique et bruitages, volume et fondus, musique qui baisse
      sous la voix, musique répétée jusqu'à la fin, jingles du kit de marque, niveau sonore
      par plateforme, export sans musique.
      Livré le 2026-10-15 : sons importés par le noyau (`sons.rs` : copie d'écoute Opus,
      forme d'onde, niveau EBU R128), formules du son en TypeScript et en Rust contrôlées par
      un tableau commun (`son.attendus.json`, 60 cas), pistes des sons dans la frise (gestes,
      Ctrl+B, Ctrl+D, Suppr), barre de réglages d'un son, lecture qui suit la tête, musique
      qui baisse sous la voix, détacher le son d'une vidéo, onglet Audio (sons du design,
      Freesound par le Rust, jingles, crédits à copier), jingles d'ouverture et de fin dans le
      kit de marque, export calé sur -14 LUFS (crête -1 dBTP) et version sans musique, quatre
      outils de plus pour le pont IA (57 en tout). Vérifié : noyau 62, interface 142, Chromium
      (son 44, suites d'avant), Tauri (son 26 dont la lecture dans WebKit enregistrée, suites
      d'avant). Reste l'essai d'Alexandre.
- [x] Lot 6 : la voix : enregistrement au micro par prises, nettoyage (« Voix nette »), voix
      de synthèse Piper.
      Livré le 2026-10-15 : micro lu par `ffmpeg` dans le noyau (`micro.rs` : niveau, prise en
      WAV, top), prise par prise dans l'onglet Audio (compte à rebours, tête qui part, témoin
      et clip rouges, Espace, Échap, son du montage coupé), nettoyage en valeurs du document
      (`voix.rs` : RNNoise, graves, chaleur, présence, compresseur, dé-esseur, niveau à -16
      LUFS ; version nettoyée en cache, jouée par la fenêtre et l'export), « Voix nette » et
      réglages un par un dans la barre d'une voix, voix de synthèse Piper (`piper.rs`, voix
      siwis et upmc, licence dans les crédits), un outil de plus pour le pont IA (58 en tout).
      Vérifié : noyau 74, interface 148, Chromium (voix 37, suites de l'étape 4), Tauri (voix
      20 dont une prise au micro d'essai et la lecture enregistrée, suites de l'étape 4). Reste
      l'essai d'Alexandre (commandes 16 et 17 une fois, pour Piper).
- [x] Lot 7 : les sous-titres : Whisper, sous-titres mot par mot (le mot prononcé mis en
      valeur), coupe des silences et des hésitations.
      Livré le 2026-10-15 : analyse de la parole par le noyau (`parole.rs` : où l'on parle,
      niveau toutes les 10 ms), transcription par Whisper sur le processeur (programme
      `whisper-ctranslate2`, modèle small, mots recalés sur la voix, gardée dans le design),
      « Blancs » dans la barre d'une vidéo ou d'un son (aperçu, blancs et « euh » coupés en
      morceaux qui se suivent, son détaché coupé avec sa vidéo), sous-titres automatiques dans
      l'onglet Texte (quatre styles, mot prononcé en couleur et agrandi, ou mots qui
      apparaissent, réglages communs, refaits après une coupe), le mot prononcé à l'export
      (`sous_titres.rs`, tableau commun de 264 cas), une seule balise vidéo par fichier dans
      la fenêtre, trois outils de plus pour le pont IA (61 en tout). Vérifié : noyau 83,
      interface 170, Chromium (sous-titres 44, suites d'avant), Tauri (sous-titres 17 dont
      le vrai Whisper, le film et la lecture enregistrée, suites de l'étape 4). Reste l'essai
      d'Alexandre (commandes 18 et 19 une fois, pour Whisper).
- [x] Outils du pont IA pour tout ce qui précède, au fil des lots (lot 1 : importer_video,
      ajouter_video, chercher_videos, ajouter_video_pixabay ; lot 2 : page_video, aller_a,
      scinder ; lot 3 : animer, images_cles, transition ; lot 4 : exporter en MP4 et GIF ;
      lot 5 : importer_son, chercher_sons, ajouter_son, regler_son ; lot 6 : voix_de_synthese ;
      lot 7 : transcrire, sous_titres, couper_blancs). Vérifié le 2026-10-15 par un montage
      complet fait par le pont dans Tauri (JOURNAL).
- [x] Vérification de l'étape (2026-10-15) : relecture contre le BRIEF, un manque comblé
      (une animation posée sur une image fixe en fait un post animé, à la souris comme par le
      pont), un défaut corrigé (un document modifié pendant `npm run tauri dev` rechargeait la
      fenêtre), montage complet par le pont dans Tauri, suites touchées repassées, `npm run
      build`. Détail au JOURNAL. Livrée sur le poste.
- [ ] Essai par Alexandre : le parcours « Essayer la vidéo (étape 4) » du
      `01_application/LISEZMOI.md` (avant, une fois : commandes 16 à 19 du `CLAUDE.md`).
- [ ] Plus tard, si utile : l'original d'un son Freesound par la connexion au compte (OAuth2,
      BRIEF § 6) ; d'ici là, Eliot prend l'extrait de bonne qualité (environ 192 kbit/s).

## Étape 5. Le labo photo et les exports de qualité (ouverte le 2026-10-16)

Résultat visible attendu : une photo ou un clip choisi montre « Retoucher » ; le panneau du labo
s'ouvre à gauche (lumière, couleur, effets, détail, histogramme, préréglages, recadrage et
horizon) et la page suit les curseurs en direct ; un visuel se pose en perspective sur un écran
ou une boîte ; le fond d'une photo de produit s'efface sur le processeur ; l'export sort, depuis
le document et les originaux, un PNG haute définition (une affiche A4 à 300 dpi), un JPEG, un
WebP, un PDF vectoriel de toutes les pages ou un SVG. Claude peut tout faire par le pont.
Détail : `BRIEF.md` § 6 (« Ce que Eliot reprend de Lightroom », « Ce que demandent la publicité
et les maquettes de produits », « L'export, de bout en bout ») et § 7.

Choix par défaut de Claude, modifiables sur simple demande :

- Aperçu en direct : le shader WebGL, décidé le 2026-10-16 par le banc du lot 0 (JOURNAL). La
  voie (Rust en direct ou shader WebGL) se choisissait par ce banc, comme le BRIEF le prévoit.
  Règle de décision écrite avant la mesure : le shader l'emporte s'il tient 55 images par
  seconde sur la photo et sur une vidéo qui joue, et si son rendu s'écarte de celui du Rust de 2
  sur 255 au plus en moyenne ; le Rust en direct l'emporte s'il tient 30 images par seconde à la
  taille de l'écran avec moins de 50 ms entre le curseur et l'image. Si les deux passent, le
  shader, parce qu'il vaut aussi pour les clips qui jouent. Le mini PC confirmera quand il sera
  là.
- Réglages : des valeurs du document (`reglages`, seulement les curseurs différents de zéro,
  même champ pour une photo et un clip, règle 13). Le noyau les calcule en lumière linéaire,
  dans l'ordre fixe du BRIEF : balance des blancs, exposition, tonalités, courbe, couleurs
  (l'étalonnage en dernier), détail, effets. Les mêmes formules en TypeScript (ou GLSL) et en Rust sont contrôlées par un
  tableau de valeurs attendues commun, comme pour l'animation et le son.
- Préréglages : un préréglage est un style. Il ne touche ni à l'exposition, ni à la netteté, ni
  à la réduction du bruit, propres à chaque photo ; l'appliquer remplace le reste de la
  retouche ; son intensité (de 0 à 100 %) rapproche chaque valeur de zéro. Ceux d'Alexandre
  sont rangés hors des designs, dans `~/Documents/Eliot/Préréglages/`. Copier et coller les
  réglages, au contraire, emporte tout, exposition comprise (des photos d'une même série).
- Exports : le noyau rend la page depuis la description en calques de l'étape 4 (les mêmes
  SVG, les mêmes polices, les originaux des photos) avec `resvg` ; PDF vectoriel par `krilla`
  et `krilla-svg` 0.8 (MIT ou Apache-2.0, des auteurs de `svg2pdf` chez Typst, qui en
  reprennent le travail ; `svg2pdf` 0.13, prévu d'abord, tient à `resvg` 0.45 et ne fait
  qu'une page par fichier, JOURNAL du 2026-10-16) ; WebP par le `ffmpeg` du système (encodeur
  libwebp, déjà là) ; SVG avec ses images dedans et ses textes en tracés (il s'ouvre sans les
  polices). L'export par la fenêtre (aperçus de 2560 px) laisse la place au rendu du noyau,
  comparé au pixel avant de s'y fier ; il reste hors de l'application, pour le PNG et le
  JPEG.
- Détourage : un modèle d'IA sur le processeur, lancé comme Whisper (programme installé par
  Alexandre, modèle téléchargé une fois dans `telechargements/`), choisi au lot 7 d'après sa
  licence (libre pour un usage commercial de préférence) et sa qualité sur des photos de
  produits. Retenu au lot 7 : BiRefNet (MIT), converti sur le poste avec la DeformConv native
  (JOURNAL du 2026-10-16).

- [x] Lot 0 : banc de l'aperçu en direct dans `00_banc_essai/` (bouton « Labo photo (étape
      5) ») : Rust en direct à 1280, 1920 et 2560 px (pixels bruts par l'IPC binaire de
      Tauri) ; shader WebGL sur la photo dessinée dans Konva, puis posée sur la page, puis sur
      une vidéo qui joue ; écart entre les deux rendus ; coût des réglages qui regardent les
      pixels voisins (clarté, texture, netteté, bruit, voile) sur l'aperçu de 2560 px et sur
      l'original de 24 Mpx. Série d'Alexandre sur le poste le 2026-10-16
      (`00_banc_essai/resultats/2026-10-16_091151_tauri-webkitgtk_labo.json`) : shader à 62
      images par seconde sur la photo et la vidéo, écart de 0,044 sur 255 avec le Rust ; le
      shader est retenu (JOURNAL).
- [x] Lot 1 : exports depuis le document : PNG haute définition (×1 à ×4, ou 150 et 300 dpi
      pour l'A4 et l'A5), JPEG, WebP, PDF vectoriel (toutes les pages), SVG (une page) ;
      fenêtre d'export revue ; comparaison au pixel entre l'écran et l'export ; `exporter` du
      pont étendu. Livré le 2026-10-16 (`noyau/src/rendu_page.rs`, commande
      `exporter_document`) : les 42 modèles de départ à 0,54 sur 255 en moyenne de la fenêtre
      (WebKitGTK), une page riche à 0,72, son PDF rendu par poppler à 1,04, son SVG rendu par
      Chromium à 0,49 (JOURNAL). Essai d'Alexandre : « Essayer les exports (étape 5, lot 1) »
      du `01_application/LISEZMOI.md`.
- [x] Lot 2 : le labo : moteur des réglages dans le noyau, bouton Retoucher, panneau (Lumière,
      Couleur avec mélangeur, Effets, Détail), histogramme, aperçu en direct par la voie du lot
      0, avant et après, double-clic qui remet à zéro, valeur au clavier ; export depuis
      l'original. Livré le 2026-10-16 (`noyau/src/labo.rs`, `src/labo/`, outil `retoucher` du
      pont) : shader et noyau à 1 sur 255 au plus sur le tableau commun, fenêtre et export à
      2,3 sur 255 (réglages d'un pixel) et 3,2 (réglages voisins, l'aperçu étant un JPEG)
      (JOURNAL). Reste pour plus tard : les photos des cadres et des maquettes. Essai
      d'Alexandre : « Essayer le labo photo (étape 5, lot 2) » du `01_application/LISEZMOI.md`.
- [x] Lot 3 : courbe des tonalités, une vingtaine de préréglages dessinés par Claude, préréglages
      d'Alexandre, copier et coller les réglages d'une image à l'autre. Livré le 2026-10-16 :
      courbe de points (RVB, rouge, vert, bleu) dans le noyau et le shader, même table, écart nul
      sur les quatre cas de courbe du tableau commun ; 23 préréglages en cinq catégories
      (`src/modele/prereglages.json`), vignettes, survol, intensité ; « Les miens » dans
      `~/Documents/Eliot/Préréglages/` ; Ctrl+Maj+C et Ctrl+Maj+V ; fenêtre et export à 1,35 à
      1,92 sur 255 avec une courbe (JOURNAL). Essai d'Alexandre : « Essayer la courbe et les
      préréglages (étape 5, lot 3) » du `01_application/LISEZMOI.md`.
- [x] Lot 4 : les clips vidéo dans le labo : réglages qui suivent la lecture, export image par
      image. Livré le 2026-10-16 : un second moteur du shader pour les clips, qui passe chaque
      image au moment où la page la dessine ; à l'arrêt, les réglages voisins calculés par le
      noyau sur l'image affichée (commande `labo_base_pixels`) ; grain qui change 24 fois par
      seconde du fichier ; film, image d'un instant, PDF et SVG retouchés depuis l'original ;
      capture à 1,46 sur 255 de l'export (2,92 avec clarté et texture), image du MP4 à 1,66
      (JOURNAL). Essai d'Alexandre : « Essayer les clips au labo (étape 5, lot 4) » du
      `01_application/LISEZMOI.md`.
- [x] Corrections du BRIEF du 2026-10-16, après le lot 4 : grain et réduction du bruit de 0 à
      100 ; `krilla` à la place de `svg2pdf` ; la musique baisse là où l'on parle dans une
      vidéo de la page (le noyau trouve la parole dans son son) ; l'étalonnage (une teinte et
      sa force pour les ombres, les tons moyens, les hautes lumières, et l'équilibre), dans le
      noyau et le shader, même tableau, écart nul ; préréglages Sépia et Noir et blanc bleuté
      (25 en tout) (JOURNAL). Essai d'Alexandre : « Essayer l'étalonnage et la musique sous une
      vidéo qui parle » du `01_application/LISEZMOI.md`.
- [x] Lot 5 : recadrage et redressement de l'horizon, dans le panneau du labo (proportions
      prêtes, grille des tiers). Livré le 2026-10-16 : un recadrage gardé sur l'élément
      (`rognage`, le cadre dans l'image redressée et l'angle), jamais de coin vide ; mode
      recadrage sur la page (double-clic, poignées, glisser, molette, flèches, Entrée, Échap),
      proportions prêtes et leur sens, curseur d'angle et grille fine, « Auto » (horizon ou
      verticale trouvés par le noyau, `noyau/src/horizon.rs`, à 0,1° près sur des images
      dessinées), tracer l'horizon ; le vignetage suit le cadre (noyau et shader, écart nul) ;
      fenêtre et export à 1,5 sur 255 (photo redressée), PDF à 1,96, clip recadré dans le MP4 à
      1,76 (JOURNAL). Essai d'Alexandre : « Essayer le recadrage (étape 5, lot 5) » du
      `01_application/LISEZMOI.md`.
- [x] Lot 6 : perspective : poser un visuel sur quatre coins (écran incliné, boîte, affiche en
      biais), à l'écran et à l'export. Livré le 2026-10-16 : les quatre coins gardés sur
      l'élément (`perspective`, en fractions de sa boîte, qui reste la plus petite autour d'eux) ;
      mode « coins » sur la page (section Perspective du labo ou double-clic, poignées, glisser,
      flèches, Entrée, Échap), quatre perspectives prêtes, « À plat » ; coins arrondis, bordure,
      ombre et retouches suivent ; la fenêtre pose le visuel par un shader WebGL, le noyau par le
      même calcul sur le processeur (`noyau/src/perspective.rs`, tableau de valeurs commun) ;
      fenêtre et export à 2,09 sur 255 dans le visuel (0,47 sur toute la page), PDF à 2,08, SVG
      rendu par Chromium à 1,45, clip en perspective dans le MP4 à 1,67 (JOURNAL). Essai
      d'Alexandre : « Essayer la perspective (étape 5, lot 6) » du `01_application/LISEZMOI.md`.
- [x] Lot 7 : détourage local : choix du modèle et de sa licence, masque gardé en valeur du
      document (l'original intact), pinceau pour reprendre les bords. Livré le 2026-10-16 :
      BiRefNet (licence MIT), choisi sur 72 photos d'objets de DIS-VD contre sa version légère
      et BEN2 Base (écart moyen 0,035, recouvrement 0,84) ; converti une fois en ONNX sur le
      poste (`outils/convertir_birefnet.py`, empreintes vérifiées), lancé par le noyau comme
      Whisper (`noyau/src/detourage.rs` et `detourer.py`, onnxruntime pour le processeur) ;
      masque rangé avec la photo, coups de pinceau dans le document, le même calcul dans la
      fenêtre et le noyau (tableau commun) ; l'ombre suit la silhouette, perspective comprise ;
      fenêtre contre export à 0,08 sur 255, avec l'ombre 0,13, avec le pinceau 0,09 (JOURNAL).
      Essai d'Alexandre : « Essayer le détourage (étape 5, lot 7) » du
      `01_application/LISEZMOI.md`, après les commandes 20 et 21 du `CLAUDE.md`.
- [x] Outils du pont IA pour tout ce qui précède, au fil des lots (lot 1 : `exporter` prend
      WebP, PDF, SVG et l'échelle ; lot 2 : `retoucher`, 62 outils ; lot 3 : `retoucher` prend la
      courbe, un préréglage et son intensité, les réglages d'une autre photo, outil
      `prereglages`, 63 outils ; lot 4 : `retoucher` et `prereglages` prennent les clips ;
      corrections du 2026-10-16 : `retoucher` prend l'étalonnage ; lot 5 : `recadrer`, 64
      outils ; lot 6 : `perspective`, 65 outils ; lot 7 : `detourer`, 66 outils).
- [ ] Vérification de l'étape, livraison, essai par Alexandre.

## Étape 6. Le studio 3D (révision 9 du BRIEF, 2026-10-15)

Objet 3D dans la page (glTF, GLB, FBX, OBJ ; orbite, éclairage HDRI, ombre, matières
recolorables), banques (Poly Haven par son API, Kenney par ses paquets, Sketchfab par la
connexion au compte, CC0 et CC BY seulement ; Mixamo à la main), animation sur la frise
(plateau tournant, caméra, animations du modèle), export du calque 3D rendu par la fenêtre.

## Étape 7. Le reste du catalogue

# PLAN.md — Eliot

Plan vivant, source de vérité de l'avancement. Version du 2026-10-15, alignée sur le
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
- Son : traitements et mesure du niveau par les filtres de `ffmpeg` (réduction de bruit,
  coupe des graves, égaliseur, compresseur, dé-esseur, niveau EBU R128, musique qui baisse
  sous la voix), calculés une fois et gardés en cache. Micro capté par le Rust.
- Sous-titres : Whisper sur le processeur (modèle téléchargé une fois par Alexandre, comme
  les archives des personnages) ; voix de synthèse : Piper, même principe. Les deux viennent
  dans leurs lots, avec leurs commandes.

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
- [ ] Lot 4 : l'export MP4 et GIF par le Rust (calques en SVG, `resvg`, `ffmpeg`), barre de
      progression et annulation, réglages par plateforme (valeurs vérifiées le jour même),
      zones sûres TikTok, Reels et Shorts, comparaison au pixel entre l'écran et l'export.
- [ ] Lot 5 : le son : onglet Audio, sons importés, Freesound (CC0 et CC BY seulement, crédits
      gardés et liste à coller), musique et bruitages, volume et fondus, musique qui baisse
      sous la voix, musique répétée jusqu'à la fin, jingles du kit de marque, niveau sonore
      par plateforme, export sans musique.
- [ ] Lot 6 : la voix : enregistrement au micro par prises, nettoyage (« Voix nette »), voix
      de synthèse Piper.
- [ ] Lot 7 : les sous-titres : Whisper, sous-titres mot par mot (le mot prononcé mis en
      valeur), coupe des silences et des hésitations.
- [ ] Outils du pont IA pour tout ce qui précède, au fil des lots.
- [ ] Vérification de l'étape, livraison, essai par Alexandre.

## Étape 5. Le labo photo et les exports de qualité

Banc de l'aperçu en direct, labo façon Lightroom et préréglages (photos et clips), recadrage,
export depuis le document (PDF vectoriel, haute définition, WebP, SVG), perspective,
détourage.

## Étape 6. Le studio 3D (révision 9 du BRIEF, 2026-10-15)

Objet 3D dans la page (glTF, GLB, FBX, OBJ ; orbite, éclairage HDRI, ombre, matières
recolorables), banques (Poly Haven par son API, Kenney par ses paquets, Sketchfab par la
connexion au compte, CC0 et CC BY seulement ; Mixamo à la main), animation sur la frise
(plateau tournant, caméra, animations du modèle), export du calque 3D rendu par la fenêtre.

## Étape 7. Le reste du catalogue

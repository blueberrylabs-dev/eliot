# PLAN.md — Eliot

Plan vivant, source de vérité de l'avancement. Version du 2026-10-14, alignée sur le
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

## Étape 4. La vidéo façon CapCut

Décision Tauri ou Electron, banc de la copie d'aperçu, frise et pistes, textes animés, son
(révision 8 du BRIEF : onglet Audio, voix enregistrée au micro, nettoyage de la voix, niveau
sonore par plateforme, musique qui baisse sous la voix, bruitages Freesound, jingles du kit de
marque, export sans musique pour les sons tendance ; avant l'étape, Alexandre crée sa clé
Freesound ; usage personnel d'apprentissage, donc API Freesound et voix Piper permises),
sous-titres mot par mot, texte qui entre par lignes sur un cadre fixe (principe retenu le
2026-10-14, prototype `outils/animer_scenes.py`), zones sûres TikTok, Reels et Shorts, réglages d'export par
plateforme, export MP4 et GIF ; le Rust apprend à rendre les calques de la page.

## Étape 5. Le labo photo et les exports de qualité

Banc de l'aperçu en direct, labo façon Lightroom et préréglages (photos et clips), recadrage,
export depuis le document (PDF vectoriel, haute définition, WebP, SVG), perspective,
détourage.

## Étape 6. Le reste du catalogue

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
- [ ] Pont IA : programme `eliot-mcp`, outils calqués sur le store, capture de la page,
      réglage pour l'activer, essai avec Claude

## Étape 3. La bibliothèque et la mise en forme publicitaire

Icônes, emojis, personnages, polices, recherche Pixabay puis Pexels (clé Pixabay posée par
Alexandre dans le `.env` le 2026-10-14), effets de texte, cadres et grilles photo, maquettes d'appareils, kit de marque,
dessin, graphiques, tableaux, QR code ; pour finir, une quarantaine de modèles de départ.

## Étape 4. La vidéo façon CapCut

Décision Tauri ou Electron, banc de la copie d'aperçu, frise et pistes, textes animés, son,
sous-titres mot par mot, zones sûres TikTok, Reels et Shorts, réglages d'export par
plateforme, export MP4 et GIF ; le Rust apprend à rendre les calques de la page.

## Étape 5. Le labo photo et les exports de qualité

Banc de l'aperçu en direct, labo façon Lightroom et préréglages (photos et clips), recadrage,
export depuis le document (PDF vectoriel, haute définition, WebP, SVG), perspective,
détourage.

## Étape 6. Le reste du catalogue

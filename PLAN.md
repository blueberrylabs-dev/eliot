# PLAN.md — Eliot

Plan vivant, source de vérité de l'avancement. Version du 2026-10-14, alignée sur le
`BRIEF.md` (révision 4 validée le 2026-10-14 ; révision 5 du même jour, à valider : elle
ajoute la bibliothèque, le labo photo, le mode vidéo façon CapCut, le pont vers une IA, et
renumérote les étapes 2 à 6).

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
- [ ] Mini PC : même série, quand il sera disponible ; décision définitive Tauri ou Electron avant l'étape 5 (vidéo)
- [ ] Comprendre la lecture au ralenti de la vidéo H.264 dans Tauri (avant l'étape 5)

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
- [ ] Essai par Alexandre sur le poste, carte graphique libre (commandes 8 à 10 du
      `CLAUDE.md`)

- [ ] Alexandre valide la révision 5 du `BRIEF.md`

## Étape 2. Les projets et l'édition complète

Accueil, nom du design, enregistrement automatique, ouverture, menu Fichier, modèles maison,
Redimensionner, plusieurs pages, barre du bas, coller et déposer, grouper, aligner, copier le
style, dégradés ; puis le pont vers une IA (MCP), s'il est validé. Détail : `BRIEF.md` § 7.

## Étape 3. La bibliothèque et la mise en forme publicitaire

Icônes, emojis, personnages, polices, recherche Pexels (Alexandre crée son compte et sa clé
avant), effets de texte, cadres et grilles photo, maquettes d'appareils, kit de marque,
dessin, graphiques, tableaux, QR code ; pour finir, une quarantaine de modèles de départ.

## Étape 4. Le labo photo et le Rust qui rend

Banc de l'aperçu en direct, labo façon Lightroom et préréglages, recadrage, export depuis le
document (PDF vectoriel, haute définition, WebP, SVG), perspective, détourage.

## Étape 5. La vidéo façon CapCut

Décision Tauri ou Electron, banc de la copie d'aperçu, frise et pistes, textes animés, son,
sous-titres, export MP4 et GIF.

## Étape 6. Le reste du catalogue

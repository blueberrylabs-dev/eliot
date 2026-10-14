# JOURNAL.md — Eliot

Journal antichronologique des décisions. La plus récente en haut. Une entrée = une date, un
titre, ce qui a été décidé, par qui, ce qui a été écarté, et la preuve (fichier, commit, run).

---

## 2026-10-14, étape 2 : projets et édition complète, livrée sur le poste

- Fait par Claude, choix par défaut inscrits au `PLAN.md` : accueil (formats nommés par
  plateforme, taille libre, designs récents avec miniature, recherche, modèles maison),
  designs enregistrés dans `~/Documents/Eliot/Designs/` (un dossier par design, version
  précédente gardée en secours), enregistrement automatique une seconde après chaque
  modification et à la fermeture, renommage, copie, corbeille du système, fichier `.eliot`
  (zip vérifié à l'import), document version 2 (nom, format, pages ; conversion des documents
  de version 1 par le noyau), plusieurs pages (bande des vignettes, vue en grille,
  réordonner en glissant), zoom et défilement, aperçu plein écran, Redimensionner (sur place
  ou sur une copie), coller une capture d'écran, déposer des fichiers, glisser depuis les
  panneaux, grouper, aligner et répartir, copier le style, dégradés.
- Vérifié dans le conteneur de Claude :
  - noyau : 25 tests sur 25 (12 nouveaux : cycle d'un design, doublons, conversion de version,
    document abîmé rouvert depuis la version précédente, renommage, copie vers les modèles,
    corbeille, identifiants douteux, archive `.eliot` aller et retour, archive piégée refusée
    sans rien écrire, images copiées d'un design à l'autre) ;
  - logique de l'interface (vitest) : 13 tests sur 13 (géométrie, pages et annuler, groupes,
    alignement, copier le style, changement de format, renommage hors historique) ;
  - interface dans Chromium : 33 vérifications sur 33 (accueil, création, glisser depuis un
    panneau, enregistrement automatique, gestes de l'étape 1, zoom, groupes, Alt + clic,
    position, style, dégradé, copier-coller, coller une capture, déposer une image, pages,
    vue en grille, renommage, copier et redimensionner, export de toutes les pages, aperçu,
    retour à l'accueil et réouverture, corbeille) ; une seule alerte, propre au navigateur
    (plein écran demandé hors d'un clic) ;
  - fenêtre Tauri sur écran virtuel : design créé, photo 24 Mpx importée dans son dossier en
    682 ms, deux pages, enregistrement, réouverture identique, miniature, renommage du dossier,
    export des deux pages en 401 ms ; fermeture de la fenêtre une fraction de seconde après une
    modification : la modification est bien sur le disque.
- Écarts : le nom du fichier exporté reste `AAAA-MM-JJ_HHMMSS_eliot` comme au BRIEF (le nom du
  design n'y figure pas) ; l'aperçu plein écran du navigateur de test demande un clic, sans
  effet dans Tauri.
- Reste de l'étape 2 : essai d'Alexandre, puis le pont vers une IA (MCP).

## 2026-10-14, révision 7 : création de contenu, vidéo avant le labo photo, clé dans le .env

- Alexandre a posé sa clé Pixabay dans un `.env` à la racine du dépôt, sa convention habituelle
  (`00_moi/COMPTES.md` : « Les .env des dépôts sont hors git »). Le `.gitignore` d'Eliot ne
  l'excluait pas : ajouté par Claude, commit `2c962dd`, avant toute livraison qui aurait pu
  l'embarquer (`git add -A`). Vérifié : jamais dans l'historique, droits 600. Claude n'a lu que
  le nom de la variable, `PIXABAY_API_KEY`.
- Alexandre : « je cherche à me lancer dans la création de contenu euh, sur euh, YouTube,
  TikTok, Instagram, via des vidéos, des montages photos. apprendre le métier. Et tout ça avec
  l'assistance de l'IA ».
- Propositions de Claude, acceptées (« Tu as mon accord ») : objectif inscrit au § 1 ; formats
  nommés par plateforme, zones sûres TikTok, Reels et Shorts, sous-titres animés mot par mot,
  réglages d'export par plateforme ; vidéo en étape 4 et labo photo en étape 5 ; règle 12
  réécrite pour les clés (`.env` hors git en développement, dossier de configuration pour la
  version installée).
- Conséquence : le rendu des calques par le Rust se construit à l'étape 4, pour l'export
  vidéo ; les exports PDF et haute définition suivent à l'étape 5.

## 2026-10-14, révision 6 : Pixabay avant Pexels

- Constat d'Alexandre, capture de la page de demande de clé Pexels : « Une nouvelle émission
  de clé API est actuellement en pause ». Aucune date de reprise trouvée.
- Proposition de Claude après lecture des règles de l'API Pixabay (§ 4 du BRIEF) : Pixabay en
  premier, gratuit, photos et vidéos, et ses règles demandent justement de copier l'image
  chez soi plutôt que de la lier à leur site ; Pexels reste prévu en plus, branché dès
  qu'une clé existe. Une seule interface de recherche dans Eliot pour les deux.
- Décision d'Alexandre : « Oui, je suis d'accord ». Il crée un compte Pixabay.

## 2026-10-14, révision 5 validée, étape 2 ouverte

- Réponse d'Alexandre aux quatre questions : « Pour tous tes points, c'est bon ». Révision 5
  validée (labo photo, vidéo façon CapCut, pont IA avec Claude en premier, sous-titres
  Whisper, nouvel ordre). Lu par Claude comme un essai d'Eliot réussi sur le poste (question
  4) ; à corriger s'il voulait dire autre chose.
- Alexandre crée son compte Pexels et récupère sa clé ; il la saisira lui-même dans Eliot à
  l'étape 3, sans la transmettre à Claude.
- Étape 2 ouverte. Choix par défaut de Claude pour les projets (dossier
  `~/Documents/Eliot/`, format de dossier, enregistrement, fichier `.eliot`, corbeille,
  groupes) inscrits au `PLAN.md`, modifiables sur simple demande.

## 2026-10-14, révision 5 du BRIEF : ce qui manque face à Canva, Lightroom, CapCut, une IA

- Alexandre a compilé Eliot sur le poste, puis envoyé une capture de l'éditeur de Canva :
  « regardes ce qu'il pourrait manquer et je pense que c'est un probleme de librairies ».
- Lecture de Claude : les bibliothèques de code (Konva, React) ne sont pas en cause, Polotno
  repose sur les mêmes. Ce qui manque, c'est le contenu (modèles, éléments, photos,
  polices), que le § 8 excluait en partie sur proposition de Claude, et des fonctions déjà
  prévues aux étapes suivantes. Licences relevées le jour même (§ 4 du BRIEF).
- Décision d'Alexandre : « Oui, tu rajoutes tout » : bibliothèque embarquée, modèles de
  départ, photos et vidéos Pexels, dessin, grilles photo, maquettes d'appareils, graphiques,
  tableaux. Écarté par Claude après lecture des règles : Unsplash (liens directs
  obligatoires, contraire au travail hors ligne) et unDraw (redistribution en lot interdite).
- Demandes d'Alexandre du même échange, mises en forme dans la révision 5 et **à valider** :
  labo photo façon Lightroom, mode vidéo façon CapCut (frise à pistes, texte animé sur une
  vidéo), pont vers une IA (« le brancher à une IA pour qu'il puisse faire les choses de
  lui-même ») par MCP, Claude en premier. Ajouts de Claude, à valider aussi : sous-titres
  automatiques par Whisper, règles 12 (hors ligne par défaut) et 13 (retouche non
  destructive), modèle de document avec pages, temps et pistes.
- Ordre de construction revu : 2 projets et édition complète (puis le pont IA), 3
  bibliothèque et mise en forme publicitaire, 4 labo photo et rendu Rust, 5 vidéo, 6 le
  reste. Les entrées plus anciennes de ce journal parlent de « l'étape 4 » pour la vidéo :
  c'est l'étape 5 depuis la révision 5.
- Action d'Alexandre avant l'étape 3 : créer un compte Pexels et sa clé d'API.

## 2026-10-14, étape 1 : l'éditeur, vérifié dans le conteneur de Claude, livré sur le poste

- Fait par Claude : `01_application/` (mode d'emploi et plan du code dans son `LISEZMOI.md`).
  Noyau Rust `noyau/` sans dépendance à Tauri : import des images (empreinte SHA-256,
  orientation de l'appareil photo, aperçu 2560 px, miniature 256 px, import parallèle) et
  écriture des exports (nom daté, jamais d'écrasement, écriture atomique, contrôle de la
  signature du fichier).
- Vérifié dans le conteneur de Claude (2 cœurs, sans carte graphique) :
  - noyau : 13 tests sur 13, dont l'orientation sur une photo d'essai tournée de 90° ;
  - interface dans Chromium, pilotée par un script : 21 vérifications sur 21, aucune erreur
    dans la console (ajout, glisser enregistré en une seule étape d'annulation, objets remis
    à leur place dans la pile après le geste, aimantation au centre, redimensionnement par un
    coin, rotation, écriture d'un texte, annuler et rétablir, rectangle de sélection, menu du
    clic droit, suppression puis annulation, couleur de palette, export PNG 1080 × 1080) ;
  - fenêtre Tauri sur un écran virtuel : import de la photo 24 Mpx du banc par le noyau en
    889 ms, aperçu et miniature relus par l'interface, titre ajouté, export PNG 1080 × 1080
    écrit par le noyau en 309 ms. Capture de la fenêtre conforme.
- Même réglage qu'au banc : `opt-level = 3` sur le noyau en mode développement, sinon l'import
  d'une grande photo prend plusieurs secondes.
- Pas encore là, prévu à l'étape 2 : enregistrement du projet (fermer la fenêtre efface la
  page), zoom de la page, glisser-déposer de fichiers, coller une image.
- Reste : essai par Alexandre sur le poste, carte graphique libre.

## 2026-10-14, BRIEF validé, démarrage sur Tauri

- Décisions d'Alexandre : « on démarre sur Tauri » ; BRIEF validé, « tout par défaut »
  (révision 4 ; valeurs retenues au § 10). Electron reste le repli, tranché au banc du mini PC
  avant l'étape 4.
- Identité des commits : `Alexandre Do <adresse retirée avant la publication>`, relevée dans le dépôt
  `00_moi` ; messages d'une ligne en français, sans autre nom (`00_moi/CONVENTIONS.md`).
- Question d'Alexandre : son premier test avait-il tourné dans Firefox ? Non : la ligne
  d'identification commence par « Mozilla/5.0 » pour tous les navigateurs ; le test Rust et
  la lecture de la machine n'existent que dans la fenêtre Tauri. Aucun fichier Firefox dans
  `resultats/`.
- Étape 1 ouverte.

## 2026-10-14, série complète : fenêtre Tauri et navigateur de la famille Chrome

- Séries : `00_banc_essai/resultats/2026-10-14_152859_tauri-webkitgtk.json` (lancée par
  Alexandre) et `2026-10-14_153221_navigateur-claude.json` (lancée par Claude dans le
  navigateur intégré de l'application Claude, Chrome 152, juste après, même poste, zone de
  dessin réglée à la même taille : 1044 × 748, rapport 1,25). Écran à 60 Hz : 60 images/s est
  le plafond.
- Mesuré (images/s, Tauri puis Chrome) : redessiner 200 objets 62,2 et 60 ; glisser un objet
  avec poignées 45,0 et 60 ; glisser 50 objets 42,2 et 60 ; tourner et redimensionner 42,8 et
  60 ; photo 24 Mpx glissée 38,3 et 60 ; aperçu 2560 px glissé 41,2 et 60 ; **objet glissé sur
  un calque à part 62,3 et 60 ; 50 objets sur un calque à part 62,2 et 60** ; vidéo H.264
  35,1 et 60 ; vidéo VP9 34,8 et 60. Aucun à-coup notable nulle part.
- Coût du dessin côté JavaScript pour une page de 200 objets : 8,7 ms dans Tauri, 1,0 ms dans
  Chrome. Avec le calque à part : 0,3 ms et 0,07 ms.
- Vidéo H.264 dans Tauri : lue au ralenti (3 s de vidéo en 5,4 s, 88 images affichées) ;
  VP9 lue à vitesse normale (5,5 s, 163 images). Dans Chrome, les deux à vitesse normale.
  Cause non identifiée.
- Export PNG 2160 × 2160 : 179 ms dans Tauri, 400 ms dans Chrome. Réduction d'une photo
  24 Mpx à 2560 px : Rust 230 ms (décodage 92, réduction 55, encodage 80), moteur web d'Ubuntu
  301 ms, Chrome 234 ms. Le Rust n'est pas plus rapide que Chrome sur une photo isolée ; son
  encodage JPEG est le plus lent des trois.
- Lecture de Claude : la cause du ralentissement des gestes dans Tauri est le redessin des
  200 objets à chaque image, pas le nombre de calques (sans poignées : 47,2 ; poignées dans le
  calque de la page : 45,3). Mettre ce qui bouge sur un calque à part le temps du geste suffit
  à tenir 60 images/s : règle 11 ajoutée au BRIEF. Chrome garde une marge d'environ 8 fois sur
  le coût de dessin, ce qui comptera sur le mini PC.
- Proposition de Claude, **à trancher par Alexandre** : démarrer l'étape 1 sur Tauri, avec
  une enveloppe isolée dans `pont/` pour pouvoir passer à Electron sans toucher au reste ;
  décision définitive après le banc du mini PC, avant l'étape 4 (vidéo). Correction : avec
  Electron, le noyau Rust resterait natif (module Node écrit en Rust, napi-rs), pas en
  WebAssembly comme écrit plus tôt dans le BRIEF.

## 2026-10-14, première série sur le poste principal (fenêtre Tauri)

- Lancée par Alexandre, fichier `00_banc_essai/resultats/2026-10-14_152100_tauri-webkitgtk.json`.
  Poste : Ryzen 9 7950X3D (32 fils), 62 Go, NVIDIA (pilote `nvidia`), session X11, écran
  1920 × 1080 à 60 Hz, mise à l'échelle 1,25. Aucune variable NVIDIA nécessaire : la fenêtre
  s'est affichée normalement.
- Mesuré : redessiner les 200 objets, 62,2 images/s (fluide) ; glisser un objet avec ses
  poignées, 44,8 images/s ; glisser 50 objets, 41,7 ; tourner et redimensionner, 41,3 ;
  aperçu 2560 px glissé, 41,4 (tous « correct », aucun à-coup) ; export PNG 2160 × 2160 en
  182 ms.
- Non mesuré : photo pleine résolution, vidéos, réductions, car les fichiers de test n'avaient
  pas été générés (commande 4 bis). Le banc les signale désormais au démarrage.
- Lecture de Claude, à vérifier : redessiner la page seule tient 60 images/s, mais tout geste
  qui redessine deux calques (page et poignées) tombe à 42-45. Quatre variantes ajoutées au
  banc pour isoler la cause (sans poignées, poignées dans le calque de la page, objet glissé
  sur un calque à part, 50 objets sur un calque à part).
- Constaté au dépôt : les images et vidéos copiées par le dossier de sortie de Claude
  reçoivent une étiquette de provenance (segment C2PA) qui change leurs octets.
  `photo_apercu_2560.jpg` sur le poste ne correspond donc pas à `EMPREINTES.txt` tant que la
  commande 4 bis n'a pas tout régénéré.

## 2026-10-14, banc d'essai prêt, à lancer à la main

- Fait par Claude : `00_banc_essai/` (fenêtre Tauri + même page ouverte dans un navigateur
  de la famille Chrome), 11 tests, résultats écrits dans `00_banc_essai/resultats/`. Preuve :
  `00_banc_essai/LISEZMOI.md`.
- Vérification faite dans le conteneur de Claude, une machine distante sans écran ni carte
  graphique (2 cœurs) : la série tourne de bout en bout dans un Chromium sans fenêtre et dans
  la fenêtre Tauri sur un écran virtuel ; la partie Rust compile et son test passe. Les
  chiffres obtenus là-bas (rendu logiciel) ne disent rien du poste : ils n'ont pas été
  conservés. Rien n'a été lancé sur le poste d'Alexandre, ni dans son Chrome.
- Mesuré au passage : sans `opt-level = 3` sur le paquet lui-même en mode développement, la
  réduction Rust d'une photo 24 Mpx prend 6,5 s au lieu de 0,1 s, parce que le code générique
  des bibliothèques est compilé dans le paquet qui l'appelle. Réglage posé dans
  `00_banc_essai/src-tauri/Cargo.toml` ; à reprendre dans l'application.
- Dépôt sur le poste : les fichiers de test lourds (photo de 5 Mo, vidéos de 10 et 11 Mo)
  n'ont pas pu être copiés depuis le conteneur (délai dépassé à chaque essai). Ils se
  régénèrent sur le poste avec `outils/generer_donnees.py` (commande 4 bis du `CLAUDE.md`) ;
  essai fait dans le conteneur : photo et vidéo H.264 identiques octet pour octet à la première
  génération.
- Question d'Alexandre : faire la partie Chrome dans le navigateur intégré de l'application
  Claude, qui tourne sur son PC. Retenu : possible une fois `npm run tauri dev` lancé par
  Alexandre (le navigateur intégré ouvre alors `http://localhost:1420` sur son poste), carte
  graphique libre.

## 2026-10-14, nom : Eliot

- Décision d'Alexandre : le projet s'appelle Eliot, « toile » à l'envers. Dossier renommé de
  `Logiciels/Toile/` en `Logiciels/Eliot/` le même jour. Écarté : « Toile » (nom provisoire
  proposé par Claude). Preuve : conversation du 2026-10-14.
- Question d'Alexandre : le projet peut-il devenir open source sur GitHub ? Réponse de
  Claude : oui, les dépendances prévues sont sous licences MIT, Apache-2.0 ou ISC (vérifié le
  2026-10-14, `BRIEF.md` § 4). Règle 10 ajoutée au BRIEF : le dépôt reste publiable à tout
  moment. Licence et compte GitHub non tranchés (Q2) ; toute publication attend le feu vert
  d'Alexandre (`00_moi/AUTONOMIE.md`).

## 2026-10-14, carte graphique : ne rien lancer dessus

- Décision d'Alexandre : sa carte graphique porte un travail lourd qu'il ne faut pas
  déranger. Règle 9 du BRIEF : le banc d'essai et l'application ne se lancent qu'à la main,
  par Alexandre, carte libre. Preuve : conversation du 2026-10-14.

## 2026-10-14, périmètre : photos et vidéos, un maximum de fonctions

- Décisions d'Alexandre : Eliot sert à apprendre la création publicitaire, en photos et en
  vidéos ; un maximum de fonctions dès la version 1, « ne cherche pas à faire d'économie ».
  Le catalogue complet est au § 6 du BRIEF, les étapes du § 7 ne fixent que l'ordre.
- Feu vert d'Alexandre pour le banc d'essai, sur le poste principal d'abord. Le mini PC
  passera plus tard, ses caractéristiques viendront quand il sera disponible.

## 2026-10-14, application locale, deux postes, interface Canva

- Décisions d'Alexandre : application locale, sans Cloudflare ni hébergement ; elle doit
  tourner aussi sur un mini PC aux performances plus modestes ; interface qui ressemble à
  Canva, facile et intuitive ; le code lourd en Rust.
- Écarté : l'application web installée dans Chrome (demandait un hébergement ou un serveur
  local). Retenu sous réserve du banc d'essai : Tauri ; repli : Electron.

## 2026-10-14, première entrée : conception avant code

- Demande d'Alexandre : « Surtout avant de coder, tu me montres ce que tu vas faire et les
  meilleures solutions ». Claude a arrêté l'écriture du code et rédigé `BRIEF.md` (brouillon,
  non validé).

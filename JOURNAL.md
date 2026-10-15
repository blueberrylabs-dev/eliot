# JOURNAL.md — Eliot

Journal antichronologique des décisions. La plus récente en haut. Une entrée = une date, un
titre, ce qui a été décidé, par qui, ce qui a été écarté, et la preuve (fichier, commit, run).

---

## 2026-10-15, étape 4, lot 3 : l'animation

Choix de Claude, modifiables sur simple demande :

- Toutes les formules vivent dans `modele/animation.ts`, en fonctions pures. L'état d'un
  élément à un instant se lit en deux parts : sa pose (position, échelle, rotation, opacité),
  donnée par ses images clés, et un effet posé par-dessus, autour de son centre, donné par ses
  animations et les transitions. Le Rust de l'export (lot 4) reprendra les mêmes formules ;
  `modele/animation.attendus.json` (550 cas) donne les valeurs que les deux côtés doivent
  retrouver à un millionième près.
- Le catalogue : 15 entrées et 15 sorties (fondu, quatre glissements, deux zooms, rebond,
  chute, tourbillon, volet, et pour un texte seulement : machine à écrire, lettre par lettre,
  mot par mot, ligne par ligne), 8 boucles (pulsation, battement, flottement, balancement,
  tremblement, clignotement, rotation, zoom lent). Un texte par morceaux se dessine lettre par
  lettre (`charRenderFunc` de Konva 10), toujours, pour que sa mise en page ne bouge pas quand
  l'animation finit. Entrée et sortie plus longues que le clip se partagent sa durée.
- L'élément choisi, page à l'arrêt, montre sa pose seule, sans ses effets : on le déplace et
  on le règle tel qu'il est posé, les effets reprennent à la lecture (et pour un élément non
  choisi). Écarté : montrer l'effet sur l'élément choisi, parce qu'un geste pendant une entrée
  aurait dû défaire l'effet pour retrouver la pose.
- Images clés : `t` compte depuis le début du clip, pas depuis le début de la page, pour que
  les clés suivent le clip quand on le déplace ou que la piste principale se resserre ; tirer
  le début du clip les garde sur le même moment, scinder les partage (une clé au bord de chaque
  moitié). L'exemple du § 6 du BRIEF montre des temps de page : à corriger à la prochaine
  révision, avec l'accord d'Alexandre. Entre deux clés, c'est le centre de l'élément qui
  avance en ligne droite : une clé d'échelle seule agrandit autour du centre. Comme dans
  CapCut, dès qu'un élément a des clés, un geste à la tête de lecture pose ou reprend la clé de
  cet instant (à 40 ms près), avec toute la pose ; les flèches et l'opacité aussi.
- Transitions (fondu enchaîné, glissement, zoom, volet) : posées sur le clip qui entre, entre
  deux clips de la piste principale ; les deux clips se chevauchent pendant la transition, la
  page raccourcit d'autant (comme CapCut), la moitié du plus court des deux au plus. Le son
  passe de l'un à l'autre. Pendant un chevauchement, scinder ne coupe pas.
- Fondus du son d'une vidéo (`fonduEntree`, `fonduSortie`), dans la bulle Son. Les fondus de
  l'image passent par les animations d'entrée et de sortie « fondu ».
- Styles de texte pour la vidéo (8) : police, couleurs, effet, animations ; dans le panneau
  Texte sur une page vidéo, et dans Effets pour un texte choisi.
- Vitesse : déjà là depuis le lot 1 (vitesse d'un clip), la frise en tient compte depuis le
  lot 2 ; rien de plus dans ce lot.
- Pont IA : `animer`, `images_cles`, `transition` (53 outils) ; `ajouter_texte` prend un
  `style` ; `modifier` accepte les fondus du son ; `etat` résume animations, clés et
  transitions dans la frise.
- Vérifié dans le conteneur : interface 103 (19 essais de l'animation, tableau commun
  compris), Chromium 44 vérifications sur l'animation et toutes les suites d'avant, Tauri 16
  dont la machine à écrire et un carré mené par deux clés, lus à l'écran de WebKit, et toutes
  les suites d'avant.

## 2026-10-15, étape 4, lot 2 : la frise

Choix de Claude, modifiables sur simple demande :

- La bascule Photo ou Vidéo dit ce qu'est la page affichée (le BRIEF : une page qui a une
  durée est une vidéo). Vidéo : la frise s'ouvre, chaque élément sur sa propre piste de
  superposition, dans son ordre d'empilement, visible tout du long (5 s, ou la plus longue
  vidéo). Photo : la page redevient fixe, temps et pistes oubliés, annulable. Poser une vidéo
  sur une page fixe en fait une page vidéo (« ouvre la frise d'office », BRIEF § 6).
- Où se pose un élément neuf : une vidéo sur la piste principale quand elle a déjà des clips
  ou que la page est vide (au bout, ou après le clip sous la tête si la tête est dedans), et
  elle remplit alors la page ; tout le reste, photos comprises, au-dessus de ce qui se voit
  à la tête, pour 3 s. Écarté : les photos sur la piste principale, comme dans CapCut, parce
  qu'un logo ou un autocollant couvrirait la page ; une photo glissée sur la principale s'y
  range quand même (diaporama).
- Une seule fonction remet une page vidéo d'aplomb après toute modification (`normaliser`) :
  vidéos à la durée de leur coupe et de leur vitesse, piste principale bout à bout depuis 0,
  un clip qui en chevauche un autre de sa piste monte sur une piste neuve juste au-dessus,
  pistes renumérotées sans trou, tableau trié par piste (l'empilement découle des pistes),
  durée de la page jusqu'au dernier clip. Les gestes, l'IA et l'annulation passent tous par
  elle ; pendant un geste, la frise montre déjà le résultat de cette même fonction.
- La tête de lecture vit dans un petit store à part (`etat/temps.ts`), hors de l'historique
  et du fichier ; une horloge la fait avancer en temps réel, les vidéos la suivent et se
  recalent au-delà d'un quart de seconde d'écart. La lecture s'arrête sur la dernière image.
- Espace : appui bref, lire ou mettre en pause ; maintenu, déplacer la vue comme avant.
- Capture, export en image et miniature d'une page vidéo montrent un instant avec l'image
  exacte de chaque vidéo, tirée de sa copie d'aperçu par le Rust (`image_de_copie`) ; les
  vignettes de pages gardent la couverture, plus légère.
- Pistes de son : avec les sons (lot 5). D'ici là, le son d'une vidéo se voit dans son clip
  (forme d'onde, la plus forte crête à pleine hauteur).
- Pont IA : `page_video`, `aller_a`, `scinder` (50 outils) ; `modifier` accepte `temps` et
  `piste` ; `capture` prend un instant ; `etat` décrit la frise ; les outils qui posent un
  élément le renvoient avec son temps et sa piste.
- Vérifié dans le conteneur : 18 essais des règles de la frise, interface 84, Chromium 38
  vérifications sur la frise (gestes à la souris compris), Tauri 21 dont les vignettes,
  l'onde et la lecture à l'écran de WebKit, un rognage et un glisser à la souris dans WebKit,
  et toutes les suites d'avant.

## 2026-10-15, étape 4, lot 1 : la vidéo dans le design

- Import : le noyau (`videos.rs`) sonde le fichier (`ffprobe`), range l'original tel quel,
  fabrique la copie d'aperçu (VP9 et Opus, 720 px sur le petit côté, jamais agrandie, une
  image clé par demi-seconde, mesurée), une couverture prise vers la première seconde (pour
  les vignettes de page, la miniature et l'export en image), la bande des vignettes de la
  frise et la forme d'onde (50 pics par seconde). Une vidéo déjà rangée n'est pas refaite.
  L'avancement remonte à la fenêtre par un canal Tauri ; une bande le montre en bas.
- Lecture : la fenêtre lit la copie en octets (genre `copie` de `lire_ressource`) et en fait
  une adresse locale ; une balise vidéo par élément, dessinée par Konva, le calque redessiné
  à chaque image (`requestVideoFrameCallback`). Choisi parce que c'est la même voie que les
  images et qu'elle n'expose aucun fichier : écarté pour l'instant, un protocole Tauri qui lit
  le disque par morceaux, à reprendre si des vidéos très longues pèsent trop en mémoire.
- Une vidéo ne joue que quand on la lance (barre du haut, comme Canva) ; elle boucle sur sa
  coupe sans jamais montrer une image qui en sort ; changer de page arrête tout. L'aperçu plein
  écran fait tout jouer, avec le son (sans le son si le moteur le refuse).
- Document version 4 : élément `video` (`ressource`, `coupe`, `vitesse`, `volume`,
  retournement, coins, bordure), champs `temps`, `piste`, `duree` et `audio` déjà décrits mais
  pas encore servis. Le noyau convertit un document de version 3 en ne changeant que le
  numéro, et refuse une durée de page hors de 0,1 s à 3 h.
- Vidéos Pixabay : même chemin que les photos (clé lue par le Rust seul, cache de 24 h), le
  fichier 1080p téléchargé par morceaux (500 Mo au plus) puis préparé comme une vidéo du
  poste, crédit gardé. Pixabay ne filtre pas les vidéos par sens : le tri Paysage ou Portrait
  se fait sur les résultats.
- Pas encore : une vidéo dans un cadre ou un écran de maquette (refusée, elle se pose seule),
  l'export MP4 (lot 4) ; l'export en image montre la couverture, et la fenêtre d'export le dit.
- Pont IA : `importer_video`, `ajouter_video`, `chercher_videos`, `ajouter_video_pixabay`
  (47 outils), et `modifier` pour la coupe, la vitesse et le volume, vérifiés contre la durée
  du fichier. Le programme `eliot-mcp` est à recompiler (commande 13).
- Archive `.eliot` : écrite et relue par morceaux, sans tout charger en mémoire (un design
  avec des vidéos peut peser des centaines de Mo).
- Vérifié dans le conteneur : noyau 42 essais, interface 66, Chromium 40 vérifications sur la
  vidéo et les suites des étapes 2 et 3 inchangées, Tauri par le pont 25 vérifications dont la
  lecture dans la fenêtre WebKit (rouge, vert, bleu, jaune puis retour au rouge), suites 3a à
  3f. Une vidéo 1080p de 15 s se prépare en 18 s sur les 2 cœurs du conteneur.

## 2026-10-15, banc des copies d'aperçu : VP9 en 720, Tauri reste

- Série complète d'Alexandre sur le poste principal (`00_banc_essai/resultats/2026-10-15_081343_tauri-webkitgtk_copies.json`),
  source de 20 s en 1080p, 30 images/s, chargée de bruit (le pire cas pour un encodeur).
- Les six copies jouent sans à-coup et sans image perdue dans la fenêtre Tauri : seules, à deux
  en même temps, et posées dans la page de 200 objets redessinée à chaque image (60,3 à 62,4
  images/s, 16 à 17 ms par image de l'écran). Ce qui les départage est la tête de lecture :
  saut médian de 15 ms et glisser à 39 images/s en VP9 1080p, 12 ms et 48,5 en H.264 720p,
  8 ms et 62,2 en VP9 720p, 6 à 7 ms et 62 en 540p (VP9, VP8, H.264).
- Fabrication : 7 à 30 fois plus vite que le temps réel selon la copie (VP9 720p : 1,8 s pour
  20 s, 8,5 Mo, environ 25 Mo par minute dans ce pire cas).
- Décision de Claude, modifiable sur simple demande : copie d'aperçu en VP9, 720 px sur le
  petit côté (1280 × 720, ou 720 × 1280 pour une story), une image clé par demi-seconde.
  Raisons : la tête de lecture suit la souris à pleine cadence, et 720 px couvrent la taille
  réelle de la page à l'écran (environ 650 px CSS, 800 px physiques à 125 %). Écartés : 1080p
  (tête de lecture lente), H.264 720p (sauts plus lents que VP9 720p), 540p par défaut (image
  plus floue sans gain visible ici) ; 540 reste un réglage pour une machine modeste, le mini PC
  dira s'il le faut.
- Tauri reste l'enveloppe : le repli Electron n'est pas nécessaire. Lot 0 coché dans `PLAN.md`.

## 2026-10-15, révision 9 du BRIEF : le studio 3D

- Question d'Alexandre : intégrer des modèles 3D (Sketchfab, Poly Haven, Kenney, Mixamo).
  Avis de Claude, sources vérifiées le jour même : Poly Haven en CC0 avec une API gratuite sans
  clé (crédit « Poly Haven » à afficher) ; Kenney en CC0, sans API ; Sketchfab par une API qui
  demande la connexion au compte, licences variables, crédit qui suit le modèle ; Mixamo
  gratuit dans les projets, fichiers bruts non redistribuables, sans API, conditions de 2022 à
  revérifier. Affichage par three.js (MIT), donc par la carte graphique pendant qu'Eliot
  tourne ; à l'export, le calque 3D est rendu par la fenêtre, exception à « le Rust rend les
  calques ».
- Décision d'Alexandre : « tu le places là où c'est le mieux pour toi ». Claude la place en
  étape 6, après le labo photo (le reste du catalogue passe en étape 7) : l'animation 3D a
  besoin de la frise de l'étape 4, l'export du calque 3D de l'export depuis le document de
  l'étape 5. Écarté : la faire tout de suite, au milieu de la vidéo. BRIEF en révision 9,
  texte à relire par Alexandre.
- Banc des copies d'aperçu : la série d'Alexandre s'est figée au test de la tête de lecture
  de la première copie (`requestVideoFrameCallback` ne se déclenche pas toujours sur une vidéo
  en pause dans WebKit) ; corrigé (évènement `seeked`, 3 s au plus par saut, une minute au plus
  par test). Avant le blocage, sur le poste : VP9 en 1080p fluide en lecture (62,2 images/s),
  avec deux vidéos (62,2) et posé dans la page entière redessinée (60,7), aucune image perdue.

## 2026-10-15, étape 4 ouverte : plan et banc des copies d'aperçu

- Clé Freesound créée par Alexandre et rangée dans le `.env` ; vérifiée par Claude par une
  recherche d'essai depuis le poste (réponse 200), sans afficher la clé.
- Plan de l'étape 4 écrit dans `PLAN.md` : huit lots (banc des copies d'aperçu, vidéo dans le
  design, frise, animation, export, son, voix, sous-titres) et les choix par défaut de Claude :
  copies d'aperçu fabriquées par le `ffmpeg` du système à l'import, document version 4 comme
  au § 6 du BRIEF, export rendu par le Rust à partir d'un SVG de chaque calque préparé par
  l'interface (`resvg`, puis `ffmpeg` en H.264 sur le processeur, jamais l'encodeur de la
  carte graphique), traitements du son par les filtres de `ffmpeg`.
- Lot 0 : banc des copies d'aperçu ajouté à `00_banc_essai/` (`outils/generer_copies.py`,
  `src/copies.ts`, bouton « Copies d'aperçu (étape 4) ») : six copies (VP9 1080p, 720p, 540p ;
  VP8 540p ; H.264 720p et 540p), lecture sur un calque à part, deux vidéos à la fois, saut et
  glisser de la tête de lecture, fabrication. Essayé dans le conteneur, dans Chromium puis
  dans la fenêtre Tauri : tout tourne (H.264 ne joue pas dans le Chromium de l'essai, qui n'a
  pas ce décodeur ; il joue dans Tauri). Défaut corrigé en route : deux vidéos de même adresse
  partageaient un lecteur dans WebKit, la seconde a maintenant sa propre adresse. Les chiffres
  du conteneur (2 cœurs, sans carte graphique) ne disent rien du poste et ne sont pas gardés.

## 2026-10-14, étape 3, lot 6 : personnages, et vérification de l'étape

- Source : les deux archives téléchargées par Alexandre sur openpeeps.com et humaaans.com,
  rangées dans `Eliot/telechargements/` (ajouté au `.gitignore`, 48 Mo). Licence vérifiée sur
  les deux sites le 2026-10-14 : CC0 (« Free for commercial and personal use under CC0
  License », « CC0 Public Domain »), recopiée dans `LICENCES-TIERS.md`.
- `npm run bibliotheque` lit les archives sans les décompresser sur le disque ni ajouter de
  dépendance (`outils/personnages.mjs`) : SVG nettoyés (titres, identifiants, nombres
  arrondis), mesurés pour couper le vide autour, rangés dans
  `public/bibliotheque/personnages/` (6,6 Mo). L'archive Open Peeps contient une seconde
  archive identique à la première : ignorée. Sans les archives, la commande le dit et la
  bibliothèque se fabrique sans personnages.
- Tout faits, dans le panneau Éléments (aperçu, Tout voir par collection et par catégorie,
  recherche en français) : 189 Open Peeps (105 bustes, 30 debout, 18 assis, 36 masques et
  soignants) et 32 Humaaans (24 debout, 8 assis), plus 4 décors Humaaans.
- Composeur (« Créer le tien ») : un personnage tiré au hasard, puis, dans la barre du haut,
  bouton Personnage : posture (buste, debout, assis ; Humaaans debout, assis), puis tenue,
  coiffure, visage, barbe, lunettes (Humaaans : coiffure, haut, bas, siège), choisis sur des
  vignettes, « Aucune » pour les pièces facultatives, et « Au hasard ». Les places des pièces
  sont relevées dans les modèles des archives. Quand une pièce change, la boîte suit le
  dessin et le reste ne bouge pas ; quand la posture change, la hauteur et le bas restent.
- Couleurs : Open Peeps par partie (trait, tête, tenue, barbe, lunettes), grâce aux marques
  « 🎨 » et « 🖍 » que leurs fichiers portent ; Humaaans couleur par couleur (changer la peau
  la change partout). Retourner, couleurs d'origine, ombre, transparence comme les autres
  objets. Une couleur de la marque donne sa couleur à la tenue d'un Open Peep.
- Document : nouveau type `personnage` (version 3 inchangée, le noyau ne lit pas les types).
  Pont IA : `lister_personnages` (catégories, pièces, planches numérotées) et
  `ajouter_personnage` ; `modifier` change pièces, posture et couleurs (43 outils en tout).
- Défauts trouvés et corrigés en route : les planches de l'IA restaient grises pour un SVG
  (`createImageBitmap` ne lit pas le SVG, passage par une balise image) ; un panneau ouvert
  après un autre gardait son défilement (chaque onglet s'ouvre maintenant en haut).
- Vérifié dans le conteneur : vitest 61 sur 61, noyau 35 sur 35, pont 5 sur 5 ; Chromium 29
  sur 29 (personnages) et 15 sur 15 (outils IA) ; Tauri par le pont 13 sur 13 (planches,
  couleurs et miroir dessinés par WebKitGTK, export). Vérification de toute l'étape 3 :
  Chromium 33, 23, 18, 29, 27 et 17 sur autant ; Tauri par le pont 22, 14, 27, 17 et 8 sur
  autant, après remise à jour des essais (nombre d'outils, place des onglets depuis l'ajout de
  Modèles) ; `npm run build` passe.

## 2026-10-14, étape 3, lot 5 : modèles de départ

- 42 modèles dessinés par Claude pour Eliot (`src/modeles/depart.ts`), dans tous les formats :
  12 carrés (soldes, nouveau produit, citation, événement, avant et après, témoignage, chiffres
  clés, trois astuces, concours, merci aux abonnés, menu du jour, on recrute), 7 portraits 4:5,
  9 stories, 5 miniatures YouTube, 3 bannières, 2 diapositives 16:9, 3 affiches A4, 1 flyer A5.
  Polices et icônes de la bibliothèque, cadres photo vides à remplir, graphiques et tableaux là
  où ils servent. Aucune marque réelle, aucun logo de réseau social, aucune citation de
  personne réelle : les textes sont des exemples à remplacer.
- Un modèle est décrit sans identifiants ni hauteurs de texte ; à l'usage, Eliot charge les
  polices, mesure les textes et les tableaux, relie les groupes. Dans un autre format, il est
  mis à l'échelle et centré, comme par Redimensionner, qui adapte maintenant aussi les
  bordures, les ombres, les graphiques et les tableaux.
- Où ils se trouvent : à l'accueil, « Partir d'un modèle » (filtre par format) crée un design
  au format du modèle ; dans l'éditeur, le nouvel onglet Modèles, en tête du rail, montre ceux
  du format ouvert, les autres sur demande, avec une recherche. Un clic remplit la page si elle
  est vide, sinon pose le modèle sur une nouvelle page juste après ; une seule étape
  d'annulation. Les vignettes se dessinent quand elles apparaissent à l'écran.
- Pont IA : `lister_modeles_depart` (avec une planche des vignettes numérotées) et
  `utiliser_modele_depart` (41 outils en tout).
- Relus à l'œil sur une planche de rendus avant livraison : cinq modèles retouchés (titres
  coupés, case vide, bas de page vide) ; les dégradés « verticaux » allaient presque de droite
  à gauche (angle mal choisi), corrigés.
- Vérifié dans le conteneur : Chromium 17 sur 17 ; Tauri par le pont 8 sur 8 (planche, design
  neuf, nouvelle page, rendu WebKitGTK) ; vitest 48 sur 48 ; non-régression Chromium 33, 23,
  18, 29 et 27 sur 27 ; `npm run build` passe.

## 2026-10-14, étape 3, lot 4 : dessin à main levée, graphiques, tableaux

- Dessin (onglet Dessin) : stylo, marqueur, surligneur (translucide, il teinte ce qu'il
  recouvre), gomme. Ouvrir l'onglet prend le crayon, le fermer ou Échap le repose. Pendant le
  trait, seule la ligne provisoire est redessinée (règle 11). Chaque trait devient un élément
  `dessin`, allégé (moins de points, même allure) et calé sur sa boîte : on le déplace,
  l'agrandit, le recolore comme une forme. La gomme retire les traits qu'elle touche, en une
  seule étape d'annulation par geste.
- Graphiques (panneau Éléments) : colonnes, barres, courbe, aires, camembert, anneau, jauge de
  progression. Les données vivent dans le document ; le dessin est recalculé à chaque rendu
  par une fonction testée sans écran (`modele/graphiques.ts`). Bouton Données : un petit
  tableau, valeurs tapées à la française, collage depuis un tableur. Graduations rondes,
  valeurs écrites à la française avec une unité (%, €, k€). Les couleurs de la marque passent
  en premier.
- Tableaux : quatre modèles (simple, comparatif, tarifs, planning). Double-clic sur une case
  pour écrire, Tab et Maj+Tab pour circuler, Tab après la dernière case ajoute une rangée ;
  rangées et colonnes, en-tête, rayures, couleurs, bordures, marge. Les lignes de texte sont
  coupées par Eliot lui-même, avec la même mesure pour l'écran, l'export et la case en cours
  d'écriture ; la hauteur suit le contenu.
- Document : toujours en version 3 (les types `dessin`, `graphique` et `tableau` y étaient
  annoncés). Pont IA : 3 outils de plus (39 en tout) : `dessiner`, `ajouter_graphique`,
  `ajouter_tableau` ; `modifier` sait changer leurs données.
- Défauts trouvés et corrigés en route : la couleur de marque donnée à une ligne ou une flèche
  ne changeait rien (elle visait le contour, la ligne se dessine avec son remplissage) ; le
  cadre de sélection d'un graphique débordait sur toute la largeur (boîtes de texte trop
  larges) ; un tableau collé dans les données d'un graphique était aussi collé sur la page.
- Vérifié dans le conteneur : Chromium 27 sur 27 (traits à la souris, gomme, Ctrl+Z, données
  et collage, cases et Tab, export au pixel) ; Tauri sur écran virtuel 17 sur 17 (WebKitGTK
  dessine traits, graphiques, jauge et tableau ; un trait tracé à la souris) ; vitest 44 sur
  44 ; non-régression Chromium 33, 23, 18 et 29 sur 29 une fois l'onglet Dessin attendu dans
  le rail, Tauri 14 sur 14 ; `npm run build` passe.

## 2026-10-14, BRIEF révision 8 : le son

- Demande d'Alexandre : intégrer « voix, parole, musique de fond, jingle, puis le traitement
  et le nettoyage audio », les banques de sons (Freesound, Pixabay Audio, Pexels Music,
  YouTube Audio Library, Free Music Archive) et les bruitages. Avis de Claude : oui, avec
  l'étape 4, parce que le son se cale sur la frise ; l'écrire au BRIEF dès maintenant pour que
  la frise prévoie les pistes audio. Validé par Alexandre (« Je valide »).
- Retenu : onglet Audio, voix enregistrée au micro, nettoyage de la voix en valeurs du
  document, niveau sonore par plateforme, musique qui baisse sous la voix, jingles dans le kit
  de marque, export sans musique pour ajouter un son tendance dans TikTok ou Instagram,
  Freesound intégré (sons CC0 et CC BY seulement, crédit gardé). Tout sur le processeur.
- Écartés ou à la main, après vérification le 2026-10-14 (sources au § 4 du BRIEF) : Pixabay
  Musique (absente de l'API, téléchargement sur le site), Pexels (pas de musique), YouTube
  Audio Library (pas d'API, titres surtout réservés à YouTube), Free Music Archive (pas d'API,
  licence titre par titre). Création de musique par IA : plus tard, elle demande la carte
  graphique.
- Deux points soulevés par Claude (Q3 et Q4) : l'API de Freesound n'est gratuite que pour un
  usage « non commercial » ; Piper, la voix de synthèse locale, est destiné par ses auteurs à
  l'usage personnel. Tranchés le même jour par Alexandre : « pour le moment, il n'est question
  que à usage personnel », Eliot sert à apprendre ; les deux conviennent, à revoir si un jour
  Eliot ou ses vidéos deviennent commerciaux.
- Au passage, un en-tête de tableau en double retiré du § 6.

## 2026-10-14, étape 3, lot 3 : photos Pixabay et kit de marque

- Photos de Pixabay (onglet Photos du rail) : recherche, aperçus et téléchargement passent
  par le noyau Rust (`noyau/src/pixabay.rs`, client HTTPS `ureq` 3 avec rustls, sans moteur
  asynchrone). La clé n'est lue que par le Rust : en développement dans le `.env` du dépôt,
  toujours dans `cles.env` du dossier de configuration d'Eliot
  (`~/.config/fr.alexandredo.eliot/`). L'interface sait seulement si une clé est là et où
  l'ajouter ; un message d'erreur ne contient jamais la clé (test Rust).
- Règles de Pixabay appliquées : rien ne part sur le réseau avant une recherche lancée par
  Alexandre (ouvrir le panneau ne fait rien, des suggestions attendent un clic) ; recherches,
  adresses et aperçus gardés 24 h dans `~/.cache/fr.alexandredo.eliot/pixabay/`, puis retirés
  par Eliot ; au-delà de 24 h, une photo trouvée ne se télécharge plus sans nouvelle
  recherche ; seule la photo choisie est téléchargée (1 280 px), et seulement depuis
  `pixabay.com` ou `cdn.pixabay.com` ; « Photos libres de Pixabay » est écrit au-dessus des
  résultats ; recherche en français, contenu filtré (`safesearch`).
- Licence de Pixabay relevée le 2026-10-14 (https://pixabay.com/service/license-summary/) :
  gratuit, auteur à citer si l'on veut ; interdit d'en faire une marque, un logo ou un nom
  commercial, de revendre la photo telle quelle, de l'utiliser de façon trompeuse. Rappelé
  dans le panneau et dans la description de l'outil pour l'IA.
- La photo choisie est copiée dans le design avec son crédit (source, auteur, lien) : la barre
  contextuelle affiche « Photo : auteur, Pixabay », un clic ouvre la page de la photo dans le
  navigateur (seules les adresses `https://pixabay.com/` sont permises à la fenêtre). Filtres
  par orientation et par couleur ; « Plus de photos » charge la page suivante ; une photo
  glissée sur un cadre ou une maquette va dedans, avec un seul téléchargement par geste.
- Kit de marque (onglet Marque) : un seul kit, dans `~/Documents/Eliot/Marque/kit/`
  (`marque.json`, et les logos dans `ressources/`, rangés comme les images d'un design) : un
  nom, jusqu'à 24 couleurs, les polices du titre, du sous-titre et du texte, des logos. Un clic
  sur une couleur la donne aux objets choisis (texte, remplissage, trait d'une flèche, fond
  d'un cadre, boîtier d'une maquette), ou au fond de la page si rien n'est choisi. Couleurs de
  la marque en tête du sélecteur de couleur, polices de la marque en tête du sélecteur de
  police. Un logo posé est d'abord copié dans le design ; le retirer du kit ne supprime pas
  son fichier.
- Pont IA : 5 outils de plus (36 en tout) : `chercher_photos` (avec une planche d'aperçus
  numérotés, pour que Claude regarde avant de choisir), `ajouter_photo_pixabay`, `marque`,
  `modifier_marque`, `ajouter_logo`. Le pont reconnaît désormais une image JPEG en plus du PNG.
- Écartés : appeler Pixabay depuis l'interface (la clé serait dans la page, contraire à la
  règle 12) ; montrer des photos populaires dès l'ouverture du panneau (une sortie sur le
  réseau sans geste d'Alexandre).
- Défaut trouvé par l'essai dans Tauri et corrigé avant livraison : le dossier des logos du
  kit était cherché comme celui d'un design (« ce design n'existe pas »).
- Essais seulement, en développement : la variable `ELIOT_PIXABAY_ADRESSE` remplace Pixabay
  par un faux serveur local ; sans effet dans la version compilée pour de bon.
- Vérifié dans le conteneur, sans la vraie clé ni le vrai Pixabay (faux serveur local, fausse
  clé) : Chromium 29 sur 29 ; Tauri sur écran virtuel 27 sur 27, dont des clics à la souris
  dans le panneau Photos (WebKitGTK) ; tests Rust du noyau 35 sur 35, du pont 5 sur 5 ;
  vitest 31 sur 31 ; non-régression Chromium 33, 23 et 18 sur 18, Tauri 14 sur 14 et 21 sur
  22 (le seul écart : l'essai du lot 1 attendait 27 outils, il y en a 36). La vraie recherche
  sur Pixabay reste à essayer sur le poste.

## 2026-10-14, étape 3, lot 2 : cadres photo, grilles, maquettes d'appareils

- Cadres (type `cadre`) : huit formes (rectangle, arrondi, rond, arche, organique, hexagone,
  étoile, cœur) qui découpent une photo. La photo couvre toujours le cadre ; son cadrage est
  une valeur du document (`recadrage` : zoom, et la partie visible de 0 à 1), jamais une
  retouche de l'image (règle 13). Une photo glissée depuis le panneau Importer, ou un fichier
  déposé, va dans le cadre qui est dessous ; double-clic pour la faire glisser dans son cadre,
  molette pour l'agrandir, la photo entière se devine autour ; Échap pour finir ; une seule
  étape d'annulation par geste.
- Grilles photo : neuf dispositions qui remplissent la page de cadres vides groupés, avec un
  écart exact entre les cases (les bords sont arrondis au pixel, pas les tailles).
- Maquettes (type `maquette`) : téléphone, tablette, ordinateur, montre, dessinés par Eliot
  (aucun dessin de marque), six couleurs de boîtier, une capture dans l'écran comme dans un
  cadre.
- Photos : coins arrondis et bordure. Pont IA : 4 outils de plus (31 en tout).
- Vérifié : Chromium 18 sur 18 (dépôt dans un cadre, ajustement, molette, Ctrl+Z en une
  étape, grille, maquette, rendu au pixel) ; Tauri par le pont 14 sur 14 (WebKitGTK découpe
  les cadres et arrondit les photos) ; non-régression 33 sur 33 et 23 sur 23 ; vitest 28 sur 28.

## 2026-10-14, étape 3, lot 1 : bibliothèque, panneau Éléments, polices, effets de texte

- Demande d'Alexandre : « Étape 3 d'Eliot » (choix donné par une question). Choix par défaut
  écrits au PLAN avant le code.
- Bibliothèque fabriquée sur le poste (`npm run bibliotheque`, `outils/preparer_bibliotheque.mjs`)
  dans `public/bibliotheque/`, hors git : 7 750 icônes (Tabler 3.49.0 au trait et pleines,
  Phosphor 2.1.1 en six épaisseurs), 4 047 emojis (Fluent Emoji en version plate, OpenMoji
  17.0.0 sans les variantes de couleur de peau), noms français des emojis (CLDR 48.2), 95
  polices de Google Fonts en TTF (38 Mo), chaque fichier contrôlé par son empreinte
  (`outils/polices.verrou.json`). 10 s la première fois, 4 s ensuite. Licences recopiées
  dans `LICENCES-TIERS.md`.
- Écartés : Fluent Emoji en relief (103 Mo) ; Merriweather (9 Mo) et Dela Gothic One (2,5 Mo,
  surtout des caractères japonais), trop lourdes pour ce qu'elles apportent. Gardées : sept
  polices sous licence Apache 2.0 (Permanent Marker, Luckiest Guy…), libres elles aussi.
- Document version 3 : types `icone`, `emoji`, `qr` ; formes `polygone`, `coeur`, `ligne`,
  `fleche` ; ombre sur tous les éléments ; contour, surlignage, capitales et barré pour les
  textes. Un document de version 2 est converti sans autre changement que son numéro (test
  Rust).
- Panneau Éléments (ouvert par défaut) : recherche en français (dictionnaire de 451 mots vers
  les mots-clés anglais des icônes, noms CLDR pour les emojis), formes, lignes et flèches,
  emojis et icônes courants, « Tout voir » par collection, QR code. Panneau Texte : 22
  associations de polices, toutes les polices par genre ; sélecteur de police avec recherche
  et aperçu ; une police sans gras ou sans italique ne reçoit plus de faux gras.
- Polices du poste : le Rust les liste (`fontdb`, largeur normale seulement) et copie celle
  qui sert dans le dossier du design (`ressources/polices/`), qui s'ouvre alors pareil ailleurs.
- Pont IA : 5 outils de plus (27 en tout) ; et un défaut corrigé : un appel arrivé pendant le
  chargement de la fenêtre attendait 120 s pour rien, il attend maintenant que l'interface
  écoute (`ia_pret`).
- Vérifié dans le conteneur : Chromium 23 sur 23 (recherche, pose, QR relu par OpenCV,
  export) ; Tauri sous écran virtuel, piloté par le pont, 22 sur 22 (WebKitGTK dessine
  icônes, emojis, QR, flèche, texte surligné ; police du poste copiée) ; non-régression étape 2
  33 sur 33 (Chromium) et 19 sur 19 (pont) ; vitest 22 sur 22 ; tests Rust du noyau 28 sur 28,
  du pont 4 sur 4 ; `npm run build` passe.

## 2026-10-14, première vidéo par le pont : présentation de Nimeria, principe d'animation retenu

- Demande d'Alexandre : « une petite vidéo pour présenter Nimeria ». Claude compose sept
  scènes dans Eliot par le pont IA (design « Nimeria présentation », story 1080 × 1920, sept
  pages, bleu marine #14243a du site et touches dorées), textes et prix repris de nimeria.fr :
  accroche, « La donnée juste, ou rien. », la règle du « ? », audit SEO dès 9 €, audit de parc
  FDS dès 200 €, paiement à l'acte, essai gratuit.
- Animation faite hors d'Eliot, qui n'anime pas encore (étape 4) : captures des pages par
  l'outil `capture`, puis `01_application/outils/animer_scenes.py`. Le cadre reste fixe, le
  contenu de chaque scène entre par bandes (fondu, montée de 46 px, décalage de 0,13 s entre
  bandes) et s'efface en 0,3 s. MP4 H.264 de 23,5 s, piste son muette (musique ajoutée par
  Alexandre à la publication, avec les sons de la plateforme).
- Écarté : zoom lent sur toute l'image avec fondus enchaînés (premier essai), le cadre se
  dédoublait pendant les fondus et le zoom saccadait d'un pixel à l'autre.
- Alexandre : « Oui, c'est très bien » ; il accepte de garder ce principe pour le mode vidéo
  d'Eliot à l'étape 4, où le noyau Rust l'appliquera aux calques du document.
- Vérifié : images extraites de la vidéo relues une à une ; l'outil rangé dans le dépôt
  reproduit la vidéo livrée à l'image près.

## 2026-10-14, déclarer le pont à l'application Claude : l'extension `.mcpb` en secours

- Constat sur le poste : l'application Claude de bureau installée est le paquet non officiel
  `claude-desktop-unofficial` (projet aaddrick/claude-desktop-debian). L'entrée `eliot` est
  bien dans `~/.config/Claude/claude_desktop_config.json` et le fichier est valide, mais après
  un redémarrage de l'application l'onglet Développeur affiche « Aucun serveur ajouté », le
  journal `mcp.log` reste vide et le bouton « Modifier la configuration » ne fait rien.
- Pistes en cours : `claude-desktop-unofficial --doctor` (vérification de la configuration
  MCP prévue par le paquet) et un arrêt complet de l'application avant de la relancer (son
  LISEZMOI demande de la quitter avant de modifier ce fichier à la main).
- Solution de secours écrite par Claude : `eliot-mcp/emballer_mcpb.py` emballe le pont en
  extension au format MCPB (archive zip : `manifest.json` version 0.3, serveur de type
  binaire, le programme gardé exécutable), à installer depuis Réglages, Extensions, sans
  passer par ce fichier. Produite sur le poste : `eliot-mcp/target/eliot.mcpb`, 852 Ko,
  22 outils ; manifeste accepté par l'outil officiel `@anthropic-ai/mcpb` 2.1.2.
- Rien n'a été modifié dans la configuration de l'application Claude par Claude : le dossier
  `~/.config/Claude` lui est fermé, les changements restent ceux d'Alexandre.
- Extension installée par Alexandre : l'application Claude la charge, les 22 outils
  apparaissent, mais `etat` répond « Eliot n'est pas joignable » alors qu'Eliot est ouvert et
  le pont activé. Cause : l'application lance ses serveurs MCP avec un environnement réduit
  (HOME, LOGNAME, PATH, SHELL, TERM, USER), sans `XDG_RUNTIME_DIR`. Le pont cherchait alors
  le fichier de communication dans `~/.cache/eliot/`, pendant qu'Eliot, lancé depuis un
  terminal, écoutait dans `/run/user/<uid>/eliot/`.
- Correction dans `eliot-mcp` seul (Eliot n'a pas à être recompilé) : le pont essaie
  `$XDG_RUNTIME_DIR`, puis `/run/user/<uid>` (numéro lu sur `/proc/self`), puis `~/.cache`,
  et nomme les chemins essayés dans son message d'erreur. Reproduit puis vérifié dans le
  conteneur : Eliot ouvert avec `/run/user/0`, pont lancé avec le même environnement réduit ;
  l'ancien pont répond « pas joignable », le nouveau répond ; essai complet du pont 19 sur 19,
  tests Rust du pont 4 sur 4 (dont « le second chemin sert si le premier est vide »).
- Pont recompilé, réemballé et réinstallé par Alexandre : depuis cette session liée au poste,
  `etat`, `lister_designs`, `ouvrir_design` et `capture` répondent (design « Design sans
  titre », story 1080 × 1920, vide). Le pont marche de bout en bout sur le poste.

## 2026-10-14, pont vers une IA (MCP), dernier morceau de l'étape 2

- Fait par Claude, comme prévu au BRIEF (§ 6) : programme `eliot-mcp` (Rust, `rmcp` 3.5,
  binaire de 2 Mo), lancé par le client MCP par l'entrée et la sortie standard ; il relaie
  chaque appel vers Eliot ouvert par un fichier de communication local
  (`$XDG_RUNTIME_DIR/eliot/eliot.sock`, dossier 700, fichier 600, aucun port réseau). Côté
  Eliot, `src-tauri/src/ia.rs` écoute seulement si le réglage est activé (Fichier, « Réglages
  et pont IA… », gardé dans `~/.config/fr.alexandredo.eliot/reglages.json`) et passe chaque
  appel à l'interface, qui l'exécute avec les actions du store (`src/ia/outils.ts`).
- 22 outils, décrits une seule fois dans `src/ia/outils.json`, lu par l'interface et inclus
  dans `eliot-mcp` à la compilation : etat, capture (PNG de la page), lister_designs,
  nouveau_design, ouvrir_design, renommer_design, ajouter_texte, ajouter_forme,
  importer_image, ajouter_image, modifier, supprimer, ordre, aligner, repartir, grouper,
  fond_page, pages, changer_format, annuler, retablir, exporter. Aucun ne supprime un design,
  n'efface une image importée ni n'écrit hors des dossiers d'Eliot. Un signal « IA : <outil> »
  s'allume quelques secondes dans la barre du haut à chaque appel.
- Vérifié dans le conteneur : `eliot-mcp` lancé comme par un client MCP, Eliot ouvert sous
  Tauri : 19 vérifications sur 19 (initialisation et consignes, 22 outils listés, story créée,
  fond en dégradé, titre en Bebas Neue, bouton arrondi, photo 24 Mpx importée en 0,9 s et
  posée en gardant ses proportions, alignement, modification groupée, refus clair d'une
  propriété inconnue, capture PNG, duplication de page puis annulation, export, outil inconnu
  refusé, design listé) ; tests Rust du pont 2 sur 2 (dont « Eliot fermé donne un message
  clair ») ; vitest 15 sur 15 (dont la concordance entre outils décrits et outils codés).
- Reste : Alexandre compile le pont, l'active et le déclare à Claude (commandes 13 à 15 du
  `CLAUDE.md`). Une fois déclaré dans l'application Claude de bureau, le pont est aussi
  joignable depuis une session de Claude liée à son poste.

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

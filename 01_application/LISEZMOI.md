# Eliot, l'application

L'éditeur, étapes 1 à 5 du `BRIEF.md` et début de l'étape 6 : un accueil qui range tes
designs, des pages qu'on compose à la souris comme dans Canva, une bibliothèque d'icônes,
d'emojis, de personnages et de polices, des photos et des vidéos libres de Pixabay, un kit de
marque, des modèles de départ, des vidéos montées et animées sur une frise, avec leur musique,
leurs bruitages, ta voix enregistrée au micro et nettoyée ou une voix de synthèse, les blancs et
les « euh » coupés, des sous-titres mot par mot, un enregistrement automatique, l'export en PNG,
JPEG, WebP, PDF vectoriel ou SVG rendu depuis les originaux, l'export des vidéos en MP4 ou en
GIF, un labo pour retoucher les photos comme dans Lightroom, et des objets 3D posés dans la page
comme des photos détourées, que l'on tourne à la souris.

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
- Exporter, en haut à droite : PNG (fond transparent possible), JPEG, WebP (fond transparent
  possible), de ×1 à ×4 (une affiche A4 ou A5 : 150 ou 300 dpi), JPEG et WebP à la qualité
  voulue (curseur Qualité : 92 et 90 par défaut, plus bas pour un fichier plus léger, vers 75
  pour le web), la page affichée ou toutes
  les pages (une image par page) ; PDF vectoriel de toutes les pages (ou de la page affichée),
  les textes sélectionnables, une page A4 ou A5 à la taille de son papier ; SVG de la page
  affichée, textes en tracés et photos dedans. Le tout dans `~/Images/Eliot/`. Depuis l'étape
  5, c'est le noyau qui rend la page, depuis les originaux des photos et les fichiers de
  police : l'export ne dépend plus de la définition des aperçus. Hors de l'application, dans
  un navigateur, seuls le PNG et le JPEG se font (par la fenêtre).

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
  tablette, ordinateur et montre : on y glisse une photo depuis le panneau Importer, ou
  « Choisir » dans la barre du haut ; double-clic pour la faire glisser dans son cadre, molette
  pour l'agrandir. Photos à coins arrondis, bordure.
- Remplacer une photo en gardant sa place : la choisir, « Remplacer » dans la barre du haut, puis
  une image de l'ordinateur. La boîte, la retouche du labo, la perspective, les coins arrondis,
  la bordure et l'ombre restent ; la nouvelle photo est recadrée au centre aux proportions de
  l'ancienne (« Recadrer » pour choisir la partie gardée). Le détourage, propre à l'ancienne
  photo, part : « Détourer » le refait. Une étape d'annulation. Dans un cadre ou une maquette,
  « Remplacer » change la photo et remet son cadrage au centre.
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
- Animer, dans la barre juste au-dessus de la page, pour les éléments choisis : une entrée,
  une sortie et une boucle. Survoler une animation la joue sur la page ; un clic la pose. Sur
  une image fixe, la première animation fait de la page une vidéo de 5 s (un post animé) et la
  frise s'ouvre ; un seul Ctrl+Z revient à l'image fixe. Un texte peut aussi entrer ou sortir par morceaux : machine à écrire,
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
  volume (réglable), en commençant un peu avant la voix et en remontant un peu après. Elle
  baisse aussi là où l'on parle dans une vidéo qu'on entend (le noyau écoute le son de la
  vidéo et y trouve la parole) ; sous une vidéo qui n'a que du bruit d'ambiance, elle joue à
  plein. Deux paroles à moins de 1,2 s l'une de l'autre ne font qu'une baisse.
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

**Les blancs et les sous-titres (étape 4, lot 7)**
- « Blancs », dans la barre d'une vidéo ou d'un son : « Couper les blancs de plus de » 0,6 s
  (de 0,3 à 2 s) et, avec Whisper, « Et les hésitations » (« euh », « hum »). La bulle dit
  d'avance combien de blancs partent et le temps gagné. « Couper » fait du clip des morceaux qui
  se suivent (la piste principale se resserre), en gardant 0,12 s de blanc contre la voix, avec
  un fondu de 10 ms à chaque coupe pour qu'aucune ne claque. L'original n'est jamais touché :
  tirer le bord d'un morceau rend ce qui a été coupé, et Ctrl+Z défait toute la coupe d'un
  coup. Un son détaché de sa vidéo est coupé avec elle.
- Les blancs se mesurent sans rien installer (le noyau écoute le niveau de la voix) ; les
  hésitations et les sous-titres demandent Whisper, qui écoute et écrit la voix sur le
  processeur (commandes 18 et 19 du `CLAUDE.md`, une fois). Une voix n'est transcrite qu'une
  fois : la transcription reste dans le design.
- Onglet Texte, « Sous-titres automatiques » (page vidéo) : choisir un style, la langue,
  puis « Créer les sous-titres ». Whisper écrit ce que disent les vidéos qu'on entend et les
  sons au rôle Voix ; les mots deviennent des sous-titres courts, posés sur une piste au-dessus
  de tout, au milieu de la largeur, en 9:16 juste au-dessus de la zone où TikTok écrit. Quatre
  styles : « Mot surligné » (trois mots au plus, le mot dit en jaune et un peu plus grand),
  « Un mot à la fois », « Mot après mot » (les mots apparaissent quand ils sont dits),
  « Classique » (une phrase sur une bande noire). Les « euh » ne s'écrivent pas, sauf si on le
  demande.
- Ensuite, pour tous les sous-titres à la fois : la taille, la hauteur dans la page, la
  couleur du mot prononcé, les capitales, ou les retirer. Un mot mal compris se corrige comme un
  texte (double-clic sur le sous-titre). Une coupe faite après refait les sous-titres de cette
  voix, avec le même aspect.
- Conseil : couper d'abord, sous-titrer ensuite.

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

**Le labo photo (étape 5, lot 2)**
- Une photo choisie, « Retoucher » dans la barre du haut : le panneau du labo s'ouvre à la
  place du panneau de gauche. Lumière (exposition en IL, contraste, hautes lumières, ombres,
  blancs, noirs), Couleur (température, teinte, vibrance, saturation, le mélangeur : teinte,
  saturation et luminance de huit couleurs, et l'étalonnage), Effets (texture, clarté, correction du voile,
  flou, vignetage, grain), Détail (netteté, réduction du bruit). Un histogramme au-dessus.
- Le flou adoucit toute la photo, de 0 à 100. Pour un sujet net sur un fond flou : poser la
  même photo deux fois, flouter celle du dessous, détourer celle du dessus.
- La photo suit le curseur pendant qu'on le tire. Texture, clarté, voile, flou, netteté et bruit
  regardent les pixels voisins : ils se calculent quand on relâche le curseur (le reste suit en
  direct pendant ce temps).
- Double-clic sur un curseur ou sur son nom : retour à zéro. La valeur se tape au clavier (un
  clic dessus, puis Entrée). « Avant (maintenir) » montre la photo sans retouche ; « Tout »
  remet tout à zéro. Tirer un curseur fait une seule étape d'annulation.
- L'original n'est jamais modifié : les réglages sont gardés dans le design, et chaque export
  (image, PDF, SVG, film) refait la retouche depuis l'original.
- La photo d'un cadre ou l'écran d'une maquette se retouche aussi : « Retoucher » dans la barre
  du haut, une fois la photo posée (les cadres des modèles de départ compris). Le même panneau,
  sans « Recadrer », « Perspective » ni « Détourage » : la photo se place dans son cadre avec
  « Ajuster ». Le vignetage suit la partie qui se voit. Les réglages restent quand on remplace
  la photo ; copier et coller, « Copier le style » et les préréglages passent d'une photo à un
  cadre et inversement.

**Courbe, préréglages, copier et coller (étape 5, lot 3)**
- La courbe des tonalités, sous les curseurs de Lumière : une courbe pour l'image entière
  (RVB), une par canal (Rouge, Vert, Bleu), avec l'histogramme de la photo derrière. Un clic sur
  la courbe y pose un point qu'on glisse ; un double-clic l'enlève (un bout revient à sa
  place) ; un point choisi bouge aux flèches (Maj : de 10) et part avec Suppr. Seize points au
  plus par courbe.
- L'étalonnage, sous le mélangeur : une teinte (de 0 à 360°) et sa force (de 0 à 100) pour
  les ombres, les tons moyens et les hautes lumières, puis l'équilibre, qui donne plus de
  place aux ombres ou aux hautes lumières. Une teinte choisie sans force en reçoit une de 25
  pour qu'on la voie. Il vient après la saturation : il colore donc aussi une photo passée en
  noir et blanc (sépia, noir et blanc bleuté).
- Les préréglages, en tête du panneau : 25 styles dessinés par Claude, rangés en Naturel,
  Couleur, Film, Noir et blanc et Sujets. Chaque vignette montre ta photo avec le style ; la
  survoler le montre sur la page sans rien changer ; un clic l'applique (une étape
  d'annulation). Juste après, un curseur règle son intensité, de 0 à 100 %. Un préréglage
  remplace la retouche et garde l'exposition, la netteté, le flou et la réduction du bruit de la
  photo, propres à chacune.
- « Enregistrer comme préréglage » garde le style de la photo sous un nom, dans « Les miens »
  (rangés hors des designs, dans `~/Documents/Eliot/Préréglages/`). La corbeille d'une
  vignette, au survol, le supprime après confirmation.
- Copier les réglages d'une photo ou d'un clip (Ctrl+Maj+C, ou les boutons en haut du labo, ou
  le clic droit) et les coller sur une ou plusieurs images choisies (Ctrl+Maj+V, ou le bouton de
  la barre du haut) : tous les réglages passent, exposition comprise, en une étape
  d'annulation. « Copier le style » (Ctrl+Alt+C) emporte aussi la retouche.

**Les clips vidéo au labo (étape 5, lot 4)**
- Un clip choisi montre aussi « Retoucher » : le même panneau, les mêmes réglages, les mêmes
  préréglages, copier et coller d'une photo à un clip et inversement.
- Le clip suit les réglages à l'arrêt comme pendant la lecture : chaque image passe par le
  shader au moment où la page la dessine. Texture, clarté, voile, flou, netteté et bruit se voient à
  l'arrêt (le noyau les calcule sur l'image affichée, quand on relâche le curseur) ; pendant la
  lecture, seulement à l'export.
- Le grain d'un clip change 24 fois par seconde, comme celui d'un film.
- L'export retouche chaque image du film depuis l'original (MP4, GIF), et l'image d'un clip à
  l'instant voulu pour un PNG, un JPEG, un PDF ou un SVG. Les vignettes de la frise restent
  sans retouche.

**Recadrer et redresser (étape 5, lot 5)**
- Une photo ou un clip : double-clic dessus, ou « Recadrer » dans la barre du haut, ou la
  section « Recadrer et redresser » du labo. Le reste de l'image se devine, assombri, autour du
  cadre gardé, avec la grille des tiers pour placer le sujet.
- Les huit poignées tirent les bords et les coins du cadre (la photo ne bouge pas) ; Maj garde
  les proportions. Glisser dans le cadre fait glisser la photo dessous ; la molette la rapproche
  ou l'éloigne ; les flèches la poussent d'un pixel (Maj : de dix). Le cadre s'arrête toujours au
  bord de l'image : jamais de coin vide.
- Proportions prêtes : Libre, Original, Page (celles du format du design), 1:1, 4:5, 3:2, 4:3,
  16:9, et le bouton qui les passe en hauteur ou en largeur. Un clic donne le plus grand cadre
  de ces proportions, au plus près du cadre actuel ; les poignées les gardent ensuite.
- Redresser : le curseur (de -45 à +45°, au dixième de degré, ou la valeur tapée) tourne la
  photo autour du cadre, qui se resserre juste assez pour ne pas montrer de coin vide ; une
  grille fine aide pendant qu'on le tire. « Auto » cherche l'horizon, ou une verticale nette, et
  la remet droite. « Tracer l'horizon » : tracer sur la photo une ligne qui devrait être droite.
- Entrée finit, Échap revient au cadre d'avant, Ctrl+Z défait geste par geste. « Remettre »
  rend toute l'image, droite. La boîte de l'objet sur la page devient le cadre gardé : coins
  arrondis, bordure et ombre le suivent ; le vignetage aussi (il assombrit les bords du cadre,
  pas ceux de l'image entière).
- L'original n'est jamais modifié : le recadrage est gardé dans le design, et l'export le
  refait depuis l'original (image, PDF, SVG, film).

**La perspective (étape 5, lot 6)**
- Poser une photo ou un clip sur l'écran d'un ordinateur, la face d'une boîte, une affiche en
  biais : « Retoucher », section « Perspective », « Poser les coins ». Quatre poignées rondes
  apparaissent aux coins du visuel ; chacune se pose sur un coin de l'écran, de la boîte ou de
  l'affiche. Le contour et la grille des tiers suivent la perspective ; glisser dans le visuel
  le déplace tout entier.
- Les flèches poussent le dernier coin tiré d'un pixel (Maj : de dix). Entrée finit, Échap
  revient aux coins d'avant, Ctrl+Z défait coin par coin. Ensuite, un double-clic sur le visuel
  reprend ses coins.
- Pour aller plus vite, quatre perspectives prêtes, à ajuster ensuite : Fuit à gauche, Fuit à
  droite, Fuit vers le haut, Fuit vers le bas. « À plat » rend le visuel droit dans sa boîte.
- La boîte de l'objet sur la page est celle des quatre coins : la déplacer, l'agrandir ou la
  tourner emmène la perspective. Coins arrondis, bordure et ombre suivent la perspective, les
  retouches du labo aussi ; un clip en perspective se lit et s'exporte image par image.
- Le recadrage se fait à plat : « À plat » (les coins s'effacent), recadrer, puis reposer les
  coins. Ce qui part en perspective est le cadre gardé.
- L'export refait la perspective depuis l'original, par le noyau (PNG, JPEG, WebP, PDF, SVG, MP4,
  GIF), avec les mêmes formules que la fenêtre. Dans le PDF et le SVG, le visuel posé devient une
  image, assez fine pour l'original ; le reste de la page reste vectoriel.

**Le détourage (étape 5, lot 7)**
- Une photo choisie : « Détourer » dans la barre du haut, ou « Retirer le fond » dans la section
  « Détourage » du labo. Un modèle d'IA, BiRefNet (licence MIT), cherche le premier plan sur le
  processeur de l'ordinateur, jamais sur la carte graphique : quelques secondes, une barre
  d'avancement, « Annuler » l'arrête. Le fond devient transparent ; l'ombre de la photo suit
  alors la silhouette du produit.
- « Reprendre les bords » : un pinceau sur la page. Effacer retire ce qui reste du fond, Garder
  rend ce que le modèle a retiré ; ce qui est retiré se devine, à peine, sous la photo. Taille
  et dureté dans le panneau ; X change de mode, [ et ] la taille. Chaque coup est une étape
  d'annulation ; Entrée finit, Échap revient au détourage d'avant le pinceau.
- « Revenir au masque du modèle » retire les coups ; « Remettre le fond » rend la photo entière.
- L'original n'est jamais touché : le masque du modèle est rangé avec la photo dans le design
  (`ressources/masques/`), fait une fois, relu ensuite ; les coups de pinceau sont gardés dans
  le document. L'export pose le masque sur l'original (PNG, transparent ou non, JPEG, WebP, PDF,
  SVG) ; recadrage et perspective s'ajoutent par-dessus.
- Une photo seulement : un clip demanderait un masque par image. Le programme et le modèle
  s'installent une fois : commandes 20 et 21 du `CLAUDE.md`.

**Le studio 3D (étape 6, lots 1 à 4)**
- Importer un modèle 3D comme une image : bouton du panneau Importer, ou dépôt sur la page. GLB,
  glTF (avec ses fichiers rangés à côté de lui : choisir ou déposer le `.gltf` seul suffit),
  FBX (les personnages de Mixamo, par exemple) et OBJ. Le noyau vérifie le fichier et prépare la
  copie que la fenêtre affiche, textures ramenées à 2048 px ; l'original reste tel quel dans le
  design. La carte du panneau Importer montre le modèle rendu, avec la mention « 3D ».
- Posé au centre comme une photo détourée : fond transparent, éclairage de studio, le modèle
  centré dans sa boîte, vu de trois quarts. La boîte se déplace, se redimensionne, se tourne,
  prend une ombre et de la transparence comme une photo.
- Le tourner sur la page : double-clic sur l'objet, ou « Tourner » dans la barre du haut.
  Glisser le tourne, Maj et glisser le décale, la molette le rapproche, les flèches le tournent
  de 5° (Maj : de 15°). Entrée finit, Échap revient à la vue d'avant. Un geste, une étape
  d'annulation.
- « Vue 3D » dans la barre : le panneau 3D. Vues prêtes (face, trois-quarts, profil, dos,
  dessus, contre-plongée), rotation, hauteur de vue, zoom et focale (en millimètres, comme sur
  un appareil photo : 85 à 135 pour un produit sans déformation, 24 à 35 pour une perspective
  marquée), « Recentrer », « Départ » ; et ce que l'on sait du modèle (format, triangles,
  matières, animations).
- La lumière (lot 2), dans « Vue 3D » : quatre environnements qui éclairent et se reflètent
  (Studio, Boîtes à lumière pour le verre et le métal, Plein air, Soleil couchant), leur force et
  leur rotation ; la lumière principale, prête (trois-quarts, de face, latérale, contre-jour,
  zénith) ou réglée (direction, hauteur, force, couleur) ; l'exposition. Elle tourne avec la vue,
  comme le studio d'un plateau tournant : tourner l'objet ne déplace pas ses reflets.
- L'ombre au sol : le modèle porte son ombre sur un sol invisible, sous lui, et se pose sur la
  page au lieu de flotter ; opacité et douceur ; elle part de la lumière principale et s'efface
  en s'éloignant du modèle. Elle se cumule avec l'ombre de la barre du haut (celle de la boîte).
- Les matières : chacune, par son nom dans le modèle, prend une couleur (les couleurs du kit de
  marque sont dans la pastille ; une matière qui a une texture est teintée) et une brillance, de
  mate à miroir. Survoler une matière la montre sur l'objet. Le modèle n'est pas modifié : un
  autre objet du même modèle garde ses couleurs. « Copier le style » passe la lumière, l'ombre au
  sol et les matières d'un objet 3D à un autre.
- L'export rend l'objet à la finesse demandée : à ×2, il est dessiné à ×2, pas agrandi. Dans le
  PDF et le SVG, il devient une image deux fois plus fine que sa boîte (à la finesse de la page
  pour un A4 ou un A5). L'objet est rendu par la fenêtre, en WebGL ; le noyau le pose avec le
  reste de la page.
- Les banques (lot 3), onglet 3D du rail. Modèles : Kenney (les paquets rangés sur le poste,
  licence CC0, sans réseau), Poly Haven (modèles réalistes, CC0, par mots ou par catégorie,
  téléchargés en glTF 1k avec leurs textures), Sketchfab (seulement les modèles sous licence
  CC0 ou CC BY ; la recherche marche sans clé, le téléchargement demande la clé d'API
  d'Alexandre, `SKETCHFAB_API_KEY` dans le `.env`). Un clic pose le modèle au centre, un glisser
  le pose sous le pointeur. Les mots français courants sont traduits pour ces banques, qui
  cherchent en anglais (« flacon de parfum » devient « bottle perfume »).
- Le crédit reste avec le modèle (source, auteur, licence, lien) : « Vue 3D », section Modèle,
  avec « Copier le crédit », le texte à recopier sous une publication (une licence CC BY
  l'exige), et « Page du modèle ». Éviter dans une publicité les modèles qui reproduisent une
  marque ou un logo connus.
- Mixamo (personnages animés, compte Adobe gratuit) : la marche à suivre dans l'onglet 3D
  (télécharger en « FBX Binary », « With Skin »), puis « Importer un FBX ».
- Environnements HDRI : une photo à 360° qui éclaire l'objet et se reflète dans ses matières.
  Onglet 3D, Environnements : ceux de Poly Haven (studios, intérieurs, extérieurs, ciels, en 1k),
  ou « Importer un .hdr » (un `.hdr` déposé sur la page fait de même) ; un clic éclaire les
  objets 3D choisis. Rangés dans le design, ils s'ajoutent aux quatre environnements fournis
  dans « Vue 3D », section Lumière (« Plus d'environnements » ouvre l'onglet). Coller un objet 3D
  dans un autre design emporte son modèle et son environnement.
- Le mouvement (lot 4), sur une page vidéo, dans « Vue 3D », section Mouvement : le plateau
  tournant (l'objet tourne sur lui-même, un tour en quelques secondes, vers la droite ou la
  gauche) et la caméra par images clés : avec le losange de la frise (ou « Poser une image clé à
  la tête de lecture »), la vue de l'instant se garde ; à un autre instant, tourner l'objet ou
  régler sa vue pose une autre image clé, et la caméra glisse de l'une à l'autre pendant la
  lecture, en douceur ou de façon régulière. Sur une image fixe, « Faire de cette page une
  vidéo ».
- L'animation du modèle (un personnage de Mixamo, un modèle qui en a) : la choisir, sa vitesse,
  en boucle ou une fois, l'instant de départ ; sur une image fixe, l'objet montre l'instant
  choisi (une pose au lieu du T). Sur la frise, le clip montre une icône pour le plateau et une
  pour l'animation. Couper ou rogner le clip ne fait pas sauter le mouvement.
- La lecture montre le mouvement ; l'export en image d'une page vidéo, l'objet à l'instant de la
  tête de lecture.
- Le film (lot 5) : en MP4 ou en GIF, un objet 3D qui bouge est rendu image par image avant le
  film, à la taille du film, avec son ombre au sol et son ombre portée. L'export dure plus
  longtemps (la fenêtre dit « Objets 3D, image par image » et le nombre d'images) ; Annuler
  l'arrête à tout moment.

**Laisser une IA piloter Eliot**
- Fichier, « Réglages et pont IA… » : un interrupteur ouvre le pont. Une IA comme Claude peut
  alors lire le design, poser et modifier des objets, gérer les pages, importer une image du
  poste, chercher et poser des photos de Pixabay, importer ou chercher des vidéos et les poser
  (coupe, vitesse, volume), monter une page vidéo (temps et pistes des clips, scinder, tête de
  lecture, capture à un instant), animer (entrées, sorties, boucles, images clés, transitions,
  styles de texte pour la vidéo), importer, chercher (Freesound) et poser des sons, les
  régler, nettoyer une voix, faire dire un texte par une voix de synthèse, détacher le son
  d'une vidéo, transcrire une voix, couper les blancs et les hésitations, poser des
  sous-titres, se servir du kit de marque, dessiner à main levée, poser des graphiques et des
  tableaux, partir d'un modèle de départ, retoucher une photo, un clip, ou la photo d'un cadre ou
  d'une maquette au labo (courbe et préréglages compris, enregistrer un préréglage), les recadrer et les redresser (proportions,
  angle, horizon trouvé seul), les poser en perspective (quatre coins sur la page ou une
  perspective prête), détourer une photo (le fond retiré par le modèle, les bords repris au
  pinceau), remplacer une photo à sa place, importer un modèle 3D ou en chercher un dans les
  banques (Kenney, Poly Haven, Sketchfab), le poser, régler sa caméra, sa lumière (environnements
  HDRI de Poly Haven compris) et son ombre au sol, repeindre ses matières, le faire bouger sur une
  page vidéo (plateau tournant, caméra par images clés, animation du modèle), regarder une capture de la page
  et exporter (en
  PNG, JPEG ou WebP à la qualité voulue, PDF ou SVG, ou en MP4 et en GIF pour une page vidéo,
  avec la version sans musique). On la voit travailler dans la fenêtre, et Ctrl+Z défait
  chacune de ses actions. Mise en place : commandes 13 à 15 bis du `CLAUDE.md`.

## Essayer la vidéo (étape 4)

Un parcours d'une vingtaine de minutes, dans l'ordre où l'on monte une vidéo. Avant, une fois :
commandes 16 à 19 du `CLAUDE.md` (Piper, ses voix, Whisper, son modèle) ; puis Eliot lancé à la
main, carte graphique libre (commande 10).

1. Accueil, format Story (9:16). Importer une vidéo filmée au téléphone où tu parles : la
   bande d'avancement, puis la frise s'ouvre. Espace : la lecture doit être fluide, le son
   calé sur l'image.
2. Importer une seconde vidéo : elle se met au bout. Le petit bouton entre les deux clips :
   un fondu enchaîné. Rejouer le passage.
3. La vidéo qui parle choisie, Son, « Détacher le son » : la voix passe sur sa piste (la
   musique baissera sous elle). Puis Blancs : l'aperçu dit combien de secondes partent ;
   cocher les hésitations, Couper. Rejouer : la voix s'enchaîne sans claquement. Tirer le bord
   d'un morceau rend ce qui avait été coupé ; Ctrl+Z défait toute la coupe.
4. Onglet Texte, Sous-titres automatiques, « Mot surligné », Créer. À noter : le temps de
   Whisper, le mot jaune qui suit la voix, les mots mal compris (double-clic pour corriger).
5. Un titre (un style pour la vidéo), Animer : une entrée, une boucle ; dans la frise, tirer
   la zone claire pour changer la durée. Un emoji : le losange de la frise pose une image clé ;
   avancer la tête de lecture puis déplacer l'emoji en pose une autre.
6. Onglet Audio : une musique de Freesound, posée d'un clic ; elle couvre toute la vidéo et
   baisse sous la voix. Un bruitage glissé dans la frise. Une phrase dite par la voix de
   synthèse.
7. Onglet Audio, « Ta voix », « Enregistrer au micro », puis « Enregistrer » : compte à
   rebours, parler, Espace pour finir. « Voix nette » est déjà posée sur la prise.
8. Exporter, MP4, TikTok, avec la version sans musique : le film dans `~/Vidéos/Eliot/`. Le
   regarder en entier : le son, les sous-titres, la transition, le titre.
9. Une nouvelle page, un texte, Animer : la page devient un post animé de 5 s ; l'exporter en
   GIF.

Ce qui m'aide le plus en retour : ce qui ne joue pas de façon fluide, un son en retard sur
l'image, un geste de la frise qui ne fait pas ce que tu attends, et les temps relevés (import,
Whisper, export).

## Essayer les exports (étape 5, lot 1)

Quelques minutes, Eliot lancé à la main, carte graphique libre (commande 10). Avant, une fois :
la commande 13 du `CLAUDE.md` (le pont IA apprend les nouveaux formats).

1. Accueil, format A4, puis le panneau Modèles : « Affiche de festival ». Glisser dans le cadre
   une photo de ton appareil, prise à la verticale (onglet Importer).
2. Exporter, PNG, 300 dpi : l'image fait 2480 × 3508 px. L'ouvrir et zoomer sur la photo : elle
   vient de l'original, nette, et droite.
3. Exporter, PDF : l'ouvrir dans la visionneuse de documents. Zoomer très fort sur un titre :
   il reste net ; sélectionner un texte et le copier. Propriétés du document : format A4.
4. Ajouter une deuxième page, Exporter, PDF, Toutes : un seul fichier de deux pages.
5. Exporter, SVG : l'ouvrir dans Firefox ou dans Inkscape, elle est identique.
6. Un post carré, Exporter, WebP, ×2, fond transparent : le comparer au PNG (taille du fichier).

Ce qui m'aide le plus en retour : un texte qui ne tombe pas au même endroit qu'à l'écran (un
mot, une ligne qui change), une couleur différente, et le temps d'un PDF de plusieurs pages.

## Essayer le labo photo (étape 5, lot 2)

Dix minutes, Eliot lancé à la main, carte graphique libre (commande 10). Avant, une fois :
recompiler l'application (commande 9) et le pont (commande 13).

1. Un post carré, une photo de ton appareil (onglet Importer), plutôt un peu terne ou à
   contre-jour. La choisir, « Retoucher ».
2. Tirer Exposition, puis Ombres et Hautes lumières : la photo suit le curseur sans à-coups.
   Noter si ça accroche.
3. Température vers le jaune, Vibrance : une ambiance plus chaude. Maintenir « Avant » pour
   comparer.
4. Clarté et Texture, puis relâcher : le détail ressort après un court instant. Noter ce temps.
5. Le mélangeur : le bleu du ciel plus profond (Saturation, Luminance), sans toucher au reste.
6. Double-clic sur un curseur : il revient à zéro. Ctrl+Z : le geste d'avant revient, d'un coup.
7. Exporter en PNG ×2, puis en PDF : la retouche est dans les deux, et la photo est nette (elle
   vient de l'original).

Ce qui m'aide le plus en retour : un curseur qui accroche, le temps après avoir relâché Clarté,
une retouche qui ne ressemble pas à ce que fait Lightroom, et un export qui diffère de l'écran.

## Essayer la courbe et les préréglages (étape 5, lot 3)

Dix minutes, mêmes conditions que le lot 2 (commande 10 ; avant, une fois, commandes 9 et 13).

1. Un post carré, deux ou trois photos de ton appareil, de sujets différents (un produit, un
   portrait, un paysage). En choisir une, « Retoucher ».
2. Préréglages : passer la souris sur les vignettes, catégorie par catégorie. La page montre
   chaque style au survol. Noter ceux qui te plaisent et ceux qui ne servent à rien.
3. En appliquer un, puis baisser son intensité vers 50 %.
4. La courbe, sous Lumière : poser un point vers le quart bas et le descendre, un autre vers le
   quart haut et le monter (une courbe en S). Puis le canal Bleu : monter un peu le bout du
   noir (des ombres bleutées).
5. « Enregistrer comme préréglage », un nom à toi. Choisir une autre photo : il est dans « Les
   miens ».
6. Ctrl+Maj+C sur la première photo, choisir les deux autres (Maj+clic), Ctrl+Maj+V : elles
   prennent la même retouche. Ctrl+Z la défait d'un coup.
7. Exporter en PNG et en PDF : la courbe et le préréglage sont dans les deux.

Ce qui m'aide le plus en retour : les préréglages à garder, à changer ou à jeter, la sensation
de la courbe sous la souris (trop sensible, pas assez), et ce qui manque pour tes styles à toi.

## Essayer les clips au labo (étape 5, lot 4)

Dix minutes, mêmes conditions (commande 10 ; avant, une fois, commandes 9 et 13).

1. Une story, un clip de ton appareil de quelques secondes (onglet Importer). Le choisir,
   « Retoucher ».
2. Un préréglage (Film chaud, par exemple), puis Lire (Espace) : la retouche suit la lecture.
   Noter si la lecture saccade, et à partir de combien de clips sur la page.
3. Pause, puis Clarté et Texture : le détail ressort à l'arrêt, après un court instant.
4. Grain vers 40, Lire : le grain bouge avec le film.
5. Ctrl+Maj+C sur le clip, choisir une photo de la page, Ctrl+Maj+V : la photo prend le même
   style.
6. Exporter en MP4 : le film est retouché du début à la fin. Noter le temps de l'export, avec
   et sans la retouche.

Ce qui m'aide le plus en retour : la fluidité de la lecture retouchée, le temps de l'export, et
un écart entre ce que montre la page et le film exporté.

## Essayer l'étalonnage et la musique sous une vidéo qui parle

Cinq minutes, mêmes conditions (commande 10 ; avant, une fois, commandes 9 et 13).

1. Une photo, « Retoucher », Couleur, Étalonnage : Ombres vers 210° (bleu), force 30 ; Hautes
   lumières vers 35° (orange), force 25. Puis l'Équilibre : à gauche les ombres prennent plus de
   place, à droite les hautes lumières.
2. Préréglages, Noir et blanc : Sépia, puis Noir et blanc bleuté.
3. Une story, une vidéo où tu parles (avec son), une musique de l'onglet Audio, puis Lire : la
   musique baisse quand tu parles et remonte dans les silences. La première fois, l'analyse
   du son de la vidéo prend un instant.
4. Exporter en MP4 : la même baisse dans le film.

Ce qui m'aide le plus en retour : la force de l'étalonnage (trop ou pas assez marquée vers 30),
et une musique qui baisse trop souvent, ou pas assez tôt.

## Essayer le recadrage (étape 5, lot 5)

Dix minutes, mêmes conditions (commande 10 ; avant, une fois, commandes 9 et 13).

1. Un post carré, une photo de paysage de ton appareil où l'horizon penche un peu. Double-clic
   dessus : le mode recadrage.
2. « Auto » : la photo se redresse ; noter si l'angle est juste. Sinon « Tracer l'horizon », et
   tracer le long de l'horizon.
3. Tirer le coin bas droit vers l'intérieur, puis glisser la photo dans le cadre pour placer
   l'horizon sur la ligne du tiers bas de la grille.
4. 4:5, puis le bouton qui pivote : le cadre passe en largeur. Entrée pour finir.
5. Double-clic encore, tirer le curseur Redresser jusqu'à 10°, puis Échap : tout revient.
6. Effets, Vignetage vers -50 : les bords du cadre s'assombrissent.
7. Une story, un clip, « Recadrer », 9:16 : le clip remplit la story ; Lire, puis exporter en
   MP4.
8. Exporter le post en PNG et en PDF : le recadrage et l'angle y sont.

Ce qui m'aide le plus en retour : une photo où « Auto » se trompe (à m'envoyer si possible), la
sensation des poignées (trop petites, trop sensibles), et les proportions qui te manquent.

## Essayer la perspective (étape 5, lot 6)

Dix minutes, mêmes conditions (commande 10 ; avant, une fois, commandes 9 et 13).

1. Un post carré. En fond, une photo de ton appareil où l'on voit de biais un écran d'ordinateur
   ou de téléphone (ou une affiche, la face d'une boîte). Par-dessus, une autre photo ou une
   capture d'écran : le visuel à poser.
2. Le visuel choisi, « Retoucher », Perspective, « Poser les coins ». Tirer chaque poignée sur un
   coin de l'écran de la photo ; zoomer (Ctrl + molette) et finir aux flèches, coin par coin.
   Entrée.
3. Dans la barre du haut, Coins vers 20, puis une bordure fine et une ombre : elles suivent la
   perspective.
4. Double-clic sur le visuel : les coins reviennent. En tirer un, puis Échap : ceux d'avant
   reviennent.
5. Un second visuel : « Fuit à gauche », puis l'ajuster.
6. Une story, une photo d'écran en fond, un clip posé dessus par ses coins ; Lire, puis exporter
   en MP4.
7. Exporter le post en PNG ×2 et en PDF : zoomer sur le visuel posé, il est net et tombe au même
   endroit qu'à l'écran.

Ce qui m'aide le plus en retour : la précision des poignées (un coin difficile à viser), la
netteté du visuel posé, à l'écran et à l'export, et les objets sur lesquels tu voudrais poser un
visuel sans y arriver (une boîte vue sur deux faces, un écran courbe).

## Essayer le détourage (étape 5, lot 7)

Dix minutes. Avant, une fois : les commandes 20 et 21 du `CLAUDE.md` (le programme, puis le
modèle), puis recompiler l'application (commande 9) et le pont (commande 13). Ensuite Eliot
lancé à la main, carte graphique libre (commande 10).

1. Un post carré, une photo de produit de ton appareil (un flacon, une tasse, une chaussure),
   sur un fond quelconque. La choisir, « Détourer » dans la barre du haut. Noter le temps du
   modèle.
2. Le fond part, la page blanche paraît. Zoomer sur les bords : là où le modèle hésite (une
   anse, un reflet, une ombre portée sur la table).
3. « Reprendre les bords » : Effacer sur ce qui reste du fond, puis X et Garder sur ce qui
   manque du produit. Essayer [ et ] pour la taille, la dureté vers 30 % pour un bord doux.
   Ctrl+Z défait coup par coup ; Entrée pour finir.
4. Ombre dans la barre du haut : elle suit le produit. Changer le fond de la page pour une
   couleur, puis un dégradé.
5. Exporter en PNG avec un fond transparent, puis en PDF : le produit seul, net, depuis
   l'original.
6. Une photo de personne, puis une photo où le sujet se détache mal du fond : noter ce que le
   modèle réussit et rate.

Ce qui m'aide le plus en retour : le temps du modèle sur ton poste, les photos où il se trompe
(à m'envoyer si possible), et la sensation du pinceau (taille, dureté, précision du bord).

## Essayer l'étape 5 en entier : une publicité de produit

Vingt minutes, après les essais des lots (ou à leur place). Avant : recompiler l'application
(commande 9) et le pont (commande 13), puis Eliot lancé à la main, carte graphique libre
(commande 10).

1. Un post carré. Une photo d'ambiance de ton appareil (un intérieur, une rue) : « Recadrer »,
   1:1, puis l'étirer sur toute la page. « Retoucher », Effets, Flou vers 40 : le fond s'adoucit
   au relâchement du curseur.
2. La photo du produit par-dessus, « Détourer » ; Ombre dans la barre du haut.
3. « Retoucher » le produit : le préréglage « Produit net », intensité vers 80 %, un peu
   d'exposition. Un titre au-dessus.
4. Une petite photo dans un coin, coins arrondis, saturation à -100. « Remplacer » dans la barre
   du haut, une autre image : elle prend la même place, en noir et blanc, coins arrondis
   compris. Ctrl+Z, puis Ctrl+Y.
5. Exporter en JPEG : le curseur Qualité dit 92. L'exporter une fois à 92, une fois à 60, et
   comparer le poids des deux fichiers et l'image, zoomée.
6. Une deuxième page : une photo d'écran d'ordinateur, un visuel posé dessus en perspective
   (lot 6), puis « Remplacer » ce visuel : les coins restent.
7. Une troisième page, depuis le modèle « Avant / après » : une photo dans chaque cadre,
   « Retoucher » celle de droite (un préréglage, un peu de vignetage) ; « Avant (maintenir) »
   la montre sans retouche.
8. Exporter en PDF, toutes les pages, puis en WebP : tout y est, depuis les originaux.
9. Fermer le design (retour à l'accueil), le rouvrir : tout est là, à l'identique.

Ce qui m'aide le plus en retour : ce qui manque pour une vraie publicité, les gestes qui
coincent, et la qualité de JPEG que tu retiens pour tes réseaux.

## Essayer l'objet 3D (étape 6, lot 1)

Dix minutes, Eliot lancé à la main, carte graphique libre (commande 10) : la 3D s'affiche par la
carte graphique, comme toute la fenêtre. Avant : `npm install` (commande 8, three.js arrive),
recompiler l'application (commande 9) et le pont (commande 13). Un modèle pour l'essai : un GLB
gratuit de Poly Haven (polyhaven.com, onglet Models, format glTF, 1k), ou un personnage de
Mixamo en FBX.

1. Un post carré. Onglet Importer, « Importer des images, des vidéos, de la 3D », le modèle :
   il se pose au centre, fond transparent ; sa carte apparaît dans le panneau, rendue.
2. Double-clic sur l'objet : le bandeau « Glisser pour tourner » s'affiche. Le tourner, le
   rapprocher à la molette, le décaler avec Maj. Échap : il revient comme avant. Recommencer,
   puis Entrée.
3. « Vue 3D » : essayer les vues prêtes, puis la focale à 24 mm et à 135 mm (la perspective
   change, pas la taille). « Recentrer ».
4. Ombre dans la barre du haut : elle suit la silhouette du modèle. Un titre au-dessus.
5. Exporter en PNG ×2 : zoomer sur l'objet, il est net. Puis en PDF.
6. Fermer le design, le rouvrir : l'objet a gardé sa vue.

Ce qui m'aide le plus en retour : la fluidité quand on tourne un gros modèle (sur le poste et
sur le mini PC), un modèle qui ne s'ouvre pas (son format, d'où il vient), et ce qui manque
d'abord pour une publicité : la lumière, les couleurs des matières (lot 2).

## Essayer la lumière et les matières (étape 6, lot 2)

Dix minutes, à la suite de l'essai du lot 1, Eliot lancé à la main, carte graphique libre.

1. L'objet 3D choisi, « Vue 3D », section Lumière : passer d'un environnement à l'autre, puis
   « Boîtes à lumière » sur un modèle en verre ou en métal (les reflets).
2. « Contre-jour », puis « Latérale » ; tirer Direction et Hauteur : l'objet suit sous la souris.
   Couleur de la lumière : une teinte chaude. Exposition à +0,5.
3. Double-clic sur l'objet et le tourner : les reflets restent à leur place dans l'image.
4. Ombre au sol, cocher : l'objet se pose. Douceur à 0 puis à 100 %.
5. Matières : survoler chaque ligne pour voir laquelle est où ; donner à l'une une couleur du kit
   de marque, baisser la brillance d'une autre. Dupliquer l'objet (Ctrl+D), puis « Toutes » sur la
   copie : l'original garde ses couleurs.
6. Exporter en PNG ×2 et en PDF : la lumière, l'ombre et les couleurs y sont.

Ce qui m'aide le plus en retour : l'environnement qui manque pour tes publicités (un fond de
studio coloré, une vitrine), une matière mal nommée par le fichier, et la fluidité quand on tire
un curseur sur le mini PC.

## Essayer les banques 3D (étape 6, lot 3)

Quinze minutes, Eliot lancé à la main, carte graphique libre. Avant, une fois : un ou deux
paquets 3D de Kenney (kenney.nl, catégorie 3D, par exemple Food Kit ou Furniture Kit : un
fichier .zip chacun) rangés dans `Eliot/telechargements/kenney/`, puis `npm run bibliotheque`
(commande 8 bis) ; la clé de Sketchfab est déjà dans le `.env`.

1. Un post carré, onglet 3D du rail, Kenney : choisir un paquet, filtrer en français
   (« pomme », « chaise »), cliquer un modèle, puis en glisser un autre sur la page.
2. Poly Haven : « bouteille », puis une catégorie (Contenants, Mobilier). Poser un modèle : la
   bande d'avancement montre le téléchargement. « Vue 3D », section Modèle : le crédit.
3. Sketchfab : « chaussure » ; CC0 seulement, puis CC BY ; cocher Animés. Poser un modèle CC BY :
   le crédit dit qu'il faut citer l'auteur ; « Copier le crédit », le coller dans un texte. Si un
   message parle de clé refusée, me le dire tel quel (sans la clé).
4. Environnements : l'objet choisi, un ciel de Poly Haven, puis un studio. Dans « Vue 3D »,
   section Lumière, passer de l'un à l'autre et aux quatre fournis.
5. Mixamo : suivre la marche à suivre avec ton compte Adobe, importer le FBX.
6. Copier un objet 3D éclairé par un HDRI, le coller dans un autre design : il arrive pareil.
   Exporter en PNG ×2.

Ce qui m'aide le plus en retour : un modèle qui ne s'ouvre pas (sa banque, son nom), un mot
français que la recherche ne comprend pas, et le temps d'un téléchargement sur ta connexion.

## Essayer l'animation 3D (étape 6, lot 4)

Dix minutes, Eliot lancé à la main, carte graphique libre. Un personnage de Mixamo (voir l'essai
du lot 3) et un objet, un flacon de Poly Haven par exemple.

1. Un post carré, le personnage posé. « Vue 3D », Animation du modèle : choisir son animation,
   puis « Instant montré » : il prend la pose de cet instant.
2. Section Mouvement : « Faire de cette page une vidéo ». Lecture (Espace) : il bouge.
3. Le flacon posé à côté, « Vue 3D » : Plateau tournant, un tour en 6 s ; lecture. Puis vers la
   gauche.
4. Tête de lecture au début, losange de la frise (une image clé) ; tête à 3 s, tourner le flacon
   sur la page et le rapprocher à la molette : une seconde image clé. Lecture : la caméra glisse.
   « Régulier », puis « En douceur ».
5. Couper le clip au milieu (Scinder) : à la lecture, aucun saut.
6. Exporter en PNG avec la tête de lecture à 2 s : l'image est celle de la fenêtre à cet instant.

Ce qui m'aide le plus en retour : la fluidité pendant la lecture sur le poste et sur le mini PC
(un objet qui bouge, puis deux), une animation de Mixamo qui ne joue pas, et le mouvement de
caméra qui manque d'abord pour une publicité.

## Essayer le film 3D (étape 6, lot 5)

Dix minutes, Eliot lancé à la main, carte graphique libre, avec le design de l'essai du lot 4.

1. Le personnage qui danse et le flacon sur son plateau, une ombre portée sur le personnage
   (Ombre, dans la barre de l'objet) et un titre par-dessus.
2. Exporter, MP4, 1080 : la fenêtre d'export dit « Objets 3D, image par image », puis les images du
   film. Noter le temps total.
3. Lire le film : il bouge comme à la lecture dans Eliot, l'ombre portée suit le personnage, le
   titre reste devant.
4. Exporter en GIF : même mouvement, plus petit.
5. Relancer un export et cliquer Annuler pendant « Objets 3D » : rien n'est écrit.

Ce qui m'aide le plus en retour : le temps d'export d'un film de 10 à 15 s sur le poste et sur le
mini PC, et une image du film qui différerait de la fenêtre au même instant.

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
| Ctrl+Maj+C, Ctrl+Maj+V | copier les réglages du labo d'une photo ou d'un clip, les coller sur ceux choisis |
| Double-clic sur une photo ou un clip | recadrer ; puis Entrée pour finir, Échap pour revenir au cadre d'avant, flèches pour pousser la photo, molette pour la rapprocher |
| Double-clic sur un objet 3D | le tourner ; glisser tourne, Maj et glisser décale, molette rapproche, flèches tournent de 5° (Maj : 15°) ; Entrée pour finir, Échap pour revenir à la vue d'avant |
| Double-clic sur un visuel en perspective | reprendre ses coins ; puis Entrée pour finir, Échap pour revenir aux coins d'avant, flèches pour pousser le dernier coin tiré (Maj : de dix) |
| X, [ et ], Entrée, Échap (pinceau du détourage) | effacer ou garder, taille plus petite ou plus grande, finir, revenir au détourage d'avant |
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
  `copies/` et `ondes/` ; pour les voix nettoyées, `traitees/`, refait au besoin ; pour la
  parole, `transcriptions/`, où l'on parle et ce qui est dit, quelques kilo-octets ; pour les
  photos détourées, `masques/`, le masque du modèle, 1024 x 1024 en niveaux de gris ; pour les
  modèles 3D, l'original dans `originaux/` (un glTF y devient un GLB), la copie aux textures
  réduites dans `copies/` quand il en faut une, l'aperçu et la miniature rendus par la fenêtre ;
  pour les environnements HDRI, le `.hdr` dans `originaux/`, une copie de 2048 px de large au
  plus dans `copies/` s'il est plus grand, l'aperçu et la miniature tonifiés par le noyau ; le
  crédit d'un modèle ou d'un environnement venu d'une banque dans `infos/`).
  Le dossier
  se copie tel quel d'une machine à l'autre ; le fichier `.eliot` en est une archive zip (sans
  `traitees/`).
- Les prises de voix : rangées dans le design comme les sons importés (`Prise 1`, `Prise 2`, et ainsi de suite).
- Les voix de Piper : `Eliot/telechargements/voix/` (commande 17), hors git ; les textes dits,
  en cache dans `~/.cache/fr.alexandredo.eliot/piper/`.
- Le modèle de Whisper : `Eliot/telechargements/whisper/faster-whisper-small/` (commande 19),
  hors git.
- Le détourage : `Eliot/telechargements/detourage/`, hors git : `env/` (Python et onnxruntime,
  commande 20) et le modèle `birefnet.onnx` (commande 21).
- Les paquets 3D de Kenney : `Eliot/telechargements/kenney/` (les .zip), hors git ; leurs
  modèles prêts dans `public/bibliotheque/kenney/` (commande 8 bis).
- Les caches des banques 3D : `~/.cache/fr.alexandredo.eliot/polyhaven/` (index 24 h, aperçus
  7 jours) et `.../sketchfab/` (recherches et aperçus, 24 h) ; les téléchargements y passent
  avant d'entrer dans le design, puis en partent.
- Modèles maison : `~/Documents/Eliot/Modèles/`.
- Préréglages du labo enregistrés : `~/Documents/Eliot/Préréglages/prereglages.json` (ceux
  qu'Eliot fournit sont dans le code, `src/modele/prereglages.json`).
- Exports : `~/Images/Eliot/AAAA-MM-JJ_HHMMSS_eliot.png` (ou `.jpg`, `.webp`, `.pdf`, `.svg`,
  avec `_page-01`… pour une image par page), jamais d'écrasement. Les films : `~/Vidéos/Eliot/AAAA-MM-JJ_HHMMSS_eliot.mp4`
  (ou `.gif`), écrits sous un nom provisoire puis renommés une fois finis ; la version sans
  musique à côté, `…_sans-musique.mp4`.
- Un design supprimé part dans la corbeille d'Ubuntu.

## Plan du code

```
01_application/
├── noyau/            Rust sans Tauri : images, vidéos (videos.rs), sons (sons.rs, son.rs), la voix (micro.rs, voix.rs, piper.rs), la parole et Whisper (parole.rs), designs (projet.rs), exports, export vidéo (montage.rs, animation.rs, sous_titres.rs), polices, Pixabay, Freesound (freesound.rs), kit de marque, export d'une page en image, PDF et SVG (rendu_page.rs), le labo photo (labo.rs), l'horizon d'une photo (horizon.rs), la perspective (perspective.rs), le détourage (detourage.rs, et detourer.py, le programme qui fait tourner le modèle), les modèles 3D (modeles3d.rs), les environnements HDRI (environnements3d.rs), les banques 3D (polyhaven.rs, sketchfab.rs, et reseau.rs pour leurs téléchargements) (cargo test)
├── src-tauri/        la fenêtre, les commandes de l'interface (src/commandes.rs), le pont IA (src/ia.rs)
├── eliot-mcp/        le programme que lance l'application Claude pour piloter Eliot (MCP)
├── public/bibliotheque/  icônes, emojis, polices, personnages, modèles de Kenney : fabriqués par npm run bibliotheque, hors git
├── src/
│   ├── App.tsx       l'accueil ou l'éditeur
│   ├── bibliotheque/ catalogue des polices, associations, mots français, recherche, rendu des icônes et des personnages
│   ├── accueil/      l'accueil : formats, designs, modèles
│   ├── modele/       le document (types.ts), la fabrication des objets, la géométrie, les personnages composés, les règles de la frise (frise.ts), les animations (animation.ts), les sons (son.ts), le nettoyage de la voix (voix.ts) et les sous-titres (sousTitres.ts) et les réglages du labo (labo.ts, courbe comprise) avec les préréglages fournis (prereglages.ts et prereglages.json), le recadrage et le redressement (rognage.ts), la perspective (perspective.ts), le masque du détourage et ses coups de pinceau (detourage.ts), avec leurs tableaux de valeurs attendues communs avec le Rust, la coupe des blancs (parole.ts), les styles de texte pour la vidéo, les zones sûres (zonesSures.ts), la caméra d'un objet 3D (objet3d.ts) et son mouvement sur une page vidéo (mouvement3d.ts)
│   ├── modeles/      les modèles de départ, dessinés pour Eliot
│   ├── etat/         le store, l'enregistrement automatique, les opérations sur les designs, la prise de voix (prise.ts), les voix nettoyées (nettoyage.ts), la parole, la coupe des blancs et les sous-titres (parole.ts)
│   ├── pont/         le seul fichier qui parle à Tauri (repli navigateur pour les tests)
│   ├── editeur/      la zone de travail Konva, les barres, les panneaux, les pages, la lecture des vidéos (videos.ts) et des sons (sons.ts), la frise (frise/), remplacer une photo à sa place (remplacer.ts)
│   ├── labo/         le labo photo : le panneau Retoucher, la courbe (EditeurCourbe.tsx), les préréglages (Prereglages.tsx, et prereglages.ts pour ceux d'Alexandre), le shader de l'aperçu en direct (shader.ts, un moteur pour les photos, un pour les clips), les photos et les clips retouchés affichés, copier et coller les réglages (retouche.ts), le recadrage (recadrage.ts, et CadreRognage.tsx pour le cadre sur la page), la perspective (miseEnPerspective.ts, CadrePerspective.tsx pour les quatre coins sur la page, moteurPerspective.ts pour le shader qui pose le visuel), le détourage (detourage.ts, et CadrePinceau.tsx pour le pinceau sur la page)
│   ├── trois/        le studio 3D : le moteur three.js qui rend les objets et leurs miniatures (moteur.ts), l'objet sur la page (RenduObjet3d.tsx), le mode Tourner (orbite.ts, CadreOrbite.tsx), le panneau 3D (Panneau3d.tsx), les banques et l'onglet 3D du rail (banques.ts, PanneauBanques.tsx)
│   ├── export/       la page décrite en calques SVG pour le noyau (calques.ts, contexteSvg.ts), export en image et en document (exporter.ts), rendu hors écran par Konva (rendu.ts, hors de l'application), export vidéo et réglages par plateforme (video.ts, plateformes.ts)
│   ├── ia/           les outils offerts à l'IA (outils.json, outils.ts) et leur pilote
│   └── reglages/     la fenêtre des réglages
└── outils/           fabrication de la bibliothèque (personnages : personnages.mjs ; paquets de Kenney : kenney.mjs), dessin de l'icône, prototype du texte animé, conversion du modèle du détourage (convertir_birefnet.py)
```

Le document est un objet JSON, seule source de vérité ; Konva ne fait que le dessiner. Pendant
un geste, les objets saisis passent sur un calque à part et reviennent à leur place dans la
pile avant l'écriture dans le document (règle 11). Tests de l'interface : `npm test`.

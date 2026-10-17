# JOURNAL.md — Eliot

Journal antichronologique des décisions. La plus récente en haut. Une entrée = une date, un
titre, ce qui a été décidé, par qui, ce qui a été écarté, et la preuve (fichier, commit, run).

---

## 2026-10-17, étape 7 : vérification de l'étape, et rapport de fin

Accord d'Alexandre (« Go. »). Ce que Claude a fait et décidé :

- Relecture de l'étape contre le BRIEF (§ 6, rail et catalogue ; § 7) et le PLAN. Tout ce que
  l'étape promettait est là. La relecture du rail trouve un manque que le relevé du 2026-10-17
  avait laissé passer, plus deux petits, comblés :
  - L'onglet Projets du rail (BRIEF § 6 : « Modèles, Éléments, Texte, Photos, Importer, Marque,
    Dessin, Projets, Calques »). Comme celui de Canva : tes autres designs, du plus récent au
    plus ancien, à chercher par leur nom (sans souci des accents ni des majuscules) ; le détail
    d'un design pour l'ouvrir, ajouter ses pages après la page affichée (mises à l'échelle comme
    Redimensionner quand le format diffère, la photo du fond suit la page), ou poser une copie
    de ses photos, vidéos, modèles 3D et sons, avec leurs crédits. L'autre design n'est jamais
    modifié (le noyau copie les fichiers, comme le collage d'un design à l'autre). Pont :
    `reprendre_design` (80 outils). Choix de Claude : pas de miniature par page de l'autre
    design (seule la première page en a une ; les rendre demanderait de charger ses images),
    des numéros à la place.
  - La recherche par mot de l'onglet Importer (BRIEF § 6 : « chaque panneau a sa recherche par
    mot ») : nom du fichier, auteur ou banque d'une photo, « vidéo », « 3D ». Marque, Dessin et
    Calques n'ont rien à chercher.
  - Les crédits à recopier sous la publication (fenêtre d'export, et `credits` d'`exporter`)
    comptent les photos et les vidéos de Pexels, dont l'API demande de citer le photographe
    quand c'est possible : « Photo de … sur Pexels » et la page du photographe. Pixabay reste
    hors de la liste (sa licence ne le demande pas). Ce n'est pas « obligatoire » (CC BY seul).
  - Le rail compte onze onglets ; il défile s'il ne tient pas en hauteur (le mini PC).
  - Une page reprise (ou des textes collés) d'un autre design emporte la police du poste de ses
    textes dans le dossier du design ouvert (BRIEF § 6 : le design s'ouvre pareil sur une autre
    machine) ; le collage d'un design à l'autre ne le faisait pas non plus.
- Défaut trouvé en construisant l'onglet Projets, corrigé : ouvrir ou créer un autre design
  depuis l'éditeur (Fichier, le pont, et maintenant l'onglet Projets) ne refaisait pas la
  miniature de celui qu'on quittait ; son minuteur partait ensuite sur le design suivant, et
  l'accueil gardait l'ancienne image (seul le retour à l'accueil la refaisait). Avant de quitter
  un design, sa miniature est refaite si un changement l'attend encore
  (`miniatureAvantDeQuitter`, `etat/enregistrement.ts`).
- Les deux vérifications du son joué (pont des sons, étape 4), notées au lot 5 : la lecture
  d'Eliot était juste. L'enregistrement de l'essai (`parec`, sur la sortie muette de
  PulseAudio) mettait jusqu'à 1,3 s à démarrer quand le conteneur était chargé ; son début
  manquait et le premier son entendu servait de repère. Relu dans l'enregistrement : chaque son
  part à son instant, la musique baisse à 30 % sous la voix. L'essai attend désormais que
  l'enregistrement tourne avant de lancer la lecture : 26 sur 26.
- Une publicité faite de bout en bout par le pont, dans Tauri, avec ce que l'étape apporte (un
  faux Pexels et un faux Pixabay locaux) : une story « Café d'automne », la photo de Pexels en
  fond, sa couleur prise à la pipette pour le texte du bouton, un titre courbé dont le style
  part dans le kit puis se pose sur l'accroche, une liste à puces, deux textes que les alertes
  signalent (contraste 1,4 : 1, 5,1 px vus sur un téléphone) et qui ne le sont plus une fois
  corrigés comme elles le conseillent, des calques nommés, un logo repris d'un autre design
  (`reprendre_design`, puis l'onglet Projets à la souris), les aides à l'écran. Mesures, sur
  255 : les aides à l'écran ne passent pas dans la capture (0,000) ; PNG contre la fenêtre
  0,57 (adouci 0,46) ; PDF par poppler contre le PNG 1,38 ; SVG par Chromium 0,15 ; annuler et
  rétablir le titre recourbé, 0,000 ; la page dupliquée 0,000 ; déclinée en carré, la photo du
  fond couvre le carré et le PNG suit la fenêtre (adouci 0,33) ; le format annulé 0,000 ; le
  design rouvert 0,000, calques nommés, courbe, liste et photo du fond gardés ; la miniature
  de l'accueil à jour. Une page vidéo de Pexels, le titre au style de la marque, en MP4 pour
  Reels : à 1 s, l'image du film contre la fenêtre, 0,35 (adouci) ; la page reprise dans un
  autre design, même image. Les crédits rendus nomment le photographe et le vidéaste de Pexels.
- Le rapport de fin : section « Avant les essais : les commandes, dans l'ordre » du
  `01_application/LISEZMOI.md` (les commandes complètes, les clés, l'ordre des parcours), un
  parcours neuf pour les étapes 1 à 3 (il n'y en avait pas) et « Essayer l'étape 7 en entier :
  une story d'automne ». L'introduction du LISEZMOI dit enfin les sept étapes.

Vérifié dans le conteneur : interface 306 (6 de plus : reprendre des pages et des ressources,
chercher un design, les crédits de Pexels), `npm run build` ; noyau inchangé depuis le lot 5
(146) ; Chromium : l'onglet Projets et l'Importer (19), les lots 1 à 5 de l'étape (30, 53, 30,
46, 24), l'étape 3, lot 3 (28 sur 29 : sa vérification de la liste du rail attendait dix
onglets ; mise à jour avec Projets, la liste lue était la bonne), l'étape 4, lots 5 et 6 (44,
37), l'étape 6, lot 1 (63) ; Tauri : la publicité (24, plus 3 pour sa page vidéo et 1 pour la
police du poste), les lots 1 à 5 de l'étape (8, 16, 10, 15, 18 ; le lot 4 à son second passage :
au premier, un clic de l'essai sur la pastille de couleur, pendant que la fenêtre se repeignait,
n'a pas ouvert la bulle), l'animation par le pont de l'étape 4 (16), les banques 3D (34), le
pont des sons (26). Les vérifications qui comptaient les outils en comptent 80 ; celle du lot 1
clique l'onglet Calques à sa nouvelle place.

## 2026-10-17, étape 7, lot 5 : Pexels, construit avant la clé

Demande d'Alexandre : Pexels ne délivre toujours pas de nouvelles clés, « mais si tu peux déjà
le construire, et le jour où il y aura les API de retour, je le mettrai dans Env ». Ce que
Claude a fait et décidé :

- L'API relue le 2026-10-17 (pexels.com/api/documentation) : `v1/search` et `v1/videos/search`,
  la clé dans l'en-tête `Authorization`, 200 demandes par heure et 20 000 par mois, un lien bien
  visible vers Pexels là où ses résultats s'affichent, le photographe cité quand c'est possible.
  Licence (pexels.com/license) : citer n'est pas obligé ; interdit de revendre une photo telle
  quelle, de s'en servir dans une marque, de laisser croire qu'une personne montrée approuve un
  produit. Les deux adresses de recherche répondent 401 sans clé (elles existent) ; aucune clé
  n'a servi.
- Noyau : `noyau/src/pexels.rs`, sur le modèle de Pixabay : la clé lue dans le `.env`
  (`PEXELS_API_KEY`), envoyée à l'API seulement, jamais aux serveurs d'images ni dans une
  adresse ; recherches et aperçus 24 h en cache (Pexels n'en dit rien : la même discipline que
  Pixabay) ; la photo choisie dans sa taille d'origine (Pixabay ne donne que 1 280 px) ; la
  vidéo en 1080p (le plus grand fichier MP4 dont le petit côté ne dépasse pas 1080, ni le 4K
  ni le HLS) ; seules les adresses de Pexels sont téléchargées ; un message clair pour une clé
  refusée et pour la limite atteinte. Tant que la clé manque, chaque demande relit le `.env` :
  la clé ajoutée sert sans relancer Eliot.
- Le crédit gagne la page de l'auteur (`lien_auteur`, facultatif : les designs d'avant ne
  changent pas) : « Photo de … sur Pexels » dans la barre du haut, un clic ouvre la page de la
  photo, « son profil » celle du photographe.
- Panneau Photos : en haut, Pixabay ou Pexels, pour les photos comme pour les vidéos ; la même
  recherche passe de l'une à l'autre, chacune garde la sienne, le choix est gardé. Les filtres
  sont les mêmes pour les deux et chacune reçoit ce qu'elle sait faire : le carré et une couleur
  de la marque (un code #rrggbb) chez Pexels seulement, le noir et blanc chez Pixabay seulement,
  le lilas devient violet chez Pexels ; les vidéos de Pexels se filtrent par sens chez Pexels.
  Sans clé, le panneau dit où ajouter `PEXELS_API_KEY` et propose les photos de Pixabay.
- Correction : la fenêtre n'ouvrait que les liens de pixabay.com ; ceux de Freesound, de Kenney,
  de Mixamo, des bibliothèques de musique et les pages des crédits de Freesound, Poly Haven et
  Sketchfab ne s'ouvraient pas, sans message (constaté dans le code du greffon : la liste est
  comparée à la lettre). La liste des sites permis compte maintenant ces sites et Pexels, et
  seulement eux ; l'adresse est écrite en entier avant d'être comparée.
- Pont : `source` (pixabay par défaut, ou pexels) dans `chercher_photos` et `chercher_videos`,
  deux outils neufs, `ajouter_photo_pexels` et `ajouter_video_pexels` (79 outils).

Preuves (conteneur de Claude, contre un faux Pexels) : 7 essais Rust de plus (146 : la clé dans
l'en-tête et jamais vers les images, les filtres envoyés, le cache, les origines refusées, le
choix du fichier vidéo, clé refusée et limite, rien sans clé, le nettoyage du cache) ; dans
Chromium, 24 vérifications (la bascule, la clé qui manque puis « Réessayer », les filtres
traduits, une couleur de la marque, la photo posée et son crédit, les trois liens ouverts, la
même requête chez Pixabay, la recherche gardée, les vidéos par sens, le pont) ; dans Tauri, 18
(sans clé, le panneau et le pont ; la clé ajoutée au fichier, « Réessayer » sans relancer ; une
recherche et une photo posée à la souris ; la clé dans l'en-tête de l'API seulement ;
l'originale téléchargée ; le lien « Pexels » ouvert par la fenêtre, noté par un faux xdg-open ;
le pont, le 1080p d'une vidéo en portrait ; les crédits relus à la réouverture ; le PNG du noyau
; Pixabay relancé par la bascule, une de ses photos posée à la souris). Repassés : Chromium,
l'étape 3, lot 3 (29 ; deux vérifications suivent le panneau : le lien « Pixabay » cherché par
son repère, l'orientation choisie par son nouveau nom), l'étape 4, lots 1, 6 et 7 (41, 37, 44 ;
celle du lot 1 cherchait le bouton Son par une infobulle que le lot 3 de l'étape 7 a rallongée :
rendue exacte), l'étape 7, lots 2 et 4 (53, 46) ; Tauri, l'étape 7, lot 4 (15), l'étape 6, lot 3
(34), le pont des vidéos et de l'animation de l'étape 4 (25, 16), et celui des sons (24 sur 26)
: ses deux vérifications du son joué, mesurées sur la sortie de PulseAudio du conteneur, tombent
à côté d'un essai à l'autre (de 0,1 à 0,8 s), sans rapport avec ce lot ; elles sont à reprendre
à la vérification de l'étape. Les vérifications qui comptaient les outils (61, 63, 77) en
comptent 79.

## 2026-10-17, étape 7, lot 4 : couleur, fond, thème

Suite du feu vert d'Alexandre pour le lot 4. Ce que Claude a fait et décidé :

- Pipette : un bouton Pipette dans chaque choix de couleur (onglet Uni), et une petite pipette
  pour le départ et pour l'arrivée d'un dégradé. La fenêtre de WebKitGTK n'a pas la pipette du
  système (l'EyeDropper des navigateurs n'y existe pas) : la pipette lit la page. Le clic prend
  le pixel affiché par le calque de la page (photo, retouches, objets 3D, vidéo à l'instant de
  la tête) ; si cette toile ne se lisait pas, la page est rendue hors écran en ce point. Une
  loupe grossit 11 × 11 pixels de l'écran sous le viseur et dit leur couleur. Échap, un clic
  droit, un clic à côté de la page ou dans une barre renoncent, sans ôter la sélection. La
  bulle se ferme quand la pipette commence, pour voir la page entière. Écarté : prendre une
  couleur hors de la page (la fenêtre ne voit pas le reste de l'écran).
- Photo en fond : un cadre marqué `enFond`, toujours le premier élément, à la taille de la
  page, rectangulaire, droit, hors de tout groupe. Une photo y passe en devenant un cadre
  (recadrée au centre, ses retouches et son nom gardés), un cadre rempli tel quel ; une autre
  photo mise en fond détache la précédente. Elle n'écoute pas la souris, sauf pendant son
  ajustement : un clic, le rectangle de sélection et Ctrl+A ne la prennent pas, ce qui est
  posé dessus se choisit et se glisse sans la bouger ; un double-clic sur la page, hors des
  objets, l'ajuste ; pas de poignées. Elle se range après chaque modification (ordre, format,
  pont) : rien ne passe dessous, un changement de format la recale sur la page. Une page vidéo
  n'en a pas : sa piste principale fait déjà le fond (la marque s'en va quand la page devient
  vidéo, le bouton est grisé). Écarté : une image dans le réglage du fond de la page ; le cadre
  garde ce qu'un cadre sait faire (ajuster, labo, exports du noyau) sans rien de neuf ailleurs.
- Thème : clair (par défaut, comme Eliot l'a toujours été), sombre, ou comme le système, dans
  les Réglages (Apparence) ; gardé par la fenêtre. Les gris de l'interface s'inversent par les
  variables de couleur de Tailwind, le blanc des surfaces devient un gris très sombre ; les
  îlots déjà sombres (frise, bulles d'aide, tuiles des styles, bloc des commandes, aperçu)
  gardent leurs couleurs. La page, ses couleurs, les vignettes et les exports sont dessinés par
  Konva et par le noyau : ils ne changent pas ; un liseré discret autour de la page la détache
  du plan sombre, où son ombre ne se voit plus. Dans Tauri, la barre de titre suit (droit
  `core:window:allow-set-theme` ajouté) et « comme le système » lit le thème de GTK par la
  fenêtre, puis ses changements. Un relevé du contraste de chaque texte visible, dans 20 états
  de l'interface (accueil, chaque onglet du rail, un texte et une photo choisis, la bulle des
  couleurs, le labo, les menus, les réglages, l'export, une page vidéo), en clair puis en
  sombre : aucun ne se lit moins bien en sombre ; les plus pâles (les astuces) passent de
  2,6 : 1 à 4 : 1.
- Pont : `fond_page` met en fond une photo de la page ou une image importée, la détache
  (`photo: null`) et règle son cadrage ; `etat` donne `photoDuFond` ; un outil neuf,
  `couleur_page`, la pipette de Claude : la couleur vue en un point, ou la moyenne d'un carré
  autour (77 outils) ; `aides` change le thème.

Preuves (conteneur de Claude) : 8 essais vitest de plus (300 : la photo devenue fond, détachée,
rangée, ôtée d'une page vidéo ; dans le store, l'annulation, Ctrl+A, deux photos, le format ; la
pipette qui donne la couleur une fois) ; dans Chromium, 46 vérifications (mettre en fond,
capture, clic, rectangle de sélection, Ctrl+A, double-clic et glisser de l'ajustement, ordre,
format, détacher, annuler ; pipette d'un texte avec sa loupe, Échap, clic à côté, clic dans un
panneau, départ d'un dégradé, fond de la page ; couleur_page et fond_page ; thème sombre avec la
page et la capture identiques au pixel, bulle d'aide restée sombre, règles redessinées, choix
gardé, comme le système en suivant ses changements ; page vidéo) ; dans Tauri, 15 (image
importée mise en fond par le pont, PNG et PDF du noyau contre la fenêtre, couleur_page mesurée
par WebKit, un clic et un double-clic à la souris, la pipette à la souris qui lit la toile de
WebKit, à une unité près, #c1392b pour le #c0392b de la photo, comme couleur_page, Échap, le
thème sombre à l'écran avec la page au pixel près, le thème de GTK lu, le design rouvert).
Repassés : Chromium, étapes 2 (33), 3, lots 1 et 3 (23, 29), 4, lots 2 à 7 (38, 44, 18, 44, 37,
44), correctifs (23), étape 5 (15 et le recadrage, 27), étape 6, lots 1 à 4 (63, 48, 34, 44),
étape 7, lots 1 à 3 (30, 53, 30) ; Tauri, l'étape 7, lots 1 à 3 (8, 16, 10), les exports de
l'étape 5 (62), l'étape 6, lots 4 et 5 (19, 20), l'animation de l'étape 4 par le pont (16). Les
vérifications d'avant qui comptaient 76 outils en comptent 77.

## 2026-10-17, étape 7, lot 3 : les aides pour apprendre

Suite du feu vert d'Alexandre pour le lot 3. Ce que Claude a fait et décidé :

- Un bouton Aides dans la barre du bas, à côté des pages, et son menu : règles, grille (pas
  réglable), grille des tiers, marges de sécurité, zones sûres, alertes de lisibilité. Rien de
  tout cela n'entre dans le document ni dans un export ; les choix sont gardés par la fenêtre,
  comme la hauteur de la frise. Un objet glissé s'aimante aux lignes montrées (grille, tiers,
  bords des marges), en plus des repères d'avant.
- Règles : le long du haut et de la gauche de la zone de travail, la page en blanc, la
  sélection en couleur, un grand trait chiffré tous les 60 px d'écran au moins (pas de 1, 2 ou
  5 fois une puissance de dix). En pixels de la page ; en millimètres pour une A4 ou une A5
  (300 dpi). Maj+R, comme dans Canva.
- Marges de sécurité : 5 % du plus petit côté sur un écran (le bord arrondi d'un téléphone, un
  recadrage), 5 mm sur le papier (ce que l'imprimeur peut rogner). Grille : 60 px par défaut,
  10 mm sur le papier.
- Zones sûres : sur toute page en 9:16, fixe ou vidéo (elles n'étaient que sous la frise), et
  une quatrième, « Story » : la zone sûre unique de Meta pour le 9:16, telle que le garde-fou
  du gestionnaire de publicités l'applique (14 % en haut, 35 % en bas, 6 % sur les côtés ;
  relevée par adsuploader.com, page du 2026-07-31, lue le 2026-10-17). Prudente pour une story
  sans publicité.
- Alertes de lisibilité, calculées au repos (0,9 s après le dernier changement, pas pendant la
  lecture ni pendant un geste) sur la page affichée :
  - Contraste : le rapport du WCAG 2 (luminances relatives) entre les lettres et ce qui est
    derrière elles, mesuré sur la page rendue hors écran (photo, vidéo à l'instant de la tête,
    objets 3D compris) : la page jusqu'au texte, son surlignage compris, et les lettres seules,
    dans la zone du texte ; le fond se lit sous les lettres et autour d'elles. Le rapport retenu
    est celui que tient presque tout le texte (le 15e centile) : un texte dont un sixième se perd
    compte comme peu lisible. Seuil du niveau AA : 4,5 : 1, ou 3 : 1 pour un grand texte (24 px
    vus, ou 18,66 en gras). Un contour épais qui tranche à la fois sur le fond et sur les lettres
    compte ; l'opacité aussi ; une ombre, non.
  - Taille : là où la page sera vue. Sur un téléphone tenu droit (390 × 844 px, la page tient
    entière) : sous 12 px vus, un texte se lit mal (34 px de page pour un post carré, 60 pour
    une vidéo paysage). Imprimée (A4, A5) : sous 8 points (34 px à 300 dpi).
  - Une marque ambrée au coin du texte (un clic le choisit), le nombre sur le bouton Aides, la
    liste dans son menu ; le bouton Lisibilité de la barre du texte dit pourquoi et propose une
    correction d'un clic : lettres blanches ou presque noires si l'une des deux suffit partout
    (sinon, sur un fond trop varié, seulement le surlignage), un surlignage, la taille
    conseillée.
  - Mesure : un cache par texte (rien ne se remesure si ni lui ni ce qui est sous lui n'a
    changé), et tous les rendus d'une mesure montés d'un coup. Dans WebKitGTK, rendre chaque
    zone à part coûtait 5 s pour cinq textes (le montage et l'attente d'image dominaient) ;
    groupés, 0,3 s.
- Infobulles : un relevé dans Chromium de tous les boutons à icône seule et de tous les
  réglages, dans 25 états de l'interface (accueil, chaque onglet du rail, chaque sorte
  d'élément choisie, labo, page vidéo, menus) : aucun sans infobulle. Celles qui ne faisaient
  que nommer l'outil disent maintenant à quoi il sert : les onglets du rail, Fichier,
  Redimensionner, Exporter, les réglages du texte (position, espacement, listes, courbe,
  styles, effets, capitales), coins, bordure, ombre, transparence, les sections du labo et du
  panneau 3D.
- Pont : `etat` donne la lisibilité de la page (où elle sera vue, la taille de police minimale)
  et ses alertes, mesurées à l'instant de l'appel, chacune avec son conseil ; un outil neuf,
  `aides`, montre ou masque les aides à l'écran (pour montrer quelque chose à Alexandre) :
  76 outils.

Preuves (conteneur de Claude) : 18 essais vitest de plus (292 : unités, graduations, grille,
tiers, marges ; luminances et rapports de référence du WCAG, dont #767676 sur blanc ; mesure sur
des rendus fabriqués, à cheval sur deux fonds, opacité, contour ; taille vue sur un téléphone et
en points ; alertes et conseils) ; dans Chromium, 30 vérifications (menu, choix gardés, règle
lue au pixel, Maj+R, aimantation au tiers, cinq textes et leurs alertes, marques, puce,
corrections, plus d'alerte une fois corrigé, le pont et l'outil aides, alertes masquées, rendu
sans aide, story fixe, A4 en millimètres et en points, infobulles du rail) ; dans Tauri, 10
(mêmes alertes mesurées par WebKit, temps de la mesure, marques à l'écran et un clic à la
souris, aides à l'écran, Maj+R au clavier, PNG du noyau sans aide, page vidéo mesurée sur le
bleu puis sur le jaune d'un clip). Repassés : Chromium, étapes 2 (33), 3, lots 1 et 3 (23, 29),
4, lots 2 à 7 (38, 44, 18, 44, 37, 44), correctifs (23), étape 5 (15 et le recadrage, 27),
étape 6, lots 1 à 4 (63, 48, 34, 44), étape 7, lots 1 et 2 (30, 53) ; Tauri, les exports de
l'étape 5 (62), la vérification de l'étape 6 (17, avec les vraies banques), les rendus croisés
(4), le film 3D (20), l'étape 7, lots 1 et 2 (8, 16), l'animation de l'étape 4 par le pont (16).
Deux vérifications d'avant cherchaient une infobulle par son texte exact (« Effets »,
« Police ») : mises à jour.

## 2026-10-17, étape 7, lot 2 : le texte

Suite de l'accord d'Alexandre (« Feu vert. »). Ce que Claude a fait et décidé :

- Texte courbé : un curseur Courbe, de -100 (en sourire) à 100 (en arche, presque un cercle). Le
  texte, sur une ligne, suit un arc de cercle tracé par Konva (son tracé de texte) ; l'arc a la
  longueur de la ligne, son angle suit la courbe. La boîte du texte devient celle de l'arc,
  autour du même centre, rotation comprise ; il grandit par les coins (la courbe reste),
  « Redresser le texte » le remet sur une ligne. Rien de neuf dans le noyau : chaque lettre
  s'enregistre en SVG, tournée, comme à l'écran.
- En route, trois manières de Konva contournées : il pose les lettres une à une, à leur largeur
  seule, et laisse tomber celle qui dépasse le bout de l'arc (la ligne se mesure donc à sa
  façon, avec un peu de marge) ; il donne pour boîte celle des pieds des lettres (poignées et
  survol prennent désormais celle de l'arc) ; son repérage à la souris ne prenait que les
  lettres (toute la boîte se prend, le creux de l'arc compris).
- Listes : à puces ou numérotées, une ligne du texte par élément ; la marque dans le retrait (la
  plus large, plus un demi-cadratin), la suite de la ligne alignée sous le texte ; à l'écriture,
  la zone de saisie laisse ce retrait. Un texte courbé n'est pas une liste : courber une liste
  la défait, et les boutons de liste se grisent sur un texte courbé.
- Styles de texte : gardés dans le kit de marque, nommés, 24 au plus, d'un design à l'autre :
  police, taille, couleur (dégradé compris), gras, italique, souligné, barré, capitales,
  interligne, espacement, alignement, contour, surlignage, ombre. Ni la place, ni le contenu,
  ni la courbe, ni la liste. Poser un style : une étape d'annulation, les effets absents du
  style s'en vont, la police se charge avant (et part avec le design si elle vient du poste).
  Garder sous un nom déjà pris remplace le style. Panneau Texte, « Mes styles de texte » : un
  clic pose un texte à ce style.
- Un texte courbé ou en liste n'entre pas par morceaux (lettres, mots, lignes, machine à
  écrire) : ces entrées ne sont pas proposées, et une telle entrée, ou celle d'un style vidéo,
  devient un fondu.
- Pont : `ajouter_texte` et `modifier` prennent `courbe` (null : droit) et `liste` (null : texte
  simple), avec des refus clairs (hors de -100 à 100, courbe et liste ensemble, liste inconnue) ;
  `animer` refuse une entrée par morceaux sur un tel texte ; un outil neuf, `styles_texte`
  (lister, enregistrer depuis un texte, appliquer par identifiant ou par nom, renommer,
  supprimer) ; `marque` liste les styles. 75 outils.

Preuves (conteneur de Claude) : 14 essais vitest de plus (274 : géométrie de l'arc, sens, boîte,
rayon minimal, centre gardé malgré la rotation, disposition et marques des listes, styles lus
sur le disque, remis d'aplomb, posés, retrouvés) ; dans Chromium, 53 vérifications (curseur,
arche et sourire lus à l'encre, centre gardé, toutes les lettres sur l'arc, coins seulement,
redresser, annuler, clic dans le creux de l'arc et écriture, listes, retrait, styles gardés,
posés, remplacés, retirés, carte du panneau, animations écartées, description pour l'export,
pont et ses refus) ; dans Tauri, 16 (fenêtre contre PNG du noyau à 0,60 d'écart moyen, chaque
texte à part, PDF par poppler à 1,10 avec la liste qui se sélectionne, SVG par Chromium à 0,16,
style écrit dans le kit sur le disque et posé dans un autre design, design rouvert, un coin tiré
à la souris puis annulé sans trace). Repassés : étape 2 (33), étape 3, lots 1 et 3 (23, 29),
étape 4, lots 2, 3, 5, 6 et 7 (38, 44, 44, 37, 44), les correctifs (23), la vérification de
l'étape 5 (15), le lot 1 de l'étape 7 (30 dans Chromium, 8 dans Tauri), les exports de l'étape 5
dans Tauri (62) et l'animation de l'étape 4 par le pont dans Tauri (16). Des vérifications
restées d'avant (nombre d'outils, rail, libellé du bouton d'import) mises à jour. Une trace du
geste vue dans Chromium venait de son dessin accéléré par SwiftShader, pas d'Eliot : absente
sans cette accélération, et dans Tauri.

## 2026-10-17, étape 7, lot 1 : le panneau des calques

Suite de l'accord d'Alexandre (« Go pour l'étape 7. »). Ce que Claude a fait et décidé :

- Le panneau Calques montre tous les éléments, du premier plan vers le fond, chacun avec son
  icône (quatorze sortes) ou, pour une photo, une vidéo ou un objet 3D, sa miniature.
- Glisser une ligne la pose juste au-dessus ou au-dessous d'une autre, un trait montrant où,
  au pointeur comme les panneaux (le glisser-déposer HTML peut être pris par l'enveloppe). Une
  étape d'annulation par glisser : deux glissers de suite ne se fondent pas en une. Sur une page
  vidéo, la ligne posée va sur une piste entre celle de son repère et sa voisine, que la
  normalisation de la frise numérote ; un clip de la piste principale reste où il est (la
  frise règle son ordre), et rien ne passe sous elle.
- Le nom : double-clic, Entrée garde, Échap revient, un nom vide rend celui tiré du contenu. Il
  va dans un champ à part, `libelle`, gardé avec le design. En route : une icône s'affichait par
  l'identifiant de son dessin (« heart ») au lieu de « Icône heart », corrigé.
- Grouper range désormais les membres d'un bloc dans la pile, à la place du plus haut (page
  fixe), comme Canva : le groupe a sa ligne, « Groupe 1 (2) », ses membres en retrait dessous ;
  la flèche la replie, un clic la choisit en entier, on la glisse d'un bloc. Un membre glissé
  hors du groupe le quitte ; un groupe réduit à un membre disparaît. Un groupe d'un document
  d'avant dont les membres sont éparpillés garde chaque membre à sa place, marqué « groupe ».
- Survoler une ligne entoure l'élément (ou le groupe) sur la page, du même contour que le survol
  sur la page ; la ligne propose Dupliquer et Supprimer (pas sur un calque verrouillé), à côté
  de l'œil et du cadenas.
- Pont : `modifier` prend `libelle` (null : le nom tiré du contenu) ; `ordre` prend `dessus` ou
  `dessous`, l'identifiant d'un autre élément, comme un glisser dans le panneau, avec des refus
  clairs (repère parmi ceux qu'on déplace, introuvable, deux consignes à la fois). Toujours 74
  outils.

Preuves (conteneur de Claude) : 6 essais vitest de plus (260 : lignes, groupes repliés et
éparpillés, ordre sur une page fixe et sur une page vidéo, rassembler un groupe, en sortir, le
nom) ; dans Chromium, 30 vérifications (icônes et miniatures, renommer, Échap, nom vide, Ctrl+Z,
glisser au-dessus et au-dessous, deux étapes d'annulation, survol, groupe rangé d'un bloc,
replié, choisi, glissé, membre sorti, masquer, verrouiller, dupliquer, supprimer, page vidéo,
piste principale, pont et ses refus) ; dans Tauri, 8 (pont, page vidéo, design rouvert qui garde
les noms, et un vrai glisser à la souris dans le panneau). Repassés : l'essai de l'étape 2
(33, grouper et dégrouper) et celui de l'étape 4, lot 1 (41, le panneau liste les vidéos ; le
libellé du bouton d'import y était resté celui d'avant l'étape 6, mis à jour).

## 2026-10-17, étape 7 ouverte : plan du reste du catalogue

Accord d'Alexandre (« Go pour l'étape 7. »). Ce que Claude a décidé :

- Relevé du catalogue du BRIEF (§ 6) contre le logiciel : manquent le panneau des calques
  complet, le texte courbé, les listes, les styles enregistrés, les règles, la grille, la grille
  des tiers et les marges de sécurité sur la page, les zones sûres d'une page fixe, les alertes
  de contraste et de texte trop petit, la pipette, la photo en fond de page, le thème sombre, et
  Pexels. Le reste du catalogue est là (vérifié dans le code le même jour).
- Plan de l'étape 7 écrit dans `PLAN.md` : cinq lots (les calques ; le texte ; les aides pour
  apprendre ; couleur, fond et thème ; Pexels), puis la vérification et le rapport de fin, qui
  rassemble les commandes à lancer avant les essais.
- Pexels : la page de son API (pexels.com/api, lue le 2026-10-17) dit encore que la délivrance
  des nouvelles clés est suspendue ; le `.env` n'a pas de `PEXELS_API_KEY` (Claude n'a regardé
  que les noms). Le lot attend la clé d'Alexandre et passe en dernier. Ses règles : crédit du photographe et lien
  vers Pexels, pas de banque concurrente bâtie dessus.
- Texte courbé par le tracé de texte de Konva : il dessine chaque lettre par `fillText`, que le
  contexte SVG de l'export enregistre déjà ; rien à apprendre au noyau.
- Le nom d'un calque : un champ à part (`libelle`), parce que `nom` sert déjà à l'icône
  (l'identifiant du dessin dans sa collection) ; le renommer changerait le dessin.

## 2026-10-17, étape 6 : vérification de l'étape

Accord d'Alexandre (« Go. Go. »). Ce que Claude a fait et décidé :

- Relecture de l'étape contre le BRIEF (§ 6, « Le studio 3D » ; § 7 ; catalogue, ligne 3D) et le
  PLAN. Tout ce que le BRIEF demande est là ; un manque pour publier, comblé, et une coquille :
  - Les crédits à recopier sous la publication. Un modèle CC BY (Sketchfab) ne gardait son
    crédit que dans « Vue 3D », objet par objet, et les sons dans l'onglet Audio : la fenêtre
    d'export rassemble désormais ceux des pages exportées, « Crédits à recopier sous la
    publication » (les objets 3D, modèles et environnements, et pour un film les sons), avec
    « Copier les crédits » et la mention « obligatoire » quand une licence CC BY est en jeu.
    Pont : `etat` donne `credits3d`, `exporter` rend `credits`, le texte à recopier (74 outils,
    descriptions mises à jour). Les photos de Pixabay restent hors de la liste : leur licence
    ne demande pas de crédit.
  - Le PLAN nommait la clé `SKETCHFAB_API_TOKEN` : c'est `SKETCHFAB_API_KEY` (les deux noms
    sont lus), corrigé.
  - Reste noté au PLAN : réduire la définition du rendu pendant les gestes sur le mini PC, si
    l'essai la montre lente ; le vrai téléchargement chez Sketchfab, avec la clé d'Alexandre ;
    les temps d'export sur le poste.
- Une publicité 3D faite de bout en bout par le pont, dans Tauri, sur les vraies données de Poly
  Haven : une story de 6 s sur le bleu nuit de la marque ; le poste radio-cassette de Poly Haven
  (« Boombox », CC0), son corps repeint du jaune de la marque, éclairé par un HDRI de studio de
  Poly Haven, ombre au sol, sur un plateau tournant (un tour en 16 s) avec deux clés de caméra
  qui le rapprochent ; le robot (RobotExpressive, CC0) qui danse dans un coin ; un titre qui
  entre par le bas, une phrase en fondu, un prix dans un bouton qui bat, une musique. Mesures,
  sur 255 : à 2,5 s, l'export PNG contre la fenêtre, 0,00 sur les deux objets 3D (0,36 sur la
  page : le bord des grands titres blancs, lissés autrement par le noyau) ; repeindre, annuler,
  rétablir, 0,00 ; la page dupliquée, 0,00 ; déclinée en carré, la 3D à l'échelle, 0,20 et 0,54
  (le robot réduit tombe entre deux pixels) ; le format annulé, 0,00 ; le design rouvert, 0,00 ;
  le MP4 pour Reels (1080 × 1920, 180 images, le son) contre la fenêtre à 0,5, 2,5 et 4,5 s, 2,27
  à 2,33 (la compression H.264 sur le bleu et le jaune saturés) ; le GIF (360 × 640, 90 images),
  1,66. Le film rend les crédits : le poste, le HDRI, la musique. Temps dans le conteneur
  (processeur seul) : MP4 en 154 s, dont 134 s pour les 360 images 3D des deux objets (371 ms
  chacune) ; GIF en 54 s.
- Défaut trouvé par cette publicité, corrigé : deux rendus hors écran de la même page en même
  temps se partageaient la toile du moteur pour un objet 3D. La vignette de l'accueil, refaite
  quelques secondes après chaque changement (premier instant, 480 px), pouvait ainsi repeindre
  l'image d'un export ou d'une capture lancés juste avant qu'ils ne la lisent : l'objet sortait
  à son premier instant, flou (constaté après un Redimensionner annulé, écart 6,09). Chaque
  rendu de page garde désormais sa copie de l'image (`copierToile`, `moteur.ts`), que l'export
  vers le noyau reconnaît toujours. Essai dans Chromium : un export et une vignette lancés
  ensemble gardent chacun leur image (0,00 ; 5,13 sans la correction).

Vérifié dans le conteneur : interface 254 (3 de plus : crédits des objets 3D, des sons d'un
film, mention obligatoire), `npm run build` ; noyau 139 (inchangé depuis le lot 5) ; Chromium :
lots 1 à 4 (63, 48, 34 avec la fenêtre d'export et ses crédits, 44), rendus croisés 4, fenêtre
d'export de l'étape 5 (15) et de l'étape 4 (18) ; Tauri : la publicité 17 (le carré recalculé sur ses images, au seuil
d'un objet posé entre deux pixels), lots 1 à 5 (33, 16, 34, 19, 20) et l'annulation d'un film (3).

## 2026-10-17, étape 6, lot 5 : l'objet 3D dans le film

Suite du plan (« Continue. »). Ce que Claude a fait et décidé :

- Un objet 3D qui bouge (plateau, caméra par images clés ou animation du modèle) est rendu par la
  fenêtre image par image avant le film, à la cadence du film et à la taille où le film le montre
  (celle du film, fois son agrandissement le plus fort, 4096 px au plus) ; le noyau n'a pas de
  WebGL, la fenêtre si. Chaque image part en PNG vers le noyau (`ecrire_image_film3d`), rangée
  dans le cache de l'application, `film3d/<film>/<objet>/<rang>.png`, puis effacée à la fin du
  film, qu'il soit fini, annulé ou en erreur (`oublier_film3d`) ; un reste de plus de six heures
  (application fermée en plein export) part au film suivant.
- Le calque de l'objet garde sa place, son ombre portée, son opacité et ses animations de
  position ; il cite ses images (`eliot:film3d/<objet>`) au lieu de son rendu du repos, et le
  noyau le relit à chaque image avec l'image 3D du rang : l'ombre portée suit la silhouette. Il
  manque une image (rang hors du clip, arrondi) : la plus proche avant, sinon la première.
- Un objet 3D immobile ne change pas de chemin : un seul rendu, comme avant.
- La fenêtre d'export montre l'étape « Objets 3D, image par image : n sur N » ; Annuler arrête aussi
  cette étape, sans film écrit. Le pont rend `images3d` (nombre d'images et durée) avec le film.
- Temps mesurés dans le conteneur (processeur seul, WebGL logiciel, jamais de carte graphique),
  page carrée, robot dansant sur un plateau tournant avec deux clés de caméra, ombre au sol,
  ombre portée et un titre : MP4 1080 × 1080 de 5 s à 30 images par seconde en 85 s, dont 53 s pour
  les 150 images 3D (354 ms par image) et 32 s pour le noyau ; la même page sans mouvement, 7,8 s.
  Sans ombre au sol, les images 3D prennent 133 ms chacune. GIF 480 × 480 à 15 images par seconde :
  27 s, dont 20 s pour les 75 images 3D. Avec la carte graphique du poste, la part de la fenêtre
  devrait fondre ; celle du noyau (relire et flouter le calque à chaque image) reste sur le
  processeur, à mesurer à l'essai.
- Écarté : rendre la 3D dans le noyau (un second moteur, des écarts avec la fenêtre) ; garder les
  images en mémoire (plusieurs centaines de Mo pour un film long).

Preuves (conteneur de Claude) : un essai du noyau de plus
(`un_objet_3d_qui_bouge_prend_son_image_rang_par_rang`, 139 passent) ; 2 essais vitest de plus
(251 : objets rendus image par image, rangs du clip) ; dans Tauri par le pont, 20 vérifications :
le MP4 (150 images, 150 images 3D) comparé à la fenêtre au même instant à 0, 1, 2,5, 4 et 4,9 s,
écart moyen de 1,09 à 1,25 sur 255 et 0,38 à 0,48 % de pixels à plus de 40 (compression H.264) ;
la zone du robot et de ses ombres à 1,14 et 1,39 ; le robot bouge d'une image à l'autre (écart de
11,8 à 15,8) ; l'ombre portée change avec lui et colle à la fenêtre (1,69) ; le GIF (75 images) à
0,59 à 0,63 ; le cache vidé après chaque film ; un objet immobile garde le chemin d'avant (1,06).
Annulation pendant le rendu des images 3D, dans Tauri : 3 vérifications (les images s'écrivent
dans le cache, l'export s'arrête, aucun film et le cache vide) ; un reste vieux de sept heures
part au film suivant, un récent reste. L'essai du lot 4 dans Tauri (19) et celui de l'export
vidéo de l'étape 4 par le pont (20 sur 21, seul le nombre d'outils d'alors a changé) repassent.

## 2026-10-17, étape 6, lot 4 : l'animation 3D sur la frise

Accord d'Alexandre (« Feu vert. »). Ce que Claude a fait et décidé :

- Le plateau tournant : un tour en N secondes (de 2 s à 2 min, 8 s par défaut), vers la droite ou
  la gauche, depuis le début du clip. Il s'ajoute à la vue de l'objet : les gestes et les réglages
  changent la vue de base, jamais le plateau ; le panneau le rappelle sous la rotation.
- La caméra par images clés partage les images clés de l'objet (les losanges du clip, le bouton
  de la frise, leur courbe) au lieu d'en avoir à part : une image clé d'un objet 3D garde aussi sa
  vue complète (rotation, hauteur, zoom, focale, décalage). Quand l'objet a des images clés et que
  la tête de lecture est sur son clip, tourner l'objet sur la page, la molette, les flèches, les
  vues prêtes ou les curseurs du panneau posent (ou reprennent) une image clé à cet instant, comme
  déplacer l'objet le fait pour sa position ; Échap rend les images clés d'avant le mode. Entre
  deux clés, la vue glisse par le chemin le plus court (jamais plus d'un demi-tour : de 170° à
  -170°, vingt degrés) ; un tour complet, c'est le plateau. Le zoom glisse en proportion (de 1 à
  2 comme de 2 à 4). Courbe « En douceur » (celle des autres images clés) ou « Régulier », pour
  toutes les clés de l'objet.
- L'animation du modèle : son nom, sa vitesse (d'un quart à quatre fois), en boucle ou non (la
  dernière image reste), l'instant de départ. Sur une image fixe, l'objet montre cet instant :
  un personnage de Mixamo peut poser au lieu de rester en T. Elle est posée le temps d'un rendu
  par un mélangeur de three.js, puis le modèle revient au repos (il sert à d'autres objets). Les
  animations sans nom prennent le nom que leur donne le noyau (« Animation N ») ; une animation
  vide d'un FBX (« Take 001 ») n'est pas proposée.
- La lecture : l'objet se rend à l'instant de la tête de lecture ; pendant la lecture, si un seul
  objet de la page bouge, la page montre la toile du moteur elle-même (règle 11) ; à plusieurs,
  ils se recopient chacun dans leur toile, pour ne pas se disputer le moteur.
- Rogner le début d'un clip ou le couper en deux ne fait pas sauter le mouvement : la seconde
  moitié reprend le plateau et l'animation là où ils en étaient. « Copier le style » passe aussi le
  plateau et l'animation (le panneau dit quand l'animation manque à l'autre modèle).
- L'export en image d'une page vidéo montre l'objet 3D à l'instant de la tête de lecture (sa vue,
  son animation), comme la fenêtre ; dans un film (MP4, GIF), il reste à sa vue du début de son
  clip jusqu'au lot 5.
- Mixamo : la marche à suivre dit de cocher « In Place » pour une marche ou une course, et où
  choisir l'animation.
- Pont IA : nouvel outil `animer_objet3d` (plateau, images clés de la caméra, animation du modèle ;
  une image fixe devient une page vidéo pour le plateau et les clés, comme avec `images_cles`) ;
  `images_cles` garde la caméra des clés d'un objet 3D ; `regler_objet3d` prévient quand la vue
  vient des images clés : 74 outils.
- Écarté pour ce lot : le film du calque 3D image par image (lot 5).

Preuves (conteneur de Claude, WebGL sur le processeur, jamais de carte graphique) : modèles
d'essai pris dans les exemples de three.js, dans le conteneur seulement (RobotExpressive de
Tomás Laulhé, CC0, quatorze animations ; « Samba Dancing », un FBX de Mixamo) ; 17 essais vitest
de plus (249 en tout : plateau, chemin le plus court, courbes, coupe et rognage sans saut, objet
figé pour l'export) ; dans Chromium, 44 vérifications (animation sur une image fixe, page passée
en vidéo, plateau, page qui tourne avec la tête de lecture, toile du moteur pendant la lecture,
images clés par le panneau et par un geste sur la page, Échap, coupe à 0,22 sur 255 au bord,
copier le style, FBX de Mixamo, pont et ses refus) ; dans Tauri par le pont, 19 (fenêtre et export
PNG à 0,00 sur 255 sur une image fixe, à 0 s, 1 s, 2 s entre deux clés et pour le danseur de
Mixamo ; la lecture fait bouger l'objet, quatre images sur quatre ; le design rouvert identique).
Les essais 3D des lots 1 à 3 repassent (Chromium 63, 48 et 33 ; Tauri 33, 16 et 34).

## 2026-10-17, étape 6, lot 3 : les banques

Accord d'Alexandre (« Go pour le lot 3 et je vais m'occuper de la clé sketchfab. », puis « La clé
Sketchfab est déjà dans Env. »). Claude n'a vérifié que la présence du nom `SKETCHFAB_API_KEY`
dans le `.env`, jamais sa valeur. Ce que Claude a fait et décidé :

- Un onglet 3D dans le rail, à deux faces. Modèles : Kenney, Poly Haven, Sketchfab, Mixamo ; un
  clic pose le modèle au centre, un glisser le pose sous le pointeur, une bande montre le
  téléchargement. Environnements : ceux du design, « Importer un .hdr », ceux de Poly Haven ; un
  clic éclaire les objets 3D choisis. « Plus d'environnements », dans la section Lumière de
  « Vue 3D », ouvre cette face.
- Kenney : pas d'API ; les paquets (.zip de kenney.nl) rangés à la main dans
  `telechargements/kenney/`, lus par `npm run bibliotheque` (`outils/kenney.mjs`). Un paquet
  n'entre que si sa licence dit CC0. Les GLB de Kenney citent leur texture commune à côté
  d'eux (`Textures/colormap.png`) : chaque modèle devient un GLB qui l'emporte, avec son aperçu
  et un catalogue ; rien ne passe par le réseau. Le noyau empaquette de même un GLB importé du
  disque qui cite des fichiers voisins. Essayé sur le vrai Food Kit (200 modèles).
- Poly Haven : l'index de chaque banque lu une fois par 24 h, la recherche faite sur le poste
  (nom, mots-clés, catégories, description ; les plus téléchargés d'abord), aperçus gardés
  7 jours ; modèles en glTF 1k avec les fichiers qu'il cite (200 Mo au plus en tout), HDRI en 1k
  (l'éclairage n'en demande pas plus). User-Agent propre à Eliot, fichiers acceptés seulement de
  `dl.polyhaven.org` et `cdn.polyhaven.com`, chemins des fichiers cités vérifiés, mention
  « Poly Haven » sous la grille.
- Sketchfab : la recherche est publique (sans clé), deux demandes, CC0 puis CC BY, douze de
  chaque en alternance ; tout autre licence (NC, ND, SA, éditoriale) est écartée, et la licence
  est relue sur la fiche du modèle juste avant le téléchargement. La clé n'est lue que par le
  Rust et n'est envoyée que dans l'en-tête `Authorization: Token` de la demande de
  téléchargement, jamais aux adresses des fichiers (des liens signés et temporaires) ; les
  messages d'erreur la masquent. Sans clé, la recherche marche et le panneau dit où l'ajouter ;
  une clé refusée (401, 403) le dit sans la montrer. L'archive glTF est ouverte en lieu sûr
  (chemins vérifiés, 300 Mo au plus, `scene.gltf` d'abord). Les deux noms de variable,
  `SKETCHFAB_API_KEY` et `SKETCHFAB_API_TOKEN`, sont acceptés.
- Jeton personnel ou OAuth, vérifié le jour même : la page de l'API de téléchargement demande
  que l'utilisateur se connecte à son compte Sketchfab dans l'application ; ici l'unique
  utilisateur est Alexandre, avec la clé de son propre compte, et d'autres intégrations envoient
  cette clé de la même façon à la même adresse. Gardé, comme décidé à l'ouverture ; repli OAuth si
  la clé est refusée à l'essai.
- Mixamo : pas d'API. Conditions d'Adobe relues le jour même : gratuit avec un compte Adobe,
  personnages et animations libres de droits pour des projets personnels, commerciaux ou
  associatifs. Dans l'onglet, la marche à suivre (« FBX Binary », « With Skin », 30 images par
  seconde) et « Importer un FBX » ; le choix de l'animation viendra au lot 4.
- Le crédit (source, auteur, licence, lien, titre) entre dans la ressource et reste avec le
  modèle, d'un design à l'autre ; « Vue 3D », section Modèle, le montre, dit quand il est
  obligatoire (CC BY) et le copie en une ligne à recoller sous une publication.
- Les environnements HDRI deviennent des ressources du design : le `.hdr` d'origine, une copie
  de 2048 px de large au plus (réduite par moyenne de zones en flottants : la réduction de la
  bibliothèque `image` écrête au-dessus de 1, ce qui éteindrait le soleil), un aperçu et une
  miniature tonifiés par le noyau. La fenêtre en fait un éclairage (HDRLoader et PMREM de
  three.js) ; en attendant qu'il soit prêt, le studio éclaire l'objet, puis le rendu est refait ;
  l'export l'attend. Un `.hdr` déposé sur la page éclaire les objets choisis au lieu de devenir
  une image.
- Chercher en français dans des banques qui parlent anglais : une centaine de mots courants
  d'une publicité de produit (objets, lieux, lumières, nourriture) traduits, les petits mots
  retirés, les autres mots gardés tels quels.
- Les marques : la recherche de Sketchfab ramène aussi des produits de marque (chaussures,
  boîtes) ; une ligne sous la grille et la description de l'outil du pont disent de les écarter
  d'une publicité.
- Pont IA : `chercher_modeles3d` (une source, une planche d'aperçus numérotés),
  `ajouter_modele3d` (télécharge, range avec le crédit, pose comme `ajouter_objet3d`),
  `chercher_environnements` ; `regler_objet3d` accepte un environnement de Poly Haven
  (« polyhaven:<id> », rangé une seule fois par design), l'id d'un environnement du design ou le
  chemin d'un `.hdr` ; `etat` liste les environnements à part : 73 outils.
- Corrigé en chemin : coller un objet 3D dans un autre design n'y copiait pas son modèle (depuis
  le lot 1) ; le modèle et son environnement suivent désormais. Un modèle de Kenney rangé sans
  extension de fichier était pris pour une image (trouvé par l'essai dans Chromium).

Preuves (conteneur de Claude, WebGL sur le processeur, jamais de carte graphique) : 9 essais du
noyau de plus (138 en tout), avec un faux Poly Haven et un faux Sketchfab (ce dernier vérifie
que la clé ne part qu'avec la demande de téléchargement) ; 4 essais vitest de plus (232) ; dans
Chromium, 33 vérifications (catalogue de Kenney fabriqué depuis le vrai Food Kit, filtre en
français, clic et glisser, crédit et « Copier le crédit », `.hdr` déposé qui éclaire l'objet
choisi, rendu plus chaud qu'au studio, tuiles, annulation, pont) ; dans Tauri par le pont, 34,
avec un faux Poly Haven et un faux Sketchfab (glTF et ses fichiers, GLB, archive glTF, licences,
la clé reçue par les deux seules demandes de téléchargement, un environnement rangé une fois et
resservi, un `.hdr` du poste, fenêtre et export PNG à 0,00 sur 255, x2 réduit à 0,20, coller
dans un autre design) ; puis sur les vraies données, par un relais local (le Rust du conteneur
ne passe pas par son mandataire réseau ; les octets ne sont pas touchés), 7 : « bouteille » sur
Poly Haven, 10 modèles en 2,0 s, `wine_bottles_01` téléchargé avec ses textures en 11,6 s,
l'HDRI `brown_photostudio_02` en 5,4 s, fenêtre et export à 0,05 ; « chaussure » sur Sketchfab,
18 modèles, CC0 et CC BY seulement. Les essais des lots 1 et 2 (Chromium 63 et 48, Tauri 33 et
16) et la vérification de l'étape 5 (23) repassent.

## 2026-10-17, étape 6, lot 2 : lumière, ombre au sol, matières

Accord d'Alexandre (« Go pour le lot 2 »). Ce que Claude a fait et décidé :

- La lumière tourne avec la vue autour de l'axe vertical, comme le studio d'un plateau tournant :
  tourner l'objet à la souris ne déplace pas ses reflets dans l'image, ce qu'attend quelqu'un qui
  « fait tourner un produit ». Le lot 1 tenait la lumière fixe dans la scène : tourner l'objet
  donnait l'impression de marcher autour d'un objet éclairé, pas de le tourner. L'élévation de
  la caméra, elle, garde
  la lumière où elle est (une lumière d'en haut reste en haut quand on regarde de dessus).
- Quatre environnements fournis, fabriqués par la fenêtre (rien à télécharger) : Studio (celui
  du lot 1), Boîtes à lumière (pièce sombre, deux grandes boîtes sur les côtés, pour le verre et
  le métal), Plein air (ciel et soleil de midi), Soleil couchant ; leur force et leur rotation.
  Les environnements HDRI importés ou de Poly Haven viendront au lot 3 avec les banques.
- La lumière principale : cinq lumières prêtes (trois-quarts, de face, latérale, contre-jour,
  zénith), sa direction par rapport à la vue, sa hauteur, sa force, sa couleur ; l'exposition
  en IL. Le document ne garde la lumière que si elle n'est pas celle de départ.
- L'ombre au sol : portée par la lumière principale sur un sol invisible au pied du modèle
  (ombre douce de three.js, VSM), opacité et douceur ; elle s'efface en s'éloignant du modèle,
  pour ne pas finir par une coupure nette au bord de la boîte ; rien quand la lumière vient
  d'en dessous. L'ombre de la boîte (celle d'une photo) reste à part.
- Les matières : couleur (qui teinte une texture) et brillance de 0 à 100, par nom de matière ;
  le modèle n'est jamais modifié, les matières sont repeintes le temps d'un rendu, si bien qu'un
  autre objet du même modèle garde les siennes. Une matière sans nom devient « Matière N », N
  son rang dans le glTF, comme le noyau la nommait déjà. Survoler une matière dans le panneau la
  montre sur l'objet, en couleur d'accent, sans toucher au document. Les couleurs du kit de
  marque sont dans chaque pastille.
- Pendant qu'on tire un curseur du panneau 3D, la page montre la toile du moteur elle-même
  (règle 11), comme pendant un glisser sur la page. Copier le style d'un objet 3D passe aussi sa
  lumière, son ombre au sol et ses matières.
- Pont IA : `regler_objet3d` règle aussi la lumière et l'ombre au sol (caméra, lumière et
  ombre d'un seul tenant, une étape d'annulation) ; nouvel outil `colorer_objet3d` (la liste des
  matières, leur couleur et leur brillance d'origine, et les matières repeintes) : 70 outils.
- Corrigé en chemin : les valeurs rangées dans le document gardaient des traînes de virgule
  flottante (0,35000000000000003) ; elles sont arrondies proprement.

Preuves (conteneur de Claude, WebGL sur le processeur, jamais de carte graphique) : 5 essais
vitest de plus (228 en tout) ; dans Chromium, 48 vérifications (environnements, lumières prêtes,
un geste une étape et la toile du moteur en direct, couleur, exposition ; un cube vu de face et
après un quart de tour éclairé à l'identique, écart 0,00, contre 5,06 avec une lumière fixe dans
la scène ; ombre au sol ; matières, survol, autre objet du même modèle intact ; copier le style ;
pont) ; dans Tauri par le pont, 16 (fenêtre et export PNG à 0,00 sur 255, x2 réduit à 0,14, PDF à
0,48 ; le verre aux couleurs du kit de marque, le second flacon intact ; l'ombre au sol du côté
opposé à la lumière ; une étape d'annulation par outil ; « Matière 2 » pour le noyau et pour la
fenêtre ; le design rouvert identique). Les essais du lot 1 repassent.

## 2026-10-17, étape 6, lot 1 : l'objet 3D dans la page

Suite de l'accord d'Alexandre (« Ok, tu peux démarrer l'étape 6 »). Ce que Claude a fait et
décidé :

- Import : GLB, glTF, FBX, OBJ, par le bouton du panneau Importer, le dépôt sur la page ou le
  collage. Le noyau (`noyau/src/modeles3d.rs`) vérifie le fichier, range l'original et, si une
  texture dépasse 2048 px, prépare une copie GLB aux textures réduites (règle 5) ; un glTF et
  les fichiers rangés à côté de lui sont empaquetés en un seul GLB, ses chemins lus seulement
  sous son dossier. Il lit dans un GLB les matières, les animations et les triangles ; pour un
  FBX ou un OBJ, la fenêtre les lit en chargeant le modèle. Un `.bin` ou une texture choisis
  avec leur glTF ne deviennent pas des images du design.
- Document : l'élément `objet3d` (la ressource et la caméra : azimut, élévation, zoom, focale,
  décalage), champs facultatifs, version inchangée. La focale est en millimètres d'un appareil
  plein format (50 par défaut, de 18 à 200), plutôt qu'un angle de vue : c'est le réglage que
  connaît un photographe de produit. Le modèle est centré et ramené à une sphère de rayon 1 ; à
  zoom 1, la caméra cadre toute la sphère dans le plus étroit des deux angles de vue.
- Rendu : three.js 0.186.1, un seul moteur WebGL hors de la page (`src/trois/moteur.ts`),
  éclairage de studio (environnement RoomEnvironment, une lumière principale, rendu des tons
  neutre), fond transparent. Chaque objet a sa toile, refaite seulement quand la caméra, le
  modèle ou la taille changent, à la définition de l'écran par paliers de 64 px (2048 px au
  plus). Pendant qu'on tourne l'objet, la page montre la toile du moteur elle-même, sans la
  recopier (règle 11, comme le labo). Les miniatures sont rendues par la fenêtre et rangées par
  le noyau (aperçu 512 px, miniature 256 px).
- Le mode Tourner sur la page : double-clic ou « Tourner » ; glisser, Maj et glisser pour
  décaler, molette, flèches (5°, 15° avec Maj), Entrée, Échap. Pendant le glisser, la caméra
  vit hors du document ; une étape d'annulation par geste. Le panneau « Vue 3D » : vues prêtes,
  rotation, hauteur de vue, zoom (curseur en logarithme), focale, recentrer, vue de départ, et
  ce que l'on sait du modèle.
- Export : la fenêtre rend l'objet à la finesse de l'export (l'échelle d'une image ; deux pixels
  par pixel de la page pour un PDF ou un SVG, un seul pour un format papier, déjà à 300 dpi),
  4096 px au plus de côté ; l'image entre dans la description de la page comme un PNG et le
  noyau la pose avec le reste. L'ombre suit la silhouette du modèle, comme celle d'une photo
  détourée.
- Pont IA : `importer_modele3d`, `ajouter_objet3d`, `regler_objet3d` (69 outils) ; `etat` liste
  les modèles à part (`modeles3d`) ; `ajouter_image` d'un modèle pose un objet 3D ; un modèle ne
  va pas dans un cadre ni une maquette.
- Écarté pour ce lot : la lumière, l'ombre au sol et les matières (lot 2), l'animation (lot 4),
  le film (lot 5 : une page vidéo pose aujourd'hui l'objet tel qu'il est au repos).

Preuves (conteneur de Claude, WebGL sur le processeur, jamais de carte graphique) : modèles
d'essai fabriqués par `fabriquer_modeles3d.py` (un flacon à trois matières, une étiquette de
3000 × 1200 px, une animation ; le même en glTF à fichiers séparés ; un cube en OBJ et en FBX
texte) ; 4 essais du noyau (129 en tout) ; 7 essais de la caméra (vitest, 223 en tout) ; dans
Chromium, 63 vérifications (import, rendu, miniature, mode Tourner, toile du moteur montrée en
direct pendant le glisser, panneau, OBJ et FBX, fichier abîmé, pont, export à finesse 2 plus net
qu'à finesse 1) ; dans Tauri par le pont, 33 (copie à 2048 px, glTF empaqueté, miniatures
rangées, fenêtre et export PNG à 0,00 sur 255, x2 réduit à 0,14, PDF à 0,40, SVG avec l'objet en
1600 px pour une boîte de 800, ombre à 0,03 et qui suit la silhouette, vue de dessus, design
rouvert). Les suites de Chromium des étapes 3 à 5 repassent.

## 2026-10-17, étape 6 ouverte : plan du studio 3D

Accord d'Alexandre (« Ok, tu peux démarrer l'étape 6 »). Ce que Claude a décidé :

- Plan de l'étape 6 écrit dans `PLAN.md` : cinq lots (l'objet 3D dans la page ; lumière,
  ombre, matières ; les banques ; l'animation sur la frise ; l'export vidéo du calque 3D),
  puis la vérification, et les choix par défaut de Claude.
- Vérifié le jour même : three.js 0.186.1 est toujours la dernière version (MIT) ; l'API de
  Poly Haven est gratuite, même pour un usage commercial, sans clé, et demande un User-Agent
  propre à l'application et la mention « Poly Haven » ; Sketchfab sert ses modèles en glTF, GLB
  et USDZ (jamais en FBX ni en OBJ), et ses lignes directrices demandent que chaque utilisateur
  se connecte à son compte (OAuth) et que l'auteur, la licence et la mention « Sketchfab »
  suivent le modèle. Les deux API répondent depuis le conteneur de Claude.
- Pas de banc à lancer sur le poste pour cette étape : dans la fenêtre, la 3D n'a qu'une voie
  (WebGL, three.js) ; les mesures sur le poste viendront avec les essais de la fin.
- Sketchfab : le jeton personnel d'API d'Alexandre dans le `.env`, plutôt qu'une connexion
  OAuth qu'il faudrait faire déclarer chez Sketchfab ; à vérifier au lot 3, repli OAuth si le
  jeton ne suffit pas. Action d'Alexandre avant le lot 3, quand il veut : créer le compte et y
  relever son jeton.
- Le noyau prépare pour la fenêtre une copie de chaque modèle, textures ramenées à 2048 px
  (règle 5), comme l'aperçu d'une photo ; la fenêtre rend les miniatures et, à l'export, le
  calque 3D à la taille voulue (exception du BRIEF à « le Rust rend les calques »).

## 2026-10-16, étape 5 : le labo sur les photos des cadres et des maquettes

Demande d'Alexandre (« On termine l'étape 5 avant l'étape 6 ») : le dernier point laissé de
côté au lot 2. Ce que Claude a fait et décidé :

- Un cadre ou une maquette qui a sa photo se retouche comme une photo posée : « Retoucher » dans
  sa barre, le même panneau (préréglages, lumière, couleur avec la courbe, le mélangeur et
  l'étalonnage, effets, détail, histogramme, « Avant »). Les réglages sont un champ du cadre
  (`reglages`, même forme que pour une photo) ; ils restent quand sa photo change, comme pour
  « Remplacer » d'une photo posée.
- Pas de recadrage, de perspective ni de détourage dans ce panneau : la photo d'un cadre se
  place déjà avec « Ajuster » (glisser, molette), et une forme découpe déjà le fond. Une note le
  dit à leur place.
- Le vignetage suit la partie de la photo qui se voit dans le cadre ou l'écran, comme il suit le
  cadre gardé d'une photo recadrée au lot 5 : la fenêtre la calcule (`partieVisible`, d'après le
  cadrage) et la donne au noyau dans la description de la page ; le noyau n'a rien d'autre à
  apprendre (`reglages_labo` accepte les cadres et les maquettes).
- Copier et coller les réglages, « Copier le style » et le pont (`retoucher`, avec `depuis`, et
  `prereglages` pour enregistrer) passent d'une photo à un cadre et inversement ; `retoucher`
  sur un cadre vide dit d'abord de le remplir. Toujours 66 outils.
- Défaut trouvé en route et corrigé : la boîte de sélection d'un cadre rempli prenait la taille
  de sa photo, qui déborde du cadre (une photo en largeur dans un cadre carré donnait une
  sélection plus large que le cadre, et des poignées hors de lui). Depuis l'étape 3, lot 2. La
  page ne dessine plus que la partie de la photo qui se voit ; la photo entière ne se montre
  que pendant « Ajuster ». Rien ne change à l'image.
- Mesures dans Tauri, le modèle « Avant / après » rempli, la photo de droite retouchée (« Couleurs
  vives », clarté calculée par le noyau, vignetage) : fenêtre contre export 1,09 sur 255, PDF
  1,23 ; un cadre au gris uni et une maquette en noir et blanc : 0,17, le vignetage à 142 sur 170
  au bord gauche comme au bord droit ; design rouvert, 1,09.
- Vérifié dans le conteneur : noyau 125 (la retouche d'un cadre dans l'export, `reglages_labo`),
  interface 216 (2 de plus), `npm run build` ; Chromium : cadres retouchés 15, cadres et grilles
  de l'étape 3 (18, 29), page décrite pour le noyau de l'étape 4 (18), labo 16, vérification 15 ;
  Tauri : cadres retouchés 10, exports du lot 1 (62, dont les 42 modèles de départ), pont de
  l'étape 3 (14, 27), la publicité de la vérification 23, labo 14.

## 2026-10-16, les essais d'Alexandre à la fin du produit

Décision d'Alexandre (« Les tests se feront une fois que le produit est fini. Je vais l'essayer
à ce moment-là et on corrigera au moment voulu. ») : les essais prévus après chaque lot et
chaque étape (parcours « Essayer… » du `01_application/LISEZMOI.md`) se font tous ensemble,
une fois le produit fini, et les corrections suivent. Claude continue de vérifier chaque lot et
chaque étape dans son conteneur ; il ne demande plus d'essai ni de commande à chaque livraison
et rassemble dans le rapport de fin les commandes à lancer avant les essais (compilations,
installations uniques du détourage, de Piper, de Whisper). Les cases « Essai par Alexandre » du
PLAN restent ouvertes jusque-là.

## 2026-10-16, étape 5 : vérification de l'étape

Demande d'Alexandre (« tu peux vérifier toutes les tables dans son ensemble », lu comme la
vérification de toute l'étape 5, faite comme celle de l'étape 4). Ce que Claude a fait et décidé :

- Relecture de l'étape contre le BRIEF (§ 6, « Ce que Eliot reprend de Lightroom », « Ce que
  demandent la publicité et les maquettes de produits », « L'export, de bout en bout » ; § 7 ;
  catalogue, lignes Image et Export) et le PLAN. Trois manques, comblés :
  - Le flou (ligne Image) : un curseur Flou au labo, section Effets, de 0 à 100, après la
    correction du voile. Le noyau le calcule en lumière linéaire (trois flous de boîte, proches
    d'un flou gaussien), de rayon proportionnel à la taille de l'image : l'aperçu de 2560 px et
    l'original donnent le même dessin. Comme la clarté, il se calcule au relâchement du curseur,
    et vaut pour les clips. Un préréglage le laisse à la photo, comme la netteté : c'est un
    usage de la photo (un fond flou derrière un sujet), pas un style. Écarté : un flou à part,
    hors du labo, qui aurait demandé un second calcul à l'écran et à l'export pour le même
    résultat.
  - La qualité (ligne Export) : un curseur Qualité pour le JPEG (92 par défaut) et le WebP (90),
    dans la fenêtre d'export comme pour le pont (`exporter`, `qualite` de 1 à 100). Un PNG,
    un PDF ou un SVG n'en ont pas : refusée par le pont, absente de la fenêtre.
  - Remplacer une image en gardant sa place (ligne Image) : « Remplacer » dans la barre d'une
    photo, une image choisie sur l'ordinateur. La boîte, la retouche, la perspective, les coins
    arrondis, la bordure et l'ombre restent ; la nouvelle photo est recadrée au centre aux
    proportions de l'ancienne, donc jamais déformée ; le détourage, fait pour l'ancienne photo,
    part (une notification le dit). Une étape d'annulation. Les cadres et les maquettes, qui
    ne recevaient une photo que par un glisser, ont aussi « Choisir » et « Remplacer ». Pont :
    `remplir_photo` remplace aussi une photo posée, sans outil de plus (66). Défaut évité en
    route : une photo remplacée pendant que le modèle la détoure recevait le masque de
    l'ancienne ; le détourage s'arrête désormais avec une erreur claire.
  - Restent notés au PLAN : le labo sur les photos des cadres et des maquettes (lot 2) ;
    l'aperçu en direct confirmé sur le mini PC, quand il sera là.
- Une publicité de produit faite de bout en bout par le pont, dans Tauri, avec le vrai modèle
  du détourage : un fond recadré au carré et flouté ; le produit détouré, retouché par « Produit
  net » à 80 % avec son exposition, une ombre ; un titre ; une vignette en noir et blanc aux
  coins arrondis, remplacée par une autre photo (même boîte, même retouche, recadrée au 3:2 de
  l'ancienne) ; une page où un visuel posé en perspective sur un écran est remplacé (les coins
  restent) ; une page vidéo au clip retouché, flou compris ; le design fermé puis rouvert.
  Mesures, sur 255 : fond flouté, fenêtre contre export 0,23 ; page 1 entière 0,45 ; visuel
  sur l'écran 1,73 ; PDF contre PNG 1,44 et 2,43 ; image du MP4 à 1 s contre l'export 1,32 ;
  rouvert, export identique (0,00) et fenêtre à 0,45. JPEG à 92 : 133 Ko, 0,57 du PNG ; à 50 :
  60 Ko, 1,39 ; WebP à 90 : 44 Ko, à 40 : 17 Ko. Le modèle du détourage : 46 s depuis
  l'application (112 s au premier essai, le modèle encore froid sur le disque du conteneur).
- Vérifié dans le conteneur : noyau 125 (le flou ajouté aux essais des réglages voisins et de
  l'échelle, la qualité à celui des images), interface 214 (4 de plus : remplacer dans le
  document, sa règle de recadrage, la qualité), `npm run build` ; Chromium : vérification 15
  (Remplacer d'une photo et d'un cadre, curseur Flou, curseur Qualité, JPEG plus léger), labo
  16, lot 1 10, lots 3 à 7 (34, 13, 27, 23, 25), shader 25 cas, corrections 23 (une
  exécution à 22 pendant une compilation : une mesure de temps de la musique sous la parole,
  repassée à 23 au calme) ; Tauri : la publicité 23, labo 14, lots 3 à 7 (21, 10, 17, 19, 23),
  exports du lot 1, corrections, pont de l'étape 3 (cadres).

## 2026-10-16, étape 5, lot 7 : le détourage

Accord d'Alexandre (« go pour le lot 7 »). Ce que Claude a fait et décidé :

- Le modèle : BiRefNet (Peng Zheng et ses co-auteurs, poids et code sous licence MIT, publiés
  sur Hugging Face), choisi parmi les modèles à licence libre pour un usage commercial. Écartés :
  RMBG 1.4 et 2.0 de BRIA (licence non commerciale) ; BEN2 Base (MIT) et BiRefNet lite (MIT),
  moins justes. Banc dans le conteneur, sur les 72 photos d'objets (sacs, bijoux, tasses,
  lampes, chaises, outils, appareils) de DIS-VD, le jeu de validation que BiRefNet n'a pas vu à
  l'entraînement, masque comparé à la vérité à la taille de l'original : BiRefNet, écart moyen
  0,035 (médiane 0,013), recouvrement 0,84, 47 photos au-dessus de 0,9 ; BiRefNet lite, 0,051,
  0,78, 34 ; BEN2 Base, 0,048, 0,79, 30. Ces modèles ont appris sur des jeux de recherche
  (DIS5K et d'autres) dont les conditions réservent les images à la recherche : les poids
  restent sous MIT, c'est ce que déclarent leurs auteurs.
- Le converti plutôt que le publié : les ONNX de BiRefNet en ligne déplient sa DeformConv en
  milliers d'opérations ; la version légère y demandait 5,5 Go de mémoire sur le processeur, la
  grande ne tenait pas dans les 8 Go du conteneur. Converti avec la DeformConv native
  (opset 20, que onnxruntime 1.30 sait calculer sur le processeur) : 2,2 Go pour la légère,
  3,5 Go pour la grande. Alexandre convertit une fois sur son poste (`outils/convertir_birefnet.py`,
  commande 21) : code et poids téléchargés à une révision fixée, empreintes SHA-256 vérifiées,
  sortie de l'ONNX comparée au modèle d'origine (écart nul dans le conteneur), quatre minutes.
- Lancé comme Whisper : un petit programme Python embarqué dans le noyau (`detourer.py`, écrit
  dans un dossier de travail neuf à chaque fois, lancé isolé), onnxruntime pour le processeur
  dans `telechargements/detourage/env/` (commande 20), aucune carte graphique visible, rien à
  chercher sur Internet. Le noyau lui donne l'original réduit à 1024 x 1024 et reçoit le masque.
  Dans le conteneur, deux cœurs : 22 s d'inférence, 45 à 50 s en tout depuis l'application.
- Le masque appartient à la photo, pas à l'objet : `ressources/masques/<photo>-<modèle>.png`,
  1024 x 1024 en niveaux de gris, tel que le modèle le rend ; fait une fois, relu ensuite (une
  copie de la photo, ou « Détourer » une seconde fois : immédiat) ; copié avec la photo d'un
  design à l'autre. Les coups de pinceau sont des valeurs du document (`detourage.coups` :
  points en fractions de l'image, rayon en fraction de son grand côté, dureté) : ils
  s'annulent comme le reste et valent à toutes les tailles.
- Un seul calcul : le masque agrandi (bilinéaire, centres des pixels alignés), puis les coups
  dans l'ordre (« garder » rapproche de 1, « effacer » de 0, une courbe douce sur le bord du
  pinceau). La fenêtre (`src/modele/detourage.ts`) et le noyau (`noyau/src/detourage.rs`) le
  font de la même façon, contrôlée par un tableau commun (`detourage.attendus.json`).
- La fenêtre compose la photo (son aperçu, ou sa toile retouchée par le labo) avec son masque,
  et la recompose seulement quand l'une ou l'autre change ; le pinceau ne recalcule que la zone
  du trait. L'export pose le masque sur l'original après les réglages du labo, avant le
  recadrage et la perspective (PNG, transparent ou non, JPEG, WebP, PDF, SVG).
- L'ombre d'une photo détourée suit sa silhouette, dans la fenêtre comme à l'export (le masque
  passe en silhouette dans la description de la page) ; en perspective, la silhouette déformée,
  rendue par le shader du lot 6.
- Le pinceau : sur la page, un cercle à la taille du pinceau, Effacer ou Garder, taille et
  dureté, X, [ et ], Entrée, Échap (revient au détourage d'avant), une étape d'annulation par
  coup ; ce qui est retiré se devine sous la photo. Écarté : un pinceau qui « devine » le bord
  (il demanderait un second modèle).
- Pont IA : `detourer` (retirer, pinceau en points de la page, revenir au masque du modèle,
  remettre le fond), 66 outils ; il attend le modèle aussi longtemps qu'un film.
- Mesures dans Tauri, une boîte rouge sur un fond gris dégradé, par le vrai modèle : fond
  retiré, bord net à quelques pixels près ; fenêtre contre export à 0,08 sur 255 ; avec
  l'ombre, 0,13 ; avec deux coups de pinceau, 0,09 ; détourée et en perspective, 0,11, avec
  l'ombre 0,16 ; PDF et SVG le même détourage. Sur la photo de la tasse : tasse, soucoupe et
  cuillère détourées proprement.
- Limites : une photo seulement (un clip demanderait un masque par image) ; le modèle cherche
  le sujet principal, pas un objet désigné ; les reflets et les ombres posées sur la table
  restent souvent, le pinceau les reprend.
- Essais : noyau 125 (8 de plus : le tableau commun, le pinceau, les tailles, les noms de
  masque, un faux programme, un programme en échec, le vrai modèle dans le conteneur, l'export
  d'une photo détourée), interface 210 (5 de plus) ; Chromium : lot 7 en 25 vérifications, lots
  1 à 6, shader et corrections repassés ; Tauri par le pont, avec le vrai modèle : lot 7 en
  23 vérifications, exports du lot 1 (62), lots 2 à 6 et corrections repassés ; dans la fenêtre
  de WebKitGTK : « Détourer » dans la barre, le pinceau et un coup.

## 2026-10-16, étape 5, lot 6 : la perspective

Accord d'Alexandre (« Ok, tu peux attaquer »). Ce que Claude a fait et décidé :

- La perspective est une valeur de l'élément (`perspective`, sur une photo ou un clip) : ses
  quatre coins, haut gauche, haut droit, bas droit, bas gauche, en fractions de sa boîte. La
  boîte reste la plus petite autour des coins : sélectionner, aligner, déplacer, agrandir et
  tourner l'objet marchent comme avant et emmènent la perspective. Écarté : des coins en pixels
  de la page, à recalculer à chaque déplacement de l'objet.
- Ce qui part en perspective est le visuel tel qu'on le voit à plat : le cadre gardé du lot 5,
  les retouches du labo. Sa taille à plat est la moyenne des côtés opposés du quadrilatère. Les
  coins arrondis et la bordure se dessinent à plat, puis suivent la perspective, comme sur une
  vraie affiche ; l'ombre suit le contour projeté.
- Le calcul : l'homographie du carré unité vers les quatre coins (Heckbert, 1989) et son
  inverse pour chaque pixel ; le bord et la bordure lissés sur la taille d'un pixel de sortie,
  mesurée par la dérivée de l'homographie ; la source lue dans une pyramide d'images réduites
  (lecture trilinéaire), au niveau du nombre de pixels de source par pixel de sortie. Un visuel
  posé loin et petit ne scintille pas, un visuel posé près reste net.
- Deux moteurs, un seul calcul, comme pour le labo : dans la fenêtre, un shader WebGL
  (`src/labo/moteurPerspective.ts`) ; à l'export, le noyau sur le processeur
  (`noyau/src/perspective.rs`). Un tableau de valeurs commun (`perspective.attendus.json`),
  écrit par le Rust et relu par les tests de l'interface, les garde d'accord.
- L'export : en PNG, JPEG, WebP et dans les films, le noyau pose l'original, image par image pour
  un clip (un clip posé petit se décode à la taille utile). Le PDF et le SVG ne savent pas
  déformer une image en perspective (leurs transformations sont affines) : le noyau pose le
  visuel déjà déformé, en image, assez fine pour l'original (jusqu'à trois fois la taille de
  l'export) ; le reste de la page reste vectoriel.
- Le mode « coins » : section Perspective du labo, « Poser les coins », ou un double-clic sur un
  visuel déjà en perspective. Quatre poignées, la grille des tiers projetée, glisser dans le
  visuel pour le déplacer, les flèches pour le dernier coin tiré, Entrée, Échap ; Suppr ne
  supprime rien pendant le mode. Un quadrilatère croisé, retourné ou trop mince est refusé : le
  coin s'arrête avant. Quatre perspectives prêtes (Fuit à gauche, Fuit à droite, Fuit vers le
  haut, Fuit vers le bas), comme points de départ ; « À plat ».
- Le recadrage attend que le visuel soit à plat (le panneau et l'outil du pont le disent).
  Écarté pour ce lot : un cadre de recadrage lui-même en perspective, difficile à lire.
- Un défaut des lots 2 à 5 corrigé au passage : un geste (un curseur du labo, un point de la
  courbe, l'intensité d'un préréglage, le cadre de recadrage, l'angle, un coin de la
  perspective) pouvait se couper en deux étapes d'annulation quand plus de 700 ms passaient
  entre deux mouvements. Ses étiquettes portent maintenant une marque propre au geste, et ses
  étapes se fondent quelle que soit la pause. Trouvé en repassant le test du lot 2 : dans le
  conteneur, Chromium met parfois plus de 700 ms à suivre un mouvement du curseur.
- Pont IA : `perspective` (quatre coins en pixels de la page, une perspective prête, ou à plat),
  65 outils ; `recadrer` refuse un visuel en perspective et dit quoi faire.
- Mesures dans Tauri, post carré, une photo posée par ses coins sur un écran dessiné penché :
  fenêtre contre export à 2,09 sur 255 dans le visuel, 0,47 sur toute la page ; avec coins
  arrondis, bordure et ombre, 0,70 ; le PDF rendu par poppler, 2,08 (poppler pose toute image un
  demi-pixel plus loin que tiny-skia et Chromium : constaté aussi sur une photo à plat, 4,30
  sans compenser, 2,76 en compensant) ; le SVG rendu par Chromium, 1,45 ; un clip retouché en
  perspective, capture contre export à 1,35, image du MP4 à 1,67 ; ce film de 3 s en 1080 × 1080
  (90 images) en 18,1 s sur les deux cœurs du conteneur.
- Limites : une face par visuel (une boîte vue sur deux faces demande deux visuels) ; pas
  d'écran courbe ; l'histogramme du labo reste celui du visuel à plat.
- Essais : noyau 117 (6 de plus : le tableau commun, les coins, un damier en perspective, coins
  arrondis et bordure, l'export d'une photo en perspective, un clip en perspective dans le
  film), interface 205 (5 de plus : quatre pour la géométrie de la perspective, un pour les
  gestes dans l'historique) ; Chromium : lot 6 en 23 vérifications, shader contre le tableau
  25 cas, lots 1 à 5 et corrections repassés ; Tauri par le pont : lot 6 en 19 vérifications,
  exports du lot 1 (62), lots 2 à 5 et corrections repassés ; dans la fenêtre de WebKitGTK : le
  visuel posé par le shader, le mode « coins » au double-clic, un coin tiré.

## 2026-10-16, étape 5, lot 5 : recadrer et redresser

Accord d'Alexandre (« Tu peux passer au lot 5 »). Ce que Claude a fait et décidé :

- Le recadrage est une valeur de l'élément (`rognage`), pas un réglage du labo : copier et
  coller les réglages d'une photo à une autre de la série, ou appliquer un préréglage, ne
  l'emporte pas, et la boîte de l'objet change avec lui. Il garde le rectangle gardé dans
  l'image redressée, en fractions de l'original (les mêmes nombres valent pour l'aperçu,
  l'original et la copie d'un clip), et l'angle, de -45 à +45°.
- Jamais de coin vide, comme Lightroom quand le cadre est contraint à l'image : chaque geste
  s'arrête au bord de l'image, et redresser resserre le cadre autour de son centre juste ce qu'il
  faut. Écarté : laisser des coins vides, qu'il faudrait ensuite combler à la main.
- Deux façons de bouger. Les poignées et les proportions laissent la photo en place sur la page
  et la boîte devient le cadre, comme dans Canva ; glisser dans le cadre, la molette, les
  flèches et l'angle laissent la boîte en place, la photo bouge dessous. Redresser ne dérange
  donc pas la mise en page.
- La fenêtre pose le recadrage en dessinant la photo : sans angle, la partie gardée de la source
  étirée sur la boîte (l'ombre suit encore la transparence de l'image) ; redressée, l'image
  tournée, découpée par la boîte (l'ombre passe alors par une plaque, comme pour des coins
  arrondis). L'export n'a rien à ajouter : l'enregistrement de la page en SVG porte la découpe
  et la rotation, et le noyau pose l'original dedans (PNG, PDF, SVG, film).
- Le vignetage suit le cadre gardé, comme le vignetage après recadrage de Lightroom : sans
  cela, une photo recadrée sur sa moitié gauche n'aurait qu'un côté assombri. Le repère du cadre
  accompagne les réglages vers le shader et le noyau, seulement quand il y a un vignetage (sans
  vignetage, recadrer ne change aucun pixel et ne refait aucune retouche). Deux cas au tableau
  commun (25 cas), écart nul.
- « Auto » (`noyau/src/horizon.rs`) : l'aperçu réduit à 640 px, les bords les plus nets
  (Sobel), une transformée de Hough limitée aux droites à moins de 20° de l'horizontale ou de
  la verticale, chaque bord votant pour les droites à moins de 8° de sa direction ; la droite
  la plus forte donne l'angle, une horizontale l'emportant sur une verticale de même force. Sur
  des horizons et des murs dessinés penchés de -2,5 à 7,25° : à 0,1° près. Une droite qui ne
  court pas sur le cinquième de l'image ne compte pas : sans ligne nette, pas de réponse, et le
  panneau propose de tracer l'horizon. Écarté : un modèle d'IA, inutile pour trouver une droite.
- « Tracer l'horizon » : une ligne tracée sur la photo devient horizontale, ou verticale si
  elle en est plus proche. La grille des tiers accompagne le cadre ; pendant qu'on tire le
  curseur d'angle, une grille fine aide à juger les droites.
- Un défaut du lot 3 corrigé au passage : une photo dessinée pendant qu'une autre était en
  direct (un préréglage survolé) prévenait l'autre pendant son propre rendu, ce que React
  signale ; elle la prévient maintenant juste après.
- Pont IA : `recadrer` (remettre, angle ou auto, proportions, zone exacte), 64 outils.
- Mesures dans Tauri, post carré : photo en 1:1, fenêtre contre export à 1,53 sur 255 ;
  redressée de 7°, 1,51 ; son PDF rendu par poppler, 1,96 ; avec un vignetage de -80, 1,36, et
  les quatre coins du cadre assombris du même facteur (0,44 en lumière linéaire), le centre
  intact ; son SVG rendu par Chromium, le même que le PNG ; « auto » sur un horizon dessiné
  penché de 4° : -4,0° ; un clip en 4:5 redressé de -5° : capture contre export à 1,82, image du
  MP4 à 1,76.
- Limites : l'histogramme reste celui de l'image entière ; le grain garde l'échelle de l'image ;
  « Auto » regarde les droites, pas le sujet ; pour un clip, il analyse sa couverture.
- Essais : noyau 111 (5 de plus : trois pour l'horizon, le vignetage qui suit le cadre, le
  recadrage dans les réglages de l'export), interface 200 (6 de plus, la géométrie du
  recadrage) ; Chromium : lot 5 en 27 vérifications, shader contre le tableau 25 cas, lots 1 à
  4 et corrections repassés ; Tauri par le pont : lot 5 en 17 vérifications, exports du lot 1
  (62), lots 2 à 4 et corrections repassés ; dans la fenêtre de WebKitGTK : le mode recadrage
  au double-clic, une poignée tirée, l'angle.

## 2026-10-16, corrections du BRIEF : la musique sous une vidéo qui parle, l'étalonnage

Réponses d'Alexandre au compte rendu du lot 4 : « Oui, pour ton point 1. Deux, ta
recommandation. Et oui, pour l'étalonnage. » Le BRIEF est corrigé en quatre points, avec son
accord (en-tête du BRIEF) :

- Le grain et la réduction du bruit vont de 0 à 100 (le BRIEF disait -100 à +100 pour tous les
  curseurs) ; le PDF vectoriel passe par `krilla` et `krilla-svg` à la place de `svg2pdf`
  (choix du lot 1, JOURNAL du même jour).
- La musique baisse aussi là où l'on parle dans une vidéo de la page, pas seulement sous un son
  au rôle Voix. Recommandation de Claude, retenue : la baisse suit la parole que le noyau
  trouve dans le son de la vidéo (la même analyse que pour couper les blancs), et non toute
  vidéo qu'on entend. Écarté : baisser sous chaque vidéo qui a du son, parce qu'une vidéo de
  bruit d'ambiance (une rue, une cuisine) ferait taire la musique sans raison. Les passages de
  parole du fichier sont ramenés au temps de la page (coupe, vitesse, temps du clip), une
  vidéo muette ou cachée ne compte pas, et deux passages à moins de 1,2 s l'un de l'autre n'en
  font qu'un : sans cela, la musique remonterait entre deux phrases. Mêmes rampes que sous la
  voix (200 ms avant, 400 ms après). Limite connue : l'analyse écoute un niveau, pas une voix ;
  un son continu fort (une perceuse) compte comme de la parole. Le tableau commun du son passe
  à 84 cas, dont 24 avec de la parole de vidéo.
- L'étalonnage, ajouté au labo : une teinte (0 à 360°) et sa force (0 à 100) pour les ombres,
  les tons moyens et les hautes lumières, et un équilibre (-100 à +100). Il vient en dernier
  des couleurs, après la saturation et le mélangeur, si bien qu'il colore aussi une photo
  passée en noir et blanc. Formule : l'écart de la teinte pleine à sa propre luminance (un gris
  ne change pas de luminance), pondéré par trois zones prises sur la luminance perçue, dont la
  frontière glisse avec l'équilibre ; il multiplie la couleur en lumière linéaire. Le même
  calcul dans le noyau et le shader : trois cas ajoutés au tableau commun (23 cas), écart
  nul. Dans le panneau, sous le mélangeur : Teinte (piste arc-en-ciel, en degrés), Force,
  Équilibre ; une teinte choisie sans force en reçoit une de 25, pour qu'on la voie. Un
  préréglage à mi-intensité divise la force de chaque teinte, garde les teintes et
  l'équilibre.
- Deux préréglages en profitent, dans Noir et blanc : Sépia et Noir et blanc bleuté (25 en
  tout).
- Pont IA : `retoucher` prend `etalonnage`, zone par zone (une zone donnée se fond avec celle
  déjà posée, comme une couleur du mélangeur), avec des erreurs qui nomment les zones.
- Essais : noyau 106 (3 de plus : la musique qui baisse sous la parole d'une vidéo, les
  passages d'une vidéo dans le temps de la page, l'étalonnage d'un noir et blanc), interface
  194 (5 de plus) ; Chromium : shader contre le tableau 23 cas, étalonnage au panneau et
  musique sous une vidéo qui parle 23 vérifications (l'analyse y est simulée), lots 2 à 4 et
  étape 4 (lot 5) repassés ; Tauri par le pont : étalonnage et sépia, fenêtre contre export à
  1,75 et 1,03 sur 255, et le MP4 où le la de la musique tombe à 0,30 de son amplitude pendant
  la parole de la vidéo puis remonte, 9 vérifications ; lots 2 à 4 repassés. L'essai du son
  de l'étape 4 dans WebKit (sortie muette de PulseAudio enregistrée) échoue sur deux points,
  avec les mêmes chiffres qu'avant ces corrections (suites du lot 7 de l'étape 4) : un défaut
  de l'enregistrement dans le conteneur, à revoir, pas de ce changement.

## 2026-10-16, étape 5, lot 4 : les clips vidéo au labo

Accord d'Alexandre (« Ok, tu peux continuer »). Ce que Claude a fait et décidé :

- Un clip a le même champ `reglages` qu'une photo (règle 13 : le fichier n'est jamais touché),
  le même panneau, les mêmes préréglages ; copier et coller, et « Copier le style », passent
  d'une photo à un clip et inversement.
- La lecture : un second moteur du shader, réservé aux clips (le premier reste aux photos, que
  rien ne doit déranger pendant qu'on tire un curseur). Chaque clip retouché y passe au moment
  où la page le dessine, image après image, puis l'image est posée tout de suite dans la page :
  rien n'est recopié (règle 11), et plusieurs clips y passent l'un après l'autre. La texture de
  la vidéo est rechargée à chaque dessin.
- Les réglages qui regardent les voisins (texture, clarté, voile, netteté, bruit) : à l'arrêt,
  le noyau les calcule sur l'image même que la page montre, envoyée en pixels bruts (commande
  `labo_base_pixels`), quand on relâche le curseur ; le shader y ajoute l'écart des réglages
  d'un pixel, comme pour une photo. Pendant la lecture, ils ne se voient pas : il faudrait les
  refaire dans le shader (des flous en plusieurs passes), écarté pour ce lot ; l'export les a
  toujours. Le panneau le dit.
- Le grain d'un clip change 24 fois par seconde du fichier (une graine tirée de l'instant
  décale la grille du bruit, la même dans le noyau et dans le shader). Un grain figé sur une
  image qui bouge ressemble à une vitre sale. Une photo garde la graine 0 : rien ne change
  pour elle. Un cas de grain de clip ajouté au tableau commun (20 cas) : écart nul.
- L'export : le film décode chaque image depuis l'original et la retouche à sa taille dans le
  film, grain de son instant compris ; l'image d'un clip à un instant (PNG, JPEG, WebP, PDF,
  SVG) aussi, à la définition de l'original. La capture et les vignettes d'une page vidéo
  prennent l'image de la copie d'aperçu retouchée par le noyau (`image_video` reçoit les
  réglages). Les vignettes de la frise restent sans retouche.
- Accélération au passage : l'étape des tonalités est sautée quand aucun de ses réglages ne
  bouge (deux puissances de moins par pixel, dans le noyau et dans le shader) ; une image de
  1000 × 563 px passe de 45 à 23 ms sur les deux cœurs du conteneur.
- Mesures dans Tauri (clip de 3 s en 1280 × 720, posé sur 1000 px d'un post carré) : capture
  contre export à 1,46 sur 255 (réglages d'un pixel ; 2,05 sans retouche, la capture partant de
  la copie d'aperçu en VP9), 2,92 avec clarté, texture et netteté ; l'image à 1 s du MP4 à 1,66
  de l'export de la même image. Le film de 3 s : 6,7 s sans retouche, 14,9 s avec des réglages
  d'un pixel, 21 s avec clarté, texture et netteté, sur les deux cœurs du conteneur, où le
  codage x264 se partage les mêmes cœurs. Chez Alexandre, à mesurer.
- Pont IA : `retoucher` et `prereglages` (enregistrer depuis) prennent les clips ; 63 outils.
- Essais : noyau 103 (4 de plus : le grain d'un clip, la base d'un clip et son image retouchée,
  un film retouché image par image, une page vidéo retouchée en PNG et en SVG), interface 189
  (2 de plus) ; Chromium : shader contre le tableau 20 cas, clips au labo 13 vérifications,
  lots 2 et 3 repassés, étape 4 (lots 1 et 2) repassée ; Tauri par le pont : clips 10
  vérifications, lots 2 et 3 repassés ; dans la fenêtre de WebKitGTK : le clip retouché à
  l'arrêt (avec la clarté du noyau) et pendant la lecture.

## 2026-10-16, étape 5, lot 3 : courbe des tonalités, préréglages, copier et coller

Accord d'Alexandre (« Tu peux attaquer le lot 3 »). Ce que Claude a fait et décidé :

- La courbe des tonalités, étape 3 de l'ordre du BRIEF (après les tonalités, avant les
  couleurs) : une courbe de points pour l'image entière (RVB), puis une par canal, comme la
  courbe de points de Lightroom. Elle travaille sur l'image telle qu'elle s'affiche (en sRGB, de
  0 à 1 ; au-delà du blanc, le blanc). Points entiers de 0 à 255, seize au plus, toujours une
  entrée 0 et une entrée 255 (ajoutées en (0, 0) et (255, 255) si elles manquent) ; une
  diagonale sort du document. Entre les points, une courbe monotone (Fritsch et Carlson,
  1980) : elle ne repart jamais en arrière entre deux points qui montent et ne dépasse pas ses
  voisins. Écartée : la spline naturelle, qui ondule et peut inverser des tons.
- La même courbe dans le noyau et dans la fenêtre : une table de 1024 pas par canal, calculée
  en f64 des deux côtés, lue en ligne droite ; dans le shader, une texture de deux lignes (les
  réglages du moment, ceux de la base du noyau). Quatre cas de courbe ajoutés au tableau commun
  (19 cas) : écart nul entre le shader et le noyau sur les quatre.
- Écartée pour l'instant : la courbe paramétrique de Lightroom (quatre zones à curseurs) ; la
  courbe de points fait la même chose, en plus libre. À ajouter si Alexandre la demande.
- Les préréglages : 23 dessinés par Claude (`src/modele/prereglages.json`), en cinq catégories
  (Naturel, Couleur, Film, Noir et blanc, Sujets), réglés à l'œil sur une planche de cinq photos
  rendue par le noyau (un portrait, un café, un chat, une fusée de nuit, une moto). Un
  préréglage est un style : il ne touche ni à l'exposition, ni à la netteté, ni à la réduction
  du bruit, propres à chaque photo ; l'appliquer remplace tout le reste de la retouche (pas de
  mélange avec le style d'avant, qui laisserait des restes). Intensité de 0 à 100 % : chaque
  valeur rapprochée de zéro, chaque point de courbe de la diagonale, réglable juste après
  l'application tant que le style n'a pas été retouché (l'exposition peut bouger).
- Écarté : un sépia et des noirs et blancs teintés. L'ordre fixe du BRIEF met la balance des
  blancs et la courbe avant la saturation : une photo passée en noir et blanc (saturation -100)
  ne peut plus être teintée. Un étalonnage (ombres, tons moyens, hautes lumières teintés, comme
  dans Lightroom) le permettrait ; il n'est pas dans le BRIEF, proposition laissée à Alexandre.
  À la place : « Sombre et désaturé ».
- Les préréglages d'Alexandre : « Enregistrer comme préréglage » garde le style de la photo sous
  un nom (le même nom remplace), dans `~/Documents/Eliot/Préréglages/prereglages.json`, hors des
  designs (commandes `prereglages_lire` et `prereglages_enregistrer`, liste vérifiée par le
  noyau, écriture atomique, fichier abîmé laissé tel quel). Suppression par la corbeille de la
  vignette, après confirmation.
- Le panneau : section Préréglages en tête (catégories, vignettes de la photo avec chaque style
  par le shader, survol montré sur la page sans toucher au document, clic qui applique en une
  étape d'annulation, intensité) ; la courbe sous les curseurs de Lumière (canaux RVB, Rouge,
  Vert, Bleu, histogramme derrière, clic qui pose un point, glisser, double-clic qui l'enlève,
  flèches et Suppr au clavier ; un geste, une étape d'annulation).
- Copier et coller les réglages : Ctrl+Maj+C et Ctrl+Maj+V (les touches de Lightroom), boutons
  du labo, clic droit, et un bouton dans la barre du haut quand des photos sont choisies.
  Tous les réglages passent, exposition comprise, sur une ou plusieurs photos, en une étape
  d'annulation. « Copier le style » d'une photo emporte aussi sa retouche (pas vers une vidéo
  avant le lot 4).
- Pont IA : `retoucher` prend la courbe, `prereglage` et `intensite` (par nom ou identifiant,
  sans tenir compte des accents), `depuis` (les réglages d'une autre photo) ; nouvel outil
  `prereglages` (lister, enregistrer ; pas de suppression par le pont) ; 63 outils.
- Essais : noyau 99 (3 de plus : la courbe, les préréglages fournis valides et distincts deux à
  deux, les préréglages d'Alexandre lus et écrits), interface 187 (8 de plus) ; Chromium :
  shader contre le tableau 19 cas, panneau du lot 3 34 vérifications, panneau du lot 2 16 ;
  Tauri par le pont : 21 vérifications (préréglage avec courbe, fenêtre contre export à 1,35 sur
  255 ; courbe en S et canal bleu à 1,67 ; réglages voisins et courbe à 1,92 ; préréglage
  enregistré sur le disque puis appliqué à une autre photo ; depuis ; PDF avec la courbe à 1,73
  de l'export PNG ; erreurs), labo du lot 2 14 ; dans la fenêtre de WebKitGTK, à la souris : les
  vignettes, le survol en noir et blanc, un point de la courbe tiré, la photo qui suit.

## 2026-10-16, étape 5, lot 2 : le labo photo

Accord d'Alexandre pour continuer (« Tu peux continuer »). Ce que Claude a fait et décidé :

- Le moteur dans le noyau (`noyau/src/labo.rs`) : les réglages en nombres à virgule, en lumière
  linéaire, dans l'ordre du BRIEF : balance des blancs et exposition (des gains par canal),
  tonalités sur la luminance perçue, couleurs (saturation, vibrance, puis le mélangeur de huit
  couleurs, rotation de teinte autour de l'axe des gris), détail (réduction du bruit de la
  couleur et de la luminance en gardant les bords, puis netteté), effets (texture, clarté sur
  les tons moyens, correction du voile par le canal sombre, puis vignetage et grain). Les
  rayons des réglages voisins comptent en pixels d'une image de 2560 px et suivent sa taille :
  l'aperçu et l'original donnent le même dessin (essai : écart moyen sous 4 sur 255 entre
  « retoucher puis réduire » et « réduire puis retoucher »). Le grain est un bruit de valeur sur
  la même grille, pour la même raison.
- Plages : chaque curseur de -100 à +100 autour de zéro comme le dit le BRIEF, sauf
  l'exposition (de -5 à +5 IL), et sauf la réduction du bruit et le grain, de 0 à 100 comme dans
  Lightroom (un négatif n'y voudrait rien dire). Écart au texte du BRIEF, à valider par
  Alexandre.
- L'aperçu en direct, par la voie retenue au lot 0 : les réglages d'un pixel dans un shader
  WebGL 2 (`src/labo/shader.ts`, mêmes formules ligne pour ligne). Les réglages voisins viennent
  du noyau (commande `labo_base`), calculés sur l'aperçu de 2560 px au relâchement du curseur :
  une base sans vignetage ni grain ; le shader y ajoute l'écart entre les réglages d'un pixel du
  moment et ceux de la base, puis le vignetage et le grain. Au repos l'image est celle du
  noyau ; pendant qu'on tire un curseur, elle suit en direct. Pendant le geste, la page affiche
  la toile du shader elle-même, sans la recopier à chaque image (règle 11) ; elle est recopiée
  dans la toile de la photo au relâchement.
- Tableau commun `src/modele/labo.attendus.json` : quinze cas de réglages, 96 pixels chacun,
  calculés par le noyau, relus par le noyau (`cargo test`) et par le shader dans Chromium : au
  plus 1 sur 255 d'écart, sur deux cas, aucun ailleurs.
- L'export : le film, le PNG, le JPEG et le WebP retouchent la photo réduite à sa taille dans
  l'export (depuis l'original) ; le PDF et le SVG emportent la photo retouchée à la définition
  de l'original. Mesuré dans Tauri : fenêtre et export à 2,3 sur 255 en moyenne pour les
  réglages d'un pixel ; 3,2 avec la clarté, la texture, la netteté, le voile et le bruit, la
  fenêtre partant de l'aperçu (un JPEG) et l'export de l'original : la netteté relève un peu
  les traces de compression de l'aperçu. Base des réglages voisins sur un aperçu de 2560 px :
  1,5 s sur les deux cœurs du conteneur (le banc du lot 0 en annonçait environ 150 ms sur les 32
  fils du poste).
- Le panneau (`src/labo/PanneauLabo.tsx`), à la place du panneau de gauche : histogramme (rouge,
  vert, bleu), « Avant (maintenir) », « Tout » pour tout remettre à zéro, Lumière, Couleur avec
  le mélangeur (pastilles des huit couleurs), Effets, Détail ; pistes colorées pour la
  température, la teinte, la vibrance, la saturation, l'exposition et le mélangeur, repère du
  zéro au milieu des autres. Double-clic : zéro ; valeur au clavier ; un geste, une étape
  d'annulation. Le labo suit la photo choisie et se ferme par un onglet du rail.
- Le document : `reglages` sur un élément `image`, seulement les curseurs différents de zéro
  (même version 4). Pont IA : outil `retoucher` (les réglages s'ajoutent, 0 en retire un,
  `remettre` repart de zéro), 62 outils.
- Reste pour plus tard : la retouche des photos posées dans un cadre ou une maquette (elles
  n'ont pas encore de bouton Retoucher), les clips vidéo (lot 4), la courbe, les préréglages et
  le copier-coller des réglages (lot 3).
- Essais : noyau 96 (6 de plus, dont l'export d'une page retouchée), interface 179 (5 de plus) ;
  Chromium : shader contre le tableau 15 cas, panneau 16 ; Tauri : labo 14 (fenêtre contre
  export, réglages voisins, PDF et SVG retouchés, original intact, annuler, remettre à zéro),
  et dans la fenêtre de WebKitGTK la température tirée à la souris : la photo suit, valeur par
  valeur.

## 2026-10-16, étape 5, lot 1 : les exports depuis le document

- Le noyau rend lui-même la page pour tous les exports en image et en document, comme pour le
  film : la fenêtre la décrit en calques (`src/export/calques.ts`), le noyau la dessine avec
  les originaux des photos et les fichiers de police de la fenêtre (`noyau/src/rendu_page.rs`,
  commande `exporter_document`). L'export ne dépend plus des aperçus de 2560 px. Hors de
  l'application, dans un navigateur, le PNG et le JPEG passent encore par Konva.
- PNG, JPEG (qualité 92, posé sur du blanc) et WebP (encodeur libwebp du `ffmpeg` du système,
  qualité 90, transparence possible), de ×1 à ×4, ou 150 et 300 dpi pour l'A4 et l'A5 ; au plus
  12 000 px de côté et 100 millions de pixels.
- PDF : toutes les pages en un fichier (ou la page affichée), par `krilla` 0.8.2 et
  `krilla-svg` 0.8.1 (MIT ou Apache-2.0, toutes leurs dépendances sous licences permissives).
  Écart avec le plan, qui nommait `svg2pdf` 0.13 : cette version tient à `resvg` 0.45 et ne fait
  qu'une page par fichier ; `krilla-svg`, des mêmes auteurs chez Typst, en reprend le travail,
  lit l'arbre de `usvg` 0.47 et fait des documents de plusieurs pages. Formes et textes restent
  vectoriels, les textes se sélectionnent, les polices sont incluses (réduites aux lettres
  employées), une photo JPEG droite passe sans être recompressée et une seule fois même posée
  trois fois. Une page A4 ou A5 prend la taille de son papier ; une autre compte 96 pixels par
  pouce (1080 px font 810 pt). Le BRIEF (§ 6, « L'export, de bout en bout ») nomme encore
  `svg2pdf` ; à corriger avec l'accord d'Alexandre.
- SVG : la page en un seul document, relu et réécrit par `usvg` 0.48 : textes en tracés, photos
  et images des vidéos dedans ; il s'ouvre tel quel sans les polices.
- Deux réglages des calques de texte (`contexteSvg.ts`), trouvés par la comparaison au pixel,
  valent aussi pour le film. La taille optique (l'axe `opsz` des polices variables Inter,
  Fraunces, DM Sans, Bodoni Moda, Source Serif 4) : le canevas de WebKitGTK ne l'applique pas,
  celui de Chromium l'applique, `resvg` l'appliquait toujours ; la fenêtre mesure désormais,
  une fois par police, ce que fait son canevas (largeur d'un texte au canevas contre la même
  dans la page, avec et sans taille optique) et le dit au noyau (`font-optical-sizing`). Et
  chaque ligne garde la longueur que la fenêtre lui mesure (`textLength`), parce que le moteur
  de polices de WebKitGTK arrondit ses avances (jusqu'à 3 px d'écart au bout d'une ligne de
  740 px).
- WebP : écrit dans un tuyau, `ffmpeg` laisse la taille du fichier à 0 en tête et, au-delà de
  32 Ko, l'écrit en quatre octets de trop à la fin ; Pillow refusait le fichier. Le noyau garde
  les blocs entiers et note la taille.
- Comparaison au pixel dans Tauri (WebKitGTK), par le pont, entre la capture de la fenêtre et
  le PNG du noyau : les 42 modèles de départ, écart moyen de 0,54 sur 255 (médiane 0,53, 1,4 au
  pire, « On recrute ») ; après un léger adoucissement qui efface le lissage des bords des
  lettres, 0,46 % des pixels au plus s'écartent de plus de 40, rien ne se déplace. Une page
  riche (photo couchée par l'appareil, tournée, arrondie, bordée, ombrée ; cadre, maquette,
  icône, emoji, QR code, graphique, tableau, trois polices, fond en dégradé, vidéo en
  couverture) : 0,72 ; son PDF rendu par poppler : 1,04 ; son SVG rendu par Chromium : 0,49.
  Avant les deux réglages des textes : 1,41 pour la page riche et 2,11 au pire des modèles.
  Ce qui reste : le lissage des lettres et leur ligne de base, que WebKitGTK cale au pixel.
- Fenêtre d'export revue : sept formats (PNG, JPEG, WebP ; PDF, SVG ; MP4, GIF), tailles en ×1
  à ×4 ou en dpi, transparence pour le PNG et le WebP, choix des pages pour le PDF (toutes par
  défaut) ; le SVG prend la page affichée.
- Pont IA : `exporter` prend `webp`, `pdf`, `svg` et `echelle` (0,5 et 1 pour l'A4 et l'A5, 1 à
  4 sinon ; `ratio` reste compris). Sa description change : recompiler le pont (commande 13).
- Essais : noyau 90 (6 de plus), interface 174 (2 de plus). Chromium : fenêtre d'export hors de
  l'application 10 ; sous-titres 44 ; la page animée du lot 4 de l'étape 4, écran contre noyau,
  de 0,41 à 0,52 sur 255 avec 0,13 % de pixels éloignés au plus (0,38 % avant la mesure de la
  taille optique). Tauri : exports 62 (les 42 modèles, la page riche, les formats), montage
  complet de l'étape 4 25. PDF de trois pages A4 avec une photo de 6 Mpx : 1,8 s dans le
  conteneur. Une photo introuvable fait échouer le PDF ou le SVG avec un message, au lieu d'y
  laisser un trou.
- Point à surveiller, d'avant ce lot : le montage complet de l'étape 4 (Tauri) passe 25 sur 25,
  mais une exécution, lancée pendant que d'autres essais tournaient, a vu la fenêtre se figer
  après la réouverture du design, au passage sur la page du post animé (le moteur web à 144 %
  du processeur, le pont sans réponse) ; même moment que l'arrêt noté à la vérification de
  l'étape 4. Pas reproduit en relançant seul.

## 2026-10-16, banc de l'aperçu en direct : le shader WebGL

- Série d'Alexandre sur le poste principal (`00_banc_essai/resultats/2026-10-16_091151_tauri-webkitgtk_labo.json`),
  fenêtre Tauri, écran à 63 Hz et à 125 %, page affichée à 0,604 (la photo y fait 815 px de
  large), 7950X3D (32 fils), carte NVIDIA.
- Shader WebGL : 62,2 images par seconde, sans un à-coup, la photo dessinée dans Konva (2,7 ms
  de dessin par image) comme posée sur la page ; la vidéo VP9 720p qui joue sous le shader :
  fluide, aucune image perdue, vitesse 1, 3 ms par image pour la texture et le dessin.
- Rust en direct : 35,5 images réglées par seconde à 1280 px, 18 ms entre le curseur et l'image
  (calcul 5,5 ms, transfert 11,9 ms pour 4,4 Mo) ; 22,3 par seconde à 1920 px (38 ms) ; 12,3 à
  2560 px (71 ms). Le transfert pèse plus que le calcul.
- Écart entre les deux rendus des mêmes pixels : 0,044 sur 255 en moyenne, 1 au plus, aucun
  pixel au-delà de 2.
- Réglages qui regardent les voisins, par le Rust : 157 ms pour les cinq sur l'aperçu de
  2560 px (clarté 30, texture 19, netteté 23, bruit 37, voile 37) ; tout le labo sur l'original
  de 24 Mpx : 1,4 s (décodage compris), ce que coûtera l'export d'une photo réglée.
- Décision par la règle écrite avant la mesure (`PLAN.md`) : les deux voies passent (shader à 62
  images par seconde sur la photo et la vidéo, écart 0,044 ; Rust à 35,5 avec 18 ms), donc le
  shader, qui vaut aussi pour les clips qui jouent. Le labo du lot 2 : les réglages d'un pixel
  dans un shader WebGL pendant qu'on tire un curseur, ceux qui regardent les voisins calculés
  par le Rust sur l'aperçu de 2560 px au relâchement, l'export depuis l'original par le Rust ;
  les mêmes formules des deux côtés, contrôlées par un tableau de valeurs attendues commun. Le
  mini PC confirmera quand il sera là. Lot 0 coché dans `PLAN.md`.

## 2026-10-16, étape 5 ouverte : plan et banc de l'aperçu en direct

- Alexandre valide la vérification de l'étape 4 et les propositions de fin de livraison (« Ok,
  c'est bon, je valide, tu peux continuer à l'étape 5 »). Lu par Claude :
  - la coupe des silences et des hésitations en morceaux de la frise (lot 7) est retenue ; le
    BRIEF est corrigé dans ce sens (§ 6, « Le son », et le modèle de document) ;
  - le nom du kit de marque passe dans l'amorce donnée à Whisper, pour que les sous-titres
    l'écrivent juste (fait le même jour : « On parle d'Eliot. » après la phrase des « euh » ;
    une phrase qui cite le nom aide plus que le nom seul). Mesuré sur la voix de synthèse qui
    dit deux fois « Eliot » : sans le nom, aucune fois écrit juste (« Gélio ») ; avec, une ou
    deux fois selon l'enregistrement. Une aide, pas une garantie ; les « euh » restent écrits ;
  - la musique sous une vidéo où l'on parle : deux façons étaient proposées, aucune n'est
    choisie ; la question reste posée (rien ne change d'ici là, détacher le son suffit).
- Plan de l'étape 5 écrit dans `PLAN.md` : huit lots (banc de l'aperçu en direct, exports depuis
  le document, labo, préréglages et courbe, clips vidéo, recadrage, perspective, détourage) et
  les choix par défaut de Claude, dont la règle qui départagera les deux voies de l'aperçu,
  écrite avant la mesure.
- Lot 0 : banc de l'aperçu en direct ajouté à `00_banc_essai/` (`src-tauri/src/labo.rs`,
  `src/labo.ts`, bouton « Labo photo (étape 5) »). Les réglages d'un pixel (balance des
  blancs, exposition, contraste, hautes lumières, ombres, blancs, noirs, saturation, vibrance,
  mélangeur de huit couleurs, vignetage, grain) sont écrits en Rust et en GLSL, ligne pour
  ligne, dans l'ordre du BRIEF ; ceux qui regardent les voisins (clarté, texture, netteté,
  bruit, voile) en Rust seulement, chronométrés. Commande 6 ter du `CLAUDE.md`.

## 2026-10-15, étape 4 : vérification de l'étape

Accord d'Alexandre pour continuer (« Fais la suite »). Ce que Claude a fait et décidé :

- Relecture de l'étape contre le BRIEF (§ 6, « Ce que Eliot reprend de CapCut » et « Le son » ;
  § 7 ; catalogue, ligne Vidéo) et le PLAN (« Claude peut tout faire par le pont ») : tout y
  est, à quatre points près.
  - Manque comblé : « ajouter une animation ouvre la frise d'office » et « un design sans vidéo
    peut aussi devenir animé ». Le bouton Animer ne venait que sur une page vidéo. Il vient
    aussi sur une image fixe : la première animation posée fait de la page une vidéo de 5 s et
    ouvre la frise, en une seule étape d'annulation (pas d'aperçu au survol tant que la page
    est fixe : rien ne bouge encore). Les outils `animer` et `images_cles` du pont font de même.
  - Reporté : l'original d'un son Freesound par la connexion au compte (OAuth2). Il faut créer
    une application sur Freesound avec le compte d'Alexandre ; l'extrait de bonne qualité
    (environ 192 kbit/s) suffit à une vidéo pour les réseaux. Noté au PLAN.
  - Déjà noté au lot 7, à valider par Alexandre : la coupe des silences en morceaux de la frise.
  - Viennent avec d'autres étapes : les réglages du labo photo sur un clip (étape 5), le banc
    du mini PC.
- Défaut trouvé et corrigé : pendant `npm run tauri dev` (la façon de lancer Eliot, commande
  10), modifier un fichier qui n'est pas du code dans `01_application/` (le LISEZMOI, une
  livraison de Claude) rechargeait la fenêtre, revenue à l'accueil, et coupait ce qui était en
  cours (une transcription, un export). Cause : le greffon de Tailwind cherchait des classes
  dans tous les fichiers du dossier et rechargeait la page à chaque changement. Il ne cherche
  plus que dans `src/` (`source(".")` dans `styles.css`). Vérifié dans Tauri, avec et sans la
  correction ; la feuille de style produite perd seulement trois classes que rien n'utilisait
  (`static`, `outline`, `lowercase`, tirées du texte des documents).
- Montage complet par le pont, dans Tauri (le parcours qu'une IA ferait pour Alexandre) : deux
  vidéos bout à bout et un fondu enchaîné ; le son de la vidéo qui parle détaché ; ses blancs
  et ses « euh » coupés (trois morceaux, le son détaché coupé pareil, la transition gardée par
  le premier, Ctrl+Z qui défait toute la coupe) ; un titre animé (lettres, pulsation, fondu) ;
  un emoji déplacé par images clés ; une voix de synthèse nettoyée ; une musique jusqu'au bout ;
  les sous-titres des deux voix ; un post animé sur une seconde page, exporté en GIF ; le MP4
  TikTok et sa version sans musique ; le design fermé puis rouvert, identique. Mesuré dans le
  film : H.264 1080 × 1920 à 30 images par seconde et AAC, 11,13 s pour une page de 11,12 s ;
  -14,3 LUFS, crête -1,1 dBTP ; la musique passe de 0,303 à 0,090 sous la voix (30 %) ; plus de
  musique du tout dans la version sans musique ; l'image mêle les deux vidéos au milieu de la
  transition ; le mot prononcé est jaune ; la fenêtre et le film diffèrent de 2,1 sur 255 en
  moyenne au même instant. Dans le conteneur (deux cœurs) : coupe 9 à 12 s Whisper compris,
  sous-titres 7 s, export 25 à 27 s pour 11 s de film.
- Vu en route, à décider par Alexandre :
  - Une vidéo où l'on parle ne fait pas baisser la musique : seuls les sons au rôle Voix le
    font (lot 5). Il faut détacher son son (bouton « Détacher le son »), ce que fait faire le
    parcours d'essai du LISEZMOI. Proposition : compter aussi comme une voix une vidéo qu'on
    entend, ou seulement celle où l'analyse du lot 7 trouve de la parole.
  - Whisper small écrit mal les noms propres (« Eliot » devient « Kélio » sur la voix de
    synthèse). Proposition : glisser le nom du kit de marque dans l'amorce donnée à Whisper,
    celle qui lui fait déjà écrire les « euh ».
- Parcours d'essai pour Alexandre : « Essayer la vidéo (étape 4) » dans
  `01_application/LISEZMOI.md`, neuf étapes, une vingtaine de minutes.
- Vérifié dans le conteneur : interface 172 (dont 2 du post animé), noyau 83, `npm run
  build` ; Chromium : post animé 11, animation 44, sous-titres 44, vidéo 41 ; Tauri : montage
  complet 25 sur 25 trois fois de suite (une exécution d'avant s'était arrêtée en route sur
  une réponse inattendue du pont, au moment du post animé ; détail non gardé, pas revu
  depuis), pont de l'étape 2 19, étape 3 (22, 14, 27, 17, 8, 13), animation 16, son 26,
  sous-titres 17.

## 2026-10-15, étape 4, lot 7 : les sous-titres

Accord d'Alexandre pour enchaîner (« Ok, tu peux enchaîner »). Choix de Claude, modifiables
sur simple demande :

- Whisper : le programme `whisper-ctranslate2` 0.5.7 (MIT), qui fait tourner faster-whisper
  1.2.1 et CTranslate2 4.8.2 (MIT), installé par `uv tool install` comme Piper (commande 18 du
  `CLAUDE.md`) ; Eliot le lance comme `ffmpeg`. Versions fixées : la 0.5.8 n'avait que dix
  jours le 2026-10-15, et la 0.5.7 laisse `uv` prendre PyAV 19, qui refuse un argument de
  faster-whisper (« unexpected keyword argument 'metadata_errors' ») ; PyAV 18.1.0 est donc
  fixé avec elle. Écartés : whisper.cpp dans le noyau (bibliothèque `whisper-rs`), qui
  demande `cmake` et `clang` pour compiler et allonge la compilation ; la voie de Piper était
  déjà là.
- Sur le processeur seulement (règle 9) : `--device cpu`, calcul en entiers 8 bits,
  `CUDA_VISIBLE_DEVICES` vide (aucune carte visible pour le programme), `HF_HUB_OFFLINE=1`
  (rien n'est cherché sur Internet), un fil de moins que les cœurs du poste, 8 au plus.
  Vérifié dans Tauri en lisant la ligne de commande et l'environnement du programme pendant
  qu'il tournait.
- Le modèle : `faster-whisper-small` (conversion du modèle small d'OpenAI publiée par Systran,
  MIT, 485 Mo), téléchargé une fois dans `telechargements/whisper/` à une révision fixée
  (commande 19). Un modèle plus juste rangé à côté (medium, large-v3-turbo) serait pris
  d'office. Mesuré dans le conteneur (deux cœurs) : 11,5 s de voix transcrites en 8 à 14 s,
  chargement du modèle compris.
- Les hésitations : Whisper les efface d'habitude. Une amorce de texte qui en contient
  (« Euh, bon, alors, euh, hum, je pense que, ben, voilà. ») les lui fait écrire : sur la
  phrase d'essai, l'« euh » passe d'un « E. » sans sens à « Euh, ». Reconnues : euh, heu, hum,
  hmm, mmh (et um, uh, erm en anglais), quelle que soit l'écriture ; pas « eu », ni « ben ».
- Où l'on parle, sans Whisper : le noyau mesure le niveau toutes les 10 ms ; on parle au-dessus
  d'un seuil tiré du bruit de fond (le dixième le plus calme, plus 10 dB, sans descendre à plus
  de 40 dB sous la voix). Un trou de moins de 150 ms reste dans la parole, un clic de moins de
  60 ms n'en est pas, la parole déborde de 30 ms de chaque côté. Un son sans écart net (une
  musique continue) est tout entier de la parole : rien n'y est coupé. 0,2 à 0,6 s pour 11,5 s
  dans Tauri.
- Les mots recalés : Whisper place les mots à 0,1 ou 0,3 s près. Un mot qui commence ou finit
  dans un silence est ramené au bord de la voix, le premier et le dernier mot d'un passage
  prennent ses bords (à moins de 400 ms), un mot à plus de 200 ms de toute voix est retiré
  (Whisper en invente parfois dans les silences). Mesuré : « D'abord », placé par Whisper à
  8,80 s, recalé à 9,19 s, où la voix commence.
- La transcription est gardée dans `ressources/transcriptions/<empreinte>.json` (passages de
  parole, mots, modèle, langue) et voyage dans l'archive `.eliot` : quelques kilo-octets. Une
  voix n'est transcrite qu'une fois.
- La coupe : le BRIEF range la coupe des silences et des hésitations dans le nettoyage de la
  voix (un réglage du clip). Elle se fait plutôt comme dans CapCut : le clip devient des
  morceaux qui se suivent dans la frise, chacun avec sa coupe en valeurs du document
  (l'original n'est jamais touché, règle 13). Ainsi la coupe se voit, se défait morceau par
  morceau (tirer un bord), et vaut aussi pour une vidéo. Le texte du BRIEF n'est pas changé :
  à valider par Alexandre.
- Réglages de la coupe : les blancs de plus de 0,6 s (de 0,3 à 2 s) sont raccourcis à 0,12 s
  de chaque côté de la voix ; au début et à la fin du clip, tout le blanc part ; une hésitation
  part avec le blanc qui l'entoure s'il est long, seule sinon ; un morceau gardé de moins de
  0,1 s part aussi ; un fondu de 10 ms à chaque coupe évite les claquements. Sur la piste
  principale, la suite se resserre ; un son détaché de sa vidéo (même fichier, même partie,
  même moment) est coupé avec elle. L'entrée, la transition et le fondu d'entrée vont au
  premier morceau, la sortie et le fondu de sortie au dernier, la boucle à tous ; les images
  clés se partagent comme au Ctrl+B. Mesuré sur la phrase d'essai : 11,5 s ramenées à 7,6 s.
- Les sous-titres : un texte de la frise par groupe de mots, qui garde le temps de chacun de
  ses mots (`sousTitre`, champ facultatif : le document reste en version 4). Une phrase, une
  virgule après deux mots au moins, un silence de plus de 0,6 s ou une autre voix ferment un
  groupe ; un morceau de phrase trop long se partage en groupes de tailles voisines (six mots
  par quatre : 3 et 3, pas 4 et 2). Un sous-titre reste 0,3 s après son dernier mot, ou jusqu'au
  suivant s'il vient moins de 0,7 s après (pas de clignotement). Ils vont au milieu de la
  largeur (84 %), sur une piste neuve au-dessus de tout ; en 9:16, leur milieu à 66 % de la
  hauteur, juste au-dessus des 484 px du bas que TikTok recouvre ; ailleurs à 80 %.
- Les styles : « Mot surligné » (Montserrat gras blanc, contour noir, trois mots et 22 lettres
  au plus, le mot dit en jaune et 12 % plus grand), « Un mot à la fois » (Anton en capitales,
  qui entre en grossissant), « Mot après mot » (Poppins, les mots apparaissent quand ils sont
  dits, le dernier en vert), « Classique » (Inter gras sur une bande noire, neuf mots au plus).
  Les « euh » ne s'écrivent pas d'office.
- Le mot prononcé : le dernier mot commencé, jusqu'au suivant. Un texte retouché (un mot ajouté
  ou retiré) partage également le temps de ses mots. Dans la fenêtre, le dessin lettre par
  lettre de Konva (celui des textes par morceaux du lot 3) colore le mot et le grandit autour
  de son milieu. À l'export, chaque lettre est enregistrée deux fois, ordinaire et mot
  prononcé (avec le milieu de son mot) : le noyau dessine l'une ou l'autre selon l'instant. Les
  deux formules existent en TypeScript et en Rust, contrôlées par un tableau commun de 264 cas.
  Mesuré dans Tauri : le mot jaune est au même endroit dans la fenêtre et dans le film, à 0,1 %
  de la largeur près.
- Une coupe faite après les sous-titres les refait pour cette voix, avec l'aspect des anciens
  (police, taille, couleurs, hauteur) ; les mots corrigés à la main sont alors perdus, d'où le
  conseil du LISEZMOI : couper d'abord, sous-titrer ensuite.
- Correction (lot 1) : la lecture des vidéos sur une page vidéo. Avant, une balise par clip,
  créée d'office. Mesuré dans WebKitGTK : une seconde balise qui lit la même copie qu'une autre
  au même moment échoue (« source non prise en charge ») ; la seconde moitié d'un Ctrl+B (lot
  2) en souffrait déjà sans que les essais, qui regardaient les captures du noyau, le voient.
  Maintenant, une seule balise par fichier, conduite par le clip que la tête montre (ou celui
  qui commence dans moins de 3 s) : elle saute d'une coupe à l'autre sans s'arrêter, sans le
  délai d'une balise relancée (jusqu'à 0,3 s, lot 5). Une balise qui échoue, ne charge rien en
  4 s, ou dont la recherche ou la lecture reste bloquée 1,5 s est refaite (trois fois, puis 10 s
  d'attente). Les pages fixes gardent une balise par élément.
- Dans le conteneur (deux cœurs, sans carte graphique), WebKitGTK prend 160 % du processeur
  pendant la lecture et cale encore à peu près une lecture sur deux au chargement de la copie ;
  la balise refaite, les morceaux s'enchaînent : enregistrée, la voix de chaque morceau revient
  0,07 à 0,13 s après son instant. Sur le poste, à voir à l'essai.
- Pont IA : `transcrire` (le texte et les mots de chaque voix au temps de la page, hésitations
  marquées), `sous_titres` (style, hauteur, réglages communs, retirer), `couper_blancs` (avec
  aperçu) ; 61 outils.
- Vérifié dans le conteneur : noyau 83 (dont 9 du lot 7 : passages de parole, sortie de
  Whisper, recalage des mots, choix du modèle, analyse gardée et relue, vrai Whisper, tableau
  commun, variantes des lettres, export d'un sous-titre), interface 170 (dont 22 du lot 7),
  Chromium 44 vérifications (fausse parole : bulle, coupe, sous-titres, mot prononcé à
  l'écran, page décrite pour l'export, outils de l'IA) et les suites d'avant, Tauri 17 (vrai
  Whisper sur le processeur, coupe, sous-titres à l'écran et dans le film, lecture
  enregistrée) et les suites de l'étape 4. L'essai du son du lot 5, enregistré dans WebKit, passe
  une fois sur deux dans le conteneur : l'autre fois, le début de la musique se perd au
  démarrage de la sortie du son (de 0,16 à 0,26 s), avec le code du lot 6 comme avec celui du
  lot 7.

## 2026-10-15, étape 4, lot 6 : la voix

Accord d'Alexandre pour enchaîner (« Ça me va, tu peux continuer »). Choix de Claude,
modifiables sur simple demande :

- Le micro : `ffmpeg`, lancé par le noyau, lit l'entrée PulseAudio (que PipeWire fournit sur
  Ubuntu), en mono, 48 kHz, 16 bits, par blocs de 20 ms ; le noyau calcule le niveau (crête et
  moyenne, tous les 50 ms) et écrit la prise en WAV. La brique `cpal` notée au § 4 du BRIEF est
  écartée : elle demande `libasound2-dev` pour compiler, une installation système de plus, et
  `ffmpeg` est déjà là. Mesuré dans le conteneur (micro d'essai de PulseAudio) : aucun
  échantillon perdu, 4,74 s de son lues en 4,70 s d'horloge.
- La prise : le micro écoute dès « Enregistrer au micro » (le niveau s'affiche) ;
  « Enregistrer » ouvre le fichier et lance un compte à rebours de 3 s, qui reste dans le
  fichier ; au top, la tête de lecture part et le clip commencera là (sa coupe) : rien n'est
  perdu si l'on parle trop tôt. Espace ou la pause finit la prise, Échap l'abandonne, une prise
  de moins de 0,3 s n'est pas gardée. Pendant la prise, la tête passe la fin de la page (dix
  minutes au plus) et la page s'allonge à l'arrêt. Le son du montage se tait d'office pendant
  la prise (sans casque, le micro l'entendrait) ; la case se décoche. « Voix nette » est posé
  d'office sur chaque prise ; la case se décoche aussi. Une prise est rangée comme un son
  importé, nommée « Prise 1 », « Prise 2 », avec l'instant de son top : reposée depuis la liste
  des sons, elle commence encore au top.
- Mesuré dans Tauri : le bip d'une page, joué pendant une prise et entendu par le micro
  d'essai, revient dans la prise 0,2 s après son instant (sortie du son de WebKit et entrée de
  PulseAudio comprises). On parle en regardant la vidéo : rien à corriger. Avec un casque, une
  voix calée à l'oreille sur la musique peut arriver un peu tard ; il suffit de glisser le
  clip. À voir sur le poste.
- Le nettoyage : des valeurs du document posées sur le clip (`nettoyage`), l'original n'est
  jamais touché (règle 13). Le noyau fabrique une fois la version nettoyée de tout le fichier,
  par réglages : FLAC 24 bits stéréo pour l'export, copie Opus pour la fenêtre, forme d'onde et
  niveau, dans `ressources/traitees/`. Ce dossier reste hors de l'archive `.eliot` (il se
  refait) ; à l'ouverture d'un design, les versions dont plus aucun clip ne se sert sont
  effacées. La chaîne : réduction du bruit RNNoise (`nnnoiseless` 0.5.2, BSD-3-Clause, modèle
  compris, rien à télécharger ; son retard d'une trame, 10 ms, est rattrapé ; la force mêle le
  son d'origine), passe-haut à 80 Hz (24 dB par octave : un ronflement à 50 Hz perd 17 dB, une
  voix grave à 150 Hz 1 dB), plateau à 180 Hz (chaleur), cloche à 4,5 kHz (présence),
  compresseur de `ffmpeg` (seuil de -10 à -30 dB, rapport de 1,5 à 6), dé-esseur de `ffmpeg`,
  puis le niveau : calé sur -16 LUFS, ou gardé tel qu'avant, crête vraie sous -1 dBTP. Le PLAN
  prévoyait tout par les filtres de `ffmpeg` : RNNoise a été préféré à `afftdn` et `arnndn`
  (ce dernier demande un fichier de modèle à part) après mesure, ci-dessous.
- « Voix nette » : bruit réduit à 85 %, graves coupés, chaleur +1,5 dB, présence +3 dB,
  compresseur et dé-esseur moyens (50 % et 40 %), voix calée sur -16 LUFS. -16 LUFS : le niveau
  courant d'une voix parlée ; une musique à -14 LUFS, baissée à 30 % sous la voix, descend
  vers -24, sous elle. Le réglage « niveau » n'était pas dans la liste du BRIEF : ajouté parce
  qu'une prise au micro d'un ordinateur sort souvent vers -30 LUFS, sous la musique même
  baissée.
- Mesuré dans le conteneur, voix de Piper sur des bruits fabriqués : RNNoise baisse un bruit
  de pièce (rose ou brun) de 30 à 50 dB sans abîmer la voix, mais laisse presque intact un
  souffle blanc fort (-35 à -45 dBFS) et le ronflement d'un ventilateur (2 à 4 dB) ; `afftdn`
  ne fait pas mieux sur ces deux-là. Le souffle d'un vrai micro est bien plus bas (-60 dBFS et
  moins), là où RNNoise le retire peu à peu (34 dB après 3 s). Le ronflement grave, lui, part
  avec « couper les graves ».
- Lecture : la fenêtre joue la version nettoyée dès qu'elle est prête, l'originale en
  attendant ; une petite étoile marque le clip. Mesuré dans WebKit (sortie muette de
  PulseAudio, enregistrée) : avec « couper les graves », un ronflement à 50 Hz passe de 2 fois
  à 0,27 fois le niveau d'un 1 kHz voisin, et le film exporté pareil. Nettoyage « Voix nette »
  d'une phrase de 3,4 s : 0,7 s dans le conteneur (deux cœurs).
- La voix de synthèse : Piper, un programme à part, lancé comme `ffmpeg` (`piper-tts` 1.8.0,
  la dernière version sur PyPI le 2026-10-15, dépôt `OHF-Voice/piper1-gpl`, GPL-3.0 ; installé
  par `uv tool install`, commande 16 du `CLAUDE.md` ; onnxruntime en version processeur, jamais
  l'option `--cuda`). Les voix : une par dossier dans `telechargements/voix/` (commande 17),
  avec sa fiche `MODEL_CARD`, d'où Eliot lit la licence et la page des données. Relevé le
  2026-10-15 sur huggingface.co/rhasspy/piper-voices (fiches des voix françaises) : siwis (CC BY
  4.0, données SIWIS, une femme), upmc (CC BY-SA 4.0, Jessica et Pierre), mls (CC BY 4.0, 125
  locuteurs), gilles (CC0, qualité basse), tom (AGPLv3). Conseillées : siwis et upmc. Le son de
  Piper (22 kHz, mono) est calé sur -16 LUFS et rangé en WAV stéréo à 48 kHz, avec le crédit de
  la voix ; « Crédits des sons » donne une ligne par voix. Le texte dit reste en cache : écouter
  puis ajouter ne fait parler Piper qu'une fois. Mesuré dans le conteneur (deux cœurs) : une
  phrase de 3,6 s prête en 5,5 s dans Eliot, le chargement de la voix compris.
- Pont IA : `voix_de_synthese` (sans texte : les voix installées et leur licence ; avec texte :
  la phrase posée au rôle voix) ; `ajouter_son` et `regler_son` prennent `nettoyage` (« voix
  nette », « aucun » ou réglage par réglage) et attendent la version nettoyée, dont ils donnent
  le niveau ; `etat` montre le nettoyage des sons (58 outils). L'IA ne prend pas le micro.
- Correction (lot 4) : une annulation d'export cliquée juste au moment où le noyau partait se
  perdait (il remet sa marque d'annulation à zéro en partant). La fenêtre la lui redit à son
  premier signe. Vu une fois par l'essai Tauri de l'export.
- La coupe des silences et des hésitations repérées par Whisper vient avec les sous-titres, au
  lot 7.
- Vérifié dans le conteneur : noyau 74 (dont 12 de la voix : réglages et clé du nettoyage,
  RNNoise sans décalage, gain final, nettoyage d'une voix relu du cache et purge, liste des
  micros, en-tête WAV, prise avec top sur un faux micro de `ffmpeg`, micro qui s'arrête,
  fiches et licences des voix, liste des voix, vrai Piper, export d'une voix nettoyée),
  interface 148, Chromium 37 vérifications sur la voix (faux micro, faux nettoyage, faux Piper)
  et les suites de l'étape 4, Tauri 20 (vrai Piper, vrai nettoyage, prise au micro d'essai à la
  souris, changement de micro vu par PulseAudio, lecture enregistrée, film) et les suites de
  l'étape 4.

## 2026-10-15, étape 4, lot 5 : le son

Choix de Claude, modifiables sur simple demande :

- Les sons d'une page vont dans `audio` (champ prévu au § 6 du BRIEF) : un clip par son, avec
  sa ressource, son temps, sa piste (0 juste sous la principale), sa coupe, son volume, ses
  fondus, son rôle (musique, voix, bruitage), et pour une musique `jusquALaFin`, `boucle`,
  `phase` et `sousLaVoix`. Les formules (instant du fichier joué, boucle, fondus, musique qui
  baisse sous la voix) vivent dans `src/modele/son.ts` et, pour l'export, dans
  `noyau/src/son.rs` ; `son.attendus.json` (60 cas) donne les valeurs que les deux côtés
  retrouvent à un millionième près.
- Import d'un son par le noyau (`noyau/src/sons.rs`) : l'original rangé une seule fois, une
  copie d'écoute pour la fenêtre (Opus 128 kbit/s, stéréo, 48 kHz, en WebM : le format que le
  banc du lot 0 a vu jouer dans Tauri), la forme d'onde (50 pics par seconde) et le niveau
  sonore. Le niveau se mesure dans le Rust avec la bibliothèque `ebur128` 0.1.10 (MIT, déjà
  notée au § 4 du BRIEF) plutôt qu'avec les filtres de `ffmpeg` que prévoyait le PLAN : le même
  code mesure aussi le mixage de l'export. Un son mono passe sur les deux canaux à -3 dB
  chacun (règle de `ffmpeg`), à l'écoute comme à l'export.
- Un son de 20 s et plus se pose comme une musique : elle couvre la page jusqu'au bout,
  répétée si elle est plus courte, avec un fondu de fin de 2 s ; un son plus court est un
  bruitage. La page dure jusqu'au dernier clip ou au dernier son qui n'est pas une musique
  « jusqu'à la fin » ; une page sans clip garde sa durée.
- La musique baisse sous les clips au rôle voix : elle garde 30 % de son volume (environ
  -10 dB), réglable musique par musique, en commençant 200 ms avant la voix et en remontant
  en 400 ms après.
- Lecture dans la fenêtre (`src/editeur/sons.ts`) par le Web Audio : la copie d'écoute de
  chaque son est décodée une fois ; à chaque lecture, chaque son est programmé sur l'horloge du
  son (départ, partie jouée, boucle) avec la courbe de son volume (50 points par seconde :
  volume, fondus, baisse sous la voix). Écarté après mesure : une balise `<audio>` par son,
  recalée sur la tête de lecture. Dans WebKit (sortie muette de PulseAudio, enregistrée), une
  balise partait jusqu'à 0,3 s en retard quand la fenêtre était chargée (la tête n'avance
  qu'à chaque image dessinée, quatre ou cinq par seconde dans le conteneur), et chaque
  recalage s'entendait. Avec le Web Audio, mesuré : chaque son part à son instant à
  l'échantillon près, d'une traite. L'horloge du son ne tourne que pendant la lecture (en
  marche, elle calcule du silence et prend du processeur à la fenêtre) ; le décodage passe par
  un contexte hors ligne. Mémoire : une musique de 3 minutes décodée occupe environ 70 Mo, le
  temps que le design reste ouvert.
- Détacher le son d'une vidéo (vitesse 1× seulement) : un clip de voix à la même place, avec
  la même coupe, et la vidéo devient muette.
- Freesound (`noyau/src/freesound.rs`) : recherche par `GET /apiv2/search/` (la documentation,
  freesound.org/docs/api/resources_apiv2.html, lue le 2026-10-15, dit que l'ancienne adresse
  `/search/text/` est dépréciée depuis novembre 2025), clé dans
  l'en-tête `Authorization: Token …`, jamais dans une adresse ; filtre
  `license:("Attribution" OR "Creative Commons 0")`, plus la durée pour les bruitages (30 s au
  plus) et les musiques (20 s et plus). La licence se relit à la réponse (nom ou adresse de la
  licence) : CC BY-NC et Sampling+ écartés une seconde fois. Écouter : l'extrait MP3 léger.
  Ajouter : l'extrait OGG de bonne qualité (environ 192 kbit/s), que la clé suffit à obtenir ;
  l'original demande la connexion au compte (OAuth2, BRIEF § 6), pas faite. Recherches et
  extraits gardés 24 h en cache (2 000 demandes par jour au plus). Le crédit (auteur, lien,
  licence, titre) est rangé avec le son ; « Crédits des sons » donne une ligne par son, au
  format `« titre » par auteur (lien), licence CC BY 4.0, via Freesound`.
- Jingles : deux sons du kit de marque, ouverture et fin ; posés au début, ou finissant avec la
  page. Ils se posent au rôle musique (ils baissent sous la voix et partent de la version sans
  musique) ; le rôle se change dans la barre.
- Niveau à l'export : -14 LUFS intégrés pour toutes les plateformes, crête vraie plafonnée à
  -1 dBTP, par un simple gain sur tout le mixage (ni limiteur, ni compresseur : si la crête
  empêche d'atteindre -14, le film reste un peu moins fort). Sources : YouTube ramène les
  vidéos plus fortes à -14 LUFS et conseille -1 dBTP ; TikTok et Instagram ne publient pas de
  cible, les mesures tournent autour de -14 (forasoft.com, « LUFS for video platforms »,
  2026-06-05). Coché d'office dans la fenêtre d'export, il se décoche.
- Version sans musique : un second MP4 à côté du film, `…_sans-musique.mp4` (sous un nom
  libre), les mêmes images recopiées sans réencodage, le son sans les clips au rôle musique,
  avec le même gain que le film (la voix y sonne pareil). Sans aucune musique dans la page,
  pas de seconde version ; avec seulement de la musique, la seconde version est muette.
- Pont IA : `importer_son`, `chercher_sons`, `ajouter_son` (un son du design, de Freesound, un
  jingle, ou le son détaché d'une vidéo), `regler_son` (57 outils) ; `etat` donne les sons
  importés, les pistes des sons et les crédits ; `marque` les jingles ; `scinder` et
  `supprimer` prennent aussi les sons ; `exporter` prend `niveau` et `sansMusique`.
- Vérifié dans le conteneur : noyau 62 (dont 12 du son : formules du tableau commun, import,
  niveau d'une sinusoïde connue, faux Freesound local, mixage avec boucle, baisse sous la voix,
  calage à -14 LUFS et version sans musique relus par `ffmpeg`), interface 142, Chromium 44
  vérifications sur le son (dont les réglages du son dans la fenêtre d'export) et toutes les
  suites d'avant, Tauri 26 dont la lecture dans WebKit enregistrée et deux films relus
  (niveau mesuré à -14,0 LUFS par le filtre `ebur128` de `ffmpeg`), et toutes les suites
  d'avant.

## 2026-10-15, BRIEF : l'exemple des images clés corrigé

Accord d'Alexandre (« tu as mon accord pour corriger l'exemple ») : dans le modèle de document
du § 6, les `t` des images clés de l'exemple passent en temps du clip (0 et 3000 au lieu de
1000 et 4000), et une ligne le dit, comme le code le fait depuis le lot 3. Rien d'autre ne
change dans le BRIEF.

## 2026-10-15, étape 4, lot 4 : l'export MP4 et GIF

Choix de Claude, modifiables sur simple demande :

- Le chemin du film. L'interface décrit la page : chaque élément est dessiné au repos par les
  mêmes composants Konva qu'à l'écran, hors écran, dans un contexte de dessin qui écrit du
  SVG au lieu de pixels (`src/export/contexteSvg.ts`, `calques.ts`). Les coupures de lignes,
  la place de chaque lettre, les dégradés, les ombres sont donc ceux de l'écran. Le noyau
  (`noyau/src/montage.rs`) rend ces calques avec `resvg` 0.48.1, puis compose chaque image du
  film avec `tiny-skia` : pose et effets de l'instant par `noyau/src/animation.rs`, les mêmes
  formules que l'interface (le tableau commun de 550 cas passe des deux côtés). Écarté :
  enregistrer le film dans la fenêtre (MediaRecorder), lié à l'écran et à sa cadence ;
  redessiner les éléments en Rust, deux écritures de chaque forme à tenir d'accord.
- Une opération de peinture, un calque : Konva applique l'opacité d'un élément à chacune de
  ses opérations (remplir, tracer, écrire), et le noyau fait de même ; un fondu donne ainsi la
  même image qu'à l'écran, contour compris. L'ombre est un calque à part, que le noyau décale
  dans le repère de la page : une ombre de canevas ne tourne pas avec la forme. Un texte qui
  entre par morceaux donne un calque par lettre, avec ses rangs (lettre, mot, ligne) comptés
  comme à l'écran.
- Les photos et les vidéos ne passent pas par le SVG : le noyau les pose lui-même depuis les
  originaux (règle 7), redressés comme à l'import, réduits à la taille utile, avec leurs
  découpes (coins arrondis, forme d'un cadre, écran d'une maquette). Une vidéo est décodée
  par `ffmpeg` à la cadence du film multipliée par sa vitesse, une image du film à la fois.
- Netteté : un calque immobile d'une image à la suivante est rendu à sa place exacte, au
  pixel près, comme à l'écran ; un calque qui bouge est posé depuis un rendu plus fin
  (l'agrandissement le plus fort de l'élément, deux fois au plus) et rééchantillonné.
- Polices : la fenêtre joint au film les fichiers de police qu'elle utilise (bibliothèque,
  polices du poste ou du design), et le noyau les choisit par le nom que la fenêtre leur
  donne. Une police variable prend son poids sur l'axe `wght` et sa taille optique, comme le
  navigateur.
- Le son : mixé par le noyau (48 kHz, stéréo), chaque vidéo à sa place, à sa vitesse (hauteur
  gardée, `atempo`), avec son volume, ses fondus et les transitions. Le niveau sonore par
  plateforme vient avec le lot 5.
- Encodage, processeur seulement (règle 9) : H.264 High par `libx264` (qualité constante
  CRF 18 plafonnée au débit de la plateforme, 2 images B, intervalle des images clés de la
  plateforme), yuv420p marqué BT.709, AAC-LC 48 kHz stéréo, index en tête (`faststart`). GIF :
  d'abord un film sans perte (FFV1), puis une palette calculée sur tout le film et le GIF en
  boucle. Le film s'écrit sous un nom provisoire, renommé une fois fini ; Annuler arrête tout
  et efface ce qui était commencé. Dossier : `~/Vidéos/Eliot/`, nom daté, ou « Enregistrer
  sous ».
- Réglages par plateforme, relevés le 2026-10-15 :
  YouTube (support.google.com/youtube/answer/1722171, « Recommended upload encoding
  settings ») : MP4, index en tête, H.264 High, CABAC, 2 images B, GOP fermé d'une
  demi-cadence, débit variable, 1080p à 8 Mbit/s (24 à 30 images/s) ou 12 Mbit/s (48 à 60),
  720p à 5 ou 7,5 Mbit/s, AAC-LC 48 kHz stéréo à 384 kbit/s, BT.709.
  Shorts (support.google.com/youtube/answer/15424877) : vertical ou carré, 3 minutes au plus ;
  encodage de YouTube.
  TikTok (developers.tiktok.com, Content Posting API, « Media Transfer Guide ») : MP4 et
  H.264 conseillés, 23 à 60 images/s, 360 à 4096 px de côté, 10 minutes et 4 Go au plus.
  Reels (relevé par argil.ai le 2026-05-10, pas de page officielle trouvée) : 1080 × 1920, 23
  à 60 images/s (30 par défaut), H.264 et AAC, 3 minutes au plus depuis l'application.
  TikTok et Reels ne donnent pas de débit : 10 Mbit/s en 1080p (15 au-delà de 30 images/s),
  choix de Claude.
- Zones sûres (page 9:16 seulement, bouton de la frise, calque jamais exporté), en pixels
  d'une vidéo 1080 × 1920 : TikTok 130 en haut, 484 en bas, 44 à gauche, 140 à droite
  (modèles de TikTok Ads, relevés par cadenus.io le 2026-07-28) ; Reels 14 % en haut, 35 %
  en bas, 6 % sur les côtés, la colonne des boutons sur le cinquième droit des 40 % du bas
  (aide de Meta, relevée par hopperhq.com) ; Shorts 288 en haut, 672 en bas, 48 à gauche,
  192 à droite (gabarit de Google, relevé par adkit.so le 2026-09-10). Des repères, pas des
  règles exactes : ils bougent avec la longueur de la légende et les versions des
  applications.
- Comparaison au pixel, mesurée : rendu du noyau et rendu de l'écran (Konva) à cinq instants
  d'une page animée et variée, écart moyen 0,4 sur 255 ; film MP4 et capture de l'écran,
  vidéos et photos comprises, écart moyen de 0,9 à 1,9 sur 255 (compression H.264 comprise).
  Seule différence connue : un contour de forme ne grandit pas à l'écran pendant une
  animation de zoom (réglage de Konva), il grandit dans le film.
- Correction en passant : les polices variables dont le fichier a une virgule dans son nom
  (Inter, Roboto, Open Sans, DM Sans, Fraunces et cinq autres) ne se chargeaient pas avec
  `npm run tauri dev` : le serveur de développement ne décodait pas `%2C`. La fenêtre prenait
  une police de secours. Corrigé dans `vite.config.ts` (les virgules remises en clair avant la
  recherche du fichier) et dans `outils/preparer_bibliotheque.mjs` (les virgules restent en
  clair dans `polices.css`). Les textes en Inter changent donc un peu de dessin.
- Pont IA : `exporter` sait faire MP4 et GIF (plateforme, définition, cadence, son, largeur
  du GIF) ; un film peut prendre plusieurs minutes, le pont attend 30 minutes au plus.
- Vérifié dans le conteneur : noyau 50 (6 essais de l'export, dont un film et un GIF faits
  et relus par `ffprobe`), interface 121 (18 de plus : réglages, zones sûres, contexte SVG),
  Chromium 18 vérifications sur l'export et toutes les suites d'avant, Tauri 21 dont un film
  TikTok de 7 s (210 images en 22 s sur 2 cœurs), un GIF, une annulation par le bouton, et
  toutes les suites d'avant.

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

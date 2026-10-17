# CLAUDE.md — Eliot

Point d'entrée pour reprendre le projet sans contexte. Version du 2026-10-17.
Règles communes à tous mes projets : `/home/nushoko/Bureau/Projets/00_moi/CONVENTIONS.md`,
`/home/nushoko/Bureau/Projets/00_moi/AUTONOMIE.md`. Qui je suis :
`/home/nushoko/Bureau/Projets/00_moi/IDENTITE.md`.

## Ce qu'est ce projet

Eliot (« toile » à l'envers) est un éditeur graphique de bureau, local, à l'interface proche
de Canva, pour apprendre la création publicitaire en photos et en vidéos. Tauri pour la
fenêtre, React et Konva pour l'interface et le dessin, un noyau Rust natif pour le travail
lourd. Détail : `BRIEF.md`.

## État au 2026-10-17

- `BRIEF.md` : révision 7, **validée par Alexandre le 2026-10-14** : bibliothèque, Pixabay
  puis Pexels, modèles de départ, création de contenu pour YouTube, TikTok et Instagram, vidéo
  façon CapCut (étape 4), labo photo façon Lightroom (étape 5), pont vers une IA. Révision 8
  du même jour, le son (voix, nettoyage, musique, bruitages, Freesound), validée sur le
  principe (« Je valide »), texte à relire par Alexandre.
- Secrets : `.env` à la racine du dépôt, hors git (`PIXABAY_API_KEY`, `FREESOUND_API_KEY`,
  `SKETCHFAB_API_KEY`, plus tard `PEXELS_API_KEY`). Ne jamais le lire ni le committer ; le Rust
  le lit lui-même (une version installée lira `~/.config/fr.alexandredo.eliot/cles.env`).
- Étape 0, banc d'essai : passé sur le poste principal le 2026-10-14, dans la fenêtre Tauri
  et dans le navigateur intégré de Claude (résultats dans `00_banc_essai/resultats/`, lecture
  au JOURNAL). Tauri tient 60 images/s à condition d'appliquer la règle 11 du BRIEF. Reste :
  le mini PC.
- Enveloppe : Tauri (décision du 2026-10-14), Electron en repli.
- Étape 1, l'éditeur : `01_application/`, livrée et essayée sur le poste le 2026-10-14.
- Étape 2, les projets et l'édition complète, avec le pont vers une IA (`eliot-mcp`) : livrée
  sur le poste le 2026-10-14, essai d'Alexandre attendu (`PLAN.md`).
- Étape 3, la bibliothèque : ouverte le 2026-10-14 ; lots 1 (icônes, emojis, QR, formes, polices,
  effets de texte), 2 (cadres photo, grilles, maquettes d'appareils), 3 (photos Pixabay, kit
  de marque), 4 (dessin à main levée, graphiques, tableaux), 5 (42 modèles de départ) et 6
  (personnages Open Peeps et Humaaans, composeur) livrés et vérifiés ; reste l'essai
  d'Alexandre (`PLAN.md`).
- Archives téléchargées à la main : `telechargements/` à la racine, hors git (Open Peeps et
  Humaaans, lues par `npm run bibliotheque` ; voix de Piper dans `telechargements/voix/`, lot 6 ;
  modèle de Whisper dans `telechargements/whisper/`, lot 7 ; programme et modèle du détourage
  dans `telechargements/detourage/`, étape 5, lot 7 ; paquets 3D de Kenney dans
  `telechargements/kenney/`, lus par `npm run bibliotheque`, étape 6, lot 3).
- Clé Freesound dans le `.env` (`FREESOUND_API_KEY`) depuis le 2026-10-15, vérifiée par une
  recherche d'essai. Clé d'API de Sketchfab (`SKETCHFAB_API_KEY`) depuis le 2026-10-17 : le
  vrai téléchargement s'essaie à la fin, par Alexandre (Claude n'a vérifié que la présence du
  nom, jamais la valeur).
- Étape 4, la vidéo : ouverte le 2026-10-15 (plan et lots dans `PLAN.md`) ; lot 0, banc des
  copies d'aperçu, passé sur le poste le 2026-10-15 (VP9 en 720 retenu, Tauri confirmé) ;
  lot 1 (la vidéo dans le design : import, copie d'aperçu, lecture, coupe, vitesse, son,
  vidéos Pixabay, quatre outils pour le pont IA), lot 2 (la frise : bascule Photo ou
  Vidéo, pistes, tête de lecture, gestes, scinder, trois outils de plus pour le pont IA),
  lot 3 (l'animation : entrées, sorties, boucles, textes par morceaux, images clés,
  transitions, fondus du son, styles de texte pour la vidéo, trois outils de plus pour le
  pont IA, 53 en tout), lot 4 (l'export en MP4 et en GIF par le noyau, réglages par
  plateforme, zones sûres), lot 5 (le son : onglet Audio, sons importés, Freesound, pistes
  des sons, musique qui baisse sous la voix, jingles du kit de marque, niveau à -14 LUFS,
  version sans musique, quatre outils de plus pour le pont IA, 57 en tout), lot 6 (la voix :
  prise au micro avec compte à rebours, « Voix nette » et nettoyage réglage par réglage, voix
  de synthèse Piper, un outil de plus pour le pont IA, 58 en tout) et lot 7 (les sous-titres :
  coupe des blancs et des hésitations, transcription par Whisper sur le processeur,
  sous-titres mot par mot avec le mot prononcé mis en valeur, une seule balise vidéo par
  fichier dans la fenêtre, trois outils de plus pour le pont IA, 61 en tout) livrés et
  vérifiés. Vérification de toute l'étape le 2026-10-15 (relecture contre le BRIEF, post animé
  depuis une image fixe, montage complet par le pont dans Tauri) ; reste l'essai d'Alexandre,
  parcours « Essayer la vidéo (étape 4) » du `01_application/LISEZMOI.md`. Après cette
  livraison, recompiler le pont (commande 13, puis 15 bis si l'extension sert) : la description
  de deux outils change. Pour la voix de synthèse, une fois : commandes 16 et 17 ; pour les
  sous-titres, une fois : commandes 18 et 19.
- Étape 5, le labo photo et les exports de qualité : ouverte le 2026-10-16 (plan, lots et règle
  de décision de l'aperçu en direct dans `PLAN.md`) ; lot 0, banc de l'aperçu en direct, passé
  sur le poste le 2026-10-16 : le shader WebGL est retenu (62 images par seconde sur la photo et
  la vidéo), le Rust calcule les réglages qui regardent les voisins et l'export. Lot 1, les
  exports depuis le document (PNG, JPEG, WebP de ×1 à ×4 ou en dpi, PDF vectoriel de toutes les
  pages, SVG, rendus par le noyau depuis les originaux), livré et vérifié le 2026-10-16 ; essai
  d'Alexandre : « Essayer les exports (étape 5, lot 1) » du `01_application/LISEZMOI.md`. Lot 2,
  le labo photo (bouton Retoucher, panneau Lumière, Couleur avec mélangeur, Effets, Détail,
  histogramme, aperçu en direct par le shader, export depuis l'original, outil `retoucher` du
  pont, 62 outils), livré et vérifié le 2026-10-16 ; essai d'Alexandre : « Essayer le labo
  photo (étape 5, lot 2) ». Lot 3, courbe des tonalités, 23 préréglages dessinés par Claude, ceux
  d'Alexandre (rangés dans `~/Documents/Eliot/Préréglages/`), copier et coller les réglages
  (Ctrl+Maj+C et V), outil `prereglages` du pont (63 outils), livré et vérifié le 2026-10-16 ;
  essai d'Alexandre : « Essayer la courbe et les préréglages (étape 5, lot 3) ». Lot 4, les clips
  vidéo au labo (retouche qui suit la lecture, réglages voisins à l'arrêt, grain qui bouge,
  export image par image), livré et vérifié le 2026-10-16 ; essai d'Alexandre : « Essayer les
  clips au labo (étape 5, lot 4) ». Corrections du BRIEF du 2026-10-16 (l'étalonnage, Sépia et
  Noir et blanc bleuté, la musique qui baisse là où l'on parle dans une vidéo) ; essai :
  « Essayer l'étalonnage et la musique sous une vidéo qui parle ». Lot 5, recadrer et redresser
  (mode recadrage sur la page, proportions prêtes, grille des tiers, angle, « Auto », tracer
  l'horizon, outil `recadrer` du pont, 64 outils), livré et vérifié le 2026-10-16 ; essai :
  « Essayer le recadrage (étape 5, lot 5) ». Lot 6, la perspective (un visuel posé sur quatre
  coins, mode « coins » sur la page, perspectives prêtes, coins arrondis, bordure et ombre qui
  suivent, rendu par le noyau à l'export, outil `perspective` du pont, 65 outils), livré et
  vérifié le 2026-10-16 ; essai : « Essayer la perspective (étape 5, lot 6) ». Lot 7, le
  détourage (BiRefNet, licence MIT, sur le processeur ; masque gardé avec la photo, pinceau pour
  reprendre les bords, ombre qui suit la silhouette, outil `detourer` du pont, 66 outils), livré
  et vérifié le 2026-10-16 ; essai : « Essayer le détourage (étape 5, lot 7) », après les
  commandes 20 et 21 (une fois). Vérification de toute l'étape le 2026-10-16 (relecture contre
  le BRIEF, trois manques comblés : le flou au labo, la qualité du JPEG et du WebP, remplacer une
  photo en gardant sa place ; une publicité de produit faite de bout en bout par le pont dans
  Tauri), puis le labo sur les photos des cadres et des maquettes (le même jour) ; reste l'essai
  d'Alexandre, parcours « Essayer l'étape 5 en entier : une publicité de produit » du
  `01_application/LISEZMOI.md`. Après cette livraison : recompiler l'application (commande 9)
  et le pont (commande 13).
- Étape 6, le studio 3D : ouverte le 2026-10-17 (plan, lots et choix par défaut dans
  `PLAN.md`) ; lot 1, l'objet 3D dans la page (import GLB, glTF, FBX, OBJ préparé par le noyau,
  rendu par three.js dans la fenêtre, mode Tourner sur la page, panneau « Vue 3D », export à la
  finesse demandée, trois outils de plus pour le pont IA, 69 en tout), livré et vérifié le
  2026-10-17 ; essai : « Essayer l'objet 3D (étape 6, lot 1) » du `01_application/LISEZMOI.md`.
  Avant cet essai : `npm install` (commande 8, three.js arrive), puis les commandes 9 et 13.
  Lot 2, lumière, ombre au sol et matières (quatre environnements fournis, lumière principale,
  exposition, ombre portée sur un sol invisible, couleur et brillance par matière, `regler_objet3d`
  élargi et `colorer_objet3d`, 70 outils), livré et vérifié le 2026-10-17 ; essai : « Essayer la
  lumière et les matières (étape 6, lot 2) ». Après cette livraison : la commande 13 (le pont).
  Lot 3, les banques (onglet 3D du rail : Kenney, Poly Haven, Sketchfab avec la clé d'Alexandre,
  CC0 et CC BY seulement, Mixamo par import ; crédit gardé avec chaque modèle ; environnements
  HDRI de Poly Haven ou d'un fichier .hdr ; trois outils de plus pour le pont IA, 73 en tout),
  livré et vérifié le 2026-10-17 ; essai : « Essayer les banques 3D (étape 6, lot 3) ». Avant cet
  essai : ranger un ou deux paquets 3D de Kenney dans `telechargements/kenney/`, puis les
  commandes 8 bis, 9 et 13. Lot 4, l'animation sur la frise (plateau tournant, caméra par images
  clés, animation du modèle, lecture en direct, `animer_objet3d`, 74 outils), livré et vérifié le
  2026-10-17 ; essai : « Essayer l'animation 3D (étape 6, lot 4) ». Après cette livraison : la
  commande 13 (le pont). Lot 5, l'objet 3D dans le film (rendu image par image par la fenêtre,
  posé par le noyau avec son ombre portée, MP4 et GIF), livré et vérifié le 2026-10-17 ; essai :
  « Essayer le film 3D (étape 6, lot 5) ». Après cette livraison : les commandes 9 et 13.
  Vérification de toute l'étape le 2026-10-17 (relecture contre le BRIEF, les crédits à
  recopier sous la publication dans la fenêtre d'export, un défaut des rendus hors écran
  simultanés corrigé, une publicité 3D faite de bout en bout par le pont dans Tauri) ; reste
  l'essai d'Alexandre, parcours « Essayer l'étape 6 en entier : une publicité 3D » du
  `01_application/LISEZMOI.md`. Après cette livraison : recompiler l'application (commande 9)
  et le pont (commande 13).
- Étape 7, le reste du catalogue : ouverte le 2026-10-17 (relevé du catalogue, plan, lots et
  choix par défaut dans `PLAN.md`) ; lot 1, le panneau des calques complet (icônes et
  miniatures, renommer, glisser pour l'ordre et les pistes, groupes repliables, survol, pont :
  `libelle` et `ordre` dessus ou dessous), livré et vérifié le 2026-10-17 ; essai : « Essayer le
  panneau des calques (étape 7, lot 1) ». Lot 2, le texte (texte courbé, listes à puces et
  numérotées, styles de texte gardés dans le kit de marque, pont : `courbe`, `liste` et l'outil
  `styles_texte`, 75 outils), livré et vérifié le 2026-10-17 ; essai : « Essayer le texte courbé,
  les listes et les styles (étape 7, lot 2) ». Lot 3, les aides pour apprendre (règles, grille,
  tiers, marges, zones sûres sur toute page 9:16 et celle d'une story, alertes de contraste et
  de taille avec leurs corrections, infobulles relues, pont : alertes dans `etat` et l'outil
  `aides`, 76 outils), livré et vérifié le 2026-10-17 ; essai : « Essayer les aides pour
  apprendre (étape 7, lot 3) ». Lot 4, couleur, fond, thème (pipette dans chaque choix de
  couleur, photo en fond de page, thème clair, sombre ou comme le système ; pont : `fond_page`
  pour la photo du fond, l'outil `couleur_page`, le thème dans `aides`, 77 outils), livré et
  vérifié le 2026-10-17 ; essai : « Essayer la pipette, la photo en fond et le thème (étape 7,
  lot 4) ». Lot 5, Pexels (photos et vidéos à côté de Pixabay, crédit avec la page du
  photographe, liens vers les sites des banques réparés ; pont : `source` et deux outils, 79
  outils), construit le 2026-10-17 avant la clé, vérifié contre un faux Pexels ; il s'allume dès
  que `PEXELS_API_KEY` est dans le `.env` (Pexels suspend encore les nouvelles clés le
  2026-10-17) ; essai : « Essayer Pexels (étape 7, lot 5) ». Vérification de toute l'étape le
  2026-10-17 (relecture contre le BRIEF ; trois manques comblés : l'onglet Projets du rail, qui
  reprend les pages, les images et les sons d'un autre design, la recherche de l'onglet
  Importer, les photos et vidéos de Pexels dans les crédits à recopier ; la police du poste suit
  une page reprise ; un défaut corrigé : la miniature d'un design quitté pour un autre depuis
  l'éditeur ; pont : `reprendre_design`, 80 outils ; une story faite de bout en bout par le pont
  dans Tauri) ; essai : « Essayer l'étape 7 en entier : une story d'automne ».
- **Le produit est fini** (les sept étapes du BRIEF, le 2026-10-17). Le rapport de fin, avec
  les commandes à lancer avant les essais et l'ordre des parcours : section « Avant les essais :
  les commandes, dans l'ordre » du `01_application/LISEZMOI.md`. Restent : les essais
  d'Alexandre et leurs corrections, le mini PC, la clé Pexels.
- **Version installée 0.9.0** (2026-10-17, à la demande d'Alexandre : « le rendre exécutable
  comme un vrai logiciel ») : un paquet `.deb` qui contient Eliot (interface, bibliothèque,
  noyau) et le pont `/usr/bin/eliot-mcp`, et fait installer par apt ffmpeg et GStreamer ;
  `01_application/paquet.sh` le construit, `01_application/installer.sh` l'installe et relie
  la version installée à la clé (`.env`) et aux modèles (`telechargements/`) par des liens
  (commandes 22 à 24). L'environnement Python du détourage est fixé par
  `01_application/requirements.txt`. Le mode développement (commande 10) reste pour les
  corrections.
- **Open source, publié le 2026-10-17** (décisions d'Alexandre du même jour) : dépôt public
  https://github.com/blueberrylabs-dev/eliot, sous l'organisation Blueberry Labs, « pour tout
  type de logiciel » (distincte de Blackberrylabs, la famille des outils pour agents IA) ; son
  nom GitHub est `blueberrylabs-dev`, `blueberrylabs` étant pris par un compte ; licence MIT
  (`LICENSE`) ; tout en français (`README.md`, `CHANGELOG.md`) ; historique gardé, l'adresse
  des commits remplacée par l'adresse noreply de GitHub. Version 0.9.0 publiée avec le `.deb`
  construit sur le poste et `SHA256SUMS`, avant le passage réel d'Alexandre (« Publier tout de
  suite ») : une
  correction trouvée à ses essais sort en 0.9.1 ou en 1.0.0, jamais en remplaçant la 0.9.0.
  Pousser : commande 25 ; publier une version : commande 26.
- Essais d'Alexandre : tous à la fin, une fois le produit fini, et les corrections à ce
  moment-là (décision du 2026-10-16). Jusque-là, ne pas lui demander d'essai ni de commande
  après chaque lot ; les commandes à lancer avant les essais (compilations, installations
  uniques) se rassemblent dans le rapport de fin.

Suite : `PLAN.md`.

## À lire avant de travailler

`BRIEF.md` (cadrage, règles § 5), `PLAN.md` (avancement), `JOURNAL.md` (décisions récentes).

## Règles propres au projet

Toutes au § 5 du `BRIEF.md`. Les deux qui ne se discutent pas :

- **Règle 9 : lancement à la main seulement, carte graphique libre.** Ni le banc d'essai ni
  l'application ne sont démarrés par un script, une tâche planifiée ou Claude.
- **Règle 10 : publiable à tout moment.** Rien dans le dépôt qui ne puisse devenir public.

## Commandes

Toutes se tapent dans un terminal du poste principal. Aucune ne programme quoi que ce soit
pour plus tard.

**1. Voir ce qui est déjà installé** (ne modifie rien) :

```
node --version; npm --version; rustc --version; cargo --version
```

Il faut Node 20.19 ou plus (ou 22.12 et plus) ; si `rustc` est introuvable, faire l'étape 3.

**2. Bibliothèques du système** (une fois, demande ton mot de passe) : moteur web de Tauri,
décodeurs vidéo (H.264 par `gstreamer1.0-libav`, VP9 par `gstreamer1.0-plugins-good`) et
`ffmpeg`, qui fabrique les vidéos de test (étape 4 bis) et, dans Eliot, prépare chaque vidéo
et chaque son importés (copie d'aperçu ou d'écoute, vignettes, forme d'onde) et fait l'export
MP4.

```
sudo apt update && sudo apt install -y libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev gstreamer1.0-libav gstreamer1.0-plugins-good gstreamer1.0-plugins-bad ffmpeg
```

Vérifier : `pkg-config --modversion webkit2gtk-4.1` affiche un numéro de version. Revenir en
arrière : `sudo apt remove` suivi des mêmes noms (déconseillé si d'autres logiciels s'en
servent).

**3. Rust**, seulement si `rustc --version` a échoué :

```
curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh -s -- -y && . "$HOME/.cargo/env"
```

Vérifier : `rustc --version`. Revenir en arrière : `rustup self uninstall`.

**4. Dépendances JavaScript du banc** (une fois) :

```
cd /home/nushoko/Bureau/Logiciels/Eliot/00_banc_essai && npm install
```

Crée `00_banc_essai/node_modules/` (131 Mo mesurés dans le conteneur de Claude).

**4 bis. Fichiers de test** (une fois) : la photo 24 Mpx et les deux vidéos 1080p, trop
lourdes pour être copiées depuis le conteneur de Claude, se fabriquent sur place en 20
secondes environ (processeur seulement). Il faut `uv`, déjà utilisé dans tes autres projets.

```
cd /home/nushoko/Bureau/Logiciels/Eliot/00_banc_essai && uv run --no-project --with numpy --with pillow python outils/generer_donnees.py
```

Vérifier : la commande affiche quatre lignes (empreinte, nom, poids) et
`public/donnees/` contient `photo_24mpx.jpg`, `photo_apercu_2560.jpg`,
`video_1080p_h264.mp4` et `video_1080p_vp9.webm`. La photo et la vidéo H.264 doivent porter
les mêmes empreintes que dans le conteneur de Claude (elles commencent par `b219839fe1e65046`
et `c49f21051aaa63a2`).

**5. Compiler le banc sans l'ouvrir.** Processeur seulement, la carte graphique n'est pas
sollicitée. La première fois, compter plusieurs minutes, tous les cœurs occupés (5 min 38 s
sur les 2 cœurs du conteneur de Claude) et jusqu'à 6 Go dans `src-tauri/target/`. Pour
laisser de la marge à ton travail en cours, `-j 4` limite à 4 cœurs :

```
cd /home/nushoko/Bureau/Logiciels/Eliot/00_banc_essai/src-tauri && cargo build -j 4
```

Vérifier : la dernière ligne commence par `Finished`.

**6. Lancer le banc, carte graphique libre** :

```
cd /home/nushoko/Bureau/Logiciels/Eliot/00_banc_essai && npm run tauri dev
```

La fenêtre s'ouvre en plein écran. Clique « Lancer tous les tests » et ne touche plus à rien
pendant environ une minute. Ensuite, sans fermer le terminal, la même page se mesure dans un
navigateur de la famille Chrome, à l'adresse `http://localhost:1420` : soit tu l'ouvres
dans Chrome et tu relances la série, soit tu le dis à Claude, qui la lance lui-même dans le
navigateur intégré de l'application Claude (il tourne sur ton PC et voit donc ce serveur
local). Arrêter : `Ctrl+C` dans le terminal (ferme la fenêtre et le serveur local).

Vérifier : deux fichiers dans `resultats/`.

```
ls /home/nushoko/Bureau/Logiciels/Eliot/00_banc_essai/resultats
```

**6 bis. Banc des copies d'aperçu (étape 4, lot 0).** D'abord fabriquer les copies, sur le
processeur seulement, environ une minute (il faut `ffmpeg`, installé par la commande 2) :

```
cd /home/nushoko/Bureau/Logiciels/Eliot/00_banc_essai && python3 outils/generer_copies.py
```

Vérifier : six lignes « … de fabrication … Mo », puis « Copies prêtes ». Ensuite, carte
graphique libre, lancer le banc comme à la commande 6 et cliquer « Copies d'aperçu
(étape 4) » ; ne plus toucher à la fenêtre pendant environ trois minutes. Arrêter : `Ctrl+C`.

```
cd /home/nushoko/Bureau/Logiciels/Eliot/00_banc_essai && npm run tauri dev
```

Vérifier : un fichier qui finit par `_copies.json` dans `00_banc_essai/resultats/`.

**6 ter. Banc de l'aperçu en direct du labo photo (étape 5, lot 0).** Il se sert de la photo de
la commande 4 bis et de la copie VP9 720p de la commande 6 bis, déjà sur le poste. D'abord
recompiler le banc (processeur seulement ; la première fois, `cargo` télécharge la
bibliothèque `rayon`, qui répartit le calcul sur les cœurs) :

```
cd /home/nushoko/Bureau/Logiciels/Eliot/00_banc_essai/src-tauri && cargo build -j 4
```

Ensuite, carte graphique libre (le shader WebGL s'en sert, comme toute la fenêtre), lancer le
banc et cliquer « Labo photo (étape 5) » ; ne plus toucher à la fenêtre pendant environ une
minute. Arrêter : `Ctrl+C`.

```
cd /home/nushoko/Bureau/Logiciels/Eliot/00_banc_essai && npm run tauri dev
```

Vérifier : un fichier qui finit par `_labo.json` dans `00_banc_essai/resultats/`.

**7. Si la fenêtre reste blanche, scintille ou plante** (pilote NVIDIA) : `Ctrl+C`, puis
relancer avec la première variable ; si ça ne suffit pas, avec la seconde. La variable
utilisée est inscrite dans les résultats.

```
cd /home/nushoko/Bureau/Logiciels/Eliot/00_banc_essai && __NV_DISABLE_EXPLICIT_SYNC=1 npm run tauri dev
```

```
cd /home/nushoko/Bureau/Logiciels/Eliot/00_banc_essai && WEBKIT_DISABLE_DMABUF_RENDERER=1 npm run tauri dev
```

### L'application (étape 1)

Les étapes 2 et 3 ci-dessus servent aussi à l'application ; rien de plus à installer dans le
système.

**8. Dépendances JavaScript de l'application** (une fois, puis à chaque changement de
`package.json`) :

```
cd /home/nushoko/Bureau/Logiciels/Eliot/01_application && npm install
```

Vérifier : aucune ligne ne commence par `npm error`. À refaire après chaque livraison qui
change `package.json` (l'étape 2 ajoute `vitest`, l'outil de test de l'interface).

**8 bis. Fabriquer la bibliothèque** (icônes, emojis, polices, personnages ; une fois, puis
après chaque livraison qui la change ; processeur seulement, réseau pour les polices la
première fois). Les personnages viennent des deux archives .zip d'Open Peeps et de Humaaans,
rangées dans `/home/nushoko/Bureau/Logiciels/Eliot/telechargements/` :

```
cd /home/nushoko/Bureau/Logiciels/Eliot/01_application && npm run bibliotheque
```

Vérifier : la commande annonce `7750 icônes, 4047 emojis, 95 polices`, puis
`221 personnages et 207 pièces à assembler (Open Peeps, Humaaans)`. Sans elle, Eliot s'ouvre,
mais sans icônes, emojis, polices ni personnages de la bibliothèque. Si une archive manque,
la commande le dit et fabrique le reste. Depuis l'étape 6, lot 3, elle lit aussi les paquets 3D
de Kenney (un .zip par paquet, téléchargé sur kenney.nl) rangés dans
`/home/nushoko/Bureau/Logiciels/Eliot/telechargements/kenney/` et annonce
`… modèles 3D de Kenney (Food Kit, …)` ; un paquet sans licence CC0 ou sans modèles GLB est
écarté, avec la raison.

**9. Compiler l'application sans l'ouvrir.** Processeur seulement, limité à 4 cœurs ; la
première fois, plusieurs minutes et quelques Go dans `01_application/src-tauri/target/`.

```
cd /home/nushoko/Bureau/Logiciels/Eliot/01_application/src-tauri && cargo build -j 4
```

Vérifier : la dernière ligne commence par `Finished`. La première fois après l'étape 5, lot 1,
`cargo` télécharge `krilla` (l'export en PDF), qui demande Rust 1.92 au moins : si la
compilation le réclame, `rustup update`, puis relancer la commande. Après l'étape 6, lot 3, la
bibliothèque `image` se recompile avec la lecture des fichiers HDR (environnements), sans rien
télécharger de nouveau.

**10. Lancer Eliot, carte graphique libre** :

```
cd /home/nushoko/Bureau/Logiciels/Eliot/01_application && npm run tauri dev
```

Arrêter : fermer la fenêtre (le design en cours s'enregistre avant), ou `Ctrl+C` dans le
terminal. Les designs sont dans `~/Documents/Eliot/Designs/`, les images exportées dans
`~/Images/Eliot/`, les films (MP4, GIF) dans `~/Vidéos/Eliot/`. Si la fenêtre reste blanche ou
scintille, mêmes variables qu'à la commande 7, placées devant `npm run tauri dev`. Un export
en MP4 occupe tout le processeur le temps du film (jamais la carte graphique).

**11. Tests du noyau Rust** (processeur seulement, sans fenêtre) :

```
cd /home/nushoko/Bureau/Logiciels/Eliot/01_application/noyau && cargo test -j 4
```

Vérifier : `test result: ok. 146 passed; 0 failed; 2 ignored` (les essais ignorés servent aux
comparaisons de Claude dans le conteneur ; l'essai du vrai Whisper ne tourne que dans le
conteneur et passe ailleurs sans rien faire, comme celui du vrai modèle du détourage). La
première fois après le lot 6 de l'étape 4, `cargo` télécharge la bibliothèque `nnnoiseless`
(réduction du bruit de la voix). Un essai fait écouter un faux micro pendant deux secondes
environ : rien n'est enregistré du vrai micro.

**12. Tests de l'interface** (sans fenêtre ni carte graphique) :

```
cd /home/nushoko/Bureau/Logiciels/Eliot/01_application && npm test
```

Vérifier : `Tests  306 passed`.

### Le pont vers une IA (fin de l'étape 2)

**13. Compiler le pont `eliot-mcp`** (une fois, puis à chaque livraison qui le change ;
processeur seulement, 4 cœurs, une à deux minutes) :

```
cd /home/nushoko/Bureau/Logiciels/Eliot/01_application/eliot-mcp && cargo build --release -j 4
```

Vérifier : la dernière ligne commence par `Finished`, et le fichier
`01_application/eliot-mcp/target/release/eliot-mcp` existe.

**14. L'activer dans Eliot** : Fichier, « Réglages et pont IA… » (ou la roue dentée de
l'accueil), puis l'interrupteur. Le réglage est gardé : le pont se rouvre à chaque lancement
d'Eliot, jusqu'à ce que l'interrupteur soit coupé. Le pont ne lance jamais Eliot.

**15. Le déclarer à Claude**, une fois. Dans l'application Claude de bureau : menu Claude,
Settings, onglet Developer, bouton Edit Config ; ajouter l'entrée `eliot` dans `mcpServers`
(la fenêtre des réglages d'Eliot la donne toute prête, avec un bouton pour la copier), puis
quitter et relancer l'application Claude :

```
{
  "mcpServers": {
    "eliot": {
      "command": "/home/nushoko/Bureau/Logiciels/Eliot/01_application/eliot-mcp/target/release/eliot-mcp"
    }
  }
}
```

Si le fichier contient déjà d'autres serveurs, ajouter seulement le bloc `"eliot": {…}` à
côté d'eux. Avec Claude Code, la même chose en une commande :

```
claude mcp add eliot -- /home/nushoko/Bureau/Logiciels/Eliot/01_application/eliot-mcp/target/release/eliot-mcp
```

Vérifier : Eliot ouvert et le pont activé, demander à Claude « appelle l'outil etat
d'Eliot » ; la réponse décrit le design ouvert. Le design et ses captures partent chez
Anthropic pendant l'échange (règle 12).

**15 bis. Si l'application Claude ignore ce fichier** (cas constaté le 2026-10-14 avec le
paquet non officiel `claude-desktop-unofficial` : « Aucun serveur ajouté » malgré l'entrée) :
emballer le pont en extension, après la commande 13, puis l'installer depuis l'application
Claude, Réglages, Extensions, en choisissant le fichier produit.

```
cd /home/nushoko/Bureau/Logiciels/Eliot/01_application/eliot-mcp && python3 emballer_mcpb.py
```

Après une livraison qui change le pont, les deux d'un coup (compiler puis emballer) :

```
cd /home/nushoko/Bureau/Logiciels/Eliot/01_application/eliot-mcp && cargo build --release -j 4 && python3 emballer_mcpb.py
```

Vérifier : la commande affiche « Extension prête » suivi du chemin
`01_application/eliot-mcp/target/eliot.mcpb`. À refaire après chaque nouvelle compilation du
pont, puis réinstaller l'extension. Si l'extension et l'entrée du fichier sont actives toutes
les deux, retirer l'entrée `eliot` du fichier pour éviter un doublon.

### La voix (étape 4, lot 6)

Le micro passe par `ffmpeg` et PulseAudio (que PipeWire fournit sur Ubuntu) : rien à installer
de plus. Le nettoyage de la voix tourne dans le noyau. Seule la voix de synthèse demande deux
choses, une fois.

**16. Installer Piper**, le programme de la voix de synthèse (processeur seulement, jamais la
carte graphique ; environ 170 Mo avec onnxruntime, sa bibliothèque de calcul) :

```
uv tool install piper-tts==1.8.0
```

Vérifier : `piper --help` affiche l'aide. Si `piper` est introuvable, taper
`uv tool update-shell` et rouvrir le terminal (Eliot le cherche aussi dans `~/.local/bin`).
Revenir en arrière : `uv tool uninstall piper-tts`.

**17. Télécharger deux voix françaises** (135 Mo, depuis le dépôt `rhasspy/piper-voices` de
Hugging Face) : siwis (une femme, CC BY 4.0) et upmc (Jessica et Pierre, CC BY-SA 4.0). Chaque
voix a son dossier dans `telechargements/voix/`, hors git, avec son modèle, sa configuration et
sa fiche (d'où viennent ses données, sous quelle licence) :

```
for v in siwis upmc; do d=/home/nushoko/Bureau/Logiciels/Eliot/telechargements/voix/fr_FR-$v-medium; mkdir -p $d && for f in fr_FR-$v-medium.onnx fr_FR-$v-medium.onnx.json MODEL_CARD; do wget -nc -P $d "https://huggingface.co/rhasspy/piper-voices/resolve/main/fr/fr_FR/$v/medium/$f"; done; done
```

Vérifier les empreintes :

```
cd /home/nushoko/Bureau/Logiciels/Eliot/telechargements/voix && md5sum */*.onnx
```

Attendu : `20e876e8c839e9b11a26085858f2300c` pour `fr_FR-siwis-medium/fr_FR-siwis-medium.onnx`
et `6837ede9408c7e1b39fa4a126af9e865` pour `fr_FR-upmc-medium/fr_FR-upmc-medium.onnx` (les
empreintes publiées dans `voices.json` du même dépôt, retrouvées dans le conteneur de Claude
le 2026-10-15). Puis rouvrir l'onglet Audio d'Eliot. Revenir en arrière : supprimer le dossier
`telechargements/voix/`.

### Les sous-titres (étape 4, lot 7)

La coupe des blancs ne demande rien de plus : le noyau mesure le niveau de la voix. Les
hésitations et les sous-titres demandent Whisper, qui écoute la voix et l'écrit mot par mot,
sur le processeur (jamais la carte graphique : Eliot le lance avec `--device cpu` et sans
carte visible). Deux choses, une fois.

**18. Installer Whisper** (`whisper-ctranslate2`, licence MIT, qui fait tourner faster-whisper
et CTranslate2 ; environ 400 Mo ; versions fixées, vérifiées dans le conteneur de Claude le
2026-10-15) :

```
uv tool install whisper-ctranslate2==0.5.7 --with ctranslate2==4.8.2 --with faster-whisper==1.2.1 --with av==18.1.0
```

Vérifier : `whisper-ctranslate2 --version` affiche `0.5.7`. Si le programme est introuvable,
taper `uv tool update-shell` et rouvrir le terminal (Eliot le cherche aussi dans
`~/.local/bin`). Revenir en arrière : `uv tool uninstall whisper-ctranslate2`.

**19. Télécharger le modèle** `faster-whisper-small` (485 Mo, licence MIT, conversion du
modèle small d'OpenAI publiée par Systran sur Hugging Face, à la révision vérifiée) dans
`telechargements/whisper/`, hors git :

```
d=/home/nushoko/Bureau/Logiciels/Eliot/telechargements/whisper/faster-whisper-small; mkdir -p $d && for f in README.md config.json model.bin tokenizer.json vocabulary.txt; do wget -nc -P $d "https://huggingface.co/Systran/faster-whisper-small/resolve/536b0662742c02347bc0e980a01041f333bce120/$f"; done
```

Vérifier les empreintes :

```
cd /home/nushoko/Bureau/Logiciels/Eliot/telechargements/whisper/faster-whisper-small && md5sum config.json model.bin tokenizer.json vocabulary.txt
```

Attendu : `6b09a90a9be263e3c2d3df31587c5554` (`config.json`), `4c1a36b9f6798403fedd8314e8bd074a`
(`model.bin`), `10268c850d335f758d616c3465b8de48` (`tokenizer.json`) et
`c1120a13c94a8cbb132489655cdd1854` (`vocabulary.txt`), relevées dans le conteneur de Claude le
2026-10-15. Puis rouvrir l'onglet Texte d'Eliot : « Modèle : faster-whisper-small » s'affiche.
Revenir en arrière : supprimer le dossier `telechargements/whisper/`.

### Le détourage (étape 5, lot 7)

Le fond d'une photo est retiré par BiRefNet (Peng Zheng et ses co-auteurs, licence MIT), un
modèle d'IA qui tourne sur le processeur, jamais sur la carte graphique : Eliot le lance par un
petit programme Python, comme Whisper, sans carte visible. Deux choses, une fois.

**20. Installer le programme du détourage** : Python et onnxruntime pour le processeur (sans
CUDA), environ 120 Mo dans `telechargements/detourage/env/`, hors git. Versions fixées,
vérifiées dans le conteneur de Claude le 2026-10-16 :

```
uv venv /home/nushoko/Bureau/Logiciels/Eliot/telechargements/detourage/env --python 3.12 && uv pip install --python /home/nushoko/Bureau/Logiciels/Eliot/telechargements/detourage/env -r /home/nushoko/Bureau/Logiciels/Eliot/01_application/requirements.txt
```

Vérifier :

```
/home/nushoko/Bureau/Logiciels/Eliot/telechargements/detourage/env/bin/python -c "import onnxruntime; print(onnxruntime.get_available_providers())"
```

Attendu : `['AzureExecutionProvider', 'CPUExecutionProvider']`, aucun fournisseur de carte
graphique. Revenir en arrière : supprimer le dossier `telechargements/detourage/env/`.

**21. Préparer le modèle** (environ quatre minutes, processeur seulement, jusqu'à 4 Go de
mémoire). Le programme `outils/convertir_birefnet.py` télécharge le code et les poids de
BiRefNet sur Hugging Face, à une révision fixée, vérifie leurs empreintes SHA-256, les convertit
en ONNX, compare le résultat au modèle d'origine, puis range `birefnet.onnx` (894 Mo) dans
`telechargements/detourage/`. uv lui fournit torch pour le processeur le temps de la
conversion (environ 1 Go dans le cache de uv, que `uv cache clean` vide ensuite) :

```
cd /home/nushoko/Bureau/Logiciels/Eliot/01_application && CUDA_VISIBLE_DEVICES= uv run --no-project --python 3.12 --index https://download.pytorch.org/whl/cpu --with "torch==2.14.0+cpu" --with "torchvision==0.29.0+cpu" --with timm==1.0.20 --with transformers==4.57.1 --with einops==0.8.2 --with kornia==0.8.3 --with safetensors==0.8.0 --with onnx==1.19.1 --with onnxscript==0.7.2 --with onnxruntime==1.30.0 --with numpy==2.3.5 python outils/convertir_birefnet.py
```

Vérifier : les dernières lignes disent « Écart avec le modèle d'origine : 0.000000 » (un écart
de quelques millièmes est accepté), puis « Modèle prêt » et le chemin de `birefnet.onnx`. Puis
rouvrir le labo d'une photo : « Modèle : BiRefNet, sur le processeur » s'affiche dans la section
Détourage. Pour une machine plus modeste, la version légère (deux fois plus rapide, un peu moins
juste, 190 Mo) : la même commande suivie de ` --modele birefnet-lite` (Eliot prend BiRefNet s'il
est là, sinon la version légère). Revenir en arrière : supprimer `birefnet.onnx`.

### La version installée (2026-10-17)

**22. Installer Eliot comme un logiciel** (processeur seulement, 4 cœurs ; plusieurs minutes la
première fois ; apt demande ton mot de passe ; Eliot n'est pas lancé) :

```
cd /home/nushoko/Bureau/Logiciels/Eliot/01_application && ./installer.sh
```

Il construit le paquet s'il n'existe pas pour la version (commande 23), l'installe avec apt
(qui ajoute ffmpeg et GStreamer s'ils manquent), puis relie la version installée au dépôt :
`~/.config/fr.alexandredo.eliot/cles.env` vers le `.env`, et
`~/.local/share/fr.alexandredo.eliot/voix`, `whisper` et `detourage` vers ceux de
`telechargements/`. Rien n'est copié ni effacé ; ce qui existe déjà n'est pas touché.
Vérifier : la dernière partie dit « Eliot 0.9.0 est installé » ; Eliot est dans le menu des
applications. Le pont installé est `/usr/bin/eliot-mcp` : dans le fichier de l'application
Claude (commande 15), remplacer le chemin du dépôt par celui-ci, ou garder l'extension
(commande 15 bis).

**23. Construire seulement le paquet** (pour le mini PC ou une version publiée) :

```
cd /home/nushoko/Bureau/Logiciels/Eliot/01_application && ./paquet.sh
```

Vérifier : `01_application/paquets/Eliot_0.9.0_amd64.deb` et `SHA256SUMS`. Sur le mini PC
(Ubuntu ou Debian, x86-64), copier ce fichier, puis `sudo apt install ./Eliot_0.9.0_amd64.deb` ;
ses clés et modèles vont dans les mêmes dossiers (`README.md`, « Les modules facultatifs »).

**24. Désinstaller** (tes designs, dans `~/Documents/Eliot`, restent) :

```
sudo apt remove eliot
```

### La publication (2026-10-17)

**25. Envoyer les nouveaux commits sur GitHub** (dépôt public `blueberrylabs-dev/eliot`, en
SSH) :

```
cd /home/nushoko/Bureau/Logiciels/Eliot && git push
```

**26. Publier une nouvelle version**, après le passage réel sur le poste : changer la version
dans `01_application/src-tauri/tauri.conf.json`, ajouter sa section en haut de `CHANGELOG.md`,
commit et commande 25, construire le paquet (commande 23), puis, en remplaçant `1.0.0` par la
nouvelle version :

```
cd /home/nushoko/Bureau/Logiciels/Eliot/01_application && gh release create v1.0.0 paquets/Eliot_1.0.0_amd64.deb paquets/SHA256SUMS --repo blueberrylabs-dev/eliot --title "Eliot 1.0.0" --notes "Voir CHANGELOG.md"
```

Vérifier : la page https://github.com/blueberrylabs-dev/eliot/releases montre la version et
ses deux fichiers. Une version publiée ne se modifie jamais sur place.

## Arborescence

```
Eliot/
├── CLAUDE.md  BRIEF.md  PLAN.md  JOURNAL.md  .gitignore
├── README.md  CHANGELOG.md  LICENSE   la page publique, les versions, la licence MIT
├── 00_banc_essai/      étape 0 : mesure de fluidité, jetable (voir son LISEZMOI.md)
├── 01_application/     Eliot lui-même (voir son LISEZMOI.md)
└── telechargements/    archives, voix et modèles installés à la main (personnages, voix de Piper, Whisper, détourage, paquets 3D de Kenney), hors git
```

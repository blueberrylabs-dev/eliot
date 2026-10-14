# BRIEF.md — Eliot

Cadrage, écrit une fois. Version du 2026-10-14, révision 8. La révision 8 ajoute le son (voix,
nettoyage, musique, jingles, bruitages, banques de sons : § 6, « Le son ») selon la proposition
de Claude **validée par Alexandre le 2026-10-14** (« Je valide »), texte à relire par lui ; il
entre dans l'étape 4. La révision 7, **validée par Alexandre le 2026-10-14** (« Tu as mon
accord »), ajoute son objectif de création de contenu pour YouTube, TikTok et Instagram, avec
ce qu'il implique, fait passer la vidéo avant le labo photo et range les clés d'API dans le
`.env` hors git. La révision 6 remplace Pexels, qui a
suspendu ses nouvelles clés, par Pixabay en premier (« Oui, je suis d'accord »). La révision 5
(« Pour tous tes points, c'est bon ») ajoute à la révision 4, validée plus tôt le même jour, ce
qu'il a demandé en comparant Eliot à Canva (« Oui, tu rajoutes tout » : bibliothèque
d'éléments, modèles de départ, photos et vidéos en ligne, nouvelles fonctions), le labo photo
façon Lightroom, le mode vidéo façon CapCut, le pont vers une IA et un nouvel ordre de
construction. Toute modification passe par une entrée du JOURNAL et par son accord
(`00_moi/AUTONOMIE.md`, point 7).

## 1. Objet

Eliot est un éditeur graphique de bureau, personnel, dont l'interface reprend celle de Canva :
une page au centre, une barre d'onglets à gauche pour ajouter des textes, des formes et des
images, une barre d'outils qui s'adapte à l'objet sélectionné, une manipulation directe à la
souris (sélection, déplacement, redimensionnement et rotation par poignées) et un export du
rendu dans un dossier du poste.

Usage : apprendre la création publicitaire en produisant des visuels (photos) et des spots
vidéo, ainsi que des maquettes de produits ; et se lancer dans la création de contenu pour
YouTube, TikTok et Instagram (vidéos, montages photo, carrousels), en apprenant le métier avec
l'aide de l'IA (révision 7). Eliot doit donc être simple, rapide et intuitif,
et offrir dès la version 1 un maximum de fonctions (catalogue au § 6). Deux outils servent de
modèles en plus de Canva : Lightroom pour retoucher une photo avec des curseurs, CapCut pour
monter une vidéo sur une frise à pistes, en bas de l'écran.

C'est une application locale : aucun hébergement, aucun compte Eliot. Tout fonctionne sans
internet, sauf deux fonctions facultatives : chercher des photos et des vidéos libres chez
Pixabay (et chez Pexels si Alexandre obtient une clé), avec une clé gratuite à son nom, et
laisser Claude piloter Eliot (§ 6, règle 12). Elle tourne sur deux postes, le poste
principal (Ubuntu 24.04) et un mini PC aux performances plus modestes. Le travail lourd
est fait en Rust.

Le nom « Eliot » est « toile » lu à l'envers, choisi par Alexandre le 2026-10-14.

## 2. Pourquoi ce projet (pour moi)

Les demandes du 2026-10-14, mot pour mot : « une application de bureau personnelle,
ultra-rapide et légère », « le code lourd est bien en Rust », « aussi fluide que l'original »,
« une application qui soit locale », « une interface qui ressemble à Canva. Facile à utiliser,
intuitif », « C'est pour la création de spots publicitaires, etc. ou des maquettes de
produits », « Je veux faire de la création publicitaire, mais justement, je veux un outil
simple, rapide et fluide et intuitif pour apprendre », « tu mets un max de fonctions dès le
départ. Ne cherche pas à faire d'économie », « je ferai soit des photos, soit des vidéos. C'est
pour mon apprentissage », « Est-ce que c'est un projet qu'on peut mettre éventuellement en open
source sur GitHub ? ».

Le même jour, après le premier essai et une capture de Canva : « regardes ce qu'il pourrait
manquer et je pense que c'est un probleme de librairies », « Oui, tu rajoutes tout », « une
option qu'il y a sur Lightroom », « un ajustement avec des curseurs pour l'exposition,
contraste, saturation, température, netteté, etc. », « pour la partie vidéo, façon CapCut »,
« un mode vidéo animation ou mini timeline en bas de l'écran avec des pistes pour superposer
du texte animé sur une vidéo », « est-ce que cet outil, on pourrait le brancher à une IA pour
qu'il puisse faire les choses de lui-même », « je cherche à me lancer dans la création de
contenu euh, sur euh, YouTube, TikTok, Instagram, via des vidéos, des montages photos.
apprendre le métier. Et tout ça avec l'assistance de l'IA ».

## 3. Public et posture

Un seul utilisateur, Alexandre, sur deux postes :

| Poste | Système | Processeur | Carte graphique | Écran |
| --- | --- | --- | --- | --- |
| Principal | Ubuntu 24.04 | AMD 7950X3D | NVIDIA RTX 3090 | ? |
| Mini PC | ? | ? | ? | ? |

Source du poste principal : `00_moi/STACK.md` (version du 2026-09-14, « à revérifier »). Le
mini PC est la machine qui fixe la barre : si Eliot est fluide dessus, il l'est partout.

Rien n'est publié ni livré à un tiers. Deux exceptions seulement, chacune à l'initiative
d'Alexandre (règle 12) : les mots d'une recherche de photos, et, s'il branche Claude sur Eliot
(§ 6), le document et les captures que Claude lit pendant l'échange.

## 4. Contexte vérifié le 2026-10-14

| Fait | Valeur relevée | Source |
| --- | --- | --- |
| Versions stables npm | `@tauri-apps/cli` 2.12.2, `@tauri-apps/api` 2.12.3, `react` 19.3.0, `react-konva` 19.3.0, `konva` 10.8.0, `zustand` 5.0.15, `tailwindcss` 4.3.3, `vite` 8.3.4, `lucide-react` 1.57.0 | `npm view <paquet> version` |
| Tauri 3 | 3.0.0-alpha.4, publiée le 2026-10-01 : pas encore stable | `npm view @tauri-apps/cli time` |
| Gabarit officiel | `create-tauri-app` 4.7.5, gabarit `react-ts` : React 19, Vite 8, TypeScript ~6.0.3, Rust édition 2024 | gabarit généré dans le conteneur Claude |
| WebKitGTK sur Ubuntu 24.04 | `libwebkit2gtk-4.1-dev` 2.52.6-0ubuntu0.24.04.1 ; dessin par Skia (C++, carte graphique par défaut) depuis la 2.46 | `apt-cache policy` (conteneur Ubuntu 24.04.5) ; https://blogs.igalia.com/carlosgc/ |
| Prérequis système Tauri | `libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev`, Rust par rustup | https://v2.tauri.app/start/prerequisites/ |
| Paquet `.deb` produit par Tauri | déclare `libwebkit2gtk-4.1-0` et `libgtk-3-0` en dépendances ; Tauri conseille de compiler pour Linux sous Linux | https://v2.tauri.app/distribute/debian/ |
| IPC binaire | `tauri::ipc::Request` donne « the raw body payload and the request headers » | https://v2.tauri.app/develop/calling-rust/ |
| Fil principal | « Commands without the async keyword are executed on the main thread unless defined with #[tauri::command(async)] » | même page |
| NVIDIA et WebKitGTK | fenêtre blanche, scintillement ou plantage au redimensionnement, dus au rendu DMABUF ; variables dans l'ordre `__NV_DISABLE_EXPLICIT_SYNC=1`, `WEBKIT_DISABLE_DMABUF_RENDERER=1`, `WEBKIT_DISABLE_COMPOSITING_MODE=1` ; ne pas forcer la deuxième sans être touché ; le canvas peut passer sur un chemin lent sans aucune erreur | https://v2.tauri.app/develop/debug/linux-graphics/ |
| Glisser-déposer | `dragDropEnabled` vaut `true` par défaut : Tauri intercepte les dépôts de fichiers et fournit leurs chemins | schéma de config de `@tauri-apps/cli` 2.12.2 |
| Canva (rapporté) | nouveau moteur de rendu « Lightspeed » : « Rust alongside wGPU, Data Oriented Design, and WebAssembly », alimenté par le modèle JavaScript | offres d'emploi Canva, https://jobs.blackbird.vc/companies/canva/jobs/72657275-lightspeed-renderer-senior-software-engineer |
| Electron | 44.7.2 ; archive Linux x64 : 122 969 114 octets | page de publication GitHub (en-tête `Content-Length`) |
| Tailles médianes (rapporté) | applications Electron 406,9 Mo, applications Tauri 26,2 Mo, relevé de juin 2026 | https://desktopinsights.com/blog/state-of-desktop-app-runtimes-2026 |
| Polotno | licence commerciale, essai de 30 jours limité à « evaluation, testing, and internal development » ; dépendances : `konva`, `react-konva`, `mobx-state-tree`, `quill`, `@polotno/svg-export` | https://polotno.com/license ; `npm view polotno dependencies` |
| Fabric.js | 7.4.0 (2026-05-18) | `npm view fabric` |
| Konva 10.8.0 | fournit `Node.toBlob`, `Transformer.getActiveAnchor`, `rotationSnaps`, `anchorStyleFunc` | fichiers de types du paquet installé |
| Banc d'essai sur le poste principal (mesuré, écran 60 Hz) | Tauri : 62 images/s pour redessiner 200 objets, mais 42 à 45 pendant un geste qui redessine la page ; 62 avec l'objet glissé sur un calque à part. Chrome 152 (navigateur intégré de Claude) : 60 partout. Coût de dessin de la page : 8,7 ms dans Tauri, 1,0 ms dans Chrome. Vidéo H.264 lue au ralenti dans Tauri, normale dans Chrome. Réduction d'une photo 24 Mpx : Rust 230 ms, Chrome 234 ms, Tauri 301 ms | `00_banc_essai/resultats/2026-10-14_152859_tauri-webkitgtk.json`, `2026-10-14_153221_navigateur-claude.json` ; détail au JOURNAL |
| Rust dans Electron | `@napi-rs/cli` 3.10.8 (MIT) : un module Node écrit en Rust, natif, sans WebAssembly | `npm view @napi-rs/cli` |
| Briques Rust | `svg2pdf` 0.13.0, `resvg` 0.45.1, `image` 0.25.10, `sha2` 0.10.9, `fast_image_resize` 6.1.0 ; les quatre premières compilent aussi pour WebAssembly (mesuré) | `cargo search` ; compilation `wasm32-unknown-unknown` dans le conteneur Claude |
| Licences des dépendances prévues | MIT : `konva`, `react-konva`, `react`, `zustand`, `tailwindcss`, `vite`. ISC : `lucide-react`. MIT ou Apache-2.0 : `@tauri-apps/api`, `@tauri-apps/plugin-dialog`, `tauri`, `image`, `fast_image_resize`, `svg2pdf`, `resvg`, `sha2`, `serde` | `npm view <paquet> license`, `cargo info <crate>` |
| FFmpeg | LGPL 2.1 ou ultérieure par défaut, GPL si compilé avec des composants comme libx264 ; la page ne traite pas le cas d'un programme qui appelle l'exécutable `ffmpeg` sans s'y lier | https://ffmpeg.org/legal.html |
| Nom « Eliot » | déjà pris sur npm (`eliot` 0.1.33, « Next generation JavaScript, simplified ») et sur PyPI (`eliot` 1.18.0) ; aucun paquet Ubuntu de ce nom ; aucun logiciel de mise en page de ce nom trouvé par une recherche rapide (marques non vérifiées) | `npm view eliot`, `pip index versions eliot`, `apt-cache search` |
| Icônes libres | `@tabler/icons` 3.49.0, MIT : 5 184 icônes au trait et 1 054 pleines ; `@phosphor-icons/core` 2.1.1, MIT : 1 512 icônes en six épaisseurs | `npm view`, fichiers SVG des paquets comptés le 2026-10-14 |
| Emojis libres | `openmoji` 17.0.0, CC-BY-SA-4.0 (crédit obligatoire, partage à l'identique des emojis modifiés) ; Fluent Emoji de Microsoft, MIT | `npm view openmoji` ; https://github.com/microsoft/fluentui-emoji |
| Personnages illustrés | Open Peeps : « Free for commercial and personal use under CC0 License » ; Humaaans : CC0 | https://www.openpeeps.com/ ; https://www.humaaans.com/ |
| unDraw (écarté) | la licence exclut de distribuer les illustrations « in packs or otherwise » et de les compiler en collection | https://undraw.co/license |
| QR code et polices | `qrcode` 1.5.4, MIT ; paquets `@fontsource/*` des polices Google en OFL-1.1 (relevé sur `anton` et `archivo-black` 5.3.0, à vérifier police par police) | `npm view` |
| API Pexels | gratuite, clé obligatoire (compte Pexels) ; 200 requêtes par heure et 20 000 par mois par défaut ; photos et vidéos (`/v1/videos/search`) ; « show a prominent link to Pexels », crédit du photographe « where possible » ; interdit : « copy or replicate core functionality of Pexels » ; rien sur la copie locale des fichiers | https://www.pexels.com/api/documentation/ |
| API Pexels, état | « Une nouvelle émission de clé API est actuellement en pause » (page de demande de clé, capture d'Alexandre du 2026-10-14) ; aucune date de reprise trouvée | https://www.pexels.com/fr-fr/api/key/ |
| API Pixabay | clé gratuite liée au compte ; 100 requêtes par 60 secondes ; photos et vidéos (`/api/videos/`) ; « permanent hotlinking of images (using Pixabay URLs in your app) is not allowed », « please download them to your server first » ; réponses à garder en cache 24 h ; « show your users where the images and videos are from, whenever search results are displayed » ; « Systematic mass downloads are not allowed » | https://pixabay.com/api/docs/ |
| API Unsplash (écartée) | « All API uses must use the hotlinked image URLs returned by the API » : incompatible avec une photo copiée dans le projet et un travail hors ligne | https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines |
| Kits MCP | `rmcp` 3.5.1, Apache-2.0, kit Rust officiel, transports par entrée et sortie standard (`transport-io`) et HTTP ; `@modelcontextprotocol/sdk` 1.32.1, MIT | `cargo info rmcp`, `npm view` |
| Whisper (sous-titres automatiques) | « Whisper's code and model weights are released under the MIT License » ; modèles de 39 millions (tiny) à 1,55 milliard de paramètres (large) | https://github.com/openai/whisper |
| API Freesound (révision 8) | gratuite avec une clé ; 60 requêtes par minute et 2 000 par jour ; recherche et extraits MP3 ou OGG avec la clé ; le fichier original demande OAuth2 (« It requires OAuth2 authentication »), 30 par minute et 500 par jour ; « You can use the Freesound API for free only for non-commercial purposes » ; « properly credit Freesound and Freesound users in accordance to sounds' licenses » ; sons sous CC0, CC BY ou CC BY-NC (Sampling+ pour d'anciens sons) | https://freesound.org/docs/api/overview.html ; https://freesound.org/docs/api/resources_apiv2.html ; https://freesound.org/docs/api/terms_of_use.html ; https://en.wikipedia.org/wiki/Freesound |
| Pixabay, musique et bruitages | absents de l'API, qui couvre « royalty-free images and videos » ; seulement sur le site | https://pixabay.com/api/docs/ |
| Pexels et le son | « All videos on Pexels are published without audio » ; pas de musique | https://help.pexels.com/hc/en-us/articles/43126081204505-Why-is-there-no-audio-on-my-video |
| YouTube Audio Library (rapporté) | pas d'API, dans YouTube Studio ; titres sous licence standard réservés aux vidéos YouTube ; titres CC BY 4.0 utilisables ailleurs avec crédit ; à vérifier dans les conditions officielles | https://licenseorg.com/guide/music-audio/youtube-audio-library |
| Free Music Archive | licences Creative Commons titre par titre, « not all of them can be used in videos, podcasts, short films or commercial projects » ; licence payante par Tribe of Noise (« €45 ») ; pas d'API annoncée | https://freemusicarchive.org/royalty-free-music/ |
| Openverse | moteur de recherche d'œuvres libres ; sources audio : freesound, jamendo, wikimedia_audio ; API à étudier | https://docs.openverse.org/api/guides/quickstart.html |
| Piper (voix de synthèse locale) | moteur sous GPL-3.0 (dépôt `OHF-Voice/piper1-gpl`) ; « intended for personal use and text to speech research only » ; « Some voices may have restrictive licenses » | https://github.com/OHF-Voice/piper1-gpl ; `docs/VOICES.md` du même dépôt |
| Briques audio Rust | `nnnoiseless` 0.5.2 (BSD-3-Clause, réduction de bruit RNNoise), `deep_filter` 0.2.5 (MIT ou Apache-2.0, réduction de bruit), `ebur128` 0.1.10 (MIT, niveau sonore EBU R128), `cpal` 0.18.2 (Apache-2.0, micro), `symphonia` 0.6.1 (MPL-2.0, décodage), `rubato` 5.0.1 (MIT ou Apache-2.0, rééchantillonnage), `hound` 3.5.1 (Apache-2.0, WAV) | `cargo info <crate>` |

## 5. Règles du projet (au-delà de CONVENTIONS.md)

1. **Le document est la seule vérité.** Un fichier JSON décrit la page et ses éléments. Konva
   dessine ce que dit le document et ne garde aucun état propre, sauf pendant un geste.
2. **Une seule porte d'écriture.** Toute modification passe par une action du store, qui
   alimente l'historique. Aucun composant ne touche au document directement.
3. **Konva pendant le geste, le store à la fin.** Pendant un glisser ou un redimensionnement,
   Konva déplace les nœuds seul, sans faire travailler React. Le store reçoit le résultat à la
   fin du geste : une écriture, une entrée d'historique, même pour dix objets sélectionnés.
4. **Le travail lourd va au Rust, natif.** Décodage et réduction des images, empreintes,
   lecture et écriture des fichiers, rendu d'export. L'interface ne fait que l'interface et le
   dessin interactif.
5. **L'interface ne touche jamais une image en pleine résolution.** Elle affiche un aperçu
   préparé par le Rust ; l'original ne sert qu'à l'export. C'est ce qui garde le glisser fluide
   sur le mini PC.
6. **Une image entre par référence.** Le document porte l'empreinte SHA-256 de l'image,
   jamais l'image elle-même.
7. **L'export ne dépend pas de l'écran.** Il se calcule depuis la page à sa taille native.
8. **Le Rust vérifie ce qu'il écrit.** Extension et premiers octets conformes au format,
   écriture atomique, jamais d'écrasement silencieux dans le dossier par défaut.
9. **Lancement à la main seulement, carte graphique libre.** Ni le banc d'essai ni
   l'application ne sont démarrés par un script, une tâche planifiée ou Claude. Alexandre les
   lance quand sa carte graphique n'a pas de travail en cours (décision du 2026-10-14).
10. **Publiable à tout moment.** Rien n'entre dans le dépôt qui ne puisse devenir public : ni
    secret, ni fichier sous licence fermée (polices, icônes, modèles d'IA compris), ni donnée
    personnelle. Les fichiers de test sont synthétiques. Seul nom cité : Alexandre Do.
11. **Pendant un geste, seul ce qui bouge est redessiné.** Au début d'un glisser, d'un
    redimensionnement ou d'une rotation, les objets sélectionnés et leurs poignées passent sur
    un calque à part ; la page n'est plus redessinée avant la fin du geste. Mesuré le
    2026-10-14 : 45 images/s sans cette règle dans Tauri, 62 avec. Une vidéo qui joue suit la
    même logique : elle vit sur son propre calque.
12. **Hors ligne par défaut.** Tout fonctionne sans internet. Seules sortent sur le réseau la
    recherche de photos et de vidéos libres (Pixabay, Pexels) et de sons (Freesound, révision
    8), quand Alexandre la lance, et
    les échanges avec Claude, quand il branche Claude sur Eliot (§ 6). C'est le Rust qui
    appelle ces services. Les clés vivent hors git : dans le `.env` à la racine du dépôt,
    comme dans les autres projets d'Alexandre (`00_moi/COMPTES.md`), lu par le Rust en
    développement ; dans le dossier de configuration du poste pour la version installée.
    Jamais dans un commit ni dans l'interface. Une photo ou une vidéo choisie est copiée dans
    les ressources avec le nom et le lien de son auteur : le projet n'a plus besoin du réseau
    ensuite.
13. **Une retouche ne touche jamais l'original.** Réglages de photo, recadrage, détourage,
    coupes et vitesse d'une vidéo sont des valeurs du document. Le Rust les applique à
    l'aperçu pour l'écran et à l'original pour l'export ; on peut toujours remettre à zéro.

Noms de fichiers, de composants et d'identifiants métier en français (`CONVENTIONS.md`), sauf
ce que les outils imposent (`package.json`, `src-tauri/`, `Cargo.toml`, `main.rs`).

## 6. Architecture envisagée

### Qui fait quoi

| Travail | Où | Pourquoi |
| --- | --- | --- |
| Interface (barres, panneaux, menus, boîtes de dialogue) | React + Tailwind, dans le moteur web | c'est l'outil qui permet le plus vite une interface proche de Canva |
| Dessin de la page pendant l'édition | Konva sur le `<canvas>` du moteur web, dessiné par Skia | le dessin doit se faire dans la fenêtre : le faire en Rust imposerait d'envoyer 4,7 Mo par image (page 1080 × 1080), 280 Mo/s à 60 images par seconde |
| Import des images : décodage, orientation, aperçu, miniature, empreinte | noyau Rust natif | calcul lourd, plusieurs cœurs, l'interface ne reçoit qu'un aperçu léger |
| Ouverture, enregistrement automatique, copie des projets | noyau Rust natif | accès disque, écriture atomique |
| Écriture des exports | noyau Rust natif | idem |
| Rendu d'export depuis le document, avec les images originales (calques des vidéos, PDF vectoriel, haute définition) | noyau Rust natif, étapes 4 et 5 | qualité maximale, indépendante de l'écran |
| Réglages de photo (labo façon Lightroom), histogramme | noyau Rust natif ; aperçu en direct par le Rust ou par un shader WebGL, choisi par mesure (étape 5) | calcul pixel par pixel sur des millions de pixels |
| Recherche et téléchargement de photos et vidéos libres (Pixabay, Pexels) | noyau Rust natif | la clé reste hors de l'interface (règle 12) |
| Frise vidéo, lecture, textes animés à l'écran | React et Konva | c'est de l'interface et du dessin interactif |
| Vignettes et formes d'onde, copies d'aperçu des vidéos, export MP4, sous-titres automatiques | noyau Rust, avec le programme `ffmpeg` du système et Whisper sur le processeur (étape 4) | décodage, composition et encodage image par image |

Le noyau est une bibliothèque Rust à part (`noyau/`), sans aucune dépendance à Tauri : il se
teste seul (`cargo test`), et si l'enveloppe change un jour, il reste.

### L'enveloppe : Tauri, sous réserve du banc d'essai

Tauri ouvre une fenêtre qui utilise le moteur web du système (WebKitGTK sous Ubuntu) au lieu
d'embarquer Chromium : c'est ce qui le rend léger. Le risque, c'est la fluidité de ce moteur,
surtout sur le mini PC. Le banc d'essai de l'étape 0 la mesure avant d'écrire l'application.

| Enveloppe | Statut | Raison |
| --- | --- | --- |
| Tauri (WebKitGTK) | proposée pour démarrer l'étape 1 ; passe le banc du poste principal avec la règle 11 | la plus légère, Rust natif à côté de l'interface ; marge faible sur le dessin (8,7 ms par page contre 1,0 dans Chrome), vidéo H.264 lue au ralenti |
| Electron (Chromium embarqué) | repli, décision définitive après le banc du mini PC et avant l'étape 4 (vidéo) | moteur de Chrome sur les deux postes, environ 8 fois plus de marge sur le dessin, H.264 normale ; mais 123 Mo d'archive pour Electron seul et plus de mémoire ; le noyau Rust resterait natif (module Node écrit en Rust, napi-rs) |
| Application web installée dans Chrome | écartée le 2026-10-14 | demande un hébergement ou un serveur local ; Alexandre veut une application locale |
| Application 100 % Rust (iced, Slint, egui) | écartée sauf échec des deux premières | toute l'interface Canva serait à construire avec des outils moins mûrs : des mois de travail |

### Ce que Eliot reprend de Canva

Canva est facile parce que chaque action courante est visible et se fait en un geste. Eliot
reprend ces gestes et cette disposition, avec ses propres couleurs et sans le logo ni les
polices de Canva.

- **Le rail d'onglets à gauche**, avec un panneau qui s'ouvre à côté. Étape 1 : Textes, Formes,
  Images, Calques. Révision 5, sur le modèle de la capture de Canva du 2026-10-14 : Modèles,
  Éléments (formes, lignes, icônes, emojis, personnages, cadres et grilles photo, maquettes
  d'appareils, graphiques, tableaux, QR code), Texte (styles et associations de polices),
  Photos (Pixabay, Pexels), Importer, Marque, Dessin, Projets, Calques. Un clic pose l'objet au
  centre de la page ; on peut aussi le glisser à l'endroit voulu (étape 2). Chaque panneau a sa
  recherche par mot. Révision 8 : un onglet Audio (étape 4, voir « Le son »).
- **La barre du haut** : accueil, menu Fichier, nom du design (modifiable), état de
  l'enregistrement, Redimensionner (décliner le design dans un autre format), annuler et
  rétablir, bascule Photo ou Vidéo (qui ouvre la frise, voir CapCut plus bas), Exporter.
- **La barre d'outils contextuelle** au-dessus de la page, qui change selon la sélection :
  police, taille, couleur, gras, italique, alignement pour un texte ; couleur et arrondi pour
  une forme ; retourner et transparence pour une image.
- **La mini-barre flottante** juste au-dessus de l'objet sélectionné : dupliquer, supprimer, et
  un bouton « plus » qui ouvre le menu de l'objet. Le même menu sort au clic droit.
- **Les poignées** rondes aux coins, en pilule sur les côtés, et la poignée de rotation sous
  l'objet. Pendant le geste, une étiquette affiche la taille ou l'angle.
- **Les repères magnétiques** : en déplaçant un objet, des lignes roses apparaissent et l'objet
  s'aimante au centre et aux bords de la page et des autres objets. C'est ce qui donne
  l'impression que « tout s'aligne tout seul ».
- **L'édition du texte en place** : double-clic, on tape directement sur la page.
- **Coller une image** depuis le presse-papiers (une capture d'écran, par exemple) et **déposer
  un fichier** depuis le gestionnaire de fichiers (étape 2).
- **La barre du bas** : zoom par curseur et « Ajuster à l'écran », vignettes des pages avec un
  bouton pour en ajouter une, vue en grille des pages, plein écran.
- **L'accueil** : créer un design en choisissant un format, rouvrir un design récent (étape 2,
  avec les projets).
- Les raccourcis clavier usuels : Ctrl+Z, Ctrl+Y, Ctrl+C, Ctrl+V, Ctrl+D, Suppr, flèches.

Ce qu'Eliot ne reprend pas de la capture : IA Canva (génération), Présenter, Notes, Minuteur,
commentaires, Partager, Applis (§ 8).

### Ce que Eliot reprend de Lightroom : le labo photo

Demande d'Alexandre du 2026-10-14. Une image (photo ou clip vidéo) sélectionnée affiche un
bouton « Retoucher » dans la barre contextuelle ; il ouvre le panneau du labo à la place du
panneau de gauche, comme « Modifier l'image » chez Canva.

- **Lumière** : exposition (de −5 à +5 IL), contraste, hautes lumières, ombres, blancs,
  noirs ; courbe des tonalités.
- **Couleur** : température, teinte, vibrance, saturation ; mélangeur de couleurs (teinte,
  saturation et luminance pour huit couleurs : rouge, orange, jaune, vert, cyan, bleu, violet,
  magenta).
- **Effets** : texture, clarté, correction du voile, vignetage, grain.
- **Détail** : netteté, réduction du bruit.
- Chaque curseur va de −100 à +100 autour de zéro (sauf l'exposition) ; double-clic pour le
  remettre à zéro ; valeur modifiable au clavier. Un histogramme surmonte les curseurs.
- **Avant et après** : un bouton maintenu montre l'original. **Préréglages** : une vingtaine
  fournis (dessinés par Claude), ceux qu'Alexandre enregistre, appliqués en un clic ; copier
  les réglages d'une image et les coller sur une autre.
- Recadrage avec redressement de l'horizon, dans le même panneau.

Fonctionnement. Les réglages sont des valeurs du document (règle 13). Le Rust les calcule en
nombres à virgule, en lumière linéaire, dans un ordre fixe écrit dans le noyau : balance des
blancs, exposition, tonalités, courbe, couleurs, détail, effets. L'aperçu affiché est
recalculé depuis l'aperçu de 2560 px, l'export depuis l'original (règles 5 et 7).

Aperçu en direct, pendant qu'on tire un curseur : deux voies, départagées par un petit banc au
début de l'étape 5, sur le poste principal puis sur le mini PC. Objectif : au moins 30 images
par seconde sur le mini PC.

| Voie | Principe | Pour | Contre |
| --- | --- | --- | --- |
| Rust en direct | à chaque mouvement, le Rust recalcule une copie à la taille de l'écran et renvoie les pixels bruts | une seule écriture des formules : l'écran et l'export sont identiques par construction | dépend du débit entre le Rust et la fenêtre, à mesurer ; ne suffit pas pour une vidéo qui joue |
| Shader WebGL | les réglages pixel par pixel tournent dans la fenêtre, sur la carte graphique ; ceux qui regardent les pixels voisins (netteté, clarté, texture, bruit, voile) sont calculés par le Rust au relâchement du curseur | instantané, et vaut aussi pour une vidéo en lecture | formules écrites deux fois (GLSL et Rust) : des tests comparent les deux rendus sur des images de référence |

### Ce que Eliot reprend de CapCut : le mode vidéo

Demande d'Alexandre du 2026-10-14 : « un mode vidéo animation ou mini timeline en bas de
l'écran avec des pistes pour superposer du texte animé sur une vidéo ».

- **La bascule Vidéo** de la barre du haut ouvre une frise chronologique en bas de l'écran,
  de hauteur réglable. La page reste au centre et montre l'image à la position de la tête de
  lecture. Ajouter une vidéo, une musique ou une animation ouvre la frise d'office. Un design
  sans vidéo peut aussi devenir animé (post animé) et s'exporter en MP4 ou en GIF.
- **La frise** : règle graduée, tête de lecture, lecture et pause (Espace), zoom de la frise,
  aimantation aux bords des clips et à la tête de lecture.
- **Les pistes** : une piste principale où les clips vidéo et photo se suivent bout à bout
  (supprimer un clip resserre la suite) ; au-dessus, des pistes de superposition pour les
  textes, images, autocollants et vidéos en incrustation ; en dessous, des pistes audio pour
  la musique, la voix off, les bruitages et le son détaché d'une vidéo. Un clip vidéo montre
  des vignettes, un clip audio sa forme d'onde.
- **Les gestes** : tirer un bord pour couper le début ou la fin, glisser pour déplacer dans le
  temps ou changer de piste, scinder à la tête de lecture (Ctrl+B, comme CapCut), dupliquer,
  supprimer.
- **Le texte animé** : animations d'entrée, de sortie et en boucle (fondu, glissement, zoom,
  rebond, machine à écrire, lettre par lettre), dont on règle la durée en tirant sur le clip ;
  styles de texte prêts pour la vidéo ; images clés sur la position, la taille, la rotation et
  l'opacité pour un mouvement libre.
- **Le clip** : vitesse, volume, fondus d'entrée et de sortie, détacher le son d'une vidéo,
  réglages du labo photo ; transitions entre deux clips de la piste principale (fondu
  enchaîné, glissement, zoom, volet).
- **Les sous-titres** : à la main, ou automatiques par reconnaissance vocale locale (Whisper,
  licence MIT, sur le processeur ; proposé par Claude), puis modifiables comme des textes.
  Révision 7 : sous-titres animés mot par mot, le mot prononcé mis en valeur, à la façon des
  vidéos TikTok.
- **L'export** : MP4 (H.264, 1080p, 30 images par seconde par défaut) et GIF, avec une barre de
  progression et un bouton pour annuler. Révision 7 : réglages d'export prêts par plateforme
  (YouTube, Shorts, TikTok, Reels), valeurs vérifiées au moment de les écrire.
- **Les zones sûres** : dans le format 9:16, un calque d'aide montre où TikTok, Reels ou
  Shorts posent leurs boutons et leurs légendes, pour ne pas y placer de texte.

Fonctionnement. Pendant l'édition, la vidéo joue dans la fenêtre, sur son propre calque
(règle 11), à partir d'une copie légère que le Rust prépare à l'import, avec des images clés
rapprochées pour que la tête de lecture réponde vite. Le format de cette copie se choisit par
mesure : au banc, la vidéo H.264 a joué au ralenti dans Tauri et la VP9 à vitesse normale. Les
textes animés sont calculés en TypeScript à chaque image ; le Rust reprend les mêmes formules
pour l'export, contrôlées par un tableau de valeurs attendues commun aux deux. À l'export, le
Rust décode les originaux avec `ffmpeg`, compose chaque image (la vidéo réglée, puis les calques
rendus par le Rust), mixe le son, et `ffmpeg` encode le fichier.

### Le son : voix, nettoyage, musique, bruitages (révision 8)

Demande d'Alexandre du 2026-10-14 : « intégrer aussi tout ce qui était voix, parole, musique de
fond, jingle, puis le traitement et le nettoyage audio », avec les banques de sons et les
bruitages. Proposition de Claude validée le même jour (« Je valide ») : le son se cale sur la
frise, il entre donc dans l'étape 4. Tout se calcule sur le processeur (règle 9).

- **L'onglet Audio** du rail : musiques, bruitages, voix ; recherche Freesound ; sons
  importés ; enregistrements ; jingles de la marque. Un clic pose le son à la tête de lecture,
  sur la piste audio qui convient ; un glisser le pose où l'on veut dans la frise.
- **La voix** : enregistrer au micro dans Eliot (le Rust capte le son), prise par prise, avec
  un compte à rebours et le niveau affiché ; chaque prise devient un clip de la piste voix.
  Une voix de synthèse locale en français sert aux brouillons et aux maquettes (Piper, sur le
  processeur) ; ses auteurs la destinent à un usage personnel et à la recherche (§ 4) : pas
  dans une pub publiée tant que la licence de la voix choisie ne le permet pas.
- **Le nettoyage d'une voix**, en valeurs du document (règle 13, l'original n'est jamais
  touché) : réduction du bruit de fond, coupe des silences et des hésitations repérées par la
  transcription Whisper, filtre des graves sous 80 Hz, égaliseur simple (chaleur, présence),
  compresseur, dé-esseur ; un bouton « Voix nette » applique un réglage prêt.
- **Le niveau sonore** : mesuré en LUFS (norme EBU R128) ; l'export se cale sur la cible de
  la plateforme choisie (autour de -14 LUFS, valeurs vérifiées au moment de les écrire), crête
  plafonnée pour éviter la saturation.
- **Le mixage** : volume et fondus par clip ; la musique baisse toute seule quand la voix
  parle (réglable) ; forme d'onde dans la frise.
- **Musique et jingles** : un jingle d'ouverture et un de fin rangés dans le kit de marque,
  posés d'un clic au début ou à la fin de la vidéo ; une musique trop courte se répète pour
  couvrir la durée, avec un fondu de fin automatique.
- **Les banques de sons** :
  - Freesound, dans l'onglet Audio, par le Rust (règle 12), clé dans le `.env`
    (`FREESOUND_API_KEY`). Seulement les sons CC0 et CC BY : ceux qui interdisent l'usage
    commercial sont écartés dès la recherche. Le crédit est gardé avec le son, comme pour les
    photos, et Eliot prépare la liste des crédits à coller dans la description de la vidéo.
    Les extraits viennent avec la clé ; l'original, si besoin, par la connexion au compte
    Freesound d'Alexandre (OAuth2).
  - Pixabay Musique et bruitages, YouTube Audio Library, Free Music Archive : aucune API
    utilisable. Alexandre télécharge sur leur site ; le fichier s'importe dans Eliot, qui
    rappelle la licence à vérifier (YouTube Audio Library : la plupart des titres sont réservés
    à YouTube ; Free Music Archive : licence titre par titre).
  - Pexels : pas de musique. Openverse : à étudier pour de la musique libre d'usage commercial.
- **L'export pour TikTok et Reels** : les sons tendance viennent de la bibliothèque de
  l'application elle-même et ne s'importent pas. L'export propose donc aussi une version sans
  musique, voix et bruitages gardés, pour ajouter le son tendance au moment de publier.
- **Plus tard** : musiques et jingles créés par une IA locale ; ils demandent la carte
  graphique (règle 9), et le modèle sera choisi d'après sa licence (certains interdisent
  l'usage commercial).

Fonctionnement. Un son importé, enregistré ou téléchargé est rangé dans les ressources du
design comme une image (empreinte, original, copie d'écoute), avec son crédit. Le Rust décode,
mesure le niveau, calcule une fois les traitements lourds (réduction de bruit) et garde le
résultat en cache, pour que la lecture dans la fenêtre reste fluide ; à l'export, il applique
tout aux originaux, mixe les pistes et `ffmpeg` encode.

### Brancher une IA : Eliot piloté par Claude

Question d'Alexandre du 2026-10-14 : « est-ce que cet outil, on pourrait le brancher à une IA
pour qu'il puisse faire les choses de lui-même ». Proposition de Claude, validée le même jour.

Le socle s'y prête déjà : le document est un JSON (règle 1) et toute modification passe par
une action du store (règle 2). Il suffit d'offrir ces actions à une IA sous forme d'outils.

- **Le pont** : MCP (Model Context Protocol), le protocole standard qui relie une IA à des
  outils. Un petit programme `eliot-mcp`, lancé par l'application Claude elle-même (mode local
  des clients MCP, par l'entrée et la sortie standard), relaie vers Eliot ouvert par un fichier
  de communication local (socket Unix) réservé à l'utilisateur : aucun port réseau n'est
  ouvert. Écrit en Rust avec `rmcp`, le kit officiel (§ 4). Le pont ne lance jamais Eliot
  (règle 9) : fenêtre fermée, il répond qu'Eliot n'est pas ouvert. Il ne fonctionne que si
  Alexandre l'a activé dans les réglages d'Eliot.
- **Les outils de l'IA**, calqués sur les actions du store : lire le document ; ajouter,
  modifier, déplacer, supprimer des éléments ; changer la page et son format ; chercher dans la
  bibliothèque (icônes, emojis, polices, modèles) et dans les banques de photos ; importer une
  image du poste ; appliquer des réglages du labo photo ; poser des clips et des animations sur
  la frise ; exporter. Et un outil pour **voir** : une capture de la page en PNG, pour que l'IA
  juge son propre travail.
- **Les garde-fous** : chaque action de l'IA est une étape de l'historique, annulable par
  Ctrl+Z ; Alexandre la voit travailler en direct dans la fenêtre. L'IA n'a aucun outil pour
  supprimer un projet, effacer une ressource, écrire hors des dossiers d'Eliot ou écraser un
  export (règle 8).
- **Quelle IA** : n'importe quel client MCP, au choix d'Alexandre.

| IA | Pour | Contre |
| --- | --- | --- |
| Claude, depuis l'application Claude ou Claude Code | la plus capable pour enchaîner une composition, dans les limites de l'abonnement | le document et les captures partent chez Anthropic le temps de l'échange : seconde exception à la règle 12, seulement quand Alexandre branche Claude |
| Modèle local (Ollama ou llama.cpp, déjà sur le poste) avec un client MCP | rien ne sort du poste | occupe la carte graphique (règle 9) ; un petit modèle enchaîne moins bien une composition |
| API Claude appelée par Eliot | assistant dans la fenêtre d'Eliot | paiement à l'usage et clé à gérer : écarté pour l'instant |

Exemples de demandes : « fais une pub carrée pour ce produit avec cette photo », « décline ce
design en story et en bannière », « propose trois titres et garde le meilleur », « monte une
vidéo de 15 s avec ces clips et des sous-titres animés », et pour apprendre : « explique-moi
pourquoi cette mise en page fonctionne ».

### Ce que demandent la publicité et les maquettes de produits

Étapes selon l'ordre de la révision 5 (§ 7).

| Besoin | Où il se fait | Étape |
| --- | --- | --- |
| Formats prêts à l'emploi (réseaux sociaux, bannières, A4) et décliner un visuel dans un autre format | interface | 2 |
| Modèles maison : enregistrer un design comme point de départ | noyau Rust (projets) | 2 |
| Bibliothèque d'éléments : icônes, emojis, personnages, polices | fichiers libres embarqués (licences au § 4) | 3 |
| Photos et vidéos libres pour illustrer une pub | recherche Pixabay, puis Pexels, par le noyau Rust (règle 12) | 3 |
| Kit de marque : couleurs, polices et logos réutilisables d'un design à l'autre | interface + fichiers du noyau | 3 |
| Effets de texte : ombre, contour, surlignage | Konva | 3 |
| Image dans un cadre ou une forme (photo dans un cercle), grilles de photos | Konva (découpe) | 3 |
| Maquettes d'appareils : une capture dans un téléphone, un ordinateur, une tablette, une montre | Konva (cadre dessiné + découpe) | 3 |
| Ombres portées sous un produit | Konva | 3 |
| Modèles de départ, prêts à modifier | documents dessinés par Claude | fin de l'étape 3 |
| Retouche des photos façon Lightroom | noyau Rust (les filtres de Konva tournent en JavaScript, pixel par pixel, trop lents sur une photo) | 5 |
| Détourage : retirer le fond d'une photo de produit | noyau Rust avec un modèle d'IA local ; modèle et licence à choisir et vérifier | 5 |
| Perspective : poser un visuel sur une boîte, un écran incliné, une affiche en biais | noyau Rust (Konva ne sait faire que des transformations sans perspective) | 5 |
| Export haute définition et PDF vectoriel | noyau Rust | 5 |
| Vidéo façon CapCut : frise, pistes, textes animés, musique, export MP4 | interface pour la frise ; noyau Rust pour les copies d'aperçu, le rendu image par image et l'encodage par le programme `ffmpeg` du système, appelé sans être embarqué | 4 |
| Le son (révision 8) : voix enregistrée, nettoyage, niveau par plateforme, musique qui baisse sous la voix, bruitages Freesound, jingles de marque | noyau Rust (captation, traitements, mixage) ; interface pour l'onglet Audio et les réglages | 4 |

Le modèle de document décrit une page à un instant donné ; pour la vidéo, on lui ajoute le
temps (apparitions, mouvements) et le noyau Rust rend chaque image. C'est une raison de plus
de garder le document comme seule vérité dès l'étape 1.

### Catalogue des fonctions de la version 1

Décision du 2026-10-14 : un maximum de fonctions dès le départ. Tout ce qui suit est dans le
périmètre ; les étapes du § 7 ne fixent que l'ordre de construction. Pour que l'outil reste
simple malgré tout, chaque fonction n'apparaît que là où elle sert : les réglages d'un texte
quand un texte est sélectionné, ceux d'une vidéo quand c'est une vidéo.

- **Page et formats** : formats prêts à l'emploi, nommés par plateforme (révision 7 : TikTok,
  Reels et Shorts en 9:16, post et carrousel Instagram en 4:5 et 1:1, vidéo YouTube en 16:9,
  miniature YouTube en 1280 × 720, bannière de chaîne ; plus bannière, A4, A5), taille libre,
  fond uni, dégradé ou image, décliner un design dans un autre format, plusieurs pages, règles,
  grille, marges de sécurité.
- **Éléments** : textes (titre, sous-titre, paragraphe, listes), formes (rectangle, arrondi,
  cercle, triangle, étoile, polygone, ligne, flèche), icônes (Tabler et Phosphor), emojis et
  autocollants (Fluent Emoji, OpenMoji), personnages (Open Peeps, Humaaans), images, photos et
  vidéos Pixabay et Pexels, vidéos, cadres (une image dans une forme) et grilles de photos,
  maquettes d'appareils (téléphone, ordinateur, tablette, montre), graphiques (barres, courbes,
  secteurs, anneaux) à partir d'un petit tableau de valeurs, tableaux, QR code, dessin à main
  levée (crayon, marqueur, surligneur, gomme). Tous les éléments embarqués se cherchent par
  mot.
- **Texte** : 60 à 100 polices libres embarquées, choisies pour la publicité, plus les polices
  installées sur le poste (copiées dans le projet quand il les utilise, pour passer d'une
  machine à l'autre) ; associations de polices prêtes (titre et texte qui vont ensemble) ;
  taille, gras, italique, souligné, barré, majuscules, alignement, interlignage, espacement des
  lettres, couleur, ombre, contour, surlignage, texte courbé, styles enregistrés.
- **Couleur** : sélecteur, pipette, couleurs déjà utilisées dans le document, kit de marque,
  dégradés linéaires et radiaux, transparence.
- **Image** : recadrer et redresser, retourner, coins arrondis, bordure, ombre, labo photo
  façon Lightroom avec préréglages (détail plus haut), flou, détourage local, perspective,
  remplacer une image en gardant sa place.
- **Organisation** : panneau des calques (ordre, visibilité, verrou, nom), grouper et
  dégrouper, aligner et répartir, repères magnétiques, copier le style d'un objet vers un
  autre, dupliquer, copier-coller entre designs.
- **Vidéo** : mode vidéo façon CapCut (détail plus haut) : frise à pistes, couper, scinder,
  vitesse, textes animés, images clés, transitions, musique et voix off avec volume et fondus,
  sous-titres, aperçu en lecture, export MP4 et GIF. Révision 8 : voix enregistrée au micro,
  nettoyage de la voix, niveau sonore par plateforme, musique qui baisse sous la voix,
  bruitages Freesound, jingles de marque, export sans musique pour les sons tendance.
- **Modèles** : une quarantaine de modèles de départ dessinés par Claude pour Eliot (post
  produit, promotion, story, bannière, miniature vidéo, affiche A4, maquette produit), avec des
  cadres photo vides à remplir ; plus les modèles maison.
- **Projets** : accueil, designs récents, nom du design, enregistrement automatique et son état
  affiché, annuler et rétablir, modèles maison, projet en dossier autonome, import et export
  d'un projet.
- **Export** : PNG (fond transparent possible), JPEG, WebP, PDF vectoriel, SVG, MP4, GIF ;
  résolution, qualité, pages choisies, dossier par défaut ; réglages prêts par plateforme ; un
  carrousel s'exporte en une image par page, numérotées dans l'ordre.
- **Aides pour apprendre** : infobulle sur chaque outil, grille des tiers, zones sûres des
  formats verticaux (là où TikTok, Reels, Shorts ou une story posent leurs boutons), alerte de
  contraste quand un texte devient difficile à lire sur son fond, alerte de texte trop petit
  pour le format.
- **Confort** : raccourcis clavier, menu au clic droit, zoom, aperçu plein écran, thème clair
  ou sombre de l'interface.

### Arborescence

```
Logiciels/Eliot/
├── CLAUDE.md  BRIEF.md  PLAN.md  JOURNAL.md
├── 00_banc_essai/                   page de test de fluidité (étape 0), jetable
└── 01_application/                  le projet Tauri (npm + cargo)
    ├── package.json  index.html  vite.config.ts  tsconfig.json  LISEZMOI.md
    ├── src/                         interface : React + TypeScript
    │   ├── main.tsx  styles.css  polices.ts
    │   ├── modele/                  types du document, fabriques d'éléments, migrations
    │   ├── etat/                    store : document, sélection, historique, actions
    │   ├── editeur/                 étape 1 : zone de travail Konva, barres, mini-barre,
    │   │   │                        menu du clic droit, saisie du texte, repères, raccourcis
    │   │   ├── panneaux/            un fichier par onglet du rail
    │   │   └── BarreBas.tsx         zoom et pages (étape 2)
    │   ├── bibliotheque/            catalogue des éléments embarqués et recherche (étape 3)
    │   ├── labo/                    panneau de retouche façon Lightroom (étape 5)
    │   ├── video/                   frise, pistes, lecture, animations (étape 4)
    │   ├── export/                  rendu de la page en image (étape 1)
    │   └── pont/                    le seul fichier qui parle à Tauri
    ├── noyau/                       bibliothèque Rust, sans Tauri (cargo test)
    │   └── src/  images.rs  export.rs  fichiers.rs (étape 1) ; projet.rs (2) ; pexels.rs (3) ;
    │             rendu.rs  video.rs (4) ; reglages.rs (5)
    ├── eliot-mcp/                   le pont vers une IA (programme à part, si validé)
    └── src-tauri/                   l'enveloppe : expose le noyau à l'interface
        ├── Cargo.toml  tauri.conf.json  build.rs
        ├── capabilities/default.json    droits de la fenêtre
        ├── icons/
        └── src/  main.rs  lib.rs  commandes.rs
```

Les fichiers des bibliothèques libres (icônes, emojis, personnages, polices) viennent de leurs
paquets npm ou d'un script de téléchargement à version fixe, avec leurs licences recopiées
dans `01_application/LICENCES-TIERS.md` ; ils ne sont pas recopiés à la main dans le dépôt.

### Le modèle de document

```json
{
  "version": 1,
  "page": { "largeur": 1080, "hauteur": 1080, "fond": "#ffffff" },
  "elements": [
    { "id": "a1", "type": "texte", "x": 120, "y": 140, "largeur": 840, "rotation": 0,
      "texte": "Ajouter un titre", "taillePolice": 96, "police": "Inter",
      "gras": true, "italique": false, "alignement": "left", "couleur": "#1f1f1f" },
    { "id": "a2", "type": "forme", "forme": "rectangle", "x": 200, "y": 400,
      "largeur": 300, "hauteur": 200, "rotation": 15, "remplissage": "#7c3aed", "arrondi": 0 },
    { "id": "a3", "type": "image", "ressource": "9f86d081884c7d65...", "x": 540, "y": 500,
      "largeur": 400, "hauteur": 300, "rotation": 0 }
  ]
}
```

L'ordre du tableau `elements` est l'ordre d'empilement : c'est déjà la gestion des calques.
Tous les éléments partagent la même boîte (`x`, `y`, `largeur`, `hauteur`, `rotation`), comme
chez Polotno ; le cercle est une ellipse dans sa boîte, donc étirable. Les champs `visible`,
`verrouille` et `nom` sont réservés dès la version 1 pour le panneau des calques. Une image
est désignée par l'empreinte SHA-256 de son fichier : la même image importée deux fois n'est
stockée qu'une fois. La police citée (« Inter ») est un exemple, le choix des polices est
ouvert.

Ce que la révision 5 ajoutera, chaque fois en montant `version` ; à l'ouverture, le noyau
convertit un document ancien vers la version courante (une fonction de migration par
version, testée) :

```json
{
  "version": 3,
  "nom": "Pub sneakers soldes",
  "format": { "largeur": 1080, "hauteur": 1920 },
  "pages": [ {
  "fond": "#000000",
  "duree": 15000,
  "elements": [
    { "id": "v1", "type": "video", "ressource": "4e07408562bedb8b", "x": 0, "y": 0,
      "largeur": 1080, "hauteur": 1920, "rotation": 0, "piste": 0,
      "temps": { "debut": 0, "fin": 8000 }, "coupe": { "debut": 2000 },
      "vitesse": 1, "volume": 0.8,
      "reglages": { "exposition": 0.3, "contraste": 12, "temperature": 8 } },
    { "id": "t1", "type": "texte", "texte": "-30 %", "x": 140, "y": 300, "largeur": 800,
      "rotation": 0, "piste": 1, "temps": { "debut": 1000, "fin": 4000 },
      "animations": { "entree": { "nom": "glissement-haut", "duree": 400 },
                      "sortie": { "nom": "fondu", "duree": 300 } },
      "cles": [ { "t": 1000, "echelle": 1 }, { "t": 4000, "echelle": 1.15 } ] }
  ],
  "audio": [
    { "id": "m1", "ressource": "8b1a9953c4611296", "temps": { "debut": 0, "fin": 15000 },
      "volume": 0.6, "fonduEntree": 500, "fonduSortie": 1500 }
  ]
  } ]
}
```

- Plusieurs pages (étape 2) : toutes au même format, chacune avec son fond et ses éléments ;
  un carrousel s'exporte en une image par page ou en un PDF.
- Le temps se compte en millisecondes entières ; une page sans `duree` est une image fixe,
  comme à l'étape 1. Une page qui a une durée est une vidéo : sa frise porte les pistes.
- `reglages` ne garde que les curseurs différents de zéro ; même champ pour une photo et pour
  un clip vidéo (règle 13).
- Les pistes : `piste` vaut 0 pour la piste principale, plus pour celles du dessus. Le store
  garde le tableau `elements` trié par piste : l'ordre d'empilement découle donc des pistes,
  et passer un clip sur une piste plus haute le passe devant. Sur une même piste, deux clips
  ne se chevauchent jamais dans le temps.
- Révision 8 : un clip `audio` porte aussi `role` (`musique`, `voix`, `bruitage` : la musique
  baisse sous les clips `voix`), `traitement` (seulement les réglages actifs : bruit, silences,
  graves, égaliseur, compresseur, dé-esseur) et, dans les ressources, le crédit du son.
- Nouveaux types d'élément : `video`, `icone` et `emoji` (un dessin vectoriel de la
  bibliothèque, désigné par son nom et sa collection), `dessin` (tracés à main levée),
  `graphique` (type et tableau de valeurs), `tableau`, `cadre` (une forme ou une grille qui
  découpe une ou plusieurs images), `qr`.

### Le store (`etat/`, zustand)

Il tient le document, les ressources, la sélection, le texte en cours de saisie et
l'historique. Actions : `ajouterElement`, `modifierElements`, `supprimerSelection`,
`dupliquerSelection`, `deplacerDansPile`, `selectionner`, `annuler`, `retablir`. L'historique
garde des instantanés du document, au plus 100 : comme les mises à jour sont immuables, deux
instantanés partagent en mémoire tout ce qui n'a pas changé.

### La zone de travail (`ZoneDeTravail.tsx`)

La scène Konva remplit la zone centrale, avec quatre calques Konva (chacun est un
`<canvas>`) : `fond` (l'ombre de la page, insensible à la souris), `page` (un groupe mis à
l'échelle et découpé aux bords de la page, avec le fond et les éléments), `geste` (vide au
repos ; pendant un geste, il reçoit les objets sélectionnés dans un groupe découpé comme la
page, puis les rend à la page à la fin, à leur rang d'origine : règle 11) et `interface`
(poignées, rectangle de sélection, repères magnétiques), au-dessus et non découpé.

La page garde sa taille native et se met à l'échelle pour tenir dans la zone, recalculée à
chaque redimensionnement de la fenêtre. Sélection : clic, Maj+clic pour ajouter ou retirer,
clic dans le vide pour désélectionner, rectangle de sélection en tirant dans le vide. Un seul
`Transformer` porte les poignées : pour un texte, les côtés changent la largeur (le texte se
réenroule) et les coins la taille de police ; une forme a huit poignées libres ; une image
quatre coins, proportions gardées. La rotation s'aimante tous les 45° à 5° près.

Repères magnétiques : au début d'un glisser, on relève les bords et les centres de la page et
des autres objets ; à chaque mouvement, l'objet s'aimante à la ligne la plus proche à moins
de 6 pixels écran, et la ligne s'affiche. Calcul fait sur une liste courte, sans React.

Édition du texte : Konva n'en fournit pas. Au double-clic, une zone de saisie HTML se pose
exactement sur le texte (même police, taille multipliée par l'échelle, même rotation).

### L'import d'une image

1. « Importer » ouvre le sélecteur de fichiers natif ; un dépôt depuis le gestionnaire de
   fichiers donne aussi des chemins. Le Rust lit le fichier lui-même : l'image ne transite pas
   par l'interface. Seul le collage depuis le presse-papiers passe des octets.
2. Le Rust décode l'image, applique l'orientation de l'appareil photo, calcule l'empreinte
   SHA-256, range l'original dans le dossier des ressources et produit un aperçu (2560 px au
   plus sur le grand côté) et une miniature (256 px). Plusieurs images s'importent en
   parallèle, sur plusieurs cœurs.
3. L'interface reçoit l'empreinte, les dimensions et l'adresse de l'aperçu, servi par le
   protocole de fichiers de Tauri, limité au dossier de l'application.

### L'export, de bout en bout

Étape 1 : l'interface rend la page à sa taille native (clone du groupe de la page, `toBlob`,
PNG ou JPEG, résolution ×1 ou ×2) et envoie les octets bruts au Rust, qui vérifie le format et
les premiers octets, écrit dans le dossier Images de l'utilisateur sous `Eliot/` (nom daté
`AAAA-MM-JJ_HHMMSS_eliot.png`, suffixe `_2` si le nom existe), par fichier temporaire puis
renommage. Avec des aperçus de 2560 px, une page 1080 × 1080 exportée en ×2 (2160 px) garde
des images nettes.

Étapes 4 et 5 : le Rust rend lui-même la page depuis le document, avec les images originales et
les mêmes fichiers de police : les calques d'une vidéo (étape 4), puis PDF vectoriel
(`svg2pdf`) et PNG haute définition (`resvg`) pour les grands formats comme l'A4 à 300 dpi
(étape 5). Point à surveiller : le texte doit tomber au même endroit qu'à l'écran. L'interface
transmet donc ses coupures de lignes, et on compare les deux rendus pixel par pixel avant de
s'y fier.

Hors Tauri (`npm run dev` dans un navigateur), l'export devient un téléchargement et l'import
passe par le navigateur : on peut travailler l'interface sans recompiler le Rust.

### Choix retenus et alternatives écartées

| Sujet | Retenu | Écarté, et pourquoi |
| --- | --- | --- |
| Moteur de dessin | Konva 10 + react-konva | Fabric.js 7 : chaque objet garde son propre état, à synchroniser avec React à chaque modification. Polotno : licence commerciale. tldraw, Excalidraw : tableaux blancs infinis |
| État | zustand 5 | Redux Toolkit : plus de code pour un seul écran. MobX : mutations implicites, historique moins lisible |
| Styles | Tailwind 4, plugin Vite | CSS écrit à la main : plus long à faire évoluer |
| Icônes | lucide-react | dessinées à la main : sans intérêt |
| Rust | noyau natif, appelé par commandes Tauri (ou par un module Node napi-rs si Electron) | WebAssembly dans la fenêtre : plus lent que le natif, inutile dans les deux enveloppes |
| Transfert vers le Rust | chemins de fichiers, sinon octets bruts | JSON + base64 : un tiers de volume en plus et un encodage complet dans chaque sens |
| Commandes Rust | `async` | synchrones : elles tournent sur le fil principal, l'interface gèle |
| Plugins Tauri | `dialog`, `opener` | `fs` : ouvrirait au front un accès disque large, inutile puisque le Rust lit et écrit |
| Version Tauri | 2.12 | 3.0 : alpha |
| Photos et vidéos en ligne | Pixabay d'abord (ses règles demandent de copier l'image chez soi), Pexels en plus si une clé est obtenue ; une même interface de recherche pour les deux | Unsplash : liens directs obligatoires vers ses serveurs, contraire à la règle 12 |
| Personnages illustrés | Open Peeps et Humaaans (CC0) | unDraw : sa licence interdit de redistribuer ses illustrations en lot |
| Fichiers de police | TTF ou OTF, une seule copie par police, servie à la fenêtre et lue par le Rust pour l'export (étape 3) | woff2 seuls (paquets `@fontsource` de l'étape 1) : le Rust devrait les décompresser avant de s'en servir |
| Aperçu en direct du labo photo | Rust en direct ou shader WebGL, départagés par mesure au début de l'étape 5 | filtres de Konva : JavaScript pixel par pixel, trop lents |
| Copie d'aperçu des vidéos | format choisi par mesure au début de l'étape 4 (VP9 a joué à vitesse normale au banc, H.264 au ralenti) | lire l'original dans la fenêtre : trop lourd pour le mini PC |
| Sous-titres automatiques | Whisper, sur le processeur, dans le noyau | un service en ligne : contraire à la règle 12 |
| Pont vers une IA | serveur MCP local (`rmcp`), par entrée et sortie standard et socket Unix | port réseau ouvert sur la machine : inutile ; API Claude dans Eliot : payante |

### Deux postes

Le paquet `.deb` se construit sur le poste principal et s'installe sur le mini PC, si celui-ci
tourne sous Ubuntu ou Debian sur un processeur x86-64 (à confirmer). Les polices sont
embarquées dans l'application : sans cela, un texte se recomposerait autrement sur une machine
qui n'a pas la même police. Le réglage NVIDIA se fait poste par poste (variable au lancement),
jamais en dur dans le code. Un projet est un dossier complet (document et images), qu'on copie
tel quel d'une machine à l'autre.

## 7. Ordre de construction

Tout le catalogue du § 6 est dans le périmètre de la version 1. Les étapes donnent l'ordre :
chacune s'appuie sur la précédente et se termine par un logiciel utilisable.

Étape 0, banc d'essai (feu vert du 2026-10-14, poste principal d'abord) : une page de 200
objets, une photo de 24 Mpx et deux vidéos 1080p (H.264 et VP9), mesurées dans une fenêtre
Tauri et dans Chrome. On mesure la fluidité du glisser, du redimensionnement et de la lecture
vidéo, et le coût de la réduction d'une photo par le Rust et par le moteur web. Fait le
2026-10-14 sur le poste principal (résultats au § 4 et au JOURNAL). Reste : le mini PC, quand
il sera disponible ; il décide entre Tauri et Electron avant l'étape 4 (vidéo).

Étape 1, l'éditeur : interface Canva décrite au § 6, sélection, poignées, repères
magnétiques, édition du texte, historique, ordre d'empilement, dupliquer, supprimer, import
d'image par le noyau Rust, export PNG et JPEG, polices embarquées. Livrée le 2026-10-14.

Révision 5 : l'ancienne étape 2 est partagée en deux, le labo photo rejoint le Rust qui rend,
la vidéo passe de 4 à 5 et le reste du catalogue de 5 à 6.

Étape 2, les projets et l'édition complète : accueil (formats, designs récents), nom du
design, enregistrement automatique et son état, ouverture, menu Fichier, modèles maison,
Redimensionner, plusieurs pages, barre du bas (zoom, vignettes des pages, plein écran),
collage d'image, dépôt de fichiers, glisser depuis le panneau, grouper, aligner et répartir,
copier le style, dégradés. Puis, si Alexandre le valide, le pont vers une IA avec les actions
existantes ; chaque étape suivante y ajoute ses outils.

Étape 3, la bibliothèque et la mise en forme publicitaire : icônes, emojis, personnages, 60
à 100 polices et polices du poste, associations de polices, recherche Pixabay et Pexels (photos
et vidéos), effets de texte, cadres et grilles photo, maquettes d'appareils, ombres portées, kit
de marque, lignes et flèches, dessin à main levée, graphiques, tableaux, QR code. Pour finir,
la quarantaine de modèles de départ, qui ont besoin de tout le reste.

Révision 7 : la vidéo, support principal d'Alexandre, passe avant le labo photo.

Étape 4, la vidéo façon CapCut : décision Tauri ou Electron d'après le banc du mini PC (sur
les mesures du poste principal s'il n'est pas encore là, à confirmer ensuite), petit banc
pour la copie d'aperçu, frise et pistes, clips, textes animés, images clés, transitions, son,
sous-titres mot par mot, zones sûres, réglages d'export par plateforme, export MP4 et GIF.
Révision 8 : le son complet (§ 6, « Le son ») : onglet Audio, voix enregistrée, nettoyage,
niveau, musique qui baisse sous la voix, Freesound, jingles de marque.
Le Rust y apprend à rendre les calques de la page, ce qui sert ensuite aux autres exports.

Étape 5, le labo photo et les exports de qualité : petit banc pour l'aperçu en direct, labo
façon Lightroom avec préréglages (pour les photos et les clips vidéo), recadrage et
redressement, export depuis le document avec les originaux (PDF vectoriel, PNG haute
définition, WebP, SVG), perspective, détourage local.

Étape 6 : le reste du catalogue (panneau des calques complet, aides pour apprendre, thème
sombre, texte courbé, styles enregistrés).

## 8. Hors périmètre

Hébergement, comptes Eliot, mises à jour automatiques par internet. Services en ligne, sauf la
recherche de photos (Pixabay, Pexels), celle de sons (Freesound, révision 8) et Claude branché
par Alexandre (règle 12). Autres
banques d'images, modèles fournis par un tiers (ceux d'Eliot sont dessinés pour lui),
génération d'images par IA, collaboration (commentaires, partage), mode présentation
(présenter, notes, minuteur), applications tierces intégrées, mobile. Windows et macOS : le
code reste portable, mais rien n'y sera testé.

## 9. Régime

Outil personnel d'apprentissage : rien n'est produit pour un tiers à ce stade. Retenu le
2026-10-14 (proposition de Claude acceptée par Alexandre) : cadrage avant code pour le socle (modèle de document, répartition
entre interface et Rust, export), parce qu'en changer après oblige à tout reprendre ;
exploratoire pour l'interface, qui se construit vite et s'ajuste à l'usage. Si Eliot devient
public sur GitHub, le dépôt sera lu par des tiers : le socle doit déjà tenir ce jour-là.

## 10. Questions tranchées et questions ouvertes

Tranchées le 2026-10-14 par Alexandre :

- Le code lourd est en Rust.
- Application locale : pas de Cloudflare ni d'hébergement. L'application web installée dans
  Chrome est donc écartée.
- Un second poste, un mini PC aux performances plus modestes, doit faire tourner Eliot.
- L'interface ressemble à Canva, facile à utiliser et intuitive.
- Usage : apprendre la création publicitaire, en photos et en vidéos, et des maquettes de
  produits.
- Un maximum de fonctions dès la version 1, sans chercher l'économie.
- Feu vert pour le banc d'essai, sur le poste principal d'abord ; les informations du mini PC
  viendront quand il sera disponible.
- Carte graphique : ne rien lancer dessus tant qu'Alexandre ne le dit pas (règle 9).
- Nom : Eliot, dossier `Logiciels/Eliot/`.
- Enveloppe : on démarre l'étape 1 sur Tauri ; Electron reste le repli, décidé au banc du mini
  PC avant l'étape de la vidéo (4 à l'époque, 5 dans la révision 5, de nouveau 4 depuis la
  révision 7).
- BRIEF validé, propositions par défaut retenues (« tout par défaut ») : page de 1080 × 1080
  par défaut, export dans `~/Images/Eliot/` avec nom daté, dépôt git local seulement,
  commandes d'installation données par Claude et lancées par Alexandre, régime du § 9,
  aucune licence tant que la question de l'open source n'est pas tranchée (tous droits
  réservés). Identité des commits : `Alexandre Do <adresse retirée avant la publication>`, celle de ses
  autres dépôts (choisie par Claude au titre du « par défaut », à changer s'il le souhaite).

Tranchées le 2026-10-14, seconde série, par Alexandre (« Oui, tu rajoutes tout », en réponse
à la comparaison avec Canva) :

- Bibliothèque embarquée : icônes, emojis et autocollants, personnages, 60 à 100 polices et
  celles du poste, panneaux Éléments et Texte enrichis.
- Une quarantaine de modèles de départ dessinés par Claude.
- Photos et vidéos en ligne : Pexels. Unsplash, que Claude avait cité dans sa proposition, est
  écarté par lui après lecture de ses règles (liens directs obligatoires, § 4). Révision 6 :
  Pexels a suspendu ses nouvelles clés (constaté par Alexandre le 2026-10-14) ; Pixabay passe
  en premier, Pexels reste prévu en plus (« Oui, je suis d'accord »).
- Dessin à main levée, grilles photo, maquettes d'appareils, graphiques, tableaux.

Validées avec la révision 5 (demandes d'Alexandre du même jour, mises en forme par Claude ;
« Pour tous tes points, c'est bon ») :

- Le labo photo façon Lightroom et le mode vidéo façon CapCut (§ 6).
- Le pont vers une IA par MCP, Claude en premier (§ 6) ; seconde exception à la règle 12.
- Les sous-titres automatiques par Whisper (proposé par Claude).
- Le nouvel ordre de construction en six étapes (§ 7).
- Les règles 12 et 13 (§ 5).

Tranchées le 2026-10-14, révision 7, par Alexandre (« Tu as mon accord ») : objectif de création
de contenu pour YouTube, TikTok et Instagram inscrit au § 1, avec formats par plateforme,
zones sûres, sous-titres mot par mot et réglages d'export par plateforme ; vidéo en étape 4,
labo photo en étape 5 ; clés d'API dans le `.env` hors git (règle 12).

Tranchées le 2026-10-14, révision 8, par Alexandre (« Je valide ») : le son entre dans
l'étape 4 (voix, nettoyage, niveau, mixage, jingles de marque) ; Freesound est la banque de
sons intégrée ; Pixabay Musique, YouTube Audio Library et Free Music Archive passent par un
téléchargement à la main ; la création de musique par IA attend la carte graphique.

Action d'Alexandre avant l'étape 4 : créer un compte Freesound, demander une clé d'API et
l'ajouter au `.env` (`FREESOUND_API_KEY`).

Action d'Alexandre avant l'étape 3 : créer un compte Pixabay et relever sa clé d'API
gratuite (et une clé Pexels si la pause se lève). Fait le 2026-10-14 pour Pixabay : la clé
est dans le `.env` à la racine du dépôt (`PIXABAY_API_KEY`), exclu de git le même jour ;
Claude ne l'a pas lue et ne la demande pas.

Ouvertes, avec la proposition de Claude :

- Q1. Le mini PC : modèle, système, processeur, carte graphique, définition de l'écran
  (quand il sera disponible).
- Q2. Open source : licence permissive (MIT ou Apache-2.0, chacun peut réutiliser le code,
  même dans un produit fermé) ou copyleft (GPL-3.0, toute version modifiée et distribuée doit
  rester ouverte) ? Sur quel compte GitHub ? Proposition : trancher avant la première
  publication ; d'ici là, tous droits réservés.
- Q3. Freesound réserve son API gratuite aux usages « non-commercial ». Eliot n'est pas vendu,
  mais il sert à des pubs. Proposition : Alexandre écrit à Freesound (formulaire de contact,
  message préparé par Claude) avant l'étape 4 pour confirmer ; sans réponse favorable,
  Freesound passe au téléchargement à la main, comme Pixabay Musique.
- Q4. Voix de synthèse pour une pub publiée : Piper est destiné à l'usage personnel selon ses
  auteurs. Proposition : Piper pour les brouillons ; pour une pub, la vraie voix enregistrée,
  ou une voix dont la licence permet l'usage commercial, choisie à l'étape 4.

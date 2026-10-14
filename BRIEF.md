# BRIEF.md — Eliot

Cadrage, écrit une fois. Version du 2026-10-14, révision 4, **validée par Alexandre le
2026-10-14**. Toute modification passe par une entrée du JOURNAL et par son accord
(`00_moi/AUTONOMIE.md`, point 7).

## 1. Objet

Eliot est un éditeur graphique de bureau, personnel, dont l'interface reprend celle de Canva :
une page au centre, une barre d'onglets à gauche pour ajouter des textes, des formes et des
images, une barre d'outils qui s'adapte à l'objet sélectionné, une manipulation directe à la
souris (sélection, déplacement, redimensionnement et rotation par poignées) et un export du
rendu dans un dossier du poste.

Usage : apprendre la création publicitaire en produisant des visuels (photos) et des spots
vidéo, ainsi que des maquettes de produits. Eliot doit donc être simple, rapide et intuitif,
et offrir dès la version 1 un maximum de fonctions (catalogue au § 6).

C'est une application locale : aucun hébergement, aucun compte, aucun service en ligne. Elle
tourne sur deux postes, le poste principal (Ubuntu 24.04) et un mini PC aux performances plus modestes. Le
travail lourd est fait en Rust.

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

## 3. Public et posture

Un seul utilisateur, Alexandre, sur deux postes :

| Poste | Système | Processeur | Carte graphique | Écran |
| --- | --- | --- | --- | --- |
| Principal | Ubuntu 24.04 | AMD 7950X3D | NVIDIA RTX 3090 | ? |
| Mini PC | ? | ? | ? | ? |

Source du poste principal : `00_moi/STACK.md` (version du 2026-09-14, « à revérifier »). Le
mini PC est la machine qui fixe la barre : si Eliot est fluide dessus, il l'est partout.

Rien n'est publié ni livré à un tiers, aucune donnée ne sort des deux machines.

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
| Rendu d'export depuis le document, avec les images originales (PDF vectoriel, haute définition) | noyau Rust natif, étape 3 | qualité maximale, indépendante de l'écran |

Le noyau est une bibliothèque Rust à part (`noyau/`), sans aucune dépendance à Tauri : il se
teste seul (`cargo test`), et si l'enveloppe change un jour, il reste.

### L'enveloppe : Tauri, sous réserve du banc d'essai

Tauri ouvre une fenêtre qui utilise le moteur web du système (WebKitGTK sous Ubuntu) au lieu
d'embarquer Chromium : c'est ce qui le rend léger. Le risque, c'est la fluidité de ce moteur,
surtout sur le mini PC. Le banc d'essai de l'étape 0 la mesure avant d'écrire l'application.

| Enveloppe | Statut | Raison |
| --- | --- | --- |
| Tauri (WebKitGTK) | proposée pour démarrer l'étape 1 ; passe le banc du poste principal avec la règle 11 | la plus légère, Rust natif à côté de l'interface ; marge faible sur le dessin (8,7 ms par page contre 1,0 dans Chrome), vidéo H.264 lue au ralenti |
| Electron (Chromium embarqué) | repli, décision définitive après le banc du mini PC et avant l'étape 4 | moteur de Chrome sur les deux postes, environ 8 fois plus de marge sur le dessin, H.264 normale ; mais 123 Mo d'archive pour Electron seul et plus de mémoire ; le noyau Rust resterait natif (module Node écrit en Rust, napi-rs) |
| Application web installée dans Chrome | écartée le 2026-10-14 | demande un hébergement ou un serveur local ; Alexandre veut une application locale |
| Application 100 % Rust (iced, Slint, egui) | écartée sauf échec des deux premières | toute l'interface Canva serait à construire avec des outils moins mûrs : des mois de travail |

### Ce que Eliot reprend de Canva

Canva est facile parce que chaque action courante est visible et se fait en un geste. Eliot
reprend ces gestes et cette disposition, avec ses propres couleurs et sans le logo ni les
polices de Canva.

- **Le rail d'onglets à gauche** (Textes, Formes, Images, puis Calques), avec un panneau qui
  s'ouvre à côté. Un clic pose l'objet au centre de la page ; on peut aussi le glisser à
  l'endroit voulu (étape 2).
- **La barre d'outils contextuelle** au-dessus de la page, qui change selon la sélection :
  police, taille, couleur, gras, italique, alignement pour un texte ; couleur et arrondi pour
  une forme ; retourner et transparence pour une image.
- **La mini-barre flottante** juste au-dessus de l'objet sélectionné : dupliquer, supprimer,
  et un bouton « plus » qui ouvre le menu de l'objet. Le même menu sort au clic droit.
- **Les poignées** rondes aux coins, en pilule sur les côtés, et la poignée de rotation sous
  l'objet. Pendant le geste, une étiquette affiche la taille ou l'angle.
- **Les repères magnétiques** : en déplaçant un objet, des lignes roses apparaissent et
  l'objet s'aimante au centre et aux bords de la page et des autres objets. C'est ce qui donne
  l'impression que « tout s'aligne tout seul ».
- **L'édition du texte en place** : double-clic, on tape directement sur la page.
- **Coller une image** depuis le presse-papiers (une capture d'écran, par exemple) et
  **déposer un fichier** depuis le gestionnaire de fichiers (étape 2).
- **La barre du bas** : zoom par curseur et « Ajuster à l'écran ».
- **L'accueil** : créer un design en choisissant un format, rouvrir un design récent
  (étape 2, avec les projets).
- Les raccourcis clavier usuels : Ctrl+Z, Ctrl+Y, Ctrl+C, Ctrl+V, Ctrl+D, Suppr, flèches.

### Ce que demandent la publicité et les maquettes de produits

| Besoin | Où il se fait | Étape |
| --- | --- | --- |
| Formats prêts à l'emploi (réseaux sociaux, bannières, A4) et décliner un visuel dans un autre format | interface | 2 |
| Kit de marque : couleurs, polices et logos réutilisables d'un design à l'autre | interface + fichiers du noyau | 2 |
| Effets de texte : ombre, contour, surlignage | Konva | 2 |
| Image dans un cadre ou une forme (photo dans un cercle, capture dans un écran de téléphone) | Konva (découpe) | 2 |
| Réglages d'image : luminosité, contraste, saturation, flou | noyau Rust (les filtres de Konva tournent en JavaScript, pixel par pixel, trop lents sur une photo) | 2 |
| Ombres portées sous un produit | Konva | 2 |
| Modèles maison : enregistrer un design comme point de départ | noyau Rust (projets) | 2 |
| Détourage : retirer le fond d'une photo de produit | noyau Rust avec un modèle d'IA local ; modèle et licence à choisir et vérifier | 3 |
| Perspective : poser un visuel sur une boîte, un écran incliné, une affiche en biais | noyau Rust (Konva ne sait faire que des transformations sans perspective) | 3 |
| Export haute définition et PDF vectoriel | noyau Rust | 3 |
| Vidéo : animations, durée, export MP4 | noyau Rust (rendu image par image, encodage par le programme `ffmpeg` du système, appelé sans être embarqué) ; à l'import, le Rust fabrique une copie légère de chaque vidéo pour l'aperçu pendant l'édition, l'export repart de l'original | 4 |

Le modèle de document décrit une page à un instant donné ; pour la vidéo, il suffirait de lui
ajouter le temps (apparitions, mouvements) et de faire rendre chaque image par le noyau Rust.
C'est une raison de plus de garder le document comme seule vérité dès l'étape 1.

### Catalogue des fonctions de la version 1

Décision du 2026-10-14 : un maximum de fonctions dès le départ. Tout ce qui suit est dans le
périmètre ; les étapes du § 7 ne fixent que l'ordre de construction. Pour que l'outil reste
simple malgré tout, chaque fonction n'apparaît que là où elle sert : les réglages d'un texte
quand un texte est sélectionné, ceux d'une vidéo quand c'est une vidéo.

- **Page et formats** : formats prêts à l'emploi (carré, portrait, story, paysage, bannière,
  miniature vidéo, A4, A5), taille libre, fond uni, dégradé ou image, décliner un design dans
  un autre format, plusieurs pages, règles, grille, marges de sécurité.
- **Éléments** : textes (titre, sous-titre, paragraphe, listes), formes (rectangle, arrondi,
  cercle, triangle, étoile, polygone, ligne, flèche), icônes libres embarquées, images,
  vidéos, cadres (une image dans une forme), QR code.
- **Texte** : polices libres embarquées, taille, gras, italique, souligné, barré, majuscules,
  alignement, interlignage, espacement des lettres, couleur, ombre, contour, surlignage, texte
  courbé, styles enregistrés.
- **Couleur** : sélecteur, pipette, couleurs déjà utilisées dans le document, kit de marque,
  dégradés linéaires et radiaux, transparence.
- **Image** : recadrer, retourner, coins arrondis, bordure, ombre, réglages (luminosité,
  contraste, saturation, température, flou, netteté) et filtres calculés par le Rust,
  détourage local, perspective, remplacer une image en gardant sa place.
- **Organisation** : panneau des calques (ordre, visibilité, verrou, nom), grouper et
  dégrouper, aligner et répartir, repères magnétiques, copier le style d'un objet vers un
  autre, dupliquer, copier-coller entre designs.
- **Vidéo** : importer une vidéo, couper le début et la fin, durée de chaque page, animations
  d'entrée et de sortie par élément (fondu, glissement, zoom, rebond), transitions entre
  pages, musique avec volume et fondu, aperçu en lecture, export MP4 et GIF.
- **Projets** : accueil, designs récents, enregistrement automatique, annuler et rétablir,
  modèles maison, projet en dossier autonome, import et export d'un projet.
- **Export** : PNG (fond transparent possible), JPEG, WebP, PDF vectoriel, SVG, MP4, GIF ;
  résolution, qualité, pages choisies, dossier par défaut.
- **Aides pour apprendre** : infobulle sur chaque outil, grille des tiers, zones sûres des
  formats story (là où l'application qui affiche la story pose ses boutons), alerte de
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
    ├── package.json  index.html  vite.config.ts  tsconfig.json
    ├── src/                         interface : React + TypeScript
    │   ├── main.tsx                 point d'entrée
    │   ├── styles.css               Tailwind, couleurs de Eliot
    │   ├── polices/                 polices libres embarquées (fichiers woff2)
    │   ├── modele/                  types du document, fabriques d'éléments
    │   ├── etat/                    store : document, sélection, historique, actions
    │   ├── editeur/
    │   │   ├── Editeur.tsx          composant principal, assemble les zones
    │   │   ├── BarreHaut.tsx        titre, annuler, rétablir, exporter
    │   │   ├── BarreContexte.tsx    outils de l'objet sélectionné
    │   │   ├── BarreLaterale.tsx    rail d'onglets + panneau
    │   │   ├── panneaux/            PanneauTextes, PanneauFormes, PanneauImages
    │   │   ├── ZoneDeTravail.tsx    scène Konva : page, éléments, sélection, poignées
    │   │   ├── RenduElement.tsx     un élément du document vers un nœud Konva
    │   │   ├── Reperes.ts           calcul des repères magnétiques
    │   │   ├── MiniBarre.tsx        mini-barre flottante et menu clic droit
    │   │   ├── EditeurTexte.tsx     saisie du texte en place
    │   │   ├── BarreBas.tsx         zoom
    │   │   └── raccourcis.ts        clavier
    │   └── pont/                    appels au Rust (une fonction par commande)
    ├── noyau/                       bibliothèque Rust, sans Tauri
    │   ├── Cargo.toml
    │   └── src/  images.rs  projet.rs  export.rs  fichiers.rs
    └── src-tauri/                   l'enveloppe : expose le noyau à l'interface
        ├── Cargo.toml  tauri.conf.json  build.rs
        ├── capabilities/default.json    droits de la fenêtre
        ├── icons/
        └── src/  main.rs  lib.rs  commandes.rs
```

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

Étape 3 : le Rust rend lui-même la page depuis le document, avec les images originales et les
mêmes fichiers de police : PDF vectoriel (`svg2pdf`) et PNG haute définition (`resvg`), pour
les grands formats comme l'A4 à 300 dpi. Point à surveiller : le texte doit tomber au même
endroit qu'à l'écran. L'interface transmet donc ses coupures de lignes, et on compare les
deux rendus pixel par pixel avant de s'y fier.

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
il sera disponible ; il décide entre Tauri et Electron avant l'étape 4.

Étape 1, l'éditeur : interface Canva décrite au § 6, sélection, poignées, repères
magnétiques, édition du texte, historique, ordre d'empilement, dupliquer, supprimer, import
d'image par le noyau Rust, export PNG et JPEG, polices embarquées.

Étape 2, les projets et la publicité : accueil (formats, designs récents), enregistrement
automatique, ouverture, modèles maison, kit de marque, effets de texte, cadres et formes
d'image, réglages d'image par le Rust, collage d'image, dépôt de fichiers, glisser depuis le
panneau, zoom.

Étape 3, le Rust qui rend : export depuis le document avec les originaux (PDF vectoriel, PNG
haute définition), perspective, détourage local.

Étape 4, la vidéo : durée, animations, transitions, musique, export MP4 et GIF.

Étape 5 : le reste du catalogue (plusieurs pages, panneau des calques complet, recadrage,
aides pour apprendre, QR code, export WebP et SVG).

## 8. Hors périmètre

Hébergement et services en ligne, comptes, mises à jour automatiques par internet. Banque
d'images en ligne et modèles fournis par un tiers (les modèles maison, eux, sont dedans),
génération d'images par IA, collaboration, mobile. Windows et macOS : le code reste portable,
mais rien n'y sera testé.

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
  PC avant l'étape 4.
- BRIEF validé, propositions par défaut retenues (« tout par défaut ») : page de 1080 × 1080
  par défaut, export dans `~/Images/Eliot/` avec nom daté, dépôt git local seulement,
  commandes d'installation données par Claude et lancées par Alexandre, régime du § 9,
  aucune licence tant que la question de l'open source n'est pas tranchée (tous droits
  réservés). Identité des commits : `Alexandre Do <adresse retirée avant la publication>`, celle de ses
  autres dépôts (choisie par Claude au titre du « par défaut », à changer s'il le souhaite).

Ouvertes, avec la proposition de Claude :

- Q1. Le mini PC : modèle, système, processeur, carte graphique, définition de l'écran
  (quand il sera disponible).
- Q2. Open source : licence permissive (MIT ou Apache-2.0, chacun peut réutiliser le code,
  même dans un produit fermé) ou copyleft (GPL-3.0, toute version modifiée et distribuée doit
  rester ouverte) ? Sur quel compte GitHub ? Proposition : trancher avant la première
  publication ; d'ici là, tous droits réservés.

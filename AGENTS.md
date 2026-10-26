# AGENTS.md — Eliot

Point d'entrée de tout agent qui reprend ce dépôt (OpenCode, Claude Code ou autre). Version du
2026-10-26. Il est court exprès : les gros fichiers du dépôt se lisent par morceaux (voir « Où
lire »). Tout ce qu'il faut savoir est dans les fichiers, pas dans une mémoire de conversation :
le travail jusqu'ici a été fait avec Claude, tu reprends là où il s'est arrêté.

## Ce qu'est Eliot

Un éditeur graphique de bureau pour Linux, local et libre (MIT), à l'interface proche de Canva,
pour apprendre la création publicitaire en photos, en vidéos et en 3D : éditeur à la souris,
bibliothèque d'éléments, vidéo façon CapCut, labo photo façon Lightroom, studio 3D, exports.
Tauri pour la fenêtre, React et Konva pour l'interface et le dessin, un noyau Rust natif pour le
travail lourd, three.js pour la 3D, et un pont MCP (`eliot-mcp`, 80 outils) pour piloter Eliot
avec une IA. Mainteneur : Alexandre Do. Dépôt public :
https://github.com/blueberrylabs-dev/eliot. Tout est en français.

## Où on en est (2026-10-26)

- Le produit est fini : les sept étapes du `BRIEF.md` sont livrées et vérifiées (14 au 17
  octobre 2026).
- La version 0.9.0 est publiée (release `v0.9.0` : paquet `.deb` et `SHA256SUMS`). Une version
  publiée ne se modifie jamais sur place : une correction sort en 0.9.1 ou en 1.0.0.
- La suite, dans l'ordre : 1) les essais d'Alexandre, tous ensemble, sur son poste (parcours dans
  `01_application/LISEZMOI.md`) ; 2) les corrections qu'ils révèlent, puis la version suivante
  (commande 26 de `CLAUDE.md`) ; 3) le mini PC (banc d'essai, puis paquet) ; 4) la clé Pexels
  (`PEXELS_API_KEY`, absente du `.env` : Pexels suspendait les nouvelles clés le 2026-10-17).
- Des pistes évoquées mais non décidées sont à la fin de `PLAN.md` (« Pistes évoquées après la
  0.9.0 »). Aucun code pour elles sans cadrage écrit et accord d'Alexandre.
- N'ouvre pas de chantier de ton chef : propose-le avec ton point de vue et attends son accord.

## Jamais sans l'accord explicite d'Alexandre, écrit dans la conversation

- `git push`, toute publication (version GitHub, site, post) et tout `gh` : un silence n'est pas
  un oui. Un commit local, lui, est permis sans demander.
- Supprimer un fichier ou un dossier, sorties générées comprises (`target/`, `dist/`,
  `node_modules/`, `paquets/`, `telechargements/`) : demande, même pour nettoyer ce que tu as créé.
- Créer, modifier ou arrêter une minuterie systemd, un cron, un service.
- Modifier `BRIEF.md` (validé : toute modification passe par une entrée du `JOURNAL.md` et son
  accord), `LICENSE`, ou une version déjà publiée.
- **Lancer Eliot ou le banc d'essai** (règle 9 du BRIEF) : ni toi, ni un script. Il les lance à la
  main quand sa carte graphique est libre. Donc jamais `npm run tauri dev` ni `eliot`.
- **Lire, afficher ou committer le `.env`** (clés d'API, hors git). Le Rust le lit lui-même.

`opencode.json` met ces actions en « demande » ou en « refus ». Si une demande te bloque,
demande à Alexandre : ne la contourne pas par une autre commande.

## Toujours

- **Commits** : en français, une ligne, au fait (« Étape 7, lot 3 : les aides pour apprendre »,
  « Corriger la miniature du design quitté »). L'identité des commits est déjà réglée dans le
  dépôt (adresse noreply de GitHub) : ne la change pas.
- **Publiable à tout moment** (règle 10 du BRIEF) : rien dans le dépôt qui ne puisse devenir
  public. Ni secret, ni fichier sous licence fermée, ni donnée personnelle ; fichiers de test
  synthétiques ; seul nom cité : Alexandre Do. Dans le README, le CHANGELOG et les notes de
  version, rien sur l'auteur au-delà de son nom.
- **Tests** : ne relance que ce qui a changé ; au premier plan, jamais en arrière-plan ; dis le
  résultat réel. Pas de suite complète à chaque commit : les gros tests avant un push ou en fin
  de lot. Ne dis pas « vérifié » sans l'avoir vérifié ; si tu n'as pas pu lancer quelque chose
  (pas de `cargo`, pas de réseau), dis-le.
- **Concevoir avant de coder.** Aller trop vite puis tout revoir est l'erreur coûteuse de ce
  projet. Ce qui engage (une fonction, le socle, le format du document) : cadrage écrit dans
  `PLAN.md` ou `BRIEF.md` et accord avant le premier code. Pour une décision de conception,
  donne ton point de vue argumenté ou une maquette concrète, pas une question à choix posée sans
  réflexion.
- **Les commandes que tu lui donnes** sont complètes, copiables telles quelles, avec le chemin
  absolu : `cd /home/nushoko/Bureau/Logiciels/Eliot/01_application && npm test`, jamais « va
  dans le dossier puis… ». Dis comment vérifier le résultat et comment revenir en arrière.
- **Français partout** : identifiants métier, commentaires, messages visibles, commits. Noms de
  fichiers sans accents ni espaces, sauf ce que les outils imposent (`package.json`, `src-tauri/`).
- **Fin de session** : coche `PLAN.md`, ajoute en haut du `JOURNAL.md` une entrée datée (décision,
  par qui, preuve), mets à jour l'« État » de `CLAUDE.md` si l'état change. Une information a un
  seul domicile : ne la recopie pas ailleurs, renvoie vers elle.

## Les règles d'architecture (BRIEF § 5, lis le texte avant de toucher au socle)

1. Le document JSON est la seule vérité ; Konva dessine, sans état propre sauf pendant un geste.
2. Une seule porte d'écriture : les actions du store, qui alimentent l'historique.
3. Konva pendant le geste, le store à la fin (une écriture, une entrée d'historique).
4. Le travail lourd va au Rust natif (`noyau/`) ; l'interface ne fait que l'interface.
5. L'interface ne touche jamais une image en pleine résolution : elle affiche un aperçu préparé
   par le Rust ; l'original ne sert qu'à l'export.
6. Une image entre par référence : le document porte son empreinte SHA-256, jamais l'image.
7. L'export ne dépend pas de l'écran : il se calcule depuis la page à sa taille native.
8. Le Rust vérifie ce qu'il écrit (extension, premiers octets, écriture atomique, jamais
   d'écrasement silencieux).
11. Pendant un geste, seul ce qui bouge est redessiné (calque à part) : 45 images/s sans cette
    règle dans Tauri, 62 avec.
12. Hors ligne par défaut. Seules sortent sur le réseau les recherches de photos, vidéos, sons et
    modèles 3D libres, quand Alexandre les lance, appelées par le Rust ; les clés restent hors git.
13. Une retouche ne touche jamais l'original : ce sont des valeurs du document, remises à zéro
    au besoin.

(Les règles 9 et 10 sont plus haut.)

## Commandes

Elles se tapent dans un terminal du poste principal. Les numéros renvoient à `CLAUDE.md`, qui
garde la liste complète (1 à 26) avec les vérifications et les retours en arrière.

Tests du noyau Rust (relevé du 2026-10-17 : `146 passed; 0 failed; 2 ignored`) :

```
cd /home/nushoko/Bureau/Logiciels/Eliot/01_application/noyau && cargo test -j 4
```

Tests de l'interface (relevé du 2026-10-17 : `306 passed`) :

```
cd /home/nushoko/Bureau/Logiciels/Eliot/01_application && npm test
```

Types et construction de l'interface (`tsc && vite build`) :

```
cd /home/nushoko/Bureau/Logiciels/Eliot/01_application && npm run build
```

Compiler l'application sans l'ouvrir (commande 9) :

```
cd /home/nushoko/Bureau/Logiciels/Eliot/01_application/src-tauri && cargo build -j 4
```

Compiler le pont `eliot-mcp` (commande 13) :

```
cd /home/nushoko/Bureau/Logiciels/Eliot/01_application && npm run pont
```

Fabriquer la bibliothèque : icônes, emojis, polices, personnages, modèles 3D (commande 8 bis) :

```
cd /home/nushoko/Bureau/Logiciels/Eliot/01_application && npm run bibliotheque
```

Réservé à Alexandre : lancer Eliot (commande 10), installer (commande 22, demande son mot de
passe), construire le paquet (commande 23), pousser (commande 25), publier (commande 26).

Après un changement : `package.json` → `npm install` (commande 8) ; la bibliothèque →
`npm run bibliotheque` ; le pont (`src/ia/outils.json`, `src-tauri/src/ia.rs`, `eliot-mcp/`) →
commande 13, puis 15 bis si l'extension sert.

## Où est quoi

```
Eliot/
├── AGENTS.md  CLAUDE.md  BRIEF.md  PLAN.md  JOURNAL.md   pilotage (voir « Où lire »)
├── README.md  CHANGELOG.md  LICENSE                      la page publique, les versions, MIT
├── opencode.json                                         les permissions d'OpenCode
├── 00_banc_essai/      étape 0 : mesure de fluidité, jetable (son LISEZMOI.md)
├── 01_application/
│   ├── noyau/          Rust sans Tauri : images, vidéos, sons, voix, Whisper, exports, 3D…
│   ├── src-tauri/      la fenêtre ; commandes.rs (commandes de l'interface), ia.rs (pont IA)
│   ├── eliot-mcp/      le programme MCP qui pilote Eliot (80 outils, src/ia/outils.json)
│   ├── src/            l'interface React : modele/ (le document), etat/ (le store), editeur/,
│   │                   labo/, trois/ (3D), export/, bibliotheque/, ia/, pont/ (seul fichier
│   │                   qui parle à Tauri), accueil/, modeles/, reglages/
│   ├── outils/         fabrication de la bibliothèque, conversion du modèle de détourage
│   └── paquet.sh  installer.sh  requirements.txt  paquets/   le paquet .deb (paquets/ hors git)
└── telechargements/    archives, voix et modèles posés à la main, hors git
```

Le détail du code : « Plan du code » dans `01_application/LISEZMOI.md`.

## Où lire (sans tout charger)

Ne lis jamais ces fichiers en entier : cherche, puis lis le morceau.

| Fichier | Taille | Ce qu'il contient | Comment le lire |
| --- | --- | --- | --- |
| `JOURNAL.md` | ~2 600 lignes | décisions datées, la plus récente en haut | `sed -n '1,80p' JOURNAL.md`, puis `grep -n '^## ' JOURNAL.md` |
| `PLAN.md` | ~800 lignes | avancement par étape (0 à 8) et par lot, cases à cocher | `grep -n '^## ' PLAN.md`, puis `sed -n 'a,bp'` |
| `BRIEF.md` | ~930 lignes | cadrage validé ; § 5 règles, § 6 architecture, § 7 ordre | `grep -n '^## \|^### ' BRIEF.md`, puis `sed -n 'a,bp'` |
| `CLAUDE.md` | ~660 lignes | état détaillé lot par lot, commandes 1 à 26 | `grep -n '^\*\*[0-9]' CLAUDE.md` |
| `01_application/LISEZMOI.md` | ~1 300 lignes | ce que fait l'appli, parcours d'essai, où vont les fichiers | `grep -n '^## '` |

## Pièges connus

- Les messages d'erreur du code (une quarantaine) renvoient à « commande N du `CLAUDE.md` » : ne
  renomme pas ce fichier et ne renumérote pas ses commandes sans changer ces messages et leurs tests.
- Il faut Node 20.19 ou plus et Rust 1.92 ou plus (`krilla`, l'export PDF) : sinon `rustup update`.
  `-j 4` laisse de la marge au poste d'Alexandre. Les dossiers `target/` pèsent des dizaines de Go :
  pas de `cargo clean` sans lui demander.
- Le pont enregistré dans l'application Claude de bureau peut être une ancienne compilation : le
  dépôt compte 80 outils ; si on en voit une vingtaine, c'est l'ancien pont (commande 13, puis 15 bis,
  ou le `/usr/bin/eliot-mcp` de la version installée).
- Dans la fenêtre, une seule balise vidéo par fichier. Une vidéo qui joue vit sur son propre calque.
- La version installée lit ses clés dans `~/.config/fr.alexandredo.eliot/cles.env` et ses modèles
  dans `~/.local/share/fr.alexandredo.eliot/` ; sur le poste d'Alexandre, `installer.sh` les relie
  au `.env` et à `telechargements/` par des liens.
- Fenêtre blanche ou qui scintille (pilote NVIDIA) : commande 7 de `CLAUDE.md`. C'est à lui de
  lancer.
- Vitest garde son cache dans `node_modules/.vitest-cache` et doit pouvoir l'effacer : dans un
  environnement où la suppression est interdite, `npm test` s'arrête au démarrage (constaté le
  2026-10-26).

# CLAUDE.md — Eliot

Point d'entrée pour reprendre le projet sans contexte. Version du 2026-10-14 (fin de journée).
Règles communes à tous mes projets : `/home/nushoko/Bureau/Projets/00_moi/CONVENTIONS.md`,
`/home/nushoko/Bureau/Projets/00_moi/AUTONOMIE.md`. Qui je suis :
`/home/nushoko/Bureau/Projets/00_moi/IDENTITE.md`.

## Ce qu'est ce projet

Eliot (« toile » à l'envers) est un éditeur graphique de bureau, local, à l'interface proche
de Canva, pour apprendre la création publicitaire en photos et en vidéos. Tauri pour la
fenêtre, React et Konva pour l'interface et le dessin, un noyau Rust natif pour le travail
lourd. Détail : `BRIEF.md`.

## État au 2026-10-14

- `BRIEF.md` : révision 7, **validée par Alexandre le 2026-10-14** : bibliothèque, Pixabay
  puis Pexels, modèles de départ, création de contenu pour YouTube, TikTok et Instagram, vidéo
  façon CapCut (étape 4), labo photo façon Lightroom (étape 5), pont vers une IA.
- Secrets : `.env` à la racine du dépôt, hors git (`PIXABAY_API_KEY`). Ne jamais le lire ni le
  committer ; le Rust le lit lui-même.
- Étape 0, banc d'essai : passé sur le poste principal le 2026-10-14, dans la fenêtre Tauri
  et dans le navigateur intégré de Claude (résultats dans `00_banc_essai/resultats/`, lecture
  au JOURNAL). Tauri tient 60 images/s à condition d'appliquer la règle 11 du BRIEF. Reste :
  le mini PC.
- Enveloppe : Tauri (décision du 2026-10-14), Electron en repli.
- Étape 1, l'éditeur : `01_application/`, livrée et essayée sur le poste le 2026-10-14.
- Étape 2, les projets et l'édition complète : ouverte le 2026-10-14 (`PLAN.md`).

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
`ffmpeg`, qui sert à fabriquer les vidéos de test (étape 4 bis) et plus tard l'export MP4.

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

Vérifier : aucune ligne ne commence par `npm error`.

**9. Compiler l'application sans l'ouvrir.** Processeur seulement, limité à 4 cœurs ; la
première fois, plusieurs minutes et quelques Go dans `01_application/src-tauri/target/`.

```
cd /home/nushoko/Bureau/Logiciels/Eliot/01_application/src-tauri && cargo build -j 4
```

Vérifier : la dernière ligne commence par `Finished`.

**10. Lancer Eliot, carte graphique libre** :

```
cd /home/nushoko/Bureau/Logiciels/Eliot/01_application && npm run tauri dev
```

Arrêter : fermer la fenêtre ou `Ctrl+C` dans le terminal. Fermer efface la page tant que
l'enregistrement du projet n'existe pas (étape 2) : exporter d'abord. Si la fenêtre reste
blanche ou scintille, mêmes variables qu'à la commande 7, placées devant `npm run tauri dev`.

**11. Tests du noyau Rust** (processeur seulement, sans fenêtre) :

```
cd /home/nushoko/Bureau/Logiciels/Eliot/01_application/noyau && cargo test -j 4
```

Vérifier : `test result: ok. 13 passed`.

## Arborescence

```
Eliot/
├── CLAUDE.md  BRIEF.md  PLAN.md  JOURNAL.md  .gitignore
├── 00_banc_essai/      étape 0 : mesure de fluidité, jetable (voir son LISEZMOI.md)
└── 01_application/     Eliot lui-même (voir son LISEZMOI.md)
```

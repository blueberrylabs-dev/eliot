# Eliot

**Un éditeur graphique de bureau, local, à l'interface proche de Canva, pour apprendre la
création publicitaire en photos et en vidéos.** Posts, stories, miniatures, affiches, petits
films pour les réseaux sociaux : on compose à la souris, on retouche les photos comme dans
Lightroom, on monte les vidéos comme dans CapCut, on pose des objets 3D. Tout tourne sur ton
ordinateur ; le travail lourd est fait par un noyau en Rust.

Linux (testé sur Ubuntu 24.04, processeur x86-64). Interface en français.

> **État : 0.9.0**, la première version complète, en cours d'essai par son auteur avant la
> 1.0. Voir [`CHANGELOG.md`](CHANGELOG.md) et la page des versions publiées du dépôt.

## Ce qu'il sait faire

- **Composer** : formats prêts pour TikTok, Reels, Shorts, Instagram, YouTube, bannières, A4
  et A5 ; textes (95 polices libres, associations de polices, effets, texte courbé, listes,
  styles gardés d'un design à l'autre) ; formes, icônes (Tabler, Phosphor), emojis (Fluent,
  OpenMoji), personnages composables (Open Peeps, Humaaans), cadres et grilles photo,
  maquettes de téléphone, d'ordinateur, de tablette et de montre, graphiques, tableaux, QR
  codes, dessin à main levée ; 42 modèles de départ ; kit de marque (couleurs, polices, logos,
  jingles) ; repères magnétiques, calques, groupes, plusieurs pages, Redimensionner.
- **Photos** : photos et vidéos libres de Pixabay et de Pexels, avec le crédit de leur auteur ;
  un labo façon Lightroom (lumière, couleur, courbe, préréglages, grain, flou), recadrer et
  redresser, poser un visuel en perspective, retirer le fond d'une photo avec un modèle d'IA
  local (BiRefNet), photo en fond de page, pipette.
- **Vidéo** : une frise à pistes, couper, scinder, vitesse, entrées et sorties animées, images
  clés, transitions ; la musique qui baisse sous la voix, des bruitages (Freesound), ta voix au
  micro et nettoyée, ou une voix de synthèse (Piper) ; les blancs et les « euh » coupés,
  des sous-titres mot par mot (Whisper) ; export MP4 réglé par plateforme, GIF.
- **3D** : objets glTF, GLB, FBX et OBJ tournés à la souris, éclairage HDRI, ombre au sol,
  matières recolorables, plateau tournant, caméra par images clés, animations Mixamo ; banques
  Poly Haven, Kenney et Sketchfab (licences CC0 et CC BY seulement, crédits gardés).
- **Apprendre le métier** : règles, grille, grille des tiers, marges de sécurité, zones sûres
  des formats verticaux, alertes quand un texte se lit mal sur son fond ou est trop petit
  pour le format, avec la correction proposée ; une infobulle sur chaque outil.
- **Exporter** : PNG (fond transparent possible), JPEG, WebP, PDF vectoriel aux textes
  sélectionnables, SVG, MP4, GIF, rendus depuis les originaux ; les crédits à recopier sous
  la publication.
- **Piloter Eliot avec une IA** : un pont MCP (`eliot-mcp`, 80 outils) laisse une IA comme
  Claude composer, retoucher, monter et exporter dans la fenêtre ouverte, sous tes yeux ;
  chacune de ses actions se défait par Ctrl+Z.

## Principes

- **Local.** Rien ne part sur internet, sauf les recherches que tu lances dans les banques de
  photos, de sons et de modèles 3D, et les échanges avec une IA si tu la branches. Pas de
  compte, pas de mise à jour automatique.
- **Une retouche ne touche jamais l'original** : réglages, recadrage, détourage, coupes sont
  des valeurs du design ; l'export repart des originaux.
- **Un design est un dossier** (`~/Documents/Eliot/Designs/<nom>/`), avec ses images et ses
  polices : il se copie tel quel sur une autre machine.
- **Le calcul lourd en Rust, sur le processeur** ; la carte graphique sert à l'affichage.

## Installer

### Avec le paquet .deb

Télécharge `Eliot_0.9.0_amd64.deb` et `SHA256SUMS` depuis la page des versions publiées du
dépôt, vérifie l'empreinte, puis installe-le ; apt installe aussi ce dont Eliot a besoin
(moteur web, ffmpeg, GStreamer) :

```
sha256sum -c SHA256SUMS && sudo apt install ./Eliot_0.9.0_amd64.deb
```

Eliot arrive dans le menu des applications. Désinstaller : `sudo apt remove eliot` (tes
designs restent dans `~/Documents/Eliot`).

### Depuis les sources

Il faut Node 20.19 ou plus, Rust 1.92 ou plus, et les bibliothèques de développement de
Tauri :

```
sudo apt install -y libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev gstreamer1.0-libav gstreamer1.0-plugins-good gstreamer1.0-plugins-bad ffmpeg
```

Puis, depuis le dossier du dépôt cloné :

```
cd 01_application && ./installer.sh
```

`installer.sh` construit le paquet (`paquet.sh` : bibliothèque, interface, noyau et pont,
plusieurs minutes la première fois), l'installe avec apt, puis relie la version installée aux
clés et aux modèles rangés dans le dépôt (`.env`, `telechargements/`). Les personnages
viennent des archives d'[Open Peeps](https://www.openpeeps.com) et de
[Humaaans](https://www.humaaans.com), et les modèles 3D de [Kenney](https://kenney.nl) de ses
paquets .zip, à ranger dans `telechargements/` avant ; sans eux, Eliot s'installe sans
personnages ni modèles Kenney.

## Les modules facultatifs

Eliot fonctionne sans eux ; chacun ajoute une fonction. La version installée lit ses clés
dans `~/.config/fr.alexandredo.eliot/cles.env` et ses modèles dans
`~/.local/share/fr.alexandredo.eliot/`.

| Fonction | Ce qu'il faut |
|---|---|
| Photos et vidéos de Pixabay | une clé gratuite, `PIXABAY_API_KEY=…` dans `cles.env` |
| Photos et vidéos de Pexels | une clé gratuite, `PEXELS_API_KEY=…` |
| Bruitages et musiques de Freesound | une clé gratuite, `FREESOUND_API_KEY=…` |
| Modèles 3D de Sketchfab | une clé d'API, `SKETCHFAB_API_KEY=…` |
| Voix de synthèse | Piper et une voix française, ci-dessous |
| Sous-titres et hésitations | Whisper et son modèle, ci-dessous |
| Détourage | l'environnement Python et le modèle BiRefNet, ci-dessous |

Voix de synthèse : [Piper](https://github.com/rhasspy/piper) (environ 170 Mo), puis une voix
française (siwis, CC BY 4.0) :

```
uv tool install piper-tts==1.8.0
```

```
d=~/.local/share/fr.alexandredo.eliot/voix/fr_FR-siwis-medium; mkdir -p $d && for f in fr_FR-siwis-medium.onnx fr_FR-siwis-medium.onnx.json MODEL_CARD; do wget -nc -P $d "https://huggingface.co/rhasspy/piper-voices/resolve/main/fr/fr_FR/siwis/medium/$f"; done
```

Sous-titres : [whisper-ctranslate2](https://github.com/Softcatala/whisper-ctranslate2)
(environ 400 Mo), puis le modèle `faster-whisper-small` (485 Mo, licence MIT) :

```
uv tool install whisper-ctranslate2==0.5.7 --with ctranslate2==4.8.2 --with faster-whisper==1.2.1 --with av==18.1.0
```

```
d=~/.local/share/fr.alexandredo.eliot/whisper/faster-whisper-small; mkdir -p $d && for f in README.md config.json model.bin tokenizer.json vocabulary.txt; do wget -nc -P $d "https://huggingface.co/Systran/faster-whisper-small/resolve/536b0662742c02347bc0e980a01041f333bce120/$f"; done
```

Détourage : l'environnement Python fixé par [`01_application/requirements.txt`](01_application/requirements.txt),
puis le modèle [BiRefNet](https://github.com/ZhengPeng7/BiRefNet) (licence MIT), converti une
fois par `01_application/outils/convertir_birefnet.py` (environ quatre minutes, 894 Mo ;
commande complète dans [`CLAUDE.md`](CLAUDE.md), commande 21, avec `--sortie` vers le dossier
ci-dessous) :

```
uv venv ~/.local/share/fr.alexandredo.eliot/detourage/env --python 3.12 && uv pip install --python ~/.local/share/fr.alexandredo.eliot/detourage/env -r 01_application/requirements.txt
```

Tout tourne sur le processeur, jamais sur la carte graphique.

## Piloter Eliot avec une IA

Dans Eliot : Fichier, « Réglages et pont IA… », l'interrupteur du pont. Puis déclarer le pont à
ton client MCP, par exemple dans le fichier de configuration de l'application Claude de
bureau :

```
{ "mcpServers": { "eliot": { "command": "/usr/bin/eliot-mcp" } } }
```

ou, avec Claude Code :

```
claude mcp add eliot -- /usr/bin/eliot-mcp
```

Le pont ne lance jamais Eliot et ne parle qu'à la fenêtre ouverte sur ce poste, par un fichier
de communication local (aucun port réseau). Le design et ses captures partent chez le
fournisseur de l'IA pendant l'échange.

## Où vont les fichiers

- Designs : `~/Documents/Eliot/Designs/`, modèles maison : `~/Documents/Eliot/Modèles/`.
- Exports : `~/Images/Eliot/` (images, PDF, SVG) et `~/Vidéos/Eliot/` (MP4, GIF), jamais
  d'écrasement.
- Clés : `~/.config/fr.alexandredo.eliot/cles.env` ; modèles : `~/.local/share/fr.alexandredo.eliot/` ;
  caches des banques (24 h) : `~/.cache/fr.alexandredo.eliot/`.

## Développer

```
cd 01_application && npm install && npm run bibliotheque && npm run tauri dev
```

Tests : `npm test` (interface) et `cargo test` dans `01_application/noyau/` (noyau).
Le dépôt :

```
├── 00_banc_essai/      le banc de mesure du départ (fluidité de Tauri, aperçus vidéo)
├── 01_application/     Eliot : src/ (interface React et Konva), noyau/ (Rust), src-tauri/
│                       (la fenêtre), eliot-mcp/ (le pont), outils/ (bibliothèque, modèles)
└── BRIEF.md  PLAN.md  JOURNAL.md  CLAUDE.md   les notes de travail de l'auteur
```

Le code, ses noms et ses commentaires sont en français, comme les notes de travail :
`BRIEF.md` (le cadrage), `PLAN.md` (l'avancement), `JOURNAL.md` (les décisions, avec leurs
preuves). `01_application/LISEZMOI.md` détaille chaque fonction et les parcours d'essai.

## Licence

Code sous licence MIT : voir [`LICENSE`](LICENSE). Les éléments tiers embarqués gardent leur
licence, listés dans [`01_application/LICENCES-TIERS.md`](01_application/LICENCES-TIERS.md) :
icônes Tabler et Phosphor (MIT), emojis Fluent (MIT) et OpenMoji (CC BY-SA 4.0), polices de
Google Fonts (OFL), personnages Open Peeps et Humaaans, modèles Kenney (CC0). Les modèles
téléchargés à part gardent aussi la leur : BiRefNet et Whisper (MIT), les voix de Piper
(CC BY ou CC BY-SA, voir la fiche de chaque voix).

Auteur : Alexandre Do.

# Banc d'essai d'Eliot

Page de test jetable (étape 0 du `BRIEF.md`). Elle mesure si le moteur web d'Ubuntu, utilisé
par Tauri, est assez fluide pour Eliot, en le comparant à Chrome sur la même page. Le résultat
décide de l'enveloppe : Tauri, ou repli sur Electron.

**À lancer à la main, carte graphique libre.** Les tests redessinent la page à chaque
rafraîchissement de l'écran pendant environ une minute et décodent deux vidéos 1080p.

## Ce qui est mesuré

| Test | Ce qu'il imite |
| --- | --- |
| Redessiner les 200 objets à chaque image | le pire cas d'une page chargée |
| Glisser un objet, glisser 50 objets, tourner et redimensionner 10 objets | les gestes à la souris |
| Glisser un objet : sans poignées, poignées dans le calque de la page, objet sur un calque à part ; glisser 50 objets sur un calque à part | la meilleure façon de monter un glisser (ajouté le 2026-10-14 après la première série) |
| Glisser une photo 24 Mpx, puis la même en aperçu 2560 px | l'effet de la règle « l'interface ne touche jamais l'original » |
| Vidéo 1080p H.264, puis VP9, dans la page pendant un glisser | l'édition d'un spot vidéo |
| Exporter la page en PNG 2160 × 2160 | l'export |
| Réduire la photo 24 Mpx à 2560 px, par le moteur web puis par le Rust | le travail lourd confié au Rust |

Pour chaque test d'animation : images par seconde, 95e centile de la durée d'une image,
nombre d'à-coups (images de plus de 33 ms) et un verdict. Règle de lecture : « fluide » si on
tient 90 % de la fréquence de l'écran (55 images/s au plus exigé) avec un 95e centile sous
25 ms, « correct » au-dessus de 30 images/s, « saccadé » en dessous.

Les fichiers de test (`public/donnees/`) sont synthétiques, générés par
`outils/generer_donnees.py` à graine fixe ; leurs empreintes SHA-256 sont écrites dans
`public/donnees/EMPREINTES.txt` à chaque génération. La photo et la vidéo H.264 sortent
identiques d'une machine à l'autre ; la vidéo VP9 change d'octets (encodeur en temps réel)
mais pas de contenu.

## Les copies d'aperçu (étape 4, lot 0)

Dans Eliot, la fenêtre ne lira jamais l'original d'une vidéo : le Rust en fera une copie
légère à l'import. Ce second banc choisit le format de cette copie. `outils/generer_copies.py`
fabrique une vidéo source de 20 s en 1080p (mire en mouvement, grain léger, son), puis la
réencode avec le `ffmpeg` du système dans six formats, tous avec une image clé par
demi-seconde :

| Copie | Pourquoi |
| --- | --- |
| VP9 1080p | la taille d'origine : faut-il seulement une copie ? |
| VP9 720p, VP9 540p | VP9 a joué à vitesse normale au premier banc |
| VP8 540p | plus simple à décoder que VP9 |
| H.264 720p, H.264 540p profil de base | H.264 a joué au ralenti au premier banc ; une copie plus petite le sauve-t-elle ? |

Le bouton « Copies d'aperçu (étape 4) » mesure, pour chacune : la fabrication (durée sur le
processeur, poids), la lecture sur un calque à part au-dessus de la page de 200 objets
(images par seconde, images de la vidéo affichées et perdues, vitesse réelle), deux vidéos à
la fois (une principale et une incrustation), et la tête de lecture (temps d'un saut,
images par seconde pendant un glisser continu de la tête). Environ deux minutes. Résultats
dans `resultats/AAAA-MM-JJ_HHMMSS_<moteur>_copies.json`, avec la liste des copies et la
version de `ffmpeg`.

## Où vont les résultats

Chaque série écrit un fichier `resultats/AAAA-MM-JJ_HHMMSS_<moteur>.json` (moteur :
`tauri-webkitgtk`, `chrome`, `firefox`). Le tableau s'affiche aussi à droite de la fenêtre.

## Commandes

Les commandes complètes (installation, lancement, en cas de fenêtre blanche) sont dans
`../CLAUDE.md`, rubrique « Commandes ».

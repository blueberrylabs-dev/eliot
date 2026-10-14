"""Prototype du texte animé de l'étape 4 (BRIEF § 6, vidéo façon CapCut), validé par
Alexandre le 2026-10-14 sur la présentation de Nimeria.

Entrée : un dossier de scènes exportées d'Eliot (scene1.png, scene2.png…, mêmes dimensions,
fond en dégradé vertical). Sortie : un MP4 H.264 où le cadre (fond, haut et bas de la page)
reste fixe et où le contenu de chaque scène entre par bandes successives, en fondu avec une
légère montée, puis s'efface avant la scène suivante. Piste son muette, à remplacer au
moment de publier.

Les bandes sont trouvées dans l'image : les lignes où la scène diffère du fond, séparées par
des vides. Fond, cadre et contenu sont séparés par différence, sans retoucher les scènes.
Processeur seulement (numpy, scipy, Pillow, ffmpeg) ; à l'étape 4, le noyau Rust reprendra
ce principe sur les calques du document plutôt que sur des images.

    python3 animer_scenes.py <dossier> --durees 2.6,2.9,3.8,3.8,3.8,3.0,3.6
"""
import argparse
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import shift as decaler

arguments = argparse.ArgumentParser(description="Anime les scènes d'Eliot en vidéo.")
arguments.add_argument("dossier", type=Path, help="dossier contenant scene1.png, scene2.png…")
arguments.add_argument("--durees", help="durée de chaque scène en secondes, séparées par des virgules (3 s par défaut)")
arguments.add_argument("--sortie", default="video.mp4", help="nom du fichier produit dans le dossier")
arguments.add_argument("--haut", type=int, default=300, help="au-dessus de cette ligne, le cadre reste fixe")
arguments.add_argument("--bas", type=int, default=1700, help="au-dessous de cette ligne, le cadre reste fixe")
options = arguments.parse_args()

DOSSIER = options.dossier
SORTIE = DOSSIER / options.sortie
FICHIERS = sorted(DOSSIER.glob("scene*.png"), key=lambda f: int(f.stem[5:]))
DUREES = [float(d) for d in options.durees.split(",")] if options.durees else [3.0] * len(FICHIERS)
assert len(DUREES) == len(FICHIERS), f"{len(FICHIERS)} scènes pour {len(DUREES)} durées"
FPS = 30
L, H = Image.open(FICHIERS[0]).size
HAUT, BAS = options.haut, options.bas
ENTREE, DECALAGE_BANDES, MONTEE = 0.5, 0.13, 46
SORTIE_DUREE, DESCENTE = 0.3, 24


def ease_out(p):
    return 1 - (1 - p) ** 3


def ease_in(p):
    return p ** 3


scenes = [np.asarray(Image.open(f).convert("RGB"), dtype=np.float32) for f in FICHIERS]
fixes, contenus, bandes = [], [], []
for s in scenes:
    fond = s[:, :20, :].mean(axis=1, keepdims=True)              # dégradé vertical, une couleur par ligne
    fixe = s.copy()
    fixe[HAUT:BAS] = np.broadcast_to(fond[HAUT:BAS], (BAS - HAUT, L, 3))
    d = s - fixe
    lignes = np.where(np.abs(d).max(axis=(1, 2)) > 4)[0]
    groupes = []
    for y in lignes:
        if groupes and y - groupes[-1][1] < 30:
            groupes[-1][1] = y
        else:
            groupes.append([y, y])
    # Un petit morceau tout près du précédent (le point d'un « ? ») reste avec lui.
    fusion = []
    for g in groupes:
        if fusion and g[1] - g[0] < 50 and g[0] - fusion[-1][1] < 45:
            fusion[-1][1] = g[1]
        else:
            fusion.append(g)
    groupes = fusion
    fixes.append(fixe)
    contenus.append(d)
    bandes.append([(max(HAUT, a - 12), min(BAS, b + 13)) for a, b in groupes])

for i, b in enumerate(bandes):
    print(f"scène {i + 1} : {len(b)} bandes {b}")


def image(i, t):
    """Image de la scène i à l'instant t (secondes depuis le début de la scène)."""
    d_scene = DUREES[i]
    sortie_debut = d_scene - SORTIE_DUREE
    p_sortie = 0.0 if i == len(DUREES) - 1 else min(1.0, max(0.0, (t - sortie_debut) / SORTIE_DUREE))
    alpha_sortie, dy_sortie = 1 - ease_in(p_sortie), -DESCENTE * ease_in(p_sortie)
    progres_premiere = 1.0
    if i == 0:
        fixe = fixes[0]
    else:
        progres_premiere = ease_out(min(1.0, max(0.0, (t - 0.05) / ENTREE)))
        fixe = fixes[i - 1] * (1 - progres_premiere) + fixes[i] * progres_premiere
    img = fixe.copy()
    for k, (a, b) in enumerate(bandes[i]):
        if i == 0:
            e = 1.0
        else:
            e = ease_out(min(1.0, max(0.0, (t - 0.05 - k * DECALAGE_BANDES) / ENTREE)))
        alpha = e * alpha_sortie
        dy = MONTEE * (1 - e) + dy_sortie
        if alpha <= 0.001:
            continue
        a2, b2 = max(0, a - 80), min(H, b + 80)
        morceau = np.zeros((b2 - a2, L, 3), np.float32)
        morceau[a - a2:b - a2] = contenus[i][a:b]
        if abs(dy) > 0.01:
            morceau = decaler(morceau, (dy, 0, 0), order=1, mode="constant", cval=0.0)
        img[a2:b2] += alpha * morceau
    return np.clip(img + 0.5, 0, 255).astype(np.uint8)


total = sum(DUREES)
ffmpeg = subprocess.Popen(
    ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
     "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{L}x{H}", "-r", str(FPS), "-i", "-",
     "-f", "lavfi", "-t", f"{total}", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
     "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-profile:v", "high",
     "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart", str(SORTIE)],
    stdin=subprocess.PIPE)
n = 0
for i, d in enumerate(DUREES):
    for f in range(int(round(d * FPS))):
        ffmpeg.stdin.write(image(i, f / FPS).tobytes())
        n += 1
ffmpeg.stdin.close()
ffmpeg.wait()
print(f"{SORTIE} : {n} images, {n / FPS:.1f} s")

"""Génère les fichiers de test du banc d'essai (photo 24 Mpx, aperçu, deux vidéos 1080p).

Les fichiers sont synthétiques : ce ne sont pas de vraies photos, mais ils ont la taille et le
poids d'une vraie photo d'appareil (6000 x 4000 pixels, bruit de capteur, dégradés). Leur
provenance est consignée ici pour que les mesures restent reproductibles.

Usage : python3 outils/generer_donnees.py   (depuis le dossier 00_banc_essai)
Prérequis : Pillow, numpy, ffmpeg (avec libx264 et libvpx-vp9).
"""

import hashlib
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

DOSSIER = Path(__file__).resolve().parent.parent / "public" / "donnees"
LARGEUR, HAUTEUR = 6000, 4000
GRAINE = 20261014  # graine fixe : la même photo à chaque génération


def generer_photo() -> None:
    rng = np.random.default_rng(GRAINE)
    # Fond : dégradé diagonal, comme un ciel ou un mur éclairé.
    y = np.linspace(0, 1, HAUTEUR, dtype=np.float32)[:, None]
    x = np.linspace(0, 1, LARGEUR, dtype=np.float32)[None, :]
    r = 60 + 150 * (0.6 * x + 0.4 * y)
    v = 90 + 110 * (1 - y) * (0.5 + 0.5 * x)
    b = 140 + 90 * (1 - x)
    forme = (HAUTEUR, LARGEUR)
    fond = np.stack([np.broadcast_to(c, forme) for c in (r, v, b)], axis=-1)
    image = Image.fromarray(np.clip(fond, 0, 255).astype(np.uint8))

    # Formes floues : des « objets » de tailles variées.
    calque = Image.new("RGB", (LARGEUR, HAUTEUR), (0, 0, 0))
    dessin = ImageDraw.Draw(calque)
    for _ in range(140):
        cx, cy = rng.integers(0, LARGEUR), rng.integers(0, HAUTEUR)
        rayon = int(rng.integers(40, 600))
        couleur = tuple(int(c) for c in rng.integers(0, 255, 3))
        dessin.ellipse([cx - rayon, cy - rayon, cx + rayon, cy + rayon], fill=couleur)
    calque = calque.filter(ImageFilter.GaussianBlur(18))
    image = Image.blend(image, calque, 0.45)

    # Bruit de capteur : c'est lui qui donne son poids à un vrai JPEG.
    tableau = np.asarray(image).astype(np.float32)
    tableau += rng.normal(0, 7, tableau.shape).astype(np.float32)
    image = Image.fromarray(np.clip(tableau, 0, 255).astype(np.uint8))

    image.save(DOSSIER / "photo_24mpx.jpg", quality=90, optimize=True)
    apercu = image.copy()
    apercu.thumbnail((2560, 2560), Image.Resampling.LANCZOS)
    apercu.save(DOSSIER / "photo_apercu_2560.jpg", quality=85, optimize=True)


def generer_videos() -> None:
    source = ["-f", "lavfi", "-i", "testsrc2=size=1920x1080:rate=30", "-t", "10"]
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", *source, "-c:v", "libx264",
         "-profile:v", "high", "-pix_fmt", "yuv420p", "-crf", "20",
         "-movflags", "+faststart", str(DOSSIER / "video_1080p_h264.mp4")],
        check=True,
    )
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", *source, "-c:v", "libvpx-vp9",
         "-crf", "32", "-b:v", "0", "-deadline", "realtime", "-cpu-used", "8",
         "-pix_fmt", "yuv420p", str(DOSSIER / "video_1080p_vp9.webm")],
        check=True,
    )


def empreintes() -> None:
    lignes = []
    for fichier in sorted(DOSSIER.iterdir()):
        if fichier.name == "EMPREINTES.txt":
            continue
        somme = hashlib.sha256(fichier.read_bytes()).hexdigest()
        lignes.append(f"{somme}  {fichier.name}  {fichier.stat().st_size} octets")
    (DOSSIER / "EMPREINTES.txt").write_text("\n".join(lignes) + "\n", encoding="utf-8")


if __name__ == "__main__":
    DOSSIER.mkdir(parents=True, exist_ok=True)
    generer_photo()
    generer_videos()
    empreintes()
    print((DOSSIER / "EMPREINTES.txt").read_text(encoding="utf-8"))

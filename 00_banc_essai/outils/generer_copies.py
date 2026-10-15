"""Fabrique les copies d'aperçu à comparer (étape 4, lot 0) et mesure ce qu'elles coûtent.

Une vidéo source synthétique de 20 s en 1080p à 30 images/s, avec un léger grain et un son,
comme une prise de téléphone, est encodée dans chaque format candidat par le `ffmpeg` du
système, sur le processeur. Pour chaque copie : durée de fabrication et poids, écrits dans
`public/donnees/copies/copies.json`, que le banc relit pour savoir quoi tester.

Usage : python3 outils/generer_copies.py   (depuis le dossier 00_banc_essai)
Prérequis : ffmpeg avec libx264, libvpx, libvpx-vp9 et libopus (commande 2 du CLAUDE.md).
Bibliothèque standard de Python seulement. Processeur seulement, environ une minute.
"""

import json
import os
import platform
import subprocess
import time
from pathlib import Path

DOSSIER = Path(__file__).resolve().parent.parent / "public" / "donnees" / "copies"
DUREE_S = 20

# Une image clé toutes les demi-secondes (15 images à 30 images/s) : c'est ce qui permet à la
# tête de lecture de sauter vite n'importe où dans la vidéo.
GOP = ["-g", "15", "-keyint_min", "15"]
VP9 = ["-c:v", "libvpx-vp9", "-deadline", "realtime", "-cpu-used", "8", "-row-mt", "1", "-crf", "33", "-b:v", "0", *GOP, "-c:a", "libopus", "-b:a", "96k"]
VP8 = ["-c:v", "libvpx", "-deadline", "realtime", "-cpu-used", "8", "-crf", "10", "-b:v", "2M", *GOP, "-c:a", "libopus", "-b:a", "96k"]
H264 = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "24", *GOP, "-sc_threshold", "0", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart"]

# id, fichier, arguments, type à donner à canPlayType, description
CANDIDATS = [
    ("vp9_1080p", "vp9_1080p.webm", VP9, 'video/webm; codecs="vp9, opus"', "VP9 en 1080p (taille d'origine)"),
    ("vp9_720p", "vp9_720p.webm", ["-vf", "scale=-2:720", *VP9], 'video/webm; codecs="vp9, opus"', "VP9 en 720p"),
    ("vp9_540p", "vp9_540p.webm", ["-vf", "scale=-2:540", *VP9], 'video/webm; codecs="vp9, opus"', "VP9 en 540p"),
    ("vp8_540p", "vp8_540p.webm", ["-vf", "scale=-2:540", *VP8], 'video/webm; codecs="vp8, opus"', "VP8 en 540p"),
    ("h264_720p", "h264_720p.mp4", ["-vf", "scale=-2:720", "-profile:v", "main", *H264], 'video/mp4; codecs="avc1.4d401f, mp4a.40.2"', "H.264 en 720p"),
    (
        "h264_540p_rapide",
        "h264_540p_rapide.mp4",
        ["-vf", "scale=-2:540", "-profile:v", "baseline", "-tune", "fastdecode", *H264],
        'video/mp4; codecs="avc1.42e01e, mp4a.40.2"',
        "H.264 en 540p, profil de base, décodage allégé",
    ),
]


def ffmpeg(*arguments: str) -> None:
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", *arguments], check=True)


def version_ffmpeg() -> str:
    sortie = subprocess.run(["ffmpeg", "-version"], capture_output=True, text=True, check=True).stdout
    return sortie.splitlines()[0]


def processeur() -> str:
    try:
        for ligne in Path("/proc/cpuinfo").read_text().splitlines():
            if ligne.startswith("model name"):
                return ligne.split(":", 1)[1].strip()
    except OSError:
        pass
    return platform.processor() or "?"


def fabriquer_source() -> Path:
    """La prise « de téléphone » : mire en mouvement, grain léger, son continu."""
    source = DOSSIER / "source_1080p.mp4"
    ffmpeg(
        "-f", "lavfi", "-i", "testsrc2=size=1920x1080:rate=30,noise=alls=4:allf=t",
        "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000",
        # Débit plafonné à celui d'un téléphone en 1080p (environ 17 Mbit/s).
        "-t", str(DUREE_S), "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-maxrate", "17M", "-bufsize", "34M",
        "-profile:v", "high", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", str(source),
    )
    return source


def main() -> None:
    DOSSIER.mkdir(parents=True, exist_ok=True)
    print("Vidéo source (20 s, 1080p)…", flush=True)
    source = fabriquer_source()
    copies = []
    for identifiant, fichier, arguments, type_mime, description in CANDIDATS:
        debut = time.monotonic()
        ffmpeg("-i", str(source), *arguments, str(DOSSIER / fichier))
        duree = time.monotonic() - debut
        poids = (DOSSIER / fichier).stat().st_size
        copies.append({
            "id": identifiant,
            "fichier": fichier,
            "type": type_mime,
            "description": description,
            "fabrication_s": round(duree, 2),
            "vitesse_fabrication": round(DUREE_S / duree, 1),
            "poids_octets": poids,
            "debit_ko_s": round(poids / 1024 / DUREE_S, 1),
        })
        print(f"  {description} : {duree:.1f} s de fabrication ({DUREE_S / duree:.1f} fois le temps réel), {poids / 1e6:.1f} Mo", flush=True)
    resume = {
        "version": 1,
        "duree_source_s": DUREE_S,
        "source": "source_1080p.mp4",
        "ffmpeg": version_ffmpeg(),
        "processeur": processeur(),
        "fils": os.cpu_count(),
        "copies": copies,
    }
    (DOSSIER / "copies.json").write_text(json.dumps(resume, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Copies prêtes dans {DOSSIER}.")


if __name__ == "__main__":
    main()

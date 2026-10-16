"""Prépare le modèle du détourage d'Eliot (étape 5, lot 7) : BiRefNet, de Peng Zheng et ses
co-auteurs (licence MIT), converti en ONNX pour onnxruntime sur le processeur.

Pourquoi le convertir soi-même : les ONNX publiés de BiRefNet déplient sa « DeformConv » en
milliers d'opérations, qui demandent plus de 5 Go de mémoire sur le processeur ; converti avec
la DeformConv native (opset 20), le même modèle en demande deux à trois fois moins.

Ce que fait le programme, sur le processeur seulement (torch pour le processeur, aucune carte
graphique visible) :
1. télécharge depuis Hugging Face le code et les poids du modèle, à une révision fixée, et
   vérifie leurs empreintes SHA-256 (un fichier différent arrête tout) ;
2. charge le modèle et l'exporte en ONNX dans un fichier provisoire ;
3. compare la sortie de l'ONNX (onnxruntime) à celle du modèle d'origine sur une image d'essai ;
4. range le fichier sous son nom définitif dans le dossier du détourage.

Il se lance une fois, par la commande 21 du CLAUDE.md d'Eliot (uv fournit torch pour le
processeur le temps de la conversion). Rien d'autre n'est écrit que le modèle.
"""
import argparse
import hashlib
import os
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

os.environ["CUDA_VISIBLE_DEVICES"] = ""

# Les modèles connus d'Eliot : dépôt, révision, empreintes des fichiers, nom du fichier rendu.
MODELES = {
    "birefnet": {
        "depot": "ZhengPeng7/BiRefNet",
        "revision": "e2bf8e4460fc8fa32bba5ea4d94b3233d367b0e4",
        "fichier": "birefnet.onnx",
        "empreintes": {
            "birefnet.py": "208771ae626f653d64128fbf2d6ac9f8e645c5cc5e286258a73ec3322bbfe5ef",
            "BiRefNet_config.py": "e7b8c2a74f6cea6a59553d517f71d47f2c1d90e670a13416af17c25fe2f3dc52",
            "config.json": "c97ea21569daf66b205491a4635147dd3bc42c7c168b89d7d75b53f67ef548ae",
            "model.safetensors": "9ab37426bf4de0567af6b5d21b16151357149139362e6e8992021b8ce356a154",
        },
    },
    "birefnet-lite": {
        "depot": "ZhengPeng7/BiRefNet_lite",
        "revision": "aa62cd87eafb9cc43056d08ef3615a14628b831d",
        "fichier": "birefnet-lite.onnx",
        "empreintes": {
            "birefnet.py": "af8568b5be406bf4d2a68a7ed6d72e40f73b37a1fb6fc9ebd71b5b3cbcd069c9",
            "BiRefNet_config.py": "e7b8c2a74f6cea6a59553d517f71d47f2c1d90e670a13416af17c25fe2f3dc52",
            "config.json": "9dc8614fccddd40c601aeadc69b9db6dd820598179b2a2198492e6ffa016a824",
            "model.safetensors": "4417d89795250e698c3cb0ae8df15743810065f646f48a694fdfa7ca052d0815",
        },
    },
}

COTE = 1024


def empreinte(chemin: Path) -> str:
    h = hashlib.sha256()
    with open(chemin, "rb") as f:
        for bloc in iter(lambda: f.read(1 << 20), b""):
            h.update(bloc)
    return h.hexdigest()


def telecharger(m: dict, dossier: Path) -> Path:
    paquet = dossier / "paquet_birefnet"
    paquet.mkdir(parents=True, exist_ok=True)
    (paquet / "__init__.py").write_text("")
    for nom, attendue in m["empreintes"].items():
        cible = paquet / nom
        url = f"https://huggingface.co/{m['depot']}/resolve/{m['revision']}/{nom}"
        print(f"Téléchargement de {nom}", flush=True)
        urllib.request.urlretrieve(url, cible)
        lue = empreinte(cible)
        if lue != attendue:
            raise SystemExit(f"{nom} : empreinte {lue}, {attendue} attendue. Rien n'est converti.")
    return paquet


def main() -> None:
    depot = Path(__file__).resolve().parents[2]
    a = argparse.ArgumentParser(description="Convertit BiRefNet en ONNX pour le détourage d'Eliot")
    a.add_argument("--modele", choices=sorted(MODELES), default="birefnet")
    a.add_argument("--sortie", default=str(depot / "telechargements" / "detourage"))
    o = a.parse_args()
    m = MODELES[o.modele]
    sortie = Path(o.sortie)
    sortie.mkdir(parents=True, exist_ok=True)

    import numpy as np
    import onnxruntime as ort
    import torch

    if torch.cuda.is_available():
        raise SystemExit("torch voit une carte graphique : la conversion ne doit tourner que sur le processeur.")
    torch.set_num_threads(max(1, (os.cpu_count() or 2) - 1))

    with tempfile.TemporaryDirectory(prefix="eliot-birefnet-") as travail:
        travail = Path(travail)
        paquet = telecharger(m, travail)
        sys.path.insert(0, str(travail))
        module = __import__("paquet_birefnet.birefnet", fromlist=["BiRefNet"])
        print("Chargement du modèle", flush=True)
        modele = module.BiRefNet.from_pretrained(str(paquet)).eval().float()

        class Sortie(torch.nn.Module):
            def __init__(self, interne):
                super().__init__()
                self.interne = interne

            def forward(self, x):
                return self.interne(x)[-1]

        enveloppe = Sortie(modele).eval()
        x = torch.rand(1, 3, COTE, COTE, generator=torch.Generator().manual_seed(7))
        provisoire = sortie / f".{m['fichier']}.provisoire"
        print("Conversion en ONNX (une à trois minutes)", flush=True)
        debut = time.perf_counter()
        programme = torch.onnx.export(enveloppe, (x,), dynamo=True, opset_version=20, input_names=["input_image"], output_names=["output_image"], external_data=False)
        programme.save(str(provisoire))
        print(f"Converti en {time.perf_counter() - debut:.0f} s", flush=True)

        print("Vérification par onnxruntime", flush=True)
        with torch.no_grad():
            attendu = torch.sigmoid(enveloppe(x)).numpy()
        reglages = ort.SessionOptions()
        reglages.enable_cpu_mem_arena = False
        session = ort.InferenceSession(str(provisoire), sess_options=reglages, providers=["CPUExecutionProvider"])
        obtenu = 1.0 / (1.0 + np.exp(-session.run(None, {"input_image": x.numpy()})[0]))
        ecart = float(np.abs(obtenu - attendu).max())
        if not ecart < 2e-3:
            provisoire.unlink(missing_ok=True)
            raise SystemExit(f"L'ONNX s'écarte du modèle d'origine ({ecart:.4f}) : rien n'est rangé.")
        final = sortie / m["fichier"]
        os.replace(provisoire, final)
        print(f"Écart avec le modèle d'origine : {ecart:.6f}")
        print(f"Modèle prêt : {final} ({final.stat().st_size / 1e6:.0f} Mo)")


if __name__ == "__main__":
    main()

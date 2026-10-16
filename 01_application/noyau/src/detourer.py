"""Le détourage d'Eliot (étape 5, lot 7) : une image carrée en entrée, le masque du premier plan
en sortie, par un modèle ONNX, sur le processeur seulement.

Lancé par le noyau (detourage.rs), qui l'écrit dans un dossier de travail neuf : il ne lit et
n'écrit que les deux fichiers qu'on lui donne, ne va jamais sur Internet et ne touche pas à la
carte graphique (onnxruntime pour le processeur, sans CUDA, et seul le fournisseur
« CPUExecutionProvider » est demandé).

Entrée : l'image en RGB, 8 bits par canal, `cote` x `cote` pixels, ligne après ligne.
Sortie : le masque en flottants 32 bits petit-boutistes, de 0 (fond) à 1 (premier plan).
"""
import argparse

import numpy as np
import onnxruntime as ort

MOYENNE = np.array([0.485, 0.456, 0.406], dtype=np.float32)
ECART = np.array([0.229, 0.224, 0.225], dtype=np.float32)


def main() -> None:
    a = argparse.ArgumentParser(description="Détourage d'Eliot")
    a.add_argument("--modele", required=True)
    a.add_argument("--entree", required=True)
    a.add_argument("--sortie", required=True)
    a.add_argument("--cote", type=int, default=1024)
    a.add_argument("--normaliser", choices=["imagenet", "aucune"], default="imagenet")
    a.add_argument("--activation", choices=["sigmoide", "aucune"], default="sigmoide")
    a.add_argument("--fils", type=int, default=2)
    o = a.parse_args()

    x = np.fromfile(o.entree, dtype=np.uint8)
    if x.size != o.cote * o.cote * 3:
        raise SystemExit(f"entrée de {x.size} octets, {o.cote * o.cote * 3} attendus")
    x = x.reshape(o.cote, o.cote, 3).astype(np.float32) / 255.0
    if o.normaliser == "imagenet":
        x = (x - MOYENNE) / ECART
    x = np.ascontiguousarray(x.transpose(2, 0, 1)[None], dtype=np.float32)
    print("etape image", flush=True)

    reglages = ort.SessionOptions()
    reglages.intra_op_num_threads = max(1, o.fils)
    reglages.inter_op_num_threads = 1
    # La mémoire rendue au fil du calcul plutôt que gardée en réserve : le pic reste celui du
    # modèle, pas celui du modèle et de sa réserve.
    reglages.enable_cpu_mem_arena = False
    reglages.enable_mem_pattern = False
    session = ort.InferenceSession(o.modele, sess_options=reglages, providers=["CPUExecutionProvider"])
    print("etape modele", flush=True)

    y = session.run(None, {session.get_inputs()[0].name: x})[0]
    y = np.asarray(y, dtype=np.float32).reshape(-1)[-o.cote * o.cote :]
    if o.activation == "sigmoide":
        y = 1.0 / (1.0 + np.exp(-y))
    np.clip(y, 0.0, 1.0).astype("<f4").tofile(o.sortie)
    print("etape fini", flush=True)


if __name__ == "__main__":
    main()

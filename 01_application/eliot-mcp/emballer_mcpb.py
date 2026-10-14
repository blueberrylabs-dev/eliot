"""Emballe le pont `eliot-mcp` en extension pour l'application Claude de bureau (format MCPB :
une archive zip avec un manifest.json et le programme). C'est l'autre façon de déclarer le
pont, quand la configuration à la main (claude_desktop_config.json) n'est pas lue.

À lancer après `cargo build --release` :
    python3 emballer_mcpb.py
Produit `target/eliot.mcpb`, à installer depuis Réglages, Extensions de l'application Claude.
"""

import json
import stat
import sys
import zipfile
from pathlib import Path

ICI = Path(__file__).resolve().parent
BINAIRE = ICI / "target" / "release" / "eliot-mcp"
OUTILS = ICI.parent / "src" / "ia" / "outils.json"
SORTIE = ICI / "target" / "eliot.mcpb"


def version() -> str:
    for ligne in (ICI / "Cargo.toml").read_text(encoding="utf-8").splitlines():
        if ligne.startswith("version"):
            return ligne.split("=")[1].strip().strip('"')
    return "0.1.0"


def main() -> int:
    if not BINAIRE.is_file():
        print(f"Programme introuvable : {BINAIRE}\nCompiler d'abord : cargo build --release -j 4", file=sys.stderr)
        return 1
    outils = json.loads(OUTILS.read_text(encoding="utf-8"))
    manifeste = {
        "manifest_version": "0.3",
        "name": "eliot",
        "display_name": "Eliot",
        "version": version(),
        "description": "Pilote Eliot, l'éditeur graphique local d'Alexandre Do, quand il est ouvert sur ce poste.",
        "author": {"name": "Alexandre Do"},
        "server": {
            "type": "binary",
            "entry_point": "server/eliot-mcp",
            "mcp_config": {"command": "${__dirname}/server/eliot-mcp", "args": []},
        },
        "compatibility": {"platforms": ["linux"]},
        "tools": [{"name": o["name"], "description": o["description"]} for o in outils],
    }
    SORTIE.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(SORTIE, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("manifest.json", json.dumps(manifeste, indent=2, ensure_ascii=False) + "\n")
        info = zipfile.ZipInfo("server/eliot-mcp")
        # Droits rwxr-xr-x gardés dans l'archive : le programme reste exécutable une fois installé.
        info.external_attr = (stat.S_IFREG | 0o755) << 16
        info.compress_type = zipfile.ZIP_DEFLATED
        archive.writestr(info, BINAIRE.read_bytes())
    print(f"Extension prête : {SORTIE} ({SORTIE.stat().st_size // 1024} Ko, {len(outils)} outils)")
    return 0


if __name__ == "__main__":
    sys.exit(main())

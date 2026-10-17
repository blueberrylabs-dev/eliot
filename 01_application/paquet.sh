#!/usr/bin/env bash
# Construit le paquet .deb d'Eliot : l'interface et sa bibliothèque, le noyau Rust et le pont
# eliot-mcp, dans un seul fichier à installer avec apt. Processeur seulement (4 cœurs), la
# carte graphique n'est pas sollicitée ; Eliot n'est jamais lancé (règle 9 du BRIEF).
#
#   ./paquet.sh
#
# Produit `paquets/Eliot_<version>_amd64.deb` et `paquets/SHA256SUMS` (hors git), à installer
# avec `./installer.sh` ou à joindre à une version publiée.
set -euo pipefail

ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ICI"

etape() { printf '\n== %s\n' "$1"; }
manque() { printf 'Manque : %s\n' "$1" >&2; exit 1; }

etape "Outils"
for outil in node npm cargo rustc pkg-config; do
  command -v "$outil" > /dev/null || manque "$outil (commandes 1 à 3 du CLAUDE.md)"
done
pkg-config --exists webkit2gtk-4.1 || manque "les bibliothèques du système (commande 2 du CLAUDE.md)"
# krilla, la bibliothèque de l'export PDF, demande Rust 1.92 au moins.
version_rust="$(rustc --version | awk '{print $2}')"
if [ "$(printf '%s\n1.92.0\n' "$version_rust" | sort -V | head -1)" != "1.92.0" ]; then
  manque "Rust 1.92 au moins (installé : $version_rust) ; mettre à jour avec : rustup update"
fi
VERSION="$(node -p "require('./src-tauri/tauri.conf.json').version")"
echo "Eliot $VERSION, Rust $version_rust, Node $(node --version)"

etape "Dépendances JavaScript"
npm install --no-audit --no-fund

etape "Bibliothèque (icônes, emojis, polices, personnages, modèles 3D de Kenney)"
if [ -f public/bibliotheque/index.json ]; then
  echo "Déjà fabriquée ; pour la refaire : npm run bibliotheque"
else
  npm run bibliotheque
fi

etape "Paquet .deb (plusieurs minutes la première fois)"
# Le pont eliot-mcp se compile avant (beforeBuildCommand), puis entre dans le paquet.
npx tauri build -- -j 4

DEB="src-tauri/target/release/bundle/deb/Eliot_${VERSION}_amd64.deb"
[ -f "$DEB" ] || manque "le paquet attendu : $DEB"
mkdir -p paquets
cp "$DEB" paquets/
(cd paquets && sha256sum "Eliot_${VERSION}_amd64.deb" > SHA256SUMS)

etape "Prêt"
echo "Paquet : $ICI/paquets/Eliot_${VERSION}_amd64.deb ($(du -h "paquets/Eliot_${VERSION}_amd64.deb" | cut -f1))"
echo "Empreinte : $(cat paquets/SHA256SUMS)"
echo "L'installer sur ce poste : $ICI/installer.sh"

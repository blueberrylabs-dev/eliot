#!/usr/bin/env bash
# Installe Eliot sur ce poste comme un logiciel : le paquet .deb (construit par ./paquet.sh s'il
# n'existe pas encore pour cette version) passe par apt, qui demande le mot de passe et
# installe aussi ce dont Eliot a besoin (ffmpeg, GStreamer, le moteur web). Eliot arrive dans
# le menu des applications ; le pont vers une IA est /usr/bin/eliot-mcp.
#
#   ./installer.sh
#
# La version installée lit ses clés dans ~/.config/fr.alexandredo.eliot/cles.env et ses
# modèles (voix de Piper, Whisper, détourage) dans ~/.local/share/fr.alexandredo.eliot/. Sur
# un poste où le dépôt est cloné, le script les relie à ceux du dépôt par des liens : la clé
# reste dans le seul fichier .env, les modèles ne sont pas copiés. Rien n'est effacé, et Eliot
# n'est jamais lancé (règle 9 du BRIEF). Désinstaller : sudo apt remove eliot
set -euo pipefail

ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPOT="$(dirname "$ICI")"
CONFIG="${XDG_CONFIG_HOME:-$HOME/.config}/fr.alexandredo.eliot"
DONNEES="${XDG_DATA_HOME:-$HOME/.local/share}/fr.alexandredo.eliot"
cd "$ICI"

etape() { printf '\n== %s\n' "$1"; }

VERSION="$(node -p "require('./src-tauri/tauri.conf.json').version")"
DEB="$ICI/paquets/Eliot_${VERSION}_amd64.deb"

if [ ! -f "$DEB" ]; then
  etape "Pas encore de paquet pour la version $VERSION : construction"
  "$ICI/paquet.sh"
fi

etape "Installation du paquet (apt demande ton mot de passe)"
sudo apt install -y "$DEB"

etape "Clés et modèles de la version installée"
mkdir -p "$CONFIG" "$DONNEES"
# Un lien vers ce qui est dans le dépôt ; s'il manque encore (une voix pas encore
# téléchargée), le lien sert dès qu'il arrive. Ce qui existe déjà n'est pas touché.
lier() {
  local cible="$1" lien="$2"
  if [ -e "$lien" ] || [ -L "$lien" ]; then
    echo "déjà en place : $lien"
  else
    ln -s "$cible" "$lien"
    echo "lien : $lien -> $cible"
  fi
}
lier "$DEPOT/.env" "$CONFIG/cles.env"
for dossier in voix whisper detourage; do
  lier "$DEPOT/telechargements/$dossier" "$DONNEES/$dossier"
done

etape "Eliot $VERSION est installé"
echo "Lancer : le menu des applications (Eliot), ou « eliot » dans un terminal, carte graphique libre."
echo "Pont vers une IA : /usr/bin/eliot-mcp (Fichier, « Réglages et pont IA… », dans Eliot)."
echo "Désinstaller : sudo apt remove eliot (tes designs, dans ~/Documents/Eliot, restent)."

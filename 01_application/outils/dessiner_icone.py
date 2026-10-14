"""Dessine l'icône d'Eliot (1024 x 1024) : un carré arrondi indigo et un « E » fait de barres.

Usage : python3 outils/dessiner_icone.py, puis npx tauri icon outils/icone_source.png
"""
from pathlib import Path

from PIL import Image, ImageDraw

TAILLE = 1024
image = Image.new("RGBA", (TAILLE, TAILLE), (0, 0, 0, 0))
dessin = ImageDraw.Draw(image)
dessin.rounded_rectangle([40, 40, TAILLE - 40, TAILLE - 40], radius=230, fill=(79, 70, 229, 255))
blanc = (255, 255, 255, 255)
# Le « E » : une barre verticale et trois horizontales, la médiane plus courte.
dessin.rounded_rectangle([300, 270, 400, 754], radius=36, fill=blanc)
dessin.rounded_rectangle([300, 270, 724, 370], radius=36, fill=blanc)
dessin.rounded_rectangle([300, 462, 640, 562], radius=36, fill=blanc)
dessin.rounded_rectangle([300, 654, 724, 754], radius=36, fill=blanc)
# Une pastille corail : la touche « création ».
dessin.ellipse([690, 450, 790, 550], fill=(255, 122, 89, 255))
image.save(Path(__file__).with_name("icone_source.png"))

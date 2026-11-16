#!/usr/bin/env python3
"""Génère les icônes de l'app (haltère lime sur fond encre). Usage : python3 scripts/make_icons.py"""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "app" / "icons"
INK, LIME = (23, 23, 15), (207, 233, 59)


def icon(size):
    s = 1024
    im = Image.new("RGB", (s, s), INK)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((300, 482, 724, 542), 20, fill=LIME)           # barre
    for x in (232, 712):                                                # disques intérieurs
        d.rounded_rectangle((x, 332, x + 80, 692), 28, fill=LIME)
    for x in (168, 816):                                                # disques extérieurs
        d.rounded_rectangle((x, 392, x + 40, 632), 18, fill=LIME)
    return im.resize((size, size), Image.LANCZOS)


OUT.mkdir(parents=True, exist_ok=True)
icon(180).save(OUT / "apple-touch-icon.png")
icon(192).save(OUT / "icon-192.png")
icon(512).save(OUT / "icon-512.png")
print("Icônes générées")

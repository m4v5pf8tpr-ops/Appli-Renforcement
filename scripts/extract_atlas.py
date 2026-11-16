#!/usr/bin/env python3
"""Extrait le moteur de silhouettes et les poses de source/Atlas_des_exercices.html
vers app/js/figures.js (script classique exposant window.Figures).

Usage : python3 scripts/extract_atlas.py
Vérifie que chaque exercice de app/data/exercises.json a une pose.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
html = (ROOT / "source" / "Atlas_des_exercices.html").read_text()
start = html.index("<script>") + len("<script>")
end = html.index("const EXOS=")
engine = html[start:end].rstrip()

out = (
    "/* Généré par scripts/extract_atlas.py depuis source/Atlas_des_exercices.html : ne pas modifier à la main. */\n"
    + "(function () {\n"
    + engine
    + "\nwindow.Figures = { POSES, makeFigure, autoVB };\n})();\n"
)
(ROOT / "app" / "js" / "figures.js").write_text(out)

# Contrôle : noms des poses déclarées avec E("...", ...)
poses = set(re.findall(r'\bE\("((?:[^"\\]|\\.)*)"', engine))
names = {e["n"] for e in json.loads((ROOT / "app" / "data" / "exercises.json").read_text())}
missing = sorted(names - poses)
if missing:
    print("Exercices sans pose :", *missing, sep="\n  ", file=sys.stderr)
    sys.exit(1)
print(f"Moteur extrait ({len(out) // 1024} Ko), {len(poses)} poses, les {len(names)} exercices sont couverts")

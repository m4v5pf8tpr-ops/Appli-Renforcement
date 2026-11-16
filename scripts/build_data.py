#!/usr/bin/env python3
"""Convertit source/Base_exercices.xlsx en fichiers JSON pour l'app.

Usage : python3 scripts/build_data.py
Sorties : app/data/exercises.json, app/data/sessions.json

Le script s'arrête en erreur si une incohérence est détectée
(séance qui cite un exercice absent, dosage illisible...).
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "source" / "Base_exercices.xlsx"
OUT = ROOT / "app" / "data"

OBJECTIFS = [
    "Cyclisme", "Course à pied", "Trail", "Natation", "Triathlon", "Football",
    "Tennis / Padel", "Escalade", "Reprise / Débutant", "Perte de poids",
    "Tonification", "Dos & posture", "Seniors & équilibre",
]
# Valeurs combinées de la colonne « Équipement » -> liste d'équipements unitaires
EQUIP_SPLIT = {
    "Aucun": [],
    "Banc + haltères": ["Banc / chaise", "Haltères"],
}

DOSE_RE = re.compile(
    r"^(?P<s1>\d+)(?:-(?P<s2>\d+))?\s*×\s*"
    r"(?P<a>\d+)(?:-(?P<b>\d+))?\s*"
    r"(?P<unit>min|s|m|pas|touches|balancements|contacts|cercles)?\b"
    r"(?:\s*(?:/|par)\s*(?P<per>côté|jambe|bras|sens|lettre))?"
    r"(?:\s*,?\s*(?P<note>.+))?$"
)
UNIT = {None: "reps", "s": "s", "m": "m"}


def slug(s):
    s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower()
    return "ex-" + re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def parse_dose(txt):
    m = DOSE_RE.match(txt.strip())
    if not m:
        return None
    g = m.groupdict()
    unit = UNIT.get(g["unit"], g["unit"])  # pas, touches... restent tels quels
    k = 1
    if unit == "min":  # « 5 × 1 min » -> secondes
        unit, k = "s", 60
    return {
        "sets": int(g["s1"]),
        "setsMax": int(g["s2"] or g["s1"]),
        "min": int(g["a"]) * k,
        "max": int(g["b"] or g["a"]) * k,
        "unit": unit,
        "per": g["per"],
        "note": g["note"],
    }


def parse_rest(txt):
    """'90 s' -> 90, '30-45 s' -> 45, '2 min' -> 120, '2-3 min' -> 150."""
    m = re.match(r"^(\d+)(?:-(\d+))?\s*(s|min)$", txt.strip())
    if not m:
        return None
    a, b = int(m[1]), int(m[2] or m[1])
    v = b if m[3] == "s" else (a + b) / 2 * 60
    return int(v)


def main():
    wb = openpyxl.load_workbook(SRC, read_only=True)
    errors = []

    ws = wb["Exercices"]
    header = [c for c in next(ws.iter_rows(max_row=1, values_only=True))]
    col = {h: i for i, h in enumerate(header)}
    exercises = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row[0]:
            continue
        row = tuple(row) + (None,) * (len(header) - len(row))
        name = row[col["Exercice"]].strip()
        equip_raw = row[col["Équipement"]]
        dose_txt = row[col["Dosage indicatif"]]
        dose = parse_dose(dose_txt)
        if dose is None:
            errors.append(f"Dosage illisible : {name!r} -> {dose_txt!r}")
        prio = [o for o in OBJECTIFS if row[col[o]] == "Prioritaire"]
        compl = [o for o in OBJECTIFS if row[col[o]] == "Complémentaire"]
        exercises.append({
            "id": slug(name),
            "n": name,
            "cat": row[col["Catégorie"]],
            "equip": EQUIP_SPLIT.get(equip_raw, [equip_raw]),
            "equipLabel": equip_raw,
            "niv": row[col["Niveau"]],
            "typ": row[col["Type de travail"]],
            "mus": row[col["Muscles ciblés"]],
            "dos": dose_txt,
            "dose": dose,
            "cons": row[col["Consigne clé"]],
            "prio": prio,
            "compl": compl,
        })

    ids = [e["id"] for e in exercises]
    if len(set(ids)) != len(ids):
        errors.append("Identifiants d'exercice en double")
    by_name = {e["n"]: e for e in exercises}

    sessions = {o: [] for o in OBJECTIFS}
    for row in wb["Séances types"].iter_rows(min_row=2, values_only=True):
        if not row[0]:
            continue
        obj, order, name, dos, rest, cons = row[:6]
        if obj not in sessions:
            errors.append(f"Objectif inconnu dans « Séances types » : {obj!r}")
            continue
        if name not in by_name:
            errors.append(f"Séance {obj} : exercice absent de la base : {name!r}")
            continue
        dose = parse_dose(dos)
        r = parse_rest(rest)
        if dose is None:
            errors.append(f"Séance {obj} : dosage illisible {dos!r}")
        if r is None:
            errors.append(f"Séance {obj} : repos illisible {rest!r}")
        sessions[obj].append({
            "order": order, "id": by_name[name]["id"], "dos": dos, "dose": dose,
            "rest": rest, "restSec": r, "cons": cons,
        })
    for obj, items in sessions.items():
        items.sort(key=lambda x: x["order"])
        if not items:
            errors.append(f"Aucune séance type pour {obj}")

    if errors:
        print("\n".join(errors), file=sys.stderr)
        sys.exit(1)

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "exercises.json").write_text(json.dumps(exercises, ensure_ascii=False, indent=1) + "\n")
    (OUT / "sessions.json").write_text(json.dumps(sessions, ensure_ascii=False, indent=1) + "\n")
    print(f"{len(exercises)} exercices, {sum(len(v) for v in sessions.values())} lignes de séances types")


if __name__ == "__main__":
    main()

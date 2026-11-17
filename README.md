# Renfo — renforcement musculaire à la maison

Application web installable sur iPhone (PWA) : à partir d'un profil (objectif, niveau, matériel, jours disponibles), elle propose chaque jour prévu une séance prête à faire, avec silhouettes animées, minuteur de repos et suivi des semaines tenues.

## Données personnelles

Ce dépôt est **public**. Il ne contient **aucune donnée personnelle** :

- le profil et l'historique sont stockés **uniquement sur le téléphone** (stockage local de l'app installée) ;
- aucun serveur, aucun compte, aucune requête vers un service tiers (les polices sont hébergées dans le dépôt) ;
- la sauvegarde se fait par export d'un fichier JSON vers Fichiers / iCloud Drive (onglet Profil). Le `.gitignore` exclut ces fichiers (`renfo-sauvegarde-*.json`) pour éviter de les committer par erreur.

⚠️ Les données d'une app web peuvent être effacées par iOS (suppression de l'app, manque d'espace). L'app demande un stockage persistant et rappelle d'exporter une sauvegarde toutes les deux semaines.

## Installer sur l'iPhone

Adresse de l'app : https://m4v5pf8tpr-ops.github.io/Appli-Renforcement/

1. Ouvrir cette adresse dans **Safari**.
2. Bouton Partager → **Sur l'écran d'accueil**.
3. Lancer l'app depuis l'icône (et non depuis Safari : les deux ont des stockages séparés).

Après le premier lancement, l'app fonctionne hors ligne.

## Publication (GitHub Pages)

Une seule fois : *Settings → Pages → Build and deployment → Source : GitHub Actions*.

Ensuite, chaque push sur `main` déclenche `.github/workflows/pages.yml`, qui :
1. régénère les données depuis `source/` et échoue si elles ne correspondent pas aux fichiers committés ;
2. met à jour la version du cache hors ligne ;
3. publie le dossier `app/`.

## Structure

| Chemin | Rôle |
|---|---|
| `source/Base_exercices.xlsx` | Base d'exercices (référence) |
| `source/Atlas_des_exercices.html` | Atlas d'origine : moteur de silhouettes + poses |
| `source/maquette/` | Maquette de design (direction visuelle) |
| `scripts/build_data.py` | Excel → `app/data/exercises.json` et `sessions.json`, avec contrôles de cohérence |
| `scripts/extract_atlas.py` | Atlas → `app/js/figures.js`, vérifie que chaque exercice a une pose |
| `scripts/make_icons.py` | Génère les icônes |
| `app/` | L'application publiée (HTML/CSS/JS sans étape de build) |
| `app/js/plan.js` | Logique de séance (choix, substitutions, durée, régularité) |

Après modification de l'Excel ou de l'atlas :

```bash
pip install openpyxl
python3 scripts/build_data.py
python3 scripts/extract_atlas.py
```

Test en local :

```bash
python3 -m http.server 8000 --directory app
```

## Fonctionnement de la séance (étape 1)

- La séance du jour est la **séance type** de l'objectif (feuille « Séances types »).
- Un exercice impossible (matériel absent ou niveau trop élevé) est remplacé par l'exercice faisable de la même catégorie le plus proche : priorité pour l'objectif, même type de travail, muscles en commun.
- Ajustements : **Fatigué** (2 séries max), **Pas le temps** (3 exercices, 2 séries).
- La durée affichée est une estimation (hypothèse : 3 s par répétition).

## Feuille de route

- **Étape 2** : séances variées tirées des 217 exercices selon la durée du créneau, vue semaine détaillée.
- **Étape 3** : ressenti après séance qui ajuste le dosage, check-in hebdomadaire, export calendrier (.ics) avec rappels.

Ces exercices ne remplacent pas un avis médical.

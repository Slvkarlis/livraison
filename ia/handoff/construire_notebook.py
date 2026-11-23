"""Genere FleetPulse_IA_Colab.ipynb (format nbformat 4), sans dependance hors bibliotheque standard.

Usage : python construire_notebook.py   (ecrit a cote de ce fichier)
"""
import json
import os

DOSSIER = os.path.dirname(os.path.abspath(__file__))


def md(texte):
    return {"cell_type": "markdown", "metadata": {}, "source": texte.strip("\n").splitlines(True)}


def code(texte):
    return {"cell_type": "code", "metadata": {}, "execution_count": None, "outputs": [],
            "source": texte.strip("\n").splitlines(True)}


CELLULES = [
    md("""
# FleetPulse : entrainement des modeles d'IA (Colab)

Ce notebook entraine les trois modeles du service d'IA sur les exports du backend :

| Modele | Stories | Entree | Sortie |
|---|---|---|---|
| ETA (preparation + trajet) | US-401, US-406 | `export.json` (cle `eta`) | `modele_eta.pkl` |
| Prevision de demande par zone et creneau | US-804 | `export.json` (cle `demande`) | `modele_demande.pkl` |
| Score de prospection | US-802 | `export.json` (cle `prospection`) | `modele_prospection.pkl` |

Les trois fichiers `.pkl` et `metriques.json` se telechargent a la fin et se placent dans le dossier `ia/`
du projet (ou dans le volume de l'API). Les metriques doivent etre renvoyees avec les fichiers (voir `README.md`).
"""),
    code("""
# 1. Dependances (Colab a deja numpy et scikit-learn ; on fixe les versions utilisees par le projet)
!pip install -q "numpy>=1.26" "scikit-learn>=1.5"
"""),
    code("""
# 2. Code du projet : televerser ia.zip (contenu du dossier ia/ du depot), puis le decompresser
from google.colab import files
import zipfile, os
televerse = files.upload()            # choisir ia.zip
for nom in televerse:
    with zipfile.ZipFile(nom) as z:
        z.extractall('/content')
os.chdir('/content/ia')
print(sorted(os.listdir('.')))
"""),
    code("""
# 3. Export du backend : televerser export.json (GET /api/admin/entrepot/export, puis les jeux demande et prospection)
import shutil
televerse_export = files.upload()     # choisir export.json (ecrit dans /content)
shutil.copy('/content/' + next(iter(televerse_export)), '/content/ia/export.json')
"""),
    code("""
# 4. Verification des donnees avant entrainement (taille, periode, valeurs manquantes)
import json, collections
with open('export.json', encoding='utf-8') as f:
    export = json.load(f)
for cle in ('eta', 'demande', 'prospection'):
    lignes = export.get(cle, [])
    print(f"{cle:12s}: {len(lignes)} lignes")
    if lignes:
        cles = collections.Counter(k for l in lignes for k, v in l.items() if v is None)
        print("   valeurs absentes :", dict(cles) or "aucune")
"""),
    code("""
# 5. Entrainement des trois modeles (fichiers ecrits dans /content/sortie)
!python entrainer.py --tout export.json --dossier /content/sortie
"""),
    code("""
# 6. Lecture des metriques
import json
with open('/content/sortie/metriques.json', encoding='utf-8') as f:
    metriques = json.load(f)
print(json.dumps(metriques, ensure_ascii=False, indent=2))
"""),
    code("""
# 7. Controle visuel : prevision contre reel sur le jeu de test de la demande
import matplotlib.pyplot as plt
from fleetpulse_ia.demande import ModeleDemande
modele = ModeleDemande.charger('/content/sortie/modele_demande.pkl')
lignes = sorted(export.get('demande', []), key=lambda l: (l['date'], l['heure']))
reel = [l['commandes'] for l in lignes]
prevu = [modele.predire(l['zoneId'], l['jourSemaine'], l['heure'], l.get('ferie', False), l.get('partenairesActifs', 0))[0] for l in lignes]
plt.figure(figsize=(12, 3))
plt.plot(reel[-168:], label='reel')
plt.plot(prevu[-168:], label='prevu')
plt.title('Demande : 168 derniers creneaux (reel contre prevu)')
plt.legend()
plt.show()
"""),
    code("""
# 8. Telechargement des artefacts
import shutil
shutil.make_archive('/content/fleetpulse_modeles', 'zip', '/content/sortie')
files.download('/content/fleetpulse_modeles.zip')
"""),
]


def main():
    notebook = {
        "cells": CELLULES,
        "metadata": {"colab": {"provenance": []}, "kernelspec": {"name": "python3", "display_name": "Python 3"},
                     "language_info": {"name": "python"}},
        "nbformat": 4,
        "nbformat_minor": 5,
    }
    chemin = os.path.join(DOSSIER, "FleetPulse_IA_Colab.ipynb")
    with open(chemin, "w", encoding="utf-8") as f:
        json.dump(notebook, f, ensure_ascii=False, indent=1)
    print(chemin)


if __name__ == "__main__":
    main()

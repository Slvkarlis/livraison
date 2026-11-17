"""Entraine le modele d'ETA a partir d'un export de l'entrepot (US-401) et l'enregistre.

Usage :
  python entrainer.py export.json             # fichier telecharge depuis GET /api/admin/entrepot/export
  python entrainer.py --simule                 # historique simule (demarrage a froid)
Le fichier peut etre l'export complet ({"eta": [...]}) ou directement la liste de /api/admin/entrepot/jeu-eta.
"""
import argparse
import json
import sys

from fleetpulse_ia.eta import ModeleEta, simuler


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("export", nargs="?", help="export JSON de l'entrepot")
    p.add_argument("--simule", action="store_true", help="entrainer sur un historique simule")
    p.add_argument("--sortie", default="modele_eta.pkl")
    a = p.parse_args(argv)
    if a.simule:
        echantillons = simuler()
    elif a.export:
        with open(a.export, encoding="utf-8") as f:
            donnees = json.load(f)
        echantillons = donnees["eta"] if isinstance(donnees, dict) else donnees
    else:
        p.error("indiquez un export ou --simule")
    modele = ModeleEta()
    mae = modele.entrainer(echantillons)
    modele.sauver(a.sortie)
    print(f"{len(echantillons)} echantillons, modele {modele.version}, erreur moyenne (min) : {mae or 'regles'} -> {a.sortie}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

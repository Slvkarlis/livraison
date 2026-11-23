"""Entraine les modeles du service d'IA a partir des exports du backend, et ecrit les artefacts.

Usage (depuis ia/) :
  python entrainer.py --eta export.json                   # ETA (US-401, US-406)
  python entrainer.py --demande demande.json              # prevision de demande (US-804)
  python entrainer.py --prospects prospects.json          # score de prospection (US-802)
  python entrainer.py --tout --dossier sortie/            # les trois d'un coup
  python entrainer.py --simule --tout --dossier sortie/   # historique simule (demarrage a froid)

Chaque fichier d'entree peut etre un export complet ({"eta": [...], "demande": [...], "prospection": [...]})
ou directement la liste. Sortie : modele_*.pkl et metriques.json (memes noms que le service d'IA).
"""
import argparse
import json
import os
import sys

from fleetpulse_ia.demande import ModeleDemande, simuler as simuler_demande
from fleetpulse_ia.eta import ModeleEta, simuler as simuler_eta
from fleetpulse_ia.prospection import ModeleProspection, simuler as simuler_prospects

CLE_EXPORT = {"eta": "eta", "demande": "demande", "prospection": "prospection"}


def _lire(chemin, cle):
    with open(chemin, encoding="utf-8") as f:
        donnees = json.load(f)
    return donnees[CLE_EXPORT[cle]] if isinstance(donnees, dict) else donnees


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--eta", metavar="FICHIER", help="export contenant les echantillons ETA")
    p.add_argument("--demande", metavar="FICHIER", help="export contenant les lignes de demande par zone et heure")
    p.add_argument("--prospects", metavar="FICHIER", help="export contenant les prospects labellises")
    p.add_argument("--tout", metavar="FICHIER", nargs="?", const="", help="un seul export contenant les trois jeux")
    p.add_argument("--simule", action="store_true", help="entrainer sur un historique simule")
    p.add_argument("--dossier", default=".", help="dossier de sortie (modele_*.pkl, metriques.json)")
    a = p.parse_args(argv)

    if not (a.simule or a.eta or a.demande or a.prospects or a.tout is not None):
        p.error("indiquez un export (--eta, --demande, --prospects, --tout) ou --simule")
    if a.tout:
        a.eta = a.eta or a.tout
        a.demande = a.demande or a.tout
        a.prospects = a.prospects or a.tout

    os.makedirs(a.dossier, exist_ok=True)
    metriques = {}

    if a.simule or a.eta:
        echantillons = simuler_eta() if a.simule else _lire(a.eta, "eta")
        modele = ModeleEta()
        mae = modele.entrainer(echantillons)
        modele.sauver(os.path.join(a.dossier, "modele_eta.pkl"))
        metriques["eta"] = {"echantillons": len(echantillons), "modele": modele.version, "mae": mae}

    if a.simule or a.demande:
        lignes = simuler_demande() if a.simule else _lire(a.demande, "demande")
        modele = ModeleDemande()
        resultat = modele.entrainer(lignes)
        modele.sauver(os.path.join(a.dossier, "modele_demande.pkl"))
        metriques["demande"] = {"lignes": len(lignes), "modele": modele.version, **resultat}

    if a.simule or a.prospects:
        prospects = simuler_prospects() if a.simule else _lire(a.prospects, "prospection")
        modele = ModeleProspection()
        resultat = modele.entrainer(prospects)
        modele.sauver(os.path.join(a.dossier, "modele_prospection.pkl"))
        metriques["prospection"] = {"prospects": len(prospects), "modele": modele.version, **resultat}

    with open(os.path.join(a.dossier, "metriques.json"), "w", encoding="utf-8") as f:
        json.dump(metriques, f, ensure_ascii=False, indent=2)
    print(json.dumps(metriques, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())

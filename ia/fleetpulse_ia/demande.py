"""US-804 : prevision du nombre de commandes par zone et par creneau horaire (Sprint 8).

Entree d'entrainement (une ligne par zone et par heure, exportee par le backend, /api/admin/entrepot/jeu-demande) :
    {"zoneId": 1, "date": "2026-11-02", "heure": 12, "jourSemaine": 1, "ferie": false,
     "partenairesActifs": 4, "commandes": 7}
Cible : "commandes". Metriques : MAE (commandes) et WAPE = somme|erreur| / somme(reel).

Sans historique suffisant, la prevision retombe sur la moyenne historique de la zone pour le meme jour
de semaine et la meme heure, puis sur la moyenne de la zone (la regle est tracee dans la reponse).
"""
import math
import pickle
from collections import defaultdict

import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error

MIN_LIGNES = 60


def _cyclique(heure):
    angle = 2 * math.pi * heure / 24
    return math.sin(angle), math.cos(angle)


def _x(ligne):
    s, c = _cyclique(int(ligne["heure"]))
    return [s, c, int(ligne["jourSemaine"]), 1.0 if ligne.get("ferie") else 0.0,
            float(ligne.get("partenairesActifs") or 0), float(ligne["zoneId"])]


def wape(reel, prevu):
    total = sum(reel)
    return round(sum(abs(r - p) for r, p in zip(reel, prevu)) / total, 4) if total else None


class ModeleDemande:
    def __init__(self):
        self.regresseur = None
        self.moyennes = {}          # (zone, jour, heure) -> moyenne ; (zone,) -> moyenne de repli
        self.version = "moyennes"
        self.metriques = {}

    def entrainer(self, lignes, graine=7, part_test=0.2):
        """Entraine sur les lignes les plus anciennes et evalue sur les plus recentes (decoupage temporel)."""
        lignes = sorted(lignes, key=lambda l: (l["date"], int(l["heure"]), int(l["zoneId"])))
        self._moyennes(lignes)
        if len(lignes) >= MIN_LIGNES:
            coupe = max(1, int(len(lignes) * (1 - part_test)))
            entrainement, test = lignes[:coupe], lignes[coupe:]
            self.regresseur = self._ajuster(entrainement, graine)
            if test:
                reel = [float(l["commandes"]) for l in test]
                prevu = [max(0.0, float(p)) for p in self.regresseur.predict(np.array([_x(l) for l in test]))]
                self.metriques = {"mae": round(float(mean_absolute_error(reel, prevu)), 3), "wape": wape(reel, prevu),
                                  "lignesTest": len(test)}
            self._moyennes(lignes)                      # les replis utilisent tout l'historique
            self.regresseur = self._ajuster(lignes, graine)  # modele final sur tout l'historique
            self.version = "gbr"
        return dict(self.metriques)

    @staticmethod
    def _ajuster(lignes, graine):
        return GradientBoostingRegressor(random_state=graine, n_estimators=150, max_depth=3).fit(
            np.array([_x(l) for l in lignes]), np.array([float(l["commandes"]) for l in lignes]))

    def _moyennes(self, lignes):
        somme = defaultdict(lambda: [0.0, 0])
        for l in lignes:
            for cle in ((int(l["zoneId"]), int(l["jourSemaine"]), int(l["heure"])), (int(l["zoneId"]),)):
                somme[cle][0] += float(l["commandes"])
                somme[cle][1] += 1
        self.moyennes = {cle: total / n for cle, (total, n) in somme.items()}

    def predire(self, zone_id, jour_semaine, heure, ferie=False, partenaires_actifs=0):
        """Retourne (commandes_prevues, regle). Jamais negatif."""
        ligne = {"zoneId": zone_id, "jourSemaine": jour_semaine, "heure": heure, "ferie": ferie,
                 "partenairesActifs": partenaires_actifs}
        if self.regresseur is not None:
            return round(max(0.0, float(self.regresseur.predict(np.array([_x(ligne)]))[0])), 2), "gbr"
        if (zone_id, jour_semaine, heure) in self.moyennes:
            return round(self.moyennes[(zone_id, jour_semaine, heure)], 2), "moyenne-zone-jour-heure"
        return round(self.moyennes.get((zone_id,), 0.0), 2), "moyenne-zone"

    def sauver(self, chemin):
        with open(chemin, "wb") as f:
            pickle.dump(self, f)

    @staticmethod
    def charger(chemin):
        with open(chemin, "rb") as f:
            return pickle.load(f)


def simuler(jours=60, graine=42):
    """Historique simule (demarrage a froid) : pics de midi et du soir, plus de commandes le week-end."""
    import random
    from datetime import date, timedelta
    r = random.Random(graine)
    lignes = []
    debut = date(2026, 1, 1)
    for j in range(jours):
        jour = debut + timedelta(days=j)
        semaine = jour.isoweekday()
        for zone in (1, 2):
            for heure in range(10, 23):
                base = 1.0 + (2.5 if heure in (12, 13) else 0) + (3.0 if heure in (19, 20, 21) else 0)
                base *= 1.3 if semaine >= 6 else 1.0
                partenaires = r.randint(2, 6)
                commandes = max(0, round(base * partenaires / 4 + r.gauss(0, 0.8)))
                lignes.append({"zoneId": zone, "date": jour.isoformat(), "heure": heure, "jourSemaine": semaine,
                               "ferie": False, "partenairesActifs": partenaires, "commandes": commandes})
    return lignes

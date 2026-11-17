"""US-406 : ETA predictive = preparation predite + trajet predit.

Deux regresseurs (gradient boosting de scikit-learn) :
- preparation reelle a partir de l'annonce du commerce, de l'heure, du jour et de la ponctualite passee du commerce ;
- trajet commerce -> client a partir de la distance, de la vitesse moyenne de la zone, de l'heure et de la taille du lot.

Au demarrage, faute d'historique, le modele est entraine sur des donnees simulees (cahier des charges §4.3),
puis recalibre avec le jeu exporte par le backend (/api/admin/entrepot/jeu-eta ou /export).
Sans modele entraine, les regles du backend s'appliquent (annonce du commerce, distance / vitesse de zone).
"""
import math
import pickle
import random
from dataclasses import dataclass

import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error

from .geo import FACTEUR_DETOUR

MIN_ECHANTILLONS = 30


@dataclass
class Caracteristiques:
    partenaire_id: int | None
    preparation_annoncee_min: float
    distance_km: float
    vitesse_zone_kmh: float
    heure: int
    jour_semaine: int
    taille_lot: int = 1


def _pointe(heure):
    """Heures de repas : trafic plus dense et cuisines plus chargees."""
    return 1.0 if heure in (12, 13, 19, 20, 21) else 0.0


def _cyclique(heure):
    angle = 2 * math.pi * heure / 24
    return math.sin(angle), math.cos(angle)


def regle_trajet_min(c):
    return c.distance_km * FACTEUR_DETOUR / max(c.vitesse_zone_kmh, 1) * 60


class ModeleEta:
    def __init__(self):
        self.preparation = None
        self.trajet = None
        self.ponctualite = {}        # partenaire_id -> ratio moyen reel / annonce
        self.version = "regles"
        self.mae = {}

    # ---------------------------------------------------------------- caracteristiques

    def _x_preparation(self, c):
        s, co = _cyclique(c.heure)
        return [c.preparation_annoncee_min, s, co, c.jour_semaine, _pointe(c.heure),
                self.ponctualite.get(c.partenaire_id, 1.0)]

    @staticmethod
    def _x_trajet(c):
        s, co = _cyclique(c.heure)
        return [c.distance_km, c.vitesse_zone_kmh, regle_trajet_min(c), s, co, c.jour_semaine, _pointe(c.heure), c.taille_lot]

    # ---------------------------------------------------------------- entrainement

    def entrainer(self, echantillons, graine=7):
        """echantillons : dicts au format EchantillonEta du backend. Retourne les erreurs moyennes (minutes)."""
        prep = [e for e in echantillons if e.get("preparationReelleMin") is not None and e.get("preparationAnnonceeMin")]
        traj = [e for e in echantillons if e.get("trajetReelMin") is not None and e.get("distanceKm") is not None]
        self.ponctualite = _ponctualites(prep)
        if len(prep) >= MIN_ECHANTILLONS:
            x = np.array([self._x_preparation(_caracs(e)) for e in prep])
            y = np.array([e["preparationReelleMin"] for e in prep])
            self.preparation = GradientBoostingRegressor(random_state=graine, n_estimators=150, max_depth=3).fit(x, y)
            self.mae["preparation"] = round(float(mean_absolute_error(y, self.preparation.predict(x))), 3)
        if len(traj) >= MIN_ECHANTILLONS:
            x = np.array([self._x_trajet(_caracs(e)) for e in traj])
            y = np.array([e["trajetReelMin"] for e in traj])
            self.trajet = GradientBoostingRegressor(random_state=graine, n_estimators=150, max_depth=3).fit(x, y)
            self.mae["trajet"] = round(float(mean_absolute_error(y, self.trajet.predict(x))), 3)
        self.version = "gbr" if self.preparation is not None or self.trajet is not None else "regles"
        return dict(self.mae)

    # ---------------------------------------------------------------- prediction

    def predire(self, c):
        """(preparation_min, trajet_min, modele). Jamais negatif ; regles si un sous-modele manque."""
        if self.preparation is not None:
            preparation = float(self.preparation.predict(np.array([self._x_preparation(c)]))[0])
        else:
            preparation = c.preparation_annoncee_min * self.ponctualite.get(c.partenaire_id, 1.0)
        if self.trajet is not None:
            trajet = float(self.trajet.predict(np.array([self._x_trajet(c)]))[0])
        else:
            trajet = regle_trajet_min(c)
        return max(0.0, round(preparation, 2)), max(0.0, round(trajet, 2)), self.version

    # ---------------------------------------------------------------- persistance

    def sauver(self, chemin):
        with open(chemin, "wb") as f:
            pickle.dump(self, f)

    @staticmethod
    def charger(chemin):
        with open(chemin, "rb") as f:
            return pickle.load(f)


def _caracs(e):
    return Caracteristiques(e.get("partenaireId"), float(e.get("preparationAnnonceeMin") or 0), float(e.get("distanceKm") or 0),
                            float(e.get("vitesseZoneKmh") or 20), int(e.get("heure") or 12), int(e.get("jourSemaine") or 1),
                            int(e.get("tailleLot") or 1))


def _ponctualites(echantillons):
    sommes = {}
    for e in echantillons:
        p = e.get("partenaireId")
        ratio = e["preparationReelleMin"] / e["preparationAnnonceeMin"]
        total, n = sommes.get(p, (0.0, 0))
        sommes[p] = (total + ratio, n + 1)
    # Memes bornes que EstimationLivraisonService.java
    return {p: min(1.5, max(0.8, total / n)) for p, (total, n) in sommes.items()}


def simuler(n=600, graine=42):
    """Historique simule : commerces plus ou moins ponctuels, heures de pointe plus lentes."""
    r = random.Random(graine)
    ponctualite = {p: r.uniform(0.85, 1.4) for p in range(1, 11)}
    echantillons = []
    for _ in range(n):
        p = r.randint(1, 10)
        heure = r.choice(range(10, 23))
        jour = r.randint(1, 7)
        annonce = r.choice([5, 10, 15, 20, 25, 30])
        pointe = _pointe(heure)
        preparation = annonce * ponctualite[p] * (1.15 if pointe else 1.0) + r.gauss(0, 1.5)
        distance = r.uniform(0.5, 8)
        vitesse = r.choice([15, 20, 25])
        trajet = distance * FACTEUR_DETOUR / vitesse * 60 * (1.25 if pointe else 1.0) * (1.1 if jour >= 6 else 1.0) + r.gauss(0, 1)
        echantillons.append({"partenaireId": p, "preparationAnnonceeMin": annonce, "preparationReelleMin": max(1.0, preparation),
                             "distanceKm": round(distance, 3), "vitesseZoneKmh": vitesse, "heure": heure, "jourSemaine": jour,
                             "tailleLot": r.choice([1, 1, 2, 3]), "trajetReelMin": max(1.0, trajet)})
    return echantillons

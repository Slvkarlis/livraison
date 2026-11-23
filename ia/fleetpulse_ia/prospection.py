"""US-802 : score de potentiel des commerces prospects (Sprint 8).

Entree d'entrainement (export des prospects, /api/admin/entrepot/jeu-prospection) :
    {"categorie": "BOULANGERIE", "distanceClientsKm": 1.2, "clientsZone": 40, "couvertureZonePct": 35.0,
     "concurrentsProches": 2, "converti": true}
Cible : "converti" (le commerce a fini inscrit). Metriques : AUC et precision parmi les 10 meilleurs scores.

Sans historique suffisant ou sans modele, le score est une regle lisible :
  base 50 + bonus clients de la zone + bonus zone peu couverte - malus concurrence, borne entre 0 et 100.
"""
import pickle

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import train_test_split

MIN_LIGNES = 40
CATEGORIES = ["BOULANGERIE", "RESTAURANT", "EPICERIE", "PHARMACIE", "AUTRE"]


def _x(p):
    categorie = str(p.get("categorie") or "AUTRE").upper()
    if categorie not in CATEGORIES:
        categorie = "AUTRE"
    one_hot = [1.0 if categorie == c else 0.0 for c in CATEGORIES]
    return one_hot + [float(p.get("distanceClientsKm") or 0), float(p.get("clientsZone") or 0),
                      float(p.get("couvertureZonePct") or 0), float(p.get("concurrentsProches") or 0)]


def score_regle(p):
    """Score lisible 0-100 utilise sans modele entraine."""
    score = 50.0
    score += min(20.0, float(p.get("clientsZone") or 0) / 5)           # zone dense en clients
    score += max(0.0, 20.0 - float(p.get("couvertureZonePct") or 0) / 5)  # zone peu couverte
    score -= min(25.0, 5.0 * float(p.get("concurrentsProches") or 0))  # concurrence proche
    score -= min(10.0, 2.0 * float(p.get("distanceClientsKm") or 0))   # clients eloignes
    return round(max(0.0, min(100.0, score)), 1)


class ModeleProspection:
    def __init__(self):
        self.classifieur = None
        self.version = "regle"
        self.metriques = {}

    def entrainer(self, lignes, graine=7):
        lignes = [l for l in lignes if l.get("converti") is not None]
        if len(lignes) < MIN_LIGNES or len({bool(l["converti"]) for l in lignes}) < 2:
            return dict(self.metriques)
        x = np.array([_x(l) for l in lignes])
        y = np.array([1 if l["converti"] else 0 for l in lignes])
        x_train, x_test, y_train, y_test = train_test_split(x, y, test_size=0.25, random_state=graine, stratify=y)
        modele = LogisticRegression(max_iter=1000, class_weight="balanced").fit(x_train, y_train)
        proba = modele.predict_proba(x_test)[:, 1]
        self.metriques = {"auc": round(float(roc_auc_score(y_test, proba)), 3),
                          "precisionTop10": round(float(y_test[np.argsort(-proba)[:10]].mean()), 3),
                          "lignesTest": int(len(y_test))}
        self.classifieur = LogisticRegression(max_iter=1000, class_weight="balanced").fit(x, y)
        self.version = "logistique"
        return dict(self.metriques)

    def scorer(self, p):
        """(score 0-100, modele). Le modele donne une probabilite de conversion, convertie en score."""
        if self.classifieur is None:
            return score_regle(p), "regle"
        proba = float(self.classifieur.predict_proba(np.array([_x(p)]))[0][1])
        return round(100 * proba, 1), "logistique"

    def sauver(self, chemin):
        with open(chemin, "wb") as f:
            pickle.dump(self, f)

    @staticmethod
    def charger(chemin):
        with open(chemin, "rb") as f:
            return pickle.load(f)


def simuler(n=300, graine=42):
    """Prospects simules : les commerces proches de beaucoup de clients et sans concurrence se convertissent davantage."""
    import random
    r = random.Random(graine)
    lignes = []
    for _ in range(n):
        categorie = r.choice(CATEGORIES)
        distance = r.uniform(0.2, 5)
        clients = r.randint(5, 80)
        couverture = r.uniform(0, 80)
        concurrents = r.randint(0, 5)
        logit = 0.04 * clients - 0.5 * concurrents - 0.3 * distance - 0.03 * couverture + 0.5 * (categorie == "RESTAURANT") - 0.5
        converti = r.random() < 1 / (1 + pow(2.718281828, -logit))
        lignes.append({"categorie": categorie, "distanceClientsKm": round(distance, 2), "clientsZone": clients,
                       "couvertureZonePct": round(couverture, 1), "concurrentsProches": concurrents, "converti": converti})
    return lignes

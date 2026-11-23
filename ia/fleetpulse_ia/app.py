"""API HTTP du service d'IA (FastAPI). Contrat partage avec ServiceIa.java.

Lancer : uvicorn fleetpulse_ia.app:app --port 8090   (puis APP_IA_URL=http://localhost:8090 cote backend)
"""
import os

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from . import __version__
from .demande import ModeleDemande, simuler as simuler_demande
from .eta import Caracteristiques, ModeleEta, simuler
from .prospection import ModeleProspection, simuler as simuler_prospects
from .lots import Commande, regrouper

CHEMIN_MODELE = os.environ.get("FLEETPULSE_MODELE_ETA", "modele_eta.pkl")


def _modele_initial():
    if os.path.exists(CHEMIN_MODELE):
        return ModeleEta.charger(CHEMIN_MODELE)
    modele = ModeleEta()
    modele.entrainer(simuler())   # demarrage a froid : historique simule
    return modele


app = FastAPI(title="FleetPulse IA", version=__version__)
CHEMIN_DEMANDE = os.environ.get("FLEETPULSE_MODELE_DEMANDE", "modele_demande.pkl")
CHEMIN_PROSPECTION = os.environ.get("FLEETPULSE_MODELE_PROSPECTION", "modele_prospection.pkl")


def _charger_ou_simuler(chemin, classe, simulation):
    if os.path.exists(chemin):
        return classe.charger(chemin)
    modele = classe()
    modele.entrainer(simulation())   # demarrage a froid : historique simule, remplace par l'entrainement Colab
    return modele


etat = {"modele": _modele_initial(),
        "demande": _charger_ou_simuler(CHEMIN_DEMANDE, ModeleDemande, simuler_demande),
        "prospection": _charger_ou_simuler(CHEMIN_PROSPECTION, ModeleProspection, simuler_prospects)}


class CaracteristiquesEta(BaseModel):
    partenaireId: int | None = None
    preparationAnnonceeMin: float = Field(ge=0, le=600)
    distanceKm: float = Field(ge=0, le=500)
    vitesseZoneKmh: float = Field(gt=0, le=200)
    heure: int = Field(ge=0, le=23)
    jourSemaine: int = Field(ge=1, le=7)
    tailleLot: int = Field(default=1, ge=1, le=10)


class PositionIa(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class CommandeIa(BaseModel):
    id: int
    zoneId: int | None = None
    commerce: PositionIa
    client: PositionIa
    preteDepuisSecondes: int = 0


class DemandeLots(BaseModel):
    commandes: list[CommandeIa]
    voisines: dict[str, list[int]] = {}
    rayonKm: float = Field(default=1.5, gt=0)
    vitesseKmh: float = Field(default=20, gt=0)
    aBordMaxMinutes: int = Field(default=35, gt=0)


@app.post("/v1/entrainement/demande")
def entrainement_demande(lignes: list[dict]):
    """US-806 : reentraine le modele de demande sur un jeu exporte (contrat handoff/CONTRATS.md)."""
    modele = ModeleDemande()
    metriques = modele.entrainer(lignes)
    modele.sauver(CHEMIN_DEMANDE)
    etat["demande"] = modele
    return {"modele": modele.version, "lignes": len(lignes), "metriques": metriques}


@app.post("/v1/entrainement/prospection")
def entrainement_prospection(prospects: list[dict]):
    """US-806 : reentraine le score de prospection sur les prospects dont l'issue est connue."""
    modele = ModeleProspection()
    metriques = modele.entrainer(prospects)
    modele.sauver(CHEMIN_PROSPECTION)
    etat["prospection"] = modele
    return {"modele": modele.version, "prospects": len(prospects), "metriques": metriques}


@app.get("/sante")
def sante():
    return {"statut": "ok", "version": __version__, "modeleEta": etat["modele"].version, "mae": etat["modele"].mae,
            "modeleDemande": etat["demande"].version, "metriquesDemande": etat["demande"].metriques,
            "modeleProspection": etat["prospection"].version, "metriquesProspection": etat["prospection"].metriques}


@app.post("/v1/eta")
def eta(c: CaracteristiquesEta):
    preparation, trajet, modele = etat["modele"].predire(Caracteristiques(
        c.partenaireId, c.preparationAnnonceeMin, c.distanceKm, c.vitesseZoneKmh, c.heure, c.jourSemaine, c.tailleLot))
    return {"preparationMin": preparation, "trajetMin": trajet, "modele": modele}


class DemandeIa(BaseModel):
    zoneId: int
    jourSemaine: int = Field(ge=1, le=7)
    heure: int = Field(ge=0, le=23)
    ferie: bool = False
    partenairesActifs: int = Field(default=0, ge=0, le=10000)


class ProspectIa(BaseModel):
    categorie: str = "AUTRE"
    distanceClientsKm: float = Field(default=0, ge=0, le=500)
    clientsZone: int = Field(default=0, ge=0)
    couvertureZonePct: float = Field(default=0, ge=0, le=100)
    concurrentsProches: int = Field(default=0, ge=0)


@app.post("/v1/demande/predire")
def demande_predire(d: list[DemandeIa]):
    """US-804 : commandes attendues par zone et creneau. Un appel par lot de creneaux (200 au plus)."""
    if len(d) > 200:
        raise HTTPException(status_code=413, detail="200 creneaux au plus par appel")
    resultats = []
    for c in d:
        prevu, regle = etat["demande"].predire(c.zoneId, c.jourSemaine, c.heure, c.ferie, c.partenairesActifs)
        resultats.append({"zoneId": c.zoneId, "jourSemaine": c.jourSemaine, "heure": c.heure,
                          "commandesPrevues": prevu, "regle": regle})
    return {"previsions": resultats, "modele": etat["demande"].version, "metriques": etat["demande"].metriques}


@app.post("/v1/prospection/score")
def prospection_score(prospects: list[ProspectIa]):
    """US-802 : score de potentiel 0-100 pour chaque prospect."""
    if len(prospects) > 500:
        raise HTTPException(status_code=413, detail="500 prospects au plus par appel")
    scores = []
    for p in prospects:
        score, modele = etat["prospection"].scorer(p.model_dump())
        scores.append({"score": score, "modele": modele})
    return {"scores": scores, "modele": etat["prospection"].version, "metriques": etat["prospection"].metriques}


@app.post("/v1/lots")
def lots(d: DemandeLots):
    if len(d.commandes) > 200:
        raise HTTPException(status_code=413, detail="200 commandes au plus par appel")
    commandes = [Commande(c.id, c.zoneId, (c.commerce.latitude, c.commerce.longitude), (c.client.latitude, c.client.longitude),
                          c.preteDepuisSecondes) for c in d.commandes]
    voisines = {int(z): set(ids) for z, ids in d.voisines.items()}
    resultat = regrouper(commandes, voisines, d.rayonKm, d.vitesseKmh, d.aBordMaxMinutes * 60)
    return {"lots": [{"commandes": [c.id for c in contenu], "itineraire": tournee.code() if tournee else []}
                     for contenu, tournee in resultat], "moteur": "economies"}


@app.post("/v1/entrainement")
def entrainement(echantillons: list[dict]):
    """Recalibre le modele d'ETA avec le jeu exporte par le backend (EchantillonEta)."""
    modele = ModeleEta()
    mae = modele.entrainer(echantillons)
    modele.sauver(CHEMIN_MODELE)
    etat["modele"] = modele
    return {"modele": modele.version, "echantillons": len(echantillons), "mae": mae}

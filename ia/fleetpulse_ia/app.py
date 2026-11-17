"""API HTTP du service d'IA (FastAPI). Contrat partage avec ServiceIa.java.

Lancer : uvicorn fleetpulse_ia.app:app --port 8090   (puis APP_IA_URL=http://localhost:8090 cote backend)
"""
import os

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from . import __version__
from .eta import Caracteristiques, ModeleEta, simuler
from .lots import Commande, regrouper

CHEMIN_MODELE = os.environ.get("FLEETPULSE_MODELE_ETA", "modele_eta.pkl")


def _modele_initial():
    if os.path.exists(CHEMIN_MODELE):
        return ModeleEta.charger(CHEMIN_MODELE)
    modele = ModeleEta()
    modele.entrainer(simuler())   # demarrage a froid : historique simule
    return modele


app = FastAPI(title="FleetPulse IA", version=__version__)
etat = {"modele": _modele_initial()}


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


@app.get("/sante")
def sante():
    return {"statut": "ok", "version": __version__, "modeleEta": etat["modele"].version, "mae": etat["modele"].mae}


@app.post("/v1/eta")
def eta(c: CaracteristiquesEta):
    preparation, trajet, modele = etat["modele"].predire(Caracteristiques(
        c.partenaireId, c.preparationAnnonceeMin, c.distanceKm, c.vitesseZoneKmh, c.heure, c.jourSemaine, c.tailleLot))
    return {"preparationMin": preparation, "trajetMin": trajet, "modele": modele}


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

"""US-404 : ordre optimal des collectes et livraisons d'un lot sous contrainte de duree a bord.

Jusqu'a 4 commandes (8 arrets), toutes les tournees valides sont explorees : l'optimum est exact.
Au-dela (lots plus grands, hors du perimetre actuel de 3 commandes), une insertion gloutonne donne une bonne tournee ;
c'est la que le solveur de ramassage et livraison d'OR-Tools prendra le relais.
"""
from dataclasses import dataclass, field

from .geo import TEMPS_ARRET_S, km_route, trajet_s

COLLECTE, LIVRAISON = "C", "L"


@dataclass(frozen=True)
class Course:
    id: int
    commerce: tuple
    client: tuple
    a_bord: bool = False


@dataclass
class Tournee:
    etapes: list = field(default_factory=list)   # (type, id, point, arrivee_s)
    duree_s: int = 0
    distance_km: float = 0.0
    a_bord_s: dict = field(default_factory=dict)

    def code(self):
        return [f"{t}:{i}" for t, i, _, _ in self.etapes]

    def livraison_s(self, commande_id):
        for t, i, _, arrivee in self.etapes:
            if t == LIVRAISON and i == commande_id:
                return arrivee
        return None


def optimiser(courses, vitesse_kmh, a_bord_max_s=None, depart=None):
    """Meilleure tournee (duree minimale, puis distance) ou None si aucune ne respecte la duree a bord."""
    if not courses or vitesse_kmh <= 0:
        return None
    if len(courses) > 4:
        return _grande_tournee(courses, vitesse_kmh, a_bord_max_s, depart)
    meilleure = [None]

    def explorer(position, etapes, collecte_le, ecoule, distance, collectees, livrees):
        if len(livrees) == len(courses):
            a_bord = {i: arrivee - collecte_le.get(i, 0) for t, i, _, arrivee in etapes if t == LIVRAISON}
            candidate = Tournee(list(etapes), ecoule, distance, a_bord)
            m = meilleure[0]
            if m is None or ecoule < m.duree_s or (ecoule == m.duree_s and distance < m.distance_km):
                meilleure[0] = candidate
            return
        if meilleure[0] is not None and ecoule > meilleure[0].duree_s:
            return
        for c in courses:
            if not c.a_bord and c.id not in collectees:
                avancer(c, COLLECTE, c.commerce, position, etapes, collecte_le, ecoule, distance, collectees, livrees)
            elif c.id not in livrees and (c.a_bord or c.id in collectees):
                avancer(c, LIVRAISON, c.client, position, etapes, collecte_le, ecoule, distance, collectees, livrees)

    def avancer(c, type_, cible, position, etapes, collecte_le, ecoule, distance, collectees, livrees):
        d = 0.0 if position is None else km_route(position, cible)
        arrivee = ecoule if position is None else ecoule + trajet_s(position, cible, vitesse_kmh)
        if type_ == LIVRAISON and not c.a_bord and a_bord_max_s is not None and arrivee - collecte_le[c.id] > a_bord_max_s:
            return
        etapes.append((type_, c.id, cible, arrivee))
        apres = arrivee + TEMPS_ARRET_S
        if type_ == COLLECTE:
            collectees.add(c.id)
            collecte_le[c.id] = apres
        else:
            livrees.add(c.id)
        explorer(cible, etapes, collecte_le, apres, distance + d, collectees, livrees)
        if type_ == COLLECTE:
            collectees.discard(c.id)
            del collecte_le[c.id]
        else:
            livrees.discard(c.id)
        etapes.pop()

    explorer(depart, [], {}, 0, 0.0, set(), set())
    return meilleure[0]


def _grande_tournee(courses, vitesse_kmh, a_bord_max_s, depart):
    # Insertion gloutonne : chaque commande est inseree a la meilleure place (collecte puis livraison)
    ordre = []
    for c in courses:
        meilleur = None
        for i in range(len(ordre) + 1):
            for j in range(i + 1, len(ordre) + 2):
                essai = ordre[:i] + [(COLLECTE, c)] + ordre[i:]
                essai = essai[:j] + [(LIVRAISON, c)] + essai[j:]
                t = _evaluer(essai, vitesse_kmh, a_bord_max_s, depart)
                if t is not None and (meilleur is None or t.duree_s < meilleur[1].duree_s):
                    meilleur = (essai, t)
        if meilleur is None:
            return None
        ordre = meilleur[0]
    return _evaluer(ordre, vitesse_kmh, a_bord_max_s, depart)


def _evaluer(ordre, vitesse_kmh, a_bord_max_s, depart):
    position, ecoule, distance, collecte_le, etapes = depart, 0, 0.0, {}, []
    for type_, c in ordre:
        cible = c.commerce if type_ == COLLECTE else c.client
        if position is not None:
            ecoule += trajet_s(position, cible, vitesse_kmh)
            distance += km_route(position, cible)
        if type_ == LIVRAISON and a_bord_max_s is not None and ecoule - collecte_le.get(c.id, 0) > a_bord_max_s:
            return None
        etapes.append((type_, c.id, cible, ecoule))
        ecoule += TEMPS_ARRET_S
        if type_ == COLLECTE:
            collecte_le[c.id] = ecoule
        position = cible
    a_bord = {i: arrivee - collecte_le.get(i, 0) for t, i, _, arrivee in etapes if t == LIVRAISON}
    return Tournee(etapes, ecoule, distance, a_bord)

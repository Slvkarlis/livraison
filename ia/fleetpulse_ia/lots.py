"""US-403 : regroupement de 2 a 3 collectes proches par l'algorithme des economies (Clarke et Wright).

Chaque commande commence seule. L'economie d'une fusion est le temps gagne a livrer deux lots en une seule tournee
plutot que separement. Les fusions sont appliquees de la plus rentable a la moins rentable, tant que :
- les commerces sont dans la meme zone ou des zones adjacentes et a moins de rayon_km les uns des autres ;
- le lot fusionne compte au plus 3 commandes ;
- une tournee respecte la duree maximale a bord.
Contrairement au glouton Java (qui part de la commande la plus ancienne), la recherche est globale : deux commandes
qui se completent bien sont regroupees meme si une troisieme, plus ancienne, est proche de l'une d'elles.
"""
from dataclasses import dataclass

from .geo import TEMPS_ARRET_S, km, trajet_s
from .itineraire import Course, optimiser

TAILLE_MAX = 3
ECART_PRETE_MAX_S = 600


@dataclass(frozen=True)
class Commande:
    id: int
    zone_id: int
    commerce: tuple
    client: tuple
    prete_depuis_s: int = 0

    def course(self):
        return Course(self.id, self.commerce, self.client)


def compatibles(a, b, voisines, rayon_km):
    meme_zone = a.zone_id == b.zone_id or b.zone_id in voisines.get(a.zone_id, set())
    if not meme_zone or km(a.commerce, b.commerce) > rayon_km:
        return False
    return abs(a.prete_depuis_s - b.prete_depuis_s) <= ECART_PRETE_MAX_S


def regrouper(commandes, voisines, rayon_km, vitesse_kmh, a_bord_max_s):
    """Partition des commandes en lots : liste de (liste de commandes, tournee)."""
    lots = {c.id: [c] for c in commandes}
    tournees = {c.id: optimiser([c.course()], vitesse_kmh, None) for c in commandes}

    def duree(cle):
        return tournees[cle].duree_s

    while True:
        meilleure = None
        cles = sorted(lots)
        for i, a in enumerate(cles):
            for b in cles[i + 1:]:
                fusion = lots[a] + lots[b]
                if len(fusion) > TAILLE_MAX:
                    continue
                if not all(compatibles(x, y, voisines, rayon_km) for x in fusion for y in fusion if x.id < y.id):
                    continue
                tournee = optimiser([c.course() for c in fusion], vitesse_kmh, a_bord_max_s)
                if tournee is None:
                    continue
                economie = duree(a) + duree(b) - tournee.duree_s
                if economie > 0 and (meilleure is None or economie > meilleure[0]):
                    meilleure = (economie, a, b, tournee)
        if meilleure is None:
            break
        _, a, b, tournee = meilleure
        lots[a] = lots[a] + lots.pop(b)
        tournees[a] = tournee
        del tournees[b]
    return [(lots[cle], tournees[cle]) for cle in sorted(lots, key=lambda k: min(c.id for c in lots[k]))]


def duree_separee_s(commande, vitesse_kmh):
    """Duree d'une livraison seule : collecte, trajet, remise."""
    return trajet_s(commande.commerce, commande.client, vitesse_kmh) + 2 * TEMPS_ARRET_S

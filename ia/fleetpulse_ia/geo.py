"""Distances et durees, identiques a Distances.java et Itineraire.java (meme detour, meme temps d'arret)."""
import math

RAYON_TERRE_KM = 6371.0088
FACTEUR_DETOUR = 1.3
TEMPS_ARRET_S = 120


def km(a, b):
    """Distance a vol d'oiseau (haversine) entre deux points (latitude, longitude)."""
    lat1, lng1 = a
    lat2, lng2 = b
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    h = math.sin(d_lat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lng / 2) ** 2
    return 2 * RAYON_TERRE_KM * math.asin(min(1.0, math.sqrt(h)))


def km_route(a, b):
    """Distance estimee par la route : les rues ne sont pas droites."""
    return km(a, b) * FACTEUR_DETOUR


def trajet_s(a, b, vitesse_kmh):
    """Duree du trajet en secondes, arrondie comme en Java (Math.round)."""
    return int(math.floor(km_route(a, b) / vitesse_kmh * 3600 + 0.5))

"""Verification de bout en bout des appels API utilises par les applications mobiles.

Usage : python scripts/e2e_mobile_api.py [http://localhost:8083]
Cree un livreur, un vehicule et un client avec des emails uniques (suffixe horodate).
"""
import json
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8083").rstrip("/")
SUFFIXE = str(int(time.time()))
echecs = 0


def appel(methode, chemin, corps=None, jeton=None):
    donnees = json.dumps(corps).encode() if corps is not None else None
    requete = urllib.request.Request(BASE + chemin, data=donnees, method=methode)
    requete.add_header("Content-Type", "application/json")
    if jeton:
        requete.add_header("Authorization", "Bearer " + jeton)
    try:
        with urllib.request.urlopen(requete) as reponse:
            texte = reponse.read().decode()
            return reponse.status, json.loads(texte) if texte else None
    except urllib.error.HTTPError as erreur:
        return erreur.code, None


def verifier(libelle, condition):
    global echecs
    print(("OK   " if condition else "ECHEC") + " " + libelle)
    if not condition:
        echecs += 1


def connexion(email, mot_de_passe):
    statut, corps = appel("POST", "/api/auth/login", {"email": email, "motDePasse": mot_de_passe})
    return corps["token"] if statut == 200 else None


admin = connexion("admin@fleetpulse.tn", "admin12345")
verifier("connexion responsable", admin is not None)

# Livreur + vehicule affecte (US-02, US-03) -> visible dans l'app livreur via /api/me
email_livreur = f"livreur.{SUFFIXE}@test.tn"
statut, livreur = appel("POST", "/api/admin/livreurs", {
    "nom": "Test", "prenom": "Livreur", "email": email_livreur, "motDePasse": "livreur123", "telephone": "20000000",
}, admin)
verifier("creation livreur", statut == 201)
statut, vehicule = appel("POST", "/api/admin/vehicules", {
    "immatriculation": f"{SUFFIXE[-3:]} TU {SUFFIXE[-4:]}", "type": "moto", "capaciteKg": 30,
    "consommationLitres100Km": 3.5,
}, admin)
verifier("creation vehicule", statut == 201)

jeton_livreur = connexion(email_livreur, "livreur123")
statut, moi = appel("GET", "/api/me", jeton=jeton_livreur)
verifier("livreur /api/me sans vehicule", statut == 200 and moi["role"] == "LIVREUR" and moi["vehicule"] is None)

statut, _ = appel("PUT", f"/api/admin/livreurs/{livreur['id']}/vehicule", {"vehiculeId": vehicule["id"]}, admin)
verifier("affectation vehicule", statut == 200)
statut, moi = appel("GET", "/api/me", jeton=jeton_livreur)
verifier("livreur /api/me avec vehicule",
         statut == 200 and moi["vehicule"] and moi["vehicule"]["immatriculation"] == vehicule["immatriculation"])
statut, _ = appel("GET", "/api/livraisons/mes", jeton=jeton_livreur)
verifier("livreur interdit sur /api/livraisons/mes (403)", statut == 403)

# Client (US-04, US-05, US-06)
email_client = f"client.{SUFFIXE}@test.tn"
statut, _ = appel("POST", "/api/auth/signup", {
    "nom": "Test", "prenom": "Client", "email": email_client, "motDePasse": "client123",
})
verifier("inscription client", statut == 201)
statut, _ = appel("POST", "/api/auth/signup", {
    "nom": "Test", "prenom": "Client", "email": email_client, "motDePasse": "client123",
})
verifier("inscription en double (409)", statut == 409)
verifier("mauvais mot de passe (401)", connexion(email_client, "mauvais123") is None)

jeton_client = connexion(email_client, "client123")
statut, moi = appel("GET", "/api/me", jeton=jeton_client)
verifier("client /api/me", statut == 200 and moi["role"] == "CLIENT" and moi["prenom"] == "Client")
statut, liste = appel("GET", "/api/livraisons/mes", jeton=jeton_client)
verifier("client sans commande", statut == 200 and liste == [])

debut = (datetime.now(timezone.utc) + timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)
commande = {
    "adresse": "Avenue Habib Bourguiba, Tunis", "latitude": 36.8008, "longitude": 10.1800,
    "creneauDebut": debut.isoformat().replace("+00:00", "Z"),
    "creneauFin": (debut + timedelta(hours=2)).isoformat().replace("+00:00", "Z"),
    "modePaiement": "COD", "montantACollecter": 42.5,
}
statut, creee = appel("POST", "/api/livraisons", commande, jeton_client)
verifier("creation commande", statut == 201 and creee["statut"] == "EN_PREPARATION")
statut, _ = appel("POST", "/api/livraisons", {**commande, "latitude": 123}, jeton_client)
verifier("commande avec GPS invalide (400)", statut == 400)
statut, liste = appel("GET", "/api/livraisons/mes", jeton=jeton_client)
verifier("client voit sa commande", statut == 200 and [l["id"] for l in liste] == [creee["id"]])
verifier("coordonnees conservees (lat, lng)",
         liste[0]["latitude"] == 36.8008 and liste[0]["longitude"] == 10.1800)

statut, _ = appel("GET", "/api/livraisons", jeton=jeton_client)
verifier("client interdit sur la liste responsable (403)", statut == 403)
statut, toutes = appel("GET", "/api/livraisons", jeton=admin)
verifier("responsable voit la commande (US-07)", statut == 200 and any(l["id"] == creee["id"] for l in toutes))

# Session invalide -> 401 (les apps deconnectent l'utilisateur)
statut, _ = appel("GET", "/api/me")
verifier("sans jeton (401)", statut == 401)
statut, _ = appel("GET", "/api/me", jeton="jeton.invalide.x")
verifier("jeton invalide (401)", statut == 401)

print(f"\n{'Tout est OK' if echecs == 0 else str(echecs) + ' echec(s)'}")
sys.exit(1 if echecs else 0)

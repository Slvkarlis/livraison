"""Verification de bout en bout des appels API utilises par les applications mobiles.

Usage : python scripts/e2e_mobile_api.py [http://localhost:8083]
Cree un livreur, un vehicule et un client avec des emails uniques (suffixe horodate).
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8083").rstrip("/")
SUFFIXE = str(int(time.time()))
echecs = 0


def appel(methode, chemin, corps=None, jeton=None):
    """Renvoie (statut HTTP, corps JSON ou None)."""
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
        texte = erreur.read().decode()
        try:
            return erreur.code, json.loads(texte) if texte else None
        except ValueError:
            return erreur.code, None


def verifier(libelle, condition):
    global echecs
    print(("OK   " if condition else "ECHEC") + " " + libelle)
    if not condition:
        echecs += 1


def connexion(email, mot_de_passe):
    statut, corps = appel("POST", "/api/auth/login", {"email": email, "motDePasse": mot_de_passe})
    return corps["token"] if statut == 200 else None


admin = connexion(os.environ.get("ADMIN_EMAIL", "admin@fleetpulse.tn"), os.environ.get("ADMIN_PASSWORD", "admin12345"))
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
iso = lambda d: d.isoformat().replace("+00:00", "Z")
position = {"latitude": 36.81, "longitude": 10.1815}

# Sprint 2 : réutiliser la couverture existante ou créer une zone sur une base de démonstration vide.
statut, zones = appel("GET", "/api/admin/zones", jeton=admin)
verifier("zones accessibles au responsable", statut == 200)
if not zones:
    statut, _ = appel("POST", "/api/admin/zones", {"nom": "Tunis test API", "fraisLivraison": 3.5, "polygone": [
        {"latitude": 36.77, "longitude": 10.13}, {"latitude": 36.77, "longitude": 10.23},
        {"latitude": 36.85, "longitude": 10.23}, {"latitude": 36.85, "longitude": 10.13}]}, admin)
    verifier("creation zone", statut == 201)

statut, devis_creneau = appel("POST", "/api/livraisons/devis", {**position, "typeLivraison": "PLANIFIEE"}, jeton_client)
verifier("devis creneau : tarif normal sans supplement",
         statut == 200 and devis_creneau["supplementImmediat"] == 0 and devis_creneau["total"] == devis_creneau["fraisLivraison"] > 0)
statut, devis_immediat = appel("POST", "/api/livraisons/devis", {**position, "typeLivraison": "IMMEDIATE"}, jeton_client)
verifier("frais de zone identiques sans supplement immediat",
         statut == 200 and devis_immediat["supplementImmediat"] == 0
         and devis_immediat["fraisLivraison"] == devis_creneau["fraisLivraison"]
         and abs(devis_immediat["total"] - devis_creneau["total"] - devis_immediat["supplementImmediat"]) < 0.001)
statut, corps = appel("POST", "/api/livraisons/devis", {"latitude": 35.8256, "longitude": 10.6084,
                                                        "typeLivraison": "PLANIFIEE"}, jeton_client)
verifier("adresse hors zone refusee avec message (400)", statut == 400 and "non desservie" in (corps or {}).get("message", ""))

commande = {
    "adresse": "Avenue Habib Bourguiba, Tunis", **position, "typeLivraison": "PLANIFIEE",
    "creneauDebut": iso(debut), "creneauFin": iso(debut + timedelta(hours=2)), "modePaiement": "COD",
    "montantACollecter": 0.001,  # ignore : le prix est calcule par le serveur
}
statut, _ = appel("POST", "/api/livraisons", commande, jeton_client)
verifier("ancien COD sans articles refuse", statut == 400)
email_partenaire = f"partenaire.{SUFFIXE}@test.tn"
statut, dossier = appel("POST", "/api/auth/inscription/partenaire", {
    "nom": "Test", "prenom": "Partenaire", "email": email_partenaire, "motDePasse": "partenaire123",
    "telephone": "+2164" + SUFFIXE[-7:], "nomCommerce": "Commerce test API", "categorie": "Restaurant",
    "adresse": "Tunis", **position, "matriculeFiscal": "TEST-API",
})
verifier("candidature partenaire", statut == 201)
statut, _ = appel("PUT", f"/api/admin/dossiers/{dossier['id']}/valider", jeton=admin)
verifier("validation partenaire", statut == 200)
jeton_partenaire = connexion(email_partenaire, "partenaire123")
statut, _ = appel("PUT", "/api/partenaire/commerce", {"ouvert": True}, jeton_partenaire)
verifier("ouverture partenaire couvert", statut == 200)
statut, produit = appel("POST", "/api/partenaire/produits", {"nom": "Brik", "prix": 6.125, "disponible": True}, jeton_partenaire)
verifier("publication produit", statut == 201)
statut, adresse = appel("POST", "/api/adresses", {"libelle": "Maison", "adresse": commande["adresse"], **position}, jeton_client)
verifier("enregistrement adresse geolocalisee", statut == 201)
panier = {"partenaireId": dossier["id"], "adresseId": adresse["id"], "lignes": [{"produitId": produit["id"], "quantite": 2}], "notes": "Sans sel"}
statut, devis = appel("POST", "/api/commandes/devis", panier, jeton_client)
verifier("devis articles plus frais serveur", statut == 200 and abs(devis["total"] - 12.25 - devis["fraisLivraison"]) < .00001)
validation = {**panier, "devisEmpreinte": devis["empreinte"], "cleIdempotence": "test_api_cod_" + SUFFIXE, "total": .001}
statut, creee = appel("POST", "/api/commandes", validation, jeton_client)
verifier("commande COD PENDING_PARTNER", statut == 201 and creee["statut"] == "PENDING_PARTNER" and creee["montantTotal"] == devis["total"])
statut, doublon = appel("POST", "/api/commandes", validation, jeton_client)
verifier("double envoi idempotent", statut == 201 and doublon["id"] == creee["id"])

statut, corps = appel("POST", "/api/livraisons", {**commande, "latitude": 123}, jeton_client)
verifier("commande avec GPS invalide (400 + message)", statut == 400 and corps and corps.get("message"))
statut, _ = appel("POST", "/api/livraisons", {**commande, "creneauDebut": iso(debut - timedelta(hours=5)),
                                               "creneauFin": iso(debut - timedelta(hours=3))}, jeton_client)
verifier("creneau passe refuse (400)", statut == 400)
statut, liste = appel("GET", "/api/livraisons/mes", jeton=jeton_client)
verifier("client voit sa commande et ses lignes", statut == 200 and [l["id"] for l in liste] == [creee["id"]] and len(liste[0]["lignes"]) == 1)
verifier("coordonnees conservees (lat, lng)",
         liste[0]["latitude"] == position["latitude"] and liste[0]["longitude"] == position["longitude"])

verifier("commande especes : a regler au livreur",
         creee["statutPaiement"] == "A_LA_LIVRAISON" and creee["montantACollecter"] == creee["montantTotal"])

# Paiement par carte (Stripe) : sans cles STRIPE_* sur le serveur, la carte est proprement desactivee.
statut, config = appel("GET", "/api/paiements/config", jeton=jeton_client)
verifier("config paiement lisible par le client", statut == 200 and "carteDisponible" in config)
statut, carte = appel("POST", "/api/livraisons", {**commande, "modePaiement": "CARTE"}, jeton_client)
if config and config["carteDisponible"]:
    verifier("commande carte : en attente, rien a encaisser par le livreur",
             statut == 201 and carte["statutPaiement"] == "EN_ATTENTE" and carte["montantACollecter"] == 0)
    statut, paiement = appel("POST", f"/api/livraisons/{carte['id']}/paiement", jeton=jeton_client)
    verifier("PaymentIntent Stripe cree (client_secret)",
             statut == 200 and paiement["clientSecret"].startswith("pi_") and paiement["montant"] == carte["montantTotal"])
    statut, verifiee = appel("POST", f"/api/livraisons/{carte['id']}/paiement/verifier", jeton=jeton_client)
    verifier("paiement non confirme reste en attente", statut == 200 and verifiee["statutPaiement"] == "EN_ATTENTE")
else:
    verifier("commande carte refusee tant que Stripe n'est pas configure (400)",
             statut == 400 and "carte" in (carte or {}).get("message", ""))
statut, _ = appel("POST", f"/api/livraisons/{creee['id']}/paiement", jeton=jeton_client)
verifier("paiement carte refuse sur une commande en especes (400)", statut == 400)
statut, _ = appel("GET", "/api/paiements/config", jeton=jeton_livreur)
verifier("livreur interdit sur la config paiement (403)", statut == 403)
statut, _ = appel("POST", "/api/stripe/webhook", {"type": "payment_intent.succeeded"})
verifier("webhook sans signature refuse", statut == 400)

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

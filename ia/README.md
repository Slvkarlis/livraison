# Service d'IA FleetPulse (Sprint 4)

Service Python isolé (cahier des charges §4.1) appelé par le backend Spring Boot (`ServiceIa.java`).
Il est **facultatif** : sans lui (ou s'il ne répond pas en 800 ms), le backend applique ses règles Java
(mode dégradé). Les deux implémentations partagent les mêmes formules (détour × 1,3, 2 min par arrêt).

| Route | Rôle | User story |
|---|---|---|
| `POST /v1/lots` | Regroupe les commandes prêtes en lots de 1 à 3 (algorithme des économies de Clarke et Wright) | US-403 |
| `POST /v1/eta` | Prédit la préparation réelle et le trajet (gradient boosting scikit-learn) | US-406 |
| `POST /v1/entrainement` | Recalibre le modèle d'ETA avec le jeu exporté par le backend | US-401, US-406 |
| `GET /sante` | Version et erreur moyenne du modèle | — |

L'ordre des arrêts (US-404) est optimal : toutes les tournées valides sont explorées (≤ 4 commandes).
Le backend revalide toujours la réponse (chaque commande une fois, zones et rayon, durée à bord) avant de l'utiliser.

## Lancer

```bash
cd ia
python -m venv .venv && . .venv/bin/activate      # Windows : .venv\Scripts\activate
pip install -r requirements.txt
uvicorn fleetpulse_ia.app:app --port 8090
# backend : APP_IA_URL=http://localhost:8090
```

Au premier démarrage, sans `modele_eta.pkl`, le modèle est entraîné sur un historique **simulé**
(cahier des charges §4.3), puis recalibré avec les données réelles :

```bash
# Export depuis le back-office (jeton d'un responsable OPERATIONS)
curl -H "Authorization: Bearer $JETON" http://localhost:8083/api/admin/entrepot/export -o export.json
python entrainer.py export.json        # écrit modele_eta.pkl, relu au prochain démarrage
```

## Tests

```bash
python -m unittest discover -s tests -v
```

Les tests de l'API HTTP sont ignorés si FastAPI n'est pas installé ; la logique (itinéraires, lots, ETA) est
toujours testée. `test_itineraire.py` vérifie les mêmes durées que `ItineraireTest.java`.

# Contrats des jeux de données IA

Un seul fichier `export.json` contient les trois jeux. Chaque ligne est un objet JSON à plat.
Les champs marqués `?` peuvent être `null`.

## 1. `eta` : préparation et trajet (US-401, US-406)

| Champ | Type | Sens |
|---|---|---|
| `commandeId` | entier | identifiant de la commande (interne, non exposé) |
| `partenaireId` | entier | commerce |
| `zoneId` | entier | zone du commerce |
| `heure` | 0–23 | heure de création |
| `jourSemaine` | 1–7 | lundi = 1 |
| `preparationAnnonceeMin` | nombre ? | délai annoncé par le commerce |
| `preparationReelleMin` | nombre ? | `preteLe − accepteeLe`, en minutes |
| `distanceKm` | nombre ? | distance financière figée |
| `vitesseZoneKmh` | nombre ? | vitesse moyenne de la zone |
| `tailleLot` | 1–3 | nombre de commandes dans le lot |
| `trajetReelMin` | nombre ? | collecte → livraison, en minutes |

Cible : `preparationReelleMin` et `trajetReelMin`. Entraînement : `entrainer.py --eta`.

## 2. `demande` : commandes par zone et créneau (US-804)

Une ligne par zone et par heure, pour toutes les heures ouvrées (les heures sans commande ont `commandes: 0`).

| Champ | Type | Sens |
|---|---|---|
| `zoneId` | entier | zone (celle figée sur la commande) |
| `date` | `AAAA-MM-JJ` | jour civil, fuseau Africa/Tunis |
| `heure` | 0–23 | heure civile de création |
| `jourSemaine` | 1–7 | lundi = 1 |
| `ferie` | booléen | jour férié tunisien (liste tenue par le responsable) |
| `partenairesActifs` | entier | commerces ayant au moins une commande ce créneau |
| `commandes` | entier | **cible** : commandes créées dans ce créneau |

Entraînement : `entrainer.py --demande`. Découpage temporel : 80 % anciens, 20 % récents (pas de mélange).

## 3. `prospection` : score de potentiel (US-802)

Une ligne par commerce prospect dont l'issue est connue (inscrit ou refusé ou sans réponse après 90 jours).

| Champ | Type | Sens |
|---|---|---|
| `categorie` | texte | `BOULANGERIE`, `RESTAURANT`, `EPICERIE`, `PHARMACIE`, `AUTRE` |
| `distanceClientsKm` | nombre | distance moyenne aux clients de la zone |
| `clientsZone` | entier | clients actifs dans la zone |
| `couvertureZonePct` | 0–100 | couverture actuelle de la zone |
| `concurrentsProches` | entier | commerces de même catégorie dans 500 m |
| `converti` | booléen | **cible** : le commerce est inscrit |

Entraînement : `entrainer.py --prospects`.

## Modèles produits

| Fichier | Entrée du service | Réponse |
|---|---|---|
| `modele_eta.pkl` | `POST /v1/eta` | `preparationMin`, `trajetMin`, `modele` |
| `modele_demande.pkl` | `POST /v1/demande/predire` | `commandesPrevues`, `regle` (`gbr` ou repli) |
| `modele_prospection.pkl` | `POST /v1/prospection/score` | `score` 0–100, `modele` |
| `metriques.json` | — | MAE, WAPE (demande), AUC et précision top-10 (prospection) |

## Ce qui n'est jamais exporté

Noms, téléphones, e-mails, adresses précises et coordonnées de clients, identifiants de livreurs.

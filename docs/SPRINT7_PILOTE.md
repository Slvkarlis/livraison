# Sprint 7 : plan de pilote (US-519)

Objectif : valider le regroupement, les échecs et la pause automatique sur une à trois zones, avant généralisation.

## Mise en place (responsable OPERATIONS)

1. Choisir jusqu'à trois zones : `PUT /api/admin/pilote/zones/{id}` avec `{"pilote": true}`.
2. Vérifier les indicateurs de départ : `GET /api/admin/pilote/kpi`.
3. Calibrer rayon R et fenêtre t avec le simulateur sur un échantillon réel :
   `POST /api/admin/simulateur/lots` (données anonymisées : positions des commerces et des clients, pas d'identité).
4. Recalibrer les modèles (demande, prospection) à partir des exports : voir `ia/handoff/README.md`.

## Indicateurs suivis chaque semaine

| Indicateur | Source | Seuil d'alerte proposé |
|---|---|---|
| Commandes expirées | `expirees` | plus de 5 % des commandes |
| Échecs de livraison | `echecs` | plus de 3 % des livraisons |
| Délai moyen commande → livraison | `delaiMoyenMinutes` | en hausse de plus de 15 % sur deux semaines |
| Respect des ETA | `respectEtaPct` | moins de 85 % |

Ces seuils sont des propositions : à valider avec le responsable avant le pilote.

## Sortie du pilote

Généralisation si, sur au moins deux semaines : respect des ETA stable, pas de pause automatique répétée d'un même commerce,
et aucun échec non traité (toutes les décisions prises via `/api/admin/echecs`).

## Responsabilités

- Responsable OPERATIONS : zones, calibrage, suivi quotidien.
- Responsable FINANCE : réclamations et imputations.
- Équipe : relecture des indicateurs et décision de généralisation.

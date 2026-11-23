# Sprint 8 : prospection, prévisions et réentraînement

Branche `sprint-8` (backend), intégrée à `work-restyled` avec les écrans web.

## Livrées

| US | Livraison | Où |
|---|---|---|
| US-801 | Import de commerces prospects depuis une source déclarée (registre, recommandation, saisie terrain, import autorisé). Les lignes invalides sont signalées sans bloquer les autres. | `ProspectionService.importer`, web : page Prospection |
| US-802 | Score de potentiel 0 à 100 par prospect non clos : modèle d'IA, ou règle lisible en repli. | `ProspectionService.scorer`, `POST /api/admin/prospects/scoring` |
| US-803 | Changement de statut : A_CONTACTER → CONTACTE → INTERESSE → INSCRIT ; refus possible avant l'inscription, motif obligatoire. | `PUT /api/admin/prospects/{id}/statut` |
| US-804 | Prévision de demande par zone et créneau (10 h à 22 h), capacité par coursier, renfort conseillé. | `PrevisionService.prevoir`, web : page Prévisions |
| US-805 | Alertes de sous-couverture : créneaux où la demande prévue dépasse la capacité disponible. | `GET /api/admin/previsions/alertes` |
| US-806 | Réentraînement des modèles (`demande`, `prospection`) sur le jeu courant de l'entrepôt. Si le service IA ne répond pas, le modèle actuel est conservé et la réponse est 409. | `POST /api/admin/ia/reentrainer/{modele}` |

## Décisions

- **Sources d'import** : seules quatre sources déclarées sont acceptées. Aucune collecte sur des sites tiers.
- **Repli du score** : identique à la règle lisible `score_regle` du service IA, pour que le résultat ne change pas quand le service tombe.
- **Réentraînement** : le modèle n'est jamais remplacé en cas d'échec. Le responsable voit l'erreur, rien d'autre.

## Vérifications

- `Sprint8ProspectionPrevisionTest` (5) et `Sprint8ReentrainerTest` (3) : verts sous JDK 25.
- Navigateur (Edge headless) : import de deux commerces, recalcul du score, simulation avec deux commandes voisines. Aucune erreur JavaScript.
- Suite complète du backend : voir le journal de la dernière exécution.

## Limites

- Le service IA n'a pas été lancé pendant les tests : le réentraînement réussi n'est pas vérifié de bout en bout. Il faut le jeu d'entraînement issu de Colab (`ia/handoff/`) pour cela.
- Les modèles n'ont pas été entraînés sur des données réelles : le score et les prévisions reposent sur des données simulées tant que le pilote n'a pas produit d'historique.
- L'import par fichier n'est pas encore branché sur l'écran : la saisie se fait ligne par ligne.

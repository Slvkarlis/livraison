# TP 5 — Validation du backend

Vérification du 17 novembre 2026, sur la branche `sprint-3`.

## Résultats exécutés

| Commande, depuis `backend/` | Résultat | Rapport |
|---|---|---|
| `.\mvnw.cmd -Punit-tests verify` | **216 tests isolés réussis**, zéro échec, erreur ou test ignoré | `target/site/jacoco-unit/index.html` |
| `.\mvnw.cmd verify` | **285 tests réussis**, zéro échec, erreur ou test ignoré | `target/site/jacoco/index.html` |

La suite complète inclut 69 tests d’intégration, en plus des 216 tests isolés. La vérification initiale avait exécuté 108 tests : 177 cas ont été ajoutés.

## Périmètre mesuré

- 11 contrôleurs REST métier, hors `AuthController`.
- 21 services Spring métier. `AuthService` est hors périmètre ; les tests existants de `CodeVerificationService` et `JetonRafraichissementService` sont conservés et exécutés, mais exclus des pourcentages métier ci-dessous.
- Les tests de `GestionErreurs`, du temps réel, des messages et des adaptateurs de démonstration complètent ces classes.
- Aucun fichier sous `mobile/` ou `web-responsable/` n’est modifié par ce travail.

Les pourcentages suivants concernent les **lignes exécutables** de la classe, hors classes imbriquées. Ils ne constituent pas une couverture à 100 % de toutes les branches. Le rapport HTML contient les lignes et branches restantes.

| Groupe | Lignes par tests isolés | Lignes par suite complète | Branches par tests isolés |
|---|---|---|---|
| Contrôleurs métier | 100,0 % | 100,0 % | 100,0 % |
| Services métier | 95,6 % | 98,9 % | 70,2 % |

## Matrice des contrôleurs

| Classe | Lignes unitaires | Lignes suite complète |
|---|---|---|
| [AdminController](../backend/src/main/java/com/fleetpulse/livraison/Controller/AdminController.java) | 100,0 % | 100,0 % |
| [AffectationZoneController](../backend/src/main/java/com/fleetpulse/livraison/Controller/AffectationZoneController.java) | 100,0 % | 100,0 % |
| [CommandePartenaireController](../backend/src/main/java/com/fleetpulse/livraison/Controller/CommandePartenaireController.java) | 100,0 % | 100,0 % |
| [CompteController](../backend/src/main/java/com/fleetpulse/livraison/Controller/CompteController.java) | 100,0 % | 100,0 % |
| [DossierController](../backend/src/main/java/com/fleetpulse/livraison/Controller/DossierController.java) | 100,0 % | 100,0 % |
| [EspaceLivreurController](../backend/src/main/java/com/fleetpulse/livraison/Controller/EspaceLivreurController.java) | 100,0 % | 100,0 % |
| [GestionCommandeController](../backend/src/main/java/com/fleetpulse/livraison/Controller/GestionCommandeController.java) | 100,0 % | 100,0 % |
| [LivraisonController](../backend/src/main/java/com/fleetpulse/livraison/Controller/LivraisonController.java) | 100,0 % | 100,0 % |
| [MarketplaceController](../backend/src/main/java/com/fleetpulse/livraison/Controller/MarketplaceController.java) | 100,0 % | 100,0 % |
| [NotificationController](../backend/src/main/java/com/fleetpulse/livraison/Controller/NotificationController.java) | 100,0 % | 100,0 % |
| [ProfilController](../backend/src/main/java/com/fleetpulse/livraison/Controller/ProfilController.java) | 100,0 % | 100,0 % |

## Matrice des services

| Classe | Lignes unitaires | Lignes suite complète |
|---|---|---|
| [AdminService](../backend/src/main/java/com/fleetpulse/livraison/Service/AdminService.java) | 99,0 % | 99,0 % |
| [AdresseService](../backend/src/main/java/com/fleetpulse/livraison/Service/AdresseService.java) | 100,0 % | 100,0 % |
| [AffectationMissionService](../backend/src/main/java/com/fleetpulse/livraison/Service/AffectationMissionService.java) | 100,0 % | 100,0 % |
| [AffectationZoneService](../backend/src/main/java/com/fleetpulse/livraison/Service/AffectationZoneService.java) | 100,0 % | 100,0 % |
| [AuditService](../backend/src/main/java/com/fleetpulse/livraison/Service/AuditService.java) | 74,1 % | 100,0 % |
| [CatalogueService](../backend/src/main/java/com/fleetpulse/livraison/Service/CatalogueService.java) | 100,0 % | 100,0 % |
| [CodeRemiseService](../backend/src/main/java/com/fleetpulse/livraison/Service/CodeRemiseService.java) | 94,0 % | 94,0 % |
| [CommandePartenaireService](../backend/src/main/java/com/fleetpulse/livraison/Service/CommandePartenaireService.java) | 98,6 % | 100,0 % |
| [CommandeService](../backend/src/main/java/com/fleetpulse/livraison/Service/CommandeService.java) | 92,2 % | 97,8 % |
| [CommandeWorkflow](../backend/src/main/java/com/fleetpulse/livraison/Service/CommandeWorkflow.java) | 100,0 % | 100,0 % |
| [CompteService](../backend/src/main/java/com/fleetpulse/livraison/Service/CompteService.java) | 90,4 % | 98,6 % |
| [EspaceLivreurService](../backend/src/main/java/com/fleetpulse/livraison/Service/EspaceLivreurService.java) | 100,0 % | 100,0 % |
| [GestionCommandeService](../backend/src/main/java/com/fleetpulse/livraison/Service/GestionCommandeService.java) | 100,0 % | 100,0 % |
| [LivraisonService](../backend/src/main/java/com/fleetpulse/livraison/Service/LivraisonService.java) | 100,0 % | 100,0 % |
| [NotificationService](../backend/src/main/java/com/fleetpulse/livraison/Service/NotificationService.java) | 100,0 % | 100,0 % |
| [ProfilService](../backend/src/main/java/com/fleetpulse/livraison/Service/ProfilService.java) | 100,0 % | 100,0 % |
| [RemiseClientService](../backend/src/main/java/com/fleetpulse/livraison/Service/RemiseClientService.java) | 100,0 % | 100,0 % |
| [RemiseLivreurService](../backend/src/main/java/com/fleetpulse/livraison/Service/RemiseLivreurService.java) | 94,4 % | 100,0 % |
| [SuiviCommandeService](../backend/src/main/java/com/fleetpulse/livraison/Service/SuiviCommandeService.java) | 100,0 % | 100,0 % |
| [SuiviPositionService](../backend/src/main/java/com/fleetpulse/livraison/Service/SuiviPositionService.java) | 96,7 % | 100,0 % |
| [ZoneService](../backend/src/main/java/com/fleetpulse/livraison/Service/ZoneService.java) | 92,8 % | 97,1 % |

## Contrôles fonctionnels et documentaires

- CRUD du TP 5 : création, liste remplie/vide, lecture par ID, modification et désactivation d’un véhicule ; cas absents et erreurs testés.
- Nouveau `GET /api/admin/vehicules/{id}`, avec réponses 200/404.
- Parcours HTTP réel du véhicule sous Spring Security et H2 isolé.
- Documentation en français de toutes les opérations des onze contrôleurs métier.
- Test de la spécification OpenAPI : résumés, descriptions, tags, réponses de sécurité, erreurs et exemples de DTO.
- API de voisinage des zones : frontière commune, symétrie et distinction d’un contact par sommet.
- Tests WebSocket : nettoyage tolérant une connexion fermée par le serveur, sans masquer les assertions des scénarios.

## Interprétation et limites

Un test d’intégration réussi ne remplace pas un test isolé. Les deux rapports sont donc séparés. Un taux de lignes élevé ne signifie pas que toutes les branches ou les situations sur téléphone ont été exercées.

Les initialisations/migrations, les entités, DTO et composants de sécurité restent visibles dans les rapports JaCoCo complets : ils ne sont pas retirés pour améliorer artificiellement un taux global. La matrice ci-dessus isole simplement le périmètre demandé.

Les passerelles SMS/email et push conservent les prérequis externes décrits dans le [guide détaillé](TP5_TESTS_ET_SWAGGER.md). Les écrans, l’authentification et les sprints 4 à 8 ne sont pas développés dans ce travail.

Les rapports de `target/` sont générés localement et ignorés par Git. Pour reproduire ces mesures, exécuter les deux commandes en tête de document avec Java 25.

# Sprint 7 : échecs, litiges et pilote

Branche `sprint-7`, fondée sur `ia-handoff`. Huit user stories, 37 points.

## Livrées

| US | Livraison | Fichiers principaux |
|---|---|---|
| US-308 · 5 pts | Le coursier déclare un échec avec motif (injoignable, refus, paiement, adresse, incident) | `EchecService`, `EspaceLivreurController` |
| US-312 · 5 pts | Le responsable décide : relivraison, retour au partenaire, perte | `EchecService`, `EchecController` |
| US-516 · 3 pts | Le client ouvre une réclamation sur sa commande livrée (48 h, une seule par commande) | `ReclamationService`, `ReclamationController` |
| US-517 · 5 pts | La finance décide du remboursement et de son imputation ; écritures REMBOURSEMENT et COMPENSATION | `ReclamationService`, `Sprint7ReclamationTest` |
| US-2B6 · 3 pts | Horaires, pause manuelle, pause automatique après trois expirations consécutives | `BoutiqueService`, `BoutiqueController`, `ExpirationCommandeService` |
| US-307 · 3 pts | Guidage vers le commerce puis vers le client ; OSRM si configuré, estimation sinon | `GuidageService`, `Routage` |
| US-518 · 8 pts | Simulateur : lots contre dispatch unitaire sur une grille rayon × fenêtre | `SimulateurLots`, `SimulateurLotsTest` |
| US-519 · 5 pts | Pilote sur trois zones au plus, indicateurs par zone pilote | `PiloteService`, `SprintSeptController` |

## Décisions

- **Expiration des commandes** : les commandes sans réponse expirent après 120 s (`app.commandes.delai-reponse-secondes`).
  Ce critère global n'était pas implémenté avant ce sprint.
- **Motif EXPIREE** : posé par le système, jamais choisi par le partenaire (400 sinon).
- **Pause automatique** : trois expirations consécutives → pause de 60 min, compteur remis à zéro ; une réponse du partenaire remet aussi le compteur à zéro.
- **Routage** : OSRM est appelé seulement si `app.routage.osrm-url` est renseignée ; sinon estimation (facteur de détour 1,3, 20 km/h). La source est renvoyée dans la réponse.
- **Simulateur** : recommandation = plus fort gain de minutes, sans allonger le total de plus de 10 % par rapport au dispatch unitaire.
- **Pilote** : au plus trois zones (`Zone.pilote`) ; chaque changement est journalisé.

## Vérifications

- Tests de sprint 7 : `Sprint7EchecTest` (5), `Sprint7ReclamationTest` (4), `Sprint7BoutiqueTest` (3), `Sprint7SuiviTest` (3), `SimulateurLotsTest` (2) : tous verts sous JDK 25.
- Suite complète : voir le journal de la clôture (section ci-dessous).

## Limites

- Les écrans web et mobile des fonctions de ce sprint ne sont pas encore faits (voir la passe de design).
- L'imputation finale (cash, reversement) des échecs « perte » reste à relier au closing : la décision est tracée, pas encore comptabilisée.
- L'OSRM public n'a pas été interrogé pendant les tests (pas d'accès réseau garanti) ; le repli est testé.
- Le pilote réel (1 à 3 zones, commerçants réels) est une action humaine : le backend fournit les outils, pas la mise en service.
- Build du mobile non relancé dans cette clôture (Node 20 sur cette machine).

# Sprint 6 — Dashboard BI et notation — plan

Branche `sprint-6` créée depuis `sprint-5`, le 18 novembre 2026. Périmètre : US-507,
US-508, US-514, US-509, US-510, US-309, US-511 et US-2B7 (42 points).
Paiement COD, MySQL 8 / H2, périodes Africa/Tunis, aucune dépendance graphique ajoutée.

## Étape 0 : vérifications et inventaire

Avant toute implémentation : backend, typecheck/lint mobile, tests Node, build web.
Les corrections des sprints précédents sont isolées dans `fix(sprint-4/5)`.
La modification Actuator déjà présente dans `backend/pom.xml` appartient à l'utilisateur.

| Indicateur / donnée source | Présence | Fichier (backend/src/main/java/com/fleetpulse/livraison/) |
|---|---|---|
| GMV / ventes articles | présente, GMV du ledger = articles hors frais | Model/EcritureLedger.java, Service/ComptabiliteService.java |
| Commissions nettes | présente (COMMISSION ; remboursements futurs exclus) | Model/enums/TypeEcriture.java |
| Marge livraison | présente : FRAIS_LIVRAISON − REMUNERATION_COURSIER | Model/EcritureLedger.java |
| Cash encaissé non rapproché | présente, liens de dépôt | Model/FinanceCommande.java, Service/CaisseService.java |
| Reversements / rémunérations à effectuer | présente, liens de closing | Model/FinanceCommande.java, Service/ClosingService.java |
| Commandes par statut / zone / position | présente | Model/Livraison.java, Model/Partenaire.java, Model/Zone.java |
| Couverture actuelle / absence coursier | présente, disponibilité et affectations temporaires | Model/Livreur.java, Model/AffectationZone.java |
| Distance / durée d'un lot | présente | Model/Lot.java, Service/Itineraire.java |
| Gains vs dispatch unitaire | absente : aucun scénario de référence figé, aucun ArretItineraire persistant | Model/Lot.java ; **non disponible** |
| Préparation annoncée / réelle | présente : tempsPreparationMinutes, accepteeLe, preteLe | Model/Livraison.java ; historique complémentaire Model/EvenementEntrepot.java |
| Acceptations / refus et motifs | présente | Model/Livraison.java |
| Expiration partenaire | hors périmètre (US-2B3 abandonnée) | **non disponible** |
| Réclamations | absente (Sprint 7) | **non disponible** |
| Notes / moyennes / classement | absente, à créer | nouvelle entité Notation |
| Minutes / km | durée collecte→livraison présente ; distance financière estimée présente, distance GPS réelle non figée | Model/Livraison.java, Model/FinanceCommande.java, Model/PositionLivreur.java |
| Respect ETA | présente : promesseLivraison, livreeLe | Model/Livraison.java |
| Délai livraison→dépôt / écarts | présente | Model/FinanceCommande.java, Model/DepotCash.java, Model/EcritureLedger.java |
| Productivité par zone | présente | Model/FinanceCommande.java (zoneId figé), Model/Livraison.java |
| Seuils / alertes | absente, à créer | nouvelles entités SeuilAlerte / Alerte |
| CA partenaire / commandes / meilleurs produits | présente, lignes figées à la commande | Model/LigneCommande.java, Model/Livraison.java |

## Conception et séquence

1. `feat(US-309)` : notation immuable par un client participant après livraison,
   unicité commande/auteur/cible, formulaire partagé et intégration au détail client.
2. `feat(US-511)` : notation croisée coursier→client et partenaire→coursier,
   mêmes règles serveur, écrans participants. Moyennes calculées en SQL, sans cache dénormalisé.
3. `feat(US-507)` : agrégations ledger par période et soldes réutilisables de caisse/closing.
4. `feat(US-508)` : statuts, carte de densité par zone, couverture actuelle.
5. `feat(US-509)` : préparation / décisions / notes et classement partenaires.
6. `feat(US-510)` : coursiers, ETA, cash et productivité des zones.
7. `feat(US-514)` : seuils validés, audit, alertes actives dédupliquées et cockpit.
8. `feat(US-2B7)` : ventes privées du partenaire dans l'app client.
9. Démo protégée par ModeDemonstration, tests complets et rapport de clôture.

Tous les dashboards agrègent en base ; périodes bornées et semi-ouvertes [début, lendemain fin).
Les valeurs sans source sont nulles avec une explication, jamais remplacées par zéro.
Les agrégats ne transportent ni coordonnées clients individuelles ni téléphone/email.

## Vérification

Tests HTTP H2 : jeux connus, erreurs de notation, accès croisés (403), filtres et frontières
Tunis, cohérence ledger, déduplication/résolution/réouverture d'alertes et audit des seuils.
Tests Node sur validation et affichage. Toutes les suites existantes restent vertes.
Démo : livraisons → notes des participants → BI → seuil cash dépassé → ventes partenaire.
Mesurer le p95 des dashboards sur au moins 30 commandes ; préciser matériel et protocole.
MySQL réel et Android/iOS seront signalés comme non vérifiés si indisponibles.

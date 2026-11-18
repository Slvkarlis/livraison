# Sprint 6 — Dashboard BI et notation

18 novembre 2026. Branche `sprint-6`, créée depuis `sprint-5`. Huit US implémentées,
42 points. [Plan et inventaire des sources](SPRINT6_PLAN.md) · [Changements par commit](SPRINT6_CHANGES.md).

## Fonctionnalités

| US | Livraison | Fichiers principaux |
|---|---|---|
| US-507 · 8 pts | BI Finance : flux du ledger, cash non rapproché et paiements en attente | `BiFinanceService`, `BiRepository`, `CaisseService`, `ClosingService`, web `BiFinance.tsx` |
| US-508 · 8 pts | Statuts, densité Leaflet par zone, couverture actuelle, filtres | `BiOperationsService`, web `BiOperations.tsx`, `CarteDensite.tsx`, `carte-bi.html` |
| US-514 · 5 pts | Cinq seuils auditables, alertes uniques et résolution/réactivation | `AlerteService`, `DetectionAlertes`, `PlanificateurBi`, web `CockpitAlertes.tsx` |
| US-509 · 5 pts | Préparation comparée, décisions, motifs, notes et classement | `BiPartenaireService`, web `BiPartenaires.tsx` |
| US-510 · 5 pts | Minutes/km estimé, ETA, dépôts, écarts et productivité | `BiCoursierService`, web `BiCoursiers.tsx` |
| US-309 · 3 pts | Client → commerce et coursier après livraison | `NotationService`, `Notation`, shared `PanneauNotation.tsx`, app client `DetailCommandeClient.tsx` |
| US-511 · 3 pts | Coursier → client ; partenaire → coursier | Même service/formulaire, `EcranMission.tsx`, `DetailCommandeRecue.tsx`, historique livré dans `EcranMissions.tsx` |
| US-2B7 · 5 pts | Ventes privées du partenaire actif | `VentesPartenaireService`, app client `EcranVentes.tsx`, onglet `ventes.tsx` |

Aucune dépendance ajoutée. Leaflet existant sert à la carte ; les autres vues utilisent
des cartes de chiffres et tableaux HTML. L'ajout Actuator préexistant dans `backend/pom.xml`
reste hors des commits du sprint. Stripe et les sprints 7/8 ne sont pas modifiés.

## Définitions des indicateurs

Toutes les dates de filtre sont civiles, **incluses**, en `Africa/Tunis` :
`[début 00:00, lendemain de fin 00:00[`, converties en UTC. Défaut : les 30 derniers
jours, aujourd'hui compris ; maximum 366 jours. Les légendes des interfaces reprennent
ces définitions. Les quantités absentes restent `null` / « Non disponible ».
Les montants utilisent `BigDecimal`, 3 décimales, `CalculsFinanciers` / HALF_UP.

| Indicateur | Formule / source | Date et population |
|---|---|---|
| GMV / ventes d'articles | Σ ledger `GMV` ; dans le modèle existant, GMV = articles hors frais, et non total COD | Date d'écriture ; ventes comptabilisées à la livraison |
| Articles livrés | Σ `LigneCommande.quantite` | `livreeLe`, statut `LIVREE` |
| Commissions nettes | Σ ledger `COMMISSION` | Date d'écriture ; aucun remboursement de commission implémenté avant Sprint 7 |
| Marge de livraison | Σ `FRAIS_LIVRAISON` − Σ `REMUNERATION_COURSIER` | Date d'écriture ; peut être négative |
| Cash en circulation | Σ encaissements des `FinanceCommande` encore sans dépôt | **État actuel** de la cohorte livrée sur la période, pas une reconstitution d'un solde historique |
| Reversements à effectuer | Σ net partenaire, dépôt présent et closing partenaire absent | Même cohorte ; règle de `ClosingService` : cash rapproché uniquement |
| Rémunérations à effectuer | Σ rémunération coursier, closing coursier absent | Même cohorte ; coursier présent |
| Reversements/rémunérations enregistrés | Σ `REVERSEMENT_PARTENAIRE` / `PAIEMENT_COURSIER` du ledger | Date d'écriture ; paiements enregistrés, sans virement bancaire |
| Commandes par statut / densité de zone | COUNT commandes, groupées par statut actuel / zone actuelle du commerce | `dateCreation`, tous statuts ; filtre zone facultatif |
| Couverture | 100 × coursiers actifs déclarés disponibles avec affectation en vigueur / commandes actives | **Maintenant**, sans filtre temporel historique ; affectations temporaires `[début,fin[` ; sans commande : null |
| Commandes actives | Statuts hors `LIVREE`, `REFUSEE`, `ANNULEE`, `ECHEC`, `RETOURNEE` | Maintenant ; zone actuelle du commerce |
| Préparation estimée/réelle | Moyenne `tempsPreparationMinutes` / moyenne `(preteLe−accepteeLe)/60` | Commandes créées dans la période ; même échantillon avec annonce et horodatages valides |
| Acceptation/refus | Acceptées / (acceptées + refusées), refusées / même dénominateur | Même cohorte ; acceptation = `accepteeLe` présent ; refus = `motifRefus` présent ; annulations sans décision et attente exclues |
| Motifs | COUNT des commandes par `motifRefus` | Même cohorte |
| Note partenaire / classement | Moyenne SQL non pondérée des avis ciblant ce commerce ; moyenne décroissante, puis nombre d'avis, puis ID | Tous les avis déposés sur les commandes créées dans la période ; sans avis : null / pas de rang |
| Minutes/km estimé | Σ minutes collecte→livraison / Σ distances financières figées | Missions `LIVREE` comptabilisées, par `FinanceCommande.livreeLe` ; durée valide et distance > 0 seulement |
| ETA respectés | 100 × COUNT(`livreeLe ≤ promesseLivraison`) / COUNT(promesse présente) | Même cohorte ; égalité considérée à l'heure ; sans promesse : null |
| Délai dépôt | Moyenne `(DepotCash.date−FinanceCommande.livreeLe)/3600` | Même cohorte, seulement missions rapprochées avec dates valides ; moyenne par mission, pas par reçu |
| Régularité du cash | Nombre de missions non déposées et COUNT ledger `ECART_DEPOT` | Missions : même cohorte ; écarts : date d'écriture dans la période. Dépôt mixte : compte si au moins une commande appartient à la zone filtrée |
| Note coursier | Moyenne SQL de tous les avis client et partenaire, même poids | Même cohorte de missions livrées |
| Productivité de zone | Livraisons/jours civils de période ; livraisons/coursiers distincts ; Σ km estimés | Zone **figée** dans `FinanceCommande.zoneId`, même cohorte |
| CA / commandes du partenaire | Σ `montantArticles`, COUNT commandes | `livreeLe`, statut `LIVREE`, uniquement le partenaire connecté ; hors frais et avant commission |
| Meilleurs produits | Σ quantités, Σ sous-totaux des lignes, top 20 par quantité puis CA puis ID | Même cohorte privée ; montants figés, nom actuel du catalogue |

Les états courants ne dépendent pas d'une reconstitution inventée des présences.
Un coursier autorisé dans deux zones peut compter dans chacune : la couverture mesure
la disponibilité autorisée, sans garantir une présence physique dans chaque zone.
La carte affiche des bulles aux centres des zones, pondérées relativement au volume
maximal du filtre. Le tableau fournit les mêmes chiffres sans carte.

## Notation et modèle

`Notation` référence `Utilisateur` pour auteur/cible (héritage JOINED existant), et
`Livraison` pour commande : vraies clés étrangères, sans identifiants polymorphes libres.
La cible envoyée est un rôle ; **le serveur résout son identité dans la commande**.
Combinaisons autorisées : client→partenaire, client→livreur, livreur→client,
partenaire→livreur. Tout tiers ou autre combinaison reçoit 403.

Après `LIVREE` uniquement (sinon 409), note entière 1–5, commentaire facultatif ≤ 500
caractères. Une seule note par `(commande,auteur,cible)` ; verrou pessimiste sur la
commande + contrainte unique. Entité immuable, aucun endpoint PUT/DELETE. Doublon : 409.
La validation refuse aussi les décimales JSON, sans troncature implicite.
GET ne retourne que les avis de l'auteur connecté. Les moyennes sont **calculées en SQL**,
jamais dénormalisées : pas de compteur à synchroniser, pas de cache périmé.

## Alertes

| Type | Défaut | Condition de déclenchement |
|---|---|---|
| `CASH_COURSIER` | 500 DT | Cash actuel non déposé d'un coursier > seuil ; FINANCE uniquement |
| `TAUX_REFUS_PARTENAIRE` | 30 % | Refus > seuil parmi les décisions des 7 jours civils glissants, aujourd'hui compris ; au moins 5 décisions |
| `RETARD_ETA` | 10 min | Commande active avec promesse dépassée de plus de ce délai |
| `COUVERTURE_ZONE` | 50 % | Couverture actuelle < seuil, au moins une commande active |
| `ABSENCE_COURSIER` | 15 min | Plus ancienne commande PRETE sans coursier attend > seuil et aucun coursier disponible autorisé dans la zone |

Valeurs ≥ 0, trois décimales ; maximum 1 000 000 DT, 100 % ou 1440 min selon le type.
Désactivation possible. Chaque modification journalise avant/après via
`ActionAudit.SEUIL_ALERTE_MODIFIE`. Le seuil de cash n'est accessible que sous
`/api/admin/finance/**` ; les autres seuils relèvent d'OPERATIONS.

Une ligne `Alerte` par `(type,objetId)` ; date initiale conservée pendant l'activité,
valeur/seuil/dernière observation actualisés. Résolution lorsque la condition disparaît,
réactivation de la même ligne en cas de récidive. Verrou sur le seuil pour sérialiser
les évaluations concurrentes. La table conserve le dernier épisode, pas l'historique
exhaustif des épisodes. Évaluation à la lecture du cockpit et toutes les 30 s via
`PlanificateurBi` (`app.bi.planificateur=false` dans les tests).

## API

Base `/api`. L'administrateur principal possède OPERATIONS et FINANCE ; les deux
sous-rôles restent séparés côté serveur (403). Aucun email/téléphone/client individuel
dans les agrégats ; objets d'alerte désignés par type et ID.

| Méthode | Chemin | Droits / contrat |
|---|---|---|
| GET | `/admin/finance/bi?debut&fin` | FINANCE ; synthèse Finance |
| GET | `/admin/bi/operations?debut&fin&zoneId` | OPERATIONS ; statuts, zones, couverture et gains indisponibles |
| GET | `/admin/bi/partenaires?debut&fin&zoneId` | OPERATIONS ; qualité partenaires |
| GET | `/admin/bi/coursiers?debut&fin&zoneId` | OPERATIONS ; coursiers et productivité des zones |
| GET | `/admin/bi/seuils` | OPERATIONS ; quatre seuils opérationnels |
| PUT | `/admin/bi/seuils/{type}` | OPERATIONS ; `{valeur,actif}` ; cash interdit |
| GET | `/admin/bi/alertes` | OPERATIONS ; évaluation et alertes actives hors cash |
| GET | `/admin/finance/bi/seuils` | FINANCE ; seuil cash |
| PUT | `/admin/finance/bi/seuils/{type}` | FINANCE ; `{valeur,actif}`, `CASH_COURSIER` uniquement |
| GET | `/admin/finance/bi/alertes` | FINANCE ; alertes cash actuelles |
| GET | `/commandes/{id}/notations` | Participant réel ; `{ouverte,cibles,notes}` |
| POST | `/commandes/{id}/notations` | Participant réel ; `{cible,note,commentaire?}` → 201 |
| GET | `/livreur/missions/livrees` | LIVREUR ; ses 50 dernières livraisons pour retrouver la notation |
| GET | `/partenaire/ventes?debut&fin` | PARTENAIRE actif ; identité imposée par le serveur |

Erreurs JSON `{code,message}` via `GestionErreurs`. Les opérations et paramètres sont
documentés dans OpenAPI `sprint-6`. L'inventaire des fichiers par commit est dans
`SPRINT6_CHANGES.md`.

## Schéma et performance

Nouvelles tables : `notation`, `seuil_alerte`, `alerte`. CHECK note 1–5, contraintes
d'unicité et clés étrangères. Index ajoutés : période de création/livraison, partenaire
et coursier dans `livraison`, zone/période et partenaire/période dans `finance_commande`,
cible/date des notes, type/état des alertes. Aucun champ historique absent inventé.

`ddl-auto=update` conservé ; script additif et rejouable
[`backend/migrations/sprint6-mysql.sql`](../backend/migrations/sprint6-mysql.sql).
Le script ne modifie aucune donnée métier existante ; ses seuils par défaut n'écrasent
pas les seuils configurés. **Script non exécuté sur MySQL réel** dans cette session.

Les dashboards font des projections et agrégations SQL/JPA, sans `findAll()` de
commandes ni calcul sur un historique entier en mémoire. Les échantillons invalides
sont exclus avant agrégation. Les noms des commerces et identifiants sont les seules
données d'identification nécessaires aux tableaux de gestion.

Mesure du test `Sprint6DemoTest` sous Windows, Java 25, H2 mode MySQL, HTTP localhost,
30 livraisons, cinq requêtes de chauffe puis 30 requêtes par endpoint, p95 au rang 29.
Premier passage dédié réussi :

| Dashboard | p95 |
|---|---|
| Finance | 19,564 ms |
| Opérations | 18,596 ms |
| Partenaires | 15,576 ms |
| Coursiers/zones | 15,384 ms |
| Ventes partenaire | 16,830 ms |

Le test impose `< 500 ms` à chaque endpoint. Ces mesures ne prouvent pas les temps
sur un MySQL de production ou sur un historique volumineux.

## Vérifications

Avant le sprint : **370 tests backend**, **75 tests Node**, typecheck/lint mobile et
build web verts. Commit séparé `c96ae59` : wrapper Windows (Target null), fabrique de
test masquée dans `EntrepotServiceTest`, simulation de zone vide dans `DispatchServiceTest`.

| Vérification finale | Résultat |
|---|---|
| Backend `mvnw.cmd -B -ntp verify` | Relance finale en cours après correction des descriptions Swagger |
| Node `node --test scripts/*.test.cjs` | 82/82 |
| Mobile typecheck / lint | Verts, zéro avertissement lint |
| Web build | Vert |
| Chrome réel, quatre dashboards, 390 et 1440 px | Huit vues vérifiées ; aucun débordement de page, erreur JS ou erreur API |
| Démo HTTP : livraisons → notes croisées → BI → seuil cash → ventes | Vert ; seed idempotent et garde production testés |

Le premier passage global exécutait 381 tests : un seul échec, le contrôle existant
de documentation Swagger. Les annotations ont été complétées et son test ciblé passe.
Scénarios ajoutés : notation hors état/doublon/tiers/décimale/commentaire/moyenne,
droits croisés, périodes et frontières Tunis, métriques sur valeurs connues, cohérence
ledger, seuils et cinq déclencheurs, absence de doublon, résolution/réactivation et audit.

Captures : [Finance à 390 px](captures/sprint6-finance-390.png),
[Opérations à 1440 px](captures/sprint6-operations-1440.png),
[résultats des huit vues](captures/sprint6-browser.json).
Les tableaux larges défilent dans leur propre conteneur ; les alertes s'affichent en
cartes pour garder valeur et seuil visibles à 390 px.

## Lancer la démonstration

Prérequis : Java **25** dans `JAVA_HOME`, dépendances npm du dépôt déjà installées.
La démo est conditionnée par `APP_DEMO_ENABLED=true`, `SPRINT6_DONNEES_DEMO=true` et
le profil `dev` ou `demo`. Avec `prod` ou `production` actif, elle reste inopérante,
même si les flags et le profil `demo` sont aussi présents. `SPRINT6_MOT_DE_PASSE_DEMO`
permet de changer le mot de passe commun.

Sur une base MySQL 8 **dédiée et vide** : configurer `SPRING_DATASOURCE_URL`,
`SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`, puis :

```powershell
$env:SPRING_PROFILES_ACTIVE = 'demo'
$env:APP_DEMO_ENABLED = 'true'
$env:SPRINT6_DONNEES_DEMO = 'true'
$env:SPRINT2_DONNEES_DEMO = 'false'
cd backend
.\mvnw.cmd -B -ntp spring-boot:run
```

Alternative **H2 isolée**, réellement utilisée pour les vérifications visuelles,
depuis `backend/` (ne nécessite pas MySQL ; données perdues à l'arrêt) :

```powershell
.\mvnw.cmd -B -ntp spring-boot:run '-Dspring-boot.run.useTestClasspath=true' '-Dspring-boot.run.profiles=demo' '-Dspring-boot.run.arguments=--server.port=8086 --spring.datasource.url=jdbc:h2:mem:sprint6preview;MODE=MySQL;DB_CLOSE_DELAY=-1 --spring.datasource.driver-class-name=org.h2.Driver --spring.jpa.database-platform=org.hibernate.dialect.H2Dialect --app.demo.enabled=true --app.sprint6.donnees-demo=true --app.sprint2.donnees-demo=false --app.dispatch.planificateur=false --app.bi.planificateur=false --app.admin.email=admin@sprint6.demo --app.admin.mot-de-passe=demo-sprint6-password'
```

Depuis la racine, dans un autre terminal :

```powershell
$env:API_URL = 'http://localhost:8086'
npm.cmd run dev --prefix web-responsable -- --host 127.0.0.1 --port 5176
```

Ouvrir `http://127.0.0.1:5176`. Pour H2 : responsable
`admin@sprint6.demo` / `demo-sprint6-password`. Pour MySQL : compte admin du README.
Comptes applicatifs : `client@sprint6.demo`, `partenaire1@sprint6.demo`,
`partenaire2@sprint6.demo`, `coursier1@sprint6.demo` à `coursier3@sprint6.demo`, tous
avec `demo-sprint6-password` par défaut. Les apps mobiles utilisent le port/API configuré
dans leur configuration partagée (et leurs origines CORS doivent être autorisées).

Le seed crée 30 livraisons sur dix jours, deux commerces, trois coursiers, deux zones,
cinq refus, une attente et 112 avis variés. Les commandes `DEMO-S6-29` et `DEMO-S6-30`
restent sans avis pour la démo interactive. Les deux premiers coursiers déposent leur
cash avec reçu ; le troisième conserve **1830 DT** ; un closing de la semaine passée
est enregistré. Les écritures sont créées au moment du seed, tandis que les dates de
livraison couvrent dix jours : les filtres Finance et Ventes suivent leurs dates documentées.

Parcours : ouvrir une commande livrée non notée → avis du client, du coursier et du
partenaire → consulter BI Partenaires/Coursiers → BI Finance, seuil cash 1800 DT →
alerte 1830 DT → app partenaire, onglet Ventes (15 livraisons / 1800 DT par commerce).
Le marker `client@sprint6.demo` rend le seed transactionnel et idempotent : pas de reset
ni réécriture au redémarrage. Pour recommencer, utiliser une nouvelle base dédiée.

## Données indisponibles et limites

- **Expiration partenaire** : non disponible, US-2B3 abandonnée.
- **Réclamations** : non disponibles, entité prévue au Sprint 7.
- **Distance/temps économisés par lots** : non disponibles, scénario unitaire de référence
  et positions de départ figées absents. `Lot.distanceKm/dureeMinutes` seuls ne suffisent pas.
- **Distance GPS réelle par mission** : non disponible ; le ratio minutes/km utilise la
  distance estimée financière et l'interface l'indique explicitement.
- Couverture : disponibilité déclarée et affectations actuelles, sans historique de
  présence physique ou taux d'occupation horaire inventé.
- Paiements : états comptables, sans exécution de virement.
- MySQL réel et son script, migration sur une base existante, Android/iOS physiques et
  rendu Expo sur appareils : **non vérifiés**. Aucun serveur de production utilisé.
- Aucun push distant réalisé ; les commits restent sur `sprint-6`.

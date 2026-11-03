# Sprint 2 — catalogue, zones et prise de commande

## Livré

| US | Comportement et fichiers principaux |
|---|---|
| US-201 | Partenaires actifs et ouverts desservant l’adresse choisie, recherche par nom et catégorie : `CatalogueService.java`, `MarcheClient.tsx` |
| US-202 | Catalogue, prix, disponibilité explicite : mêmes fichiers |
| US-203 | Catalogue privé du partenaire validé, publication/modification/disponibilité et ouverture du commerce : `CatalogueService.java`, `catalogue-partenaire.tsx`, `CataloguePartenaire.tsx` |
| US-204 | Panier en mémoire, quantités, notes, confirmation avant remplacement par un autre partenaire : `sprint2.ts`, `marche-session.tsx`, `MarcheClient.tsx` ; contrôle mono-partenaire également côté serveur |
| US-205 | Jusqu’à 20 adresses par client : libellé, adresse, latitude/longitude, ajout/correction/suppression ; carte et géolocalisation existantes réutilisées : `AdresseService.java`, `choisir-adresse.tsx` |
| US-206 | Devis serveur détaillé : articles, frais de zone et total COD ; confirmation invalidée si le devis change : `CommandeService.java` |
| US-207 | Validation COD idempotente, prix et noms figés, statut `PENDING_PARTNER` : `CommandeService.java`, `LigneCommande.java` |
| US-208 | CRUD de zones, frais, dessin sur carte OpenStreetMap, coordonnées éditables au clavier, frontières adjacentes et audit : `ZoneService.java`, `Zone.java`, `Zones.tsx`, `CarteZones.tsx` |
| US-209 | Historique client existant enrichi avec commerce, lignes, notes et statut ; détail web enrichi aussi : `LivraisonResponse.java`, `(onglets)/index.tsx`, `commande/[id].tsx`, `pages/Commandes.tsx` |

Les interfaces réutilisent le thème, les composants, le transport HTTP, les sessions et guards existants. Les états de chargement, vide, erreur et succès sont présents. Les modales web conservent le mécanisme de focus du Sprint 1. Le partenaire utilise l’application **mobile-client** ; après validation, son catalogue remplace l’écran de suivi du dossier. Le coursier conserve son application.

## Exploration et choix

Avant les changements, `Livraison` portait le client, une adresse géolocalisée copiée, un créneau, les paiements et des frais calculés selon le dépôt, sans commerce ni articles. L’historique utilisait déjà `GET /livraisons/mes`. Le CRUD livreurs/véhicules, les candidatures, l’authentification et l’audit sont réutilisés.

`Livraison` reste la **Commande** du domaine pour préserver les identifiants et les références de paiement. `LigneCommande.commande` désigne cette entité. Les anciennes commandes restent dans les mêmes listes.

La seule dépendance ajoutée est **JTS 1.20.0**. Le polygone est un `Polygon` JTS (sous-type de `Geometry`), converti en WKT dans une colonne texte. Les coordonnées sont en longitude/latitude, SRID 4326 ; l’API utilise des objets `{latitude, longitude}`. Ce stockage portable évite un dialecte spatial différent dans les tests H2. Une enveloppe avec index réduit les candidats en SQL, puis `covers` inclut les frontières. Les calculs sont planaires et adaptés aux zones locales de livraison, sans passage de l’antiméridien. Voir la [documentation JTS](https://locationtech.github.io/jts/javadoc/org/locationtech/jts/geom/Geometry.html).

Les polygones acceptent 3 à 200 sommets, sans trou ; auto-intersections, alignements et chevauchements intérieurs sont refusés. Les frontières communes sont autorisées. À une frontière partagée, la zone au plus petit identifiant gagne, de façon déterministe. Chaque partenaire dessert **sa zone uniquement** ; une zone voisine reste une autre couverture, même si elle est adjacente. Le rattachement est calculé depuis la position du commerce et actualisé lors des changements de zone et de l’ouverture du catalogue. Un commerce hors couverture reste fermé.

**Aucune zone couvrante = adresse non desservie, commande refusée.** Aucun retour silencieux au tarif kilométrique. Les frais des nouveaux devis, y compris l’ancien devis de livraison, viennent de la zone ; il n’y a pas de supplément immédiat dans ce sprint. `TarificationService` et ses tests de l’ancienne formule restent disponibles, sans être utilisés pour fixer les nouveaux frais.

## Contrats API

Chemins relatifs à `/api`, JSON, session Bearer obligatoire. OPERATIONS inclut l’administrateur principal ; FINANCE ne gère pas les zones. Les rôles des comptes inactifs restent limités par le Sprint 1.

| Méthode / chemin | Corps ou paramètres | Réponse / autorisation |
|---|---|---|
| `GET /admin/zones` | — | 200 liste `{id, nom, polygone, fraisLivraison, partenaires}` ; OPERATIONS/admin |
| `POST /admin/zones` | `{nom, polygone:[{latitude,longitude},…], fraisLivraison}` | 201 zone ; mêmes droits |
| `PUT /admin/zones/{id}` | Même corps | 200 zone ; mêmes droits |
| `DELETE /admin/zones/{id}` | — | 204 ; 409 si partenaires rattachés ; mêmes droits |
| `GET /partenaire/commerce` | — | 200 `{id,nomCommerce,categorie,adresse,ouvert,zoneId,zoneNom}` ; partenaire actif |
| `PUT /partenaire/commerce` | `{ouvert:boolean}` | 200 commerce ; 409 si ouverture hors couverture ; titulaire uniquement |
| `GET /partenaire/produits` | — | 200 produits du titulaire ; partenaire actif |
| `POST /partenaire/produits` | `{nom,prix,disponible}` | 201 produit ; partenaire actif |
| `PUT /partenaire/produits/{id}` | Même corps | 200 produit ; 403 si autre titulaire |
| `GET /adresses` | — | 200 adresses du client connecté |
| `POST /adresses` | `{libelle,adresse,latitude,longitude}` | 201 adresse ; client |
| `PUT /adresses/{id}` | Même corps | 200 ; client propriétaire |
| `DELETE /adresses/{id}` | — | 204 ; client propriétaire ; commandes existantes inchangées |
| `GET /partenaires` | `adresseId` obligatoire, `recherche`, `categorie` facultatifs | 200 commerces ouverts de la zone ; client propriétaire de l’adresse |
| `GET /partenaires/{id}/produits` | `adresseId` obligatoire | 200 produits `{id,partenaireId,nom,prix,disponible}` ; client, commerce ouvert et desservant l’adresse |
| `POST /commandes/devis` | panier ci-dessous | 200 `{partenaireId,nomPartenaire,zoneNom,lignes,montantArticles,fraisLivraison,total,empreinte}` ; client |
| `POST /commandes` | panier + `{cleIdempotence,devisEmpreinte}` | 201 commande ; même commande en cas de rejeu identique ; client |
| `GET /livraisons/mes` | Contrat conservé | 200 historique, nouveaux champs ci-dessous ; client |
| `GET /livraisons` | Contrat conservé | 200 commandes enrichies ; responsable, droits existants conservés |

Panier : `{partenaireId, adresseId, lignes:[{produitId,quantite}], notes?}`. Aucun montant ni mode de paiement n’est demandé : ce chemin impose **COD**. Le serveur ignore les montants ajoutés par le client, recharge les produits et recalcule tout. Prix et frais acceptent au plus trois décimales (DT).

Le devis renvoie une empreinte SHA-256 du contenu calculé, de la couverture et de l’adresse copiée. Le client la renvoie comme `devisEmpreinte` ; si quelque chose change, 409 demande un nouveau devis. Cette empreinte n’est ni un moyen d’autorisation ni une réservation de stock.

La commande reprend le DTO historique avec `partenaireId`, `nomPartenaire`, `zoneNom`, `montantArticles`, `lignes` et `notes`. Une ligne contient `{produitId,nomProduit,quantite,prixUnitaire,sousTotal}`. Le champ existant `montantTotal` est désormais articles + frais ; `montantACollecter` lui est égal en COD. Les données personnelles du partenaire ne sont pas exposées dans son catalogue.

Erreurs : format `{code,message}` existant ; 400 données invalides ou adresse non desservie, 403 accès refusé, 404 introuvable, 409 état incompatible/devis modifié/concurrence, 429 fréquence excessive. Sans JWT, 401 peut rester sans corps.

## Intégrité, abus et concurrence

- 1 à 50 produits distincts, 1 à 99 unités chacun ; pas de doublons ni de mélange de partenaires ; notes limitées à 500 caractères.
- Partenaire actif et ouvert, produits disponibles, adresse appartenant au client et dans la même zone que le commerce ; contrôles répétés au devis puis à la confirmation.
- Articles minimum **1 DT**, total maximum **1000 DT**, au plus **3 commandes actives**, au moins **30 secondes** entre créations. Paramètres : `COMMANDES_MINIMUM`, `COMMANDES_MAXIMUM`, `COMMANDES_ACTIVES_MAX`, `COMMANDES_INTERVALLE_SECONDES`. Les statuts actifs incluent `PENDING_PARTNER` et les anciens statuts de préparation/transport non terminés.
- Verrou pessimiste sur le client pour sérialiser validations et modifications d’adresses ; verrou partenaire partagé par les écritures de catalogue et la validation COD. Les limites et l’idempotence sont donc vérifiées sous verrou en base.
- Clé de 16 à 100 caractères alphanumériques, `_` ou `-`, préfixée en base par l’identifiant client ; contrainte unique. Même clé et même requête : même identifiant de commande, y compris après changement de catalogue. Même clé et autre requête : 409.
- L’app conserve le corps et la clé en mémoire en cas de réponse réseau incertaine, bloque les modifications et propose de réessayer. Le panier est lié à la session et effacé au changement de compte. Il n’est pas synchronisé entre appareils et ne survit pas à l’arrêt de l’app.
- Montants calculés en `BigDecimal` ; noms, prix unitaires, sous-totaux, adresse, nom du commerce et nom de zone copiés à la création. Le champ historique de frais reste un `double` pour compatibilité ; le total et les lignes sont stockés en décimal.
- Modifications de zones en transaction SERIALIZABLE, rafraîchissement/verrouillage des partenaires lors du rattachement, actions de zone et changements de frais dans l’audit. Une transaction concurrente annulée renvoie 409 et peut être rejouée.

## Schéma et migration

Nouvelles tables : `zone`, `produit`, `adresse_livraison`, `ligne_commande`. `partenaire` reçoit `zone_id` nullable et `ouvert` nullable/fermé par défaut. `livraison` reçoit des champs **nullables** pour le partenaire, les montants décimaux, les noms copiés, les notes et l’idempotence. Le statut passe en `VARCHAR(30)` pour accepter `PENDING_PARTNER` sans bloquer sur un ancien ENUM MySQL.

Les commandes antérieures ont `partenaireId=null`, `lignes=[]`, `montantArticles=null` et conservent leur calcul de total historique (frais + supplément, sinon montant à collecter). Aucune reconstruction fictive d’articles ou de partenaire. `Client.getNbCommandes()` dérive le nombre de la relation existante ; `passerCommande()` associe la nouvelle commande.

Le développement conserve `ddl-auto=update`. Pour un déploiement contrôlé : sauvegarder la base, arrêter le backend, appliquer `backend/migrations/sprint2-mysql.sql`, vérifier les nombres et montants des anciennes commandes, puis démarrer avec `SPRING_JPA_HIBERNATE_DDL_AUTO=validate`. Le script est additif et peut reprendre les ajouts de colonnes déjà effectués. Il exige MySQL 8 et les droits DDL/CREATE ROUTINE. Le retour applicatif conserve les tables et colonnes ajoutées pour préserver les nouvelles commandes.

**La migration SQL n’a pas été exécutée sur MySQL pendant cette tâche.** Les lectures d’anciennes commandes et le schéma complet sont testés sur H2 ; valider la migration sur une copie MySQL avant déploiement.

## Vérifications

| Contrôle | Résultat |
|---|---|
| Backend complet | **53 tests réussis**, dont les **36 tests du Sprint 1**, 4 tests de géométrie, 12 scénarios HTTP Sprint 2 et 1 test des données démo/reprise |
| Tests partagés Node | **32 réussis** : 20 Sprint 1 + 12 panier/validations/contrats Sprint 2 |
| TypeScript mobile client + coursier + shared | Réussi |
| ESLint mobile + shared | Réussi, sans avertissement ; aucun linter web distinct configuré |
| Build web | Réussi |
| Exports Android client et coursier | Réussis |
| Chrome avec backend H2 | **18 contrôles réussis**, dont 9 Sprint 1 : tracé de trois sommets à la souris, CRUD/frais/zones, refus, droits, audit, commandes et largeur 390 px ; résultats dans `.tmp/sprint2-browser-results.json` |
| Point dans zone JTS | **2 microsecondes** observées après chauffe pour un polygone simple ; test sous 200 ms. Ce n’est pas une mesure de charge MySQL ou du réseau. |
| Script Python historique | Adapté aux zones et au COD avec articles ; non exécuté : aucun interpréteur Python utilisable détecté dans cette session. Le parcours est aussi couvert par les tests HTTP Java et navigateur. |
| Android/iOS sur appareil | Non vérifié : aucun appareil/émulateur disponible dans cette session |

Les tests HTTP vérifient : filtres et catalogue, calcul serveur avec faux montants envoyés, prix/noms figés, panier vide/multi-partenaire/doublons/quantités, hors couverture/autre zone, fermeture/indisponibilité après devis, min/max, catalogues et adresses privés, rôles et anonymat, deux validations concurrentes donnant **une seule commande**, réemploi de clé avec autre corps, changement de frais, audit, frontières/chevauchement/suppression, fréquence/commandes actives, adresse copiée et ancienne commande lisible.

Reproduction depuis la racine, dépendances installées et **Java 25** dans `JAVA_HOME` :

```powershell
node --test scripts/sprint1.test.cjs scripts/sprint2.test.cjs
npm.cmd run typecheck --prefix mobile
npm.cmd run lint --prefix mobile
npm.cmd run build --prefix web-responsable
Set-Location backend
mvn.cmd --batch-mode --no-transfer-progress test dependency:build-classpath '-Dmdep.outputFile=../.tmp/backend-classpath.txt'
Set-Location ..
node scripts/verify-sprint2-browser.cjs
```

Le navigateur exige Chrome ou Edge, les ports 18083/15173 libres et un accès aux ressources Leaflet/OSM. Il utilise H2 en mémoire, lance ses propres processus avec dossiers temporaires isolés, exécute aussi les neuf contrôles navigateur du Sprint 1, puis ferme ses processus. Il ne modifie pas MySQL. La capture responsive est `.tmp/sprint2-zones-390.png`.

## Démonstration

Sur une base MySQL de développement, avec Java 25 :

```powershell
$env:SPRING_PROFILES_ACTIVE = 'demo'
$env:APP_DEMO_ENABLED = 'true'
$env:SPRINT2_DONNEES_DEMO = 'true'
Set-Location backend
.\mvnw.cmd spring-boot:run
```

Dans deux autres terminaux à la racine :

```powershell
npm.cmd run dev --prefix web-responsable
npm.cmd run client --prefix mobile
```

Le flag de données est facultatif et inopérant en production, même s’il est défini : les protections du mode démo du Sprint 1 sont réutilisées. Sur une base sans zone, il crée **Tunis centre démo** (36.77–36.85 / 10.13–10.23), frais **3,500 DT**, **Chez Amira** et **Épicerie du centre**, **5 produits chacun**, puis un client. Les relances ne réinitialisent pas les comptes ni leurs mots de passe. Si des zones existent déjà, leur couverture est conservée : les commerces démo ne s’ouvrent que si leur position est couverte.

| Compte | Mot de passe initial |
|---|---|
| `admin@fleetpulse.tn` | `admin12345` (ou `ADMIN_EMAIL` / `ADMIN_PASSWORD`, selon le Sprint 1) |
| `restaurant@sprint2.demo` | `sprint2-demo-password` |
| `epicerie@sprint2.demo` | `sprint2-demo-password` |
| `client@sprint2.demo` | `sprint2-demo-password` |

Parcours à reproduire : responsable → **Zones et frais** → créer/modifier un contour et ses frais ; partenaire dans l’app client → **Mon catalogue** → publier et ouvrir ; client → **Nouvelle commande** → enregistrer une adresse à **36.81, 10.18** ou placer le repère sur la carte → choisir un commerce et ses articles → **Calculer les frais et le total** → **Confirmer la commande COD** → détail et historique **En attente du partenaire**. Par exemple deux articles à 6,125 DT + 4,250 DT de livraison donnent 16,500 DT ; ce cas est vérifié contre le serveur réel dans Chrome.

Sur téléphone : si nécessaire `EXPO_PUBLIC_API_URL=http://<IP-PC>:8083` et même réseau que le PC. Le web utilise le proxy Vite existant, configurable par `API_URL`. Les tests H2 utilisent toujours `admin@sprint1.test` / `test-admin-password`, distinct de MySQL.

## Limites et périmètre conservé

- Pas d’options de produits : aucun modèle d’options n’existait. Les notes portent sur la commande.
- Pas de décision partenaire, expiration à deux minutes, préparation, QR, dispatch, tracking, ETA, finance ou notation ajoutés.
- Les champs historiques de créneau restent remplis pour la compatibilité ; pour le COD catalogue, ils ne constituent aucune promesse de délai et ne sont pas présentés comme tels dans le détail client.
- Stripe n’intervient jamais dans le devis ou la création COD. Son service et ses endpoints de paiement sont inchangés ; les tests existants de paiement passent. L’ancien formulaire est conservé sur la route protégée `/livraison-carte`, avec COD désactivé pour éviter une création sans articles. `POST /livraisons` reste disponible pour l’ancien flux CARTE ; le COD sans lignes répond désormais 400 et invite à utiliser le catalogue. Aucun paiement Stripe réel n’a été déclenché dans cette tâche.
- Les cartes réutilisent Leaflet 1.9.4 via le CDN déjà employé et les tuiles OSM. Une connexion Internet est nécessaire ; les coordonnées restent saisissables si la carte est indisponible. Aucun paquet d’interface supplémentaire n’est installé.
- L’affichage natif, les permissions GPS, le clavier et les gestes mobiles restent à valider sur appareil ; un export Android réussi ne constitue pas cette validation.
- Le script SQL, les verrous et le plan de requête restent à éprouver sur une copie MySQL représentative avant mise en production.

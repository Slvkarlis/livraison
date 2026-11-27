# Sprint 9 : livraison de quartier

Branche `sprint-9-quartier` — 27 novembre 2026.

## Livrées

| US | Livraison | Où |
|---|---|---|
| US-901 | Groupe d'un commerce, centre privé, zone, rayon de 400 m et fenêtre de 8 min par défaut ; capacité commune au dispatch : 3. | `GroupeQuartier`, `StatutGroupeQuartier`, `QuartierService` |
| US-902 | Ouverture à la commande chez un commerce activé ; refus du regroupement si préparation, fenêtre et trajet ne tiennent pas dans la promesse. | `CommandeService`, `QuartierService.ouverturePossible` |
| US-903 | Adhésion même commerce, même zone, dans le rayon, avant expiration et sous capacité ; offre et frais réduits dans le devis. | `POST /api/commandes/devis`, `QuartierService.compatible` |
| US-904 | À deux : −40 % pour chacun. À trois : dernier gratuit, autres −50 %. Plafond individuel non croissant, y compris après annulation ou exclusion. | `TarificationQuartier`, champs `frais*Quartier` en `BigDecimal` |
| US-905 | Fermeture à capacité ou expiration, tournée optimisée et lot `QUARTIER` conservé par le dispatch. Le coursier attend que tous les colis soient prêts. | `QuartierService.fermer`, `DispatchService` |
| US-906 | Singleton libéré sans la fenêtre ordinaire supplémentaire ; exclusion individuelle si une tournée ne respecte pas les promesses. Nouvelle vérification à la proposition et à l'acceptation. | `quartierSeule`, `securiserLot`, variante d'`Itineraire.optimiser` avec échéances |
| US-907 | Invitations privées, boîte de notifications, push Expo et WebSocket après commit ; une par groupe, deux par jour au maximum, préférence client. | `InvitationQuartier`, `InvitationsQuartierService`, `NotificationService`, `DiffusionTempsReel` |
| US-908 | Groupes proches anonymes ; supervision, statistiques, activation par commerce, paramètres persistants et Swagger. | `QuartierController`, `ParametresDispatch`, `ParametresQuartier` |
| US-909 | Bandeaux accueil et commerce avec décompte, remise dans la confirmation, suivi avec nombre de voisins et préférence dans le profil. | `BandeauQuartier`, `MarcheClient`, `DetailCommandeClient`, `PreferenceQuartier` |
| US-910 | Mention « Groupe de quartier » dans l'offre et l'itinéraire du coursier. | `CarteOffre`, `CarteItineraire` |
| US-911 | Page Quartier dans le menu, groupes actualisés toutes les 5 s, carte Leaflet avec cercles, économies et réglages. | `web-responsable/src/pages/Quartier.tsx`, `CarteQuartier` |
| US-912 | Trois voisins avec adresses, commerce et coursier synthétiques ; démo de création d'un groupe de trois sans attendre l'expiration. | `Sprint9DemoInitializer`, `outils/simulation/demo-quartier.mjs` |
| US-913 | Comparaison à demandes constantes, taux d'adhésion 10/25/40 %, cinq indicateurs. | `SimulateurLots.comparerQuartier`, `SimulationQuartier`, page Simulateur, `outils/simulation/quartier.mjs` |
| US-914 | Commandes carte : Checkout Stripe hébergé, autorisation du plafond puis capture du prix final ; zéro COD, annulation/libération ou remboursement et reprise idempotente. | `PaiementQuartierService`, `StripeCarteQuartier`, confirmation carte dans l'app client |

## Décisions

- **Intégration au dispatch** : les groupes ouverts restent hors du regroupement ordinaire et de l'IA Python. Un groupe fermé possède son lot avant la recherche du coursier ; refus et expiration d'offre reproposent ce lot. Une affectation manuelle prend le groupe entier. Les exclusions motivées par une promesse partent seules.
- **Promesse** : pour un commerce activé, elle est figée dès la création, à 60 min par défaut. L'acceptation partenaire conserve cette promesse. La borne d'ouverture inclut préparation prévue + fenêtre + approche + trajet et arrêts. L'optimiseur explore les tournées respectant toutes les échéances, temps de remise compris.
- **Prix acquis** : pour des frais normaux de 3 DT, le premier commande à 3 DT, le deuxième à 1,800 DT ; leurs frais deviennent 1,800 DT. L'arrivée du troisième fixe 1,500 / 1,500 / 0 DT. Une annulation ne retire aucune réduction acquise. Un singleton qui n'a jamais eu de voisin reste à 3 DT.
- **Montants** : calculs et stockage des tarifs quartier en `BigDecimal`, trois décimales TND. Les champs historiques `double` sont alimentés à la frontière pour conserver les contrats des anciens sprints. `BaremeService` et les écritures de rémunération individuelle ne sont pas réduits.
- **Économies** : `gainKm = max(0, somme des trajets commerce→client séparés − trajet groupé)` ; `gainDt = gainKm × coutKm`. Ce sont des économies de trajet estimées, pas un bénéfice net après remises ou commissions. Une annulation après fermeture remet l'estimation à zéro par prudence.
- **Confidentialité** : ni centre, ni identité, ni adresse, ni identifiant de commande voisine dans l'offre client. Le centre n'est accessible qu'aux opérations. Chaque membre reçoit sur sa file WebSocket seulement l'identifiant de sa propre commande pour recharger ses frais.
- **Quota** : jour civil `Africa/Tunis`, compteur et déduplication persistants, vérifiés sous verrou du client destinataire. Plusieurs adresses d'un même client ne multiplient pas les invitations. Les comptes inactifs et les membres ne sont pas invités.
- **Configuration** : `app.quartier.*` initialise les valeurs ; un réglage admin enregistré en base est prioritaire au redémarrage. Les taux sont copiés dans le groupe à l'ouverture. Le dispatch par lots doit être actif.
- **Carte** : aucun service Stripe utilisable n'était présent dans cet état du dépôt. Le parcours ajouté autorise le montant annoncé et attend la fermeture avant capture ; il est désactivé sans clé. Les sommes Stripe TND doivent être multiples de 0,010 DT ; si une remise produit un demi-centime, le prix final est arrondi vers le bas. Un paiement non confirmé ne part jamais au dispatch, y compris en mode d'affectation simple.
- **Thème** : le dépôt utilise actuellement ambre/graphite. Les nouvelles surfaces quartier sont lavande/violet ; le reste du thème est conservé.

## API

| Méthode | Route | Accès / résultat |
|---|---|---|
| GET | `/api/quartier/groupes-proches?adresseId=` | Client propriétaire de l'adresse : commerce, nombre de membres, remise, frais et expiration |
| GET / PUT | `/api/quartier/preference` | Préférence `recevoirInvitationsQuartier` du client connecté |
| POST | `/api/commandes/devis` | `groupeDisponible` et frais projetés, inclus dans l'empreinte |
| POST | `/api/commandes` | COD par défaut ; `modePaiement: CARTE` si configuré, `urlPaiementCarte` dans la réponse |
| GET | `/api/quartier/carte` | Disponibilité du prestataire, sans clé |
| POST | `/api/commandes/{id}/carte/confirmer` | Vérification côté serveur pour le propriétaire |
| GET | `/api/admin/quartier/groupes` | 500 derniers groupes, centre et lot inclus ; opérations uniquement |
| GET | `/api/admin/quartier/statistiques` | Ouverts, fermés, annulés, remplissage et économies |
| GET | `/api/admin/quartier/commerces` | Activation des commerces |
| PUT | `/api/admin/quartier/commerces/{id}` | `{groupesQuartierActifs: true/false}` |
| GET / PUT | `/api/admin/quartier/parametres` | Réglages persistants des prochains groupes |
| POST | `/api/admin/simulateur/quartier` | Comparaison des trois modes, aucune commande réelle modifiée |

Les endpoints sont documentés dans Swagger et renvoient les erreurs `{code, message}`.
Les nouveaux statuts sont stockés en `VARCHAR`.

## Preuve par les chiffres

Jeu déterministe de **60 demandes identiques dans les trois modes** : un commerce à
36,80 / 10,18, destinations autour de 36,82 / 10,18 dans un rayon inférieur à 400 m,
une demande toutes les 90 s, préparation de 15 min, promesse de 60 min, vitesse de
20 km/h, frais de 3 DT. Le départ est le commerce.

Le mode « lots actuels » appelle `RegroupementLots.regrouper`, rayon 1,5 km,
durée à bord 35 min, commandes disponibles dans la fenêtre ordinaire de 30 s.
Sur ce jeu espacé de 90 s, il ne trouve pas de simultanéité : son bilan est donc
celui du dispatch unitaire. Le quartier avance dans sa fenêtre les demandes
existantes d'adhérents compatibles prévues dans les 30 minutes suivantes ; il
n'ajoute aucune demande. Le tirage est déterministe par identifiant. Les échéances
du jeu initial sont conservées pour comparer la ponctualité sur la même base.

| Mode | Adhésion | Km totaux | Coût / commande (DT) | Commandes / coursier / h | À l'heure promise | Frais client moyens (DT) |
|---|---:|---:|---:|---:|---:|---:|
| Sans lots | — | 176,099 | 5,935 | 4,687 | 100 % | 3,000 |
| Lots actuels | — | 176,099 | 5,935 | 4,687 | 100 % | 3,000 |
| Lots + quartier | 10 % | 161,623 | 5,814 | 4,967 | 100 % | 2,800 |
| Lots + quartier | 25 % | 135,605 | 5,598 | 5,567 | 100 % | 2,420 |
| Lots + quartier | 40 % | 115,314 | 5,428 | 6,145 | 100 % | 2,080 |

Coût modélisé : rémunération individuelle inchangée, 3 DT + 0,500 DT/km direct,
plus coût variable des tournées de 0,500 DT/km. La productivité porte sur les heures
en tournée, sans attente d'une nouvelle demande. Les coursiers sont supposés
disponibles ; le temps de fenêtre est pris en compte pour l'heure de remise.
Ce tableau mesure un scénario synthétique, pas les résultats d'un pilote réel.

Reproduction : `SimulationQuartierTest`, ou `node outils/simulation/quartier.mjs`
avec `API_TOKEN` opérations et `API_URL`. Le même jeu est proposé par le bouton
« Charger 60 demandes de quartier » de la page Simulateur.

## Vérifications

- **Backend** : suite complète `mvn test` sous JDK 25 : **432 tests, zéro échec, zéro erreur, aucun ignoré** ; bases H2 isolées, résultat dans `.tmp/sprint9-mvn-final.log`.
- **Règles** : ouverture et promesse, rayon/zone/commerce/expiration/capacité, prix 1/2/3, plafonds après annulation et exclusion, singleton, lot imposé, anti-spam, préférence et confidentialité.
- **HTTP COD** : trois comptes et adresses voisins → devis réduits → un groupe → un lot de trois → un coursier → trois collectes → trois QR et remises. Vérification des frais et des accès refusés.
- **HTTP carte, prestataire simulé** : trois autorisations, captures finales 13,500 / 13,500 / 12,000 DT pour des articles de 12 DT, un lot, trois remises à zéro COD. Refus des montants/devises discordants et reprise après capture déjà effectuée couverts en unitaires.
- **Admin** : modification persistée des paramètres, refus des valeurs invalides et protection des endpoints ; test Swagger sur toutes les opérations.
- **Applications mobiles** : `npm run typecheck` et `npm run lint` sur client et livreur.
- **Web responsable** : `npm run build` (`tsc -b` + Vite) et `npm run lint` passent. La nouvelle commande ESLint réutilise les outils TypeScript déjà installés dans `mobile/node_modules` ; aucune dépendance ajoutée.
- **Contrats partagés** : **82/82** tests Node des scripts `scripts/*.test.cjs`. L'ancienne assertion de destination admin attendait `/dossiers` alors que le code préexistant dirige vers `/accueil` ; l'assertion a été corrigée, sans modifier les droits ni la navigation.
- **Navigateur** : démo autonome H2, connexion responsable, page Quartier, cercle Leaflet et calcul depuis le Simulateur vérifiés dans Chrome/Edge headless ; aucune exception JavaScript non gérée. Script reproductible `scripts/verifier-sprint9-web.cjs`, captures locales `.tmp/sprint9-quartier-web.png` et `.tmp/sprint9-simulateur-web.png`.

Commandes, depuis `backend/`, avec un JDK 25 dans `JAVA_HOME` :

```powershell
mvn test
mvn dependency:build-classpath "-Dmdep.outputFile=../.tmp/backend-classpath-sprint9.txt" "-DincludeScope=test"
```

Puis depuis la racine :

```powershell
npm.cmd --prefix mobile/mobile-client run typecheck
npm.cmd --prefix mobile/mobile-client run lint
npm.cmd --prefix mobile/mobile-livreur run typecheck
npm.cmd --prefix mobile/mobile-livreur run lint
npm.cmd --prefix web-responsable run build
npm.cmd --prefix web-responsable run lint
node scripts/verifier-sprint9-web.cjs
```

## Démonstration

Sur une base de démonstration dédiée, activer le profil `demo`, `APP_DEMO_ENABLED=true`
et `SPRINT9_DONNEES_DEMO=true`, puis démarrer le backend. L'initialiseur est inactif
sans ces réglages et refuse les profils de production via `ModeDemonstration`.

Comptes : `voisin1@sprint9.demo`, `voisin2@sprint9.demo`, `voisin3@sprint9.demo`,
`commerce@sprint9.demo`, `coursier@sprint9.demo`. Mot de passe par défaut :
`demo-sprint9-password`, modifiable par `SPRINT9_MOT_DE_PASSE_DEMO`.

`node outils/simulation/demo-quartier.mjs` passe les trois commandes, marque les
colis prêts et accepte le lot en moins de deux minutes sur le serveur local de test.
Les remises se font avec les QR des applications ; leur automatisation HTTP complète
est dans `Sprint9QuartierParcoursTest`. Le script peut être rejoué après traitement
du lot précédent, dans les limites de commandes actives et de capacité du coursier.

Configuration initiale : `QUARTIER_RAYON_METRES=400`, `QUARTIER_FENETRE_SECONDES=480`,
`QUARTIER_PREPARATION_MINUTES=15`, `QUARTIER_PROMESSE_MINUTES=60`,
`QUARTIER_REDUCTION_DEUX=0.40`, `QUARTIER_REDUCTION_TROIS=0.50`,
`QUARTIER_COUT_KM=0.500`. Les réglages admin persistés prennent priorité.

Carte facultative : `STRIPE_SECRET_KEY` et `STRIPE_RETOUR_URL`, URL web de retour
se terminant par `/commande/`, adaptée à l'installation. Push réel : configuration
Expo et `APP_PUSH_EXPO_ACTIF` existants.

## Limites

- Aucun paiement ni remboursement Stripe réel testé : passerelle simulée pour les tests HTTP, documentation officielle utilisée pour Checkout, autorisation et capture. Aucun numéro de carte n'est traité par FleetPulse.
- Aucun push Expo reçu sur un téléphone ni parcours Expo Go sur appareil physique vérifié pendant cette session.
- Migration MySQL fournie dans `backend/migrations/sprint9-mysql.sql`, non appliquée à la base de développement ; tests exécutés sur H2. Avec Hibernate `ddl-auto=update`, les ajouts sont gérés au démarrage ; ne pas rejouer la migration sur une base déjà mise à jour.
- La contrainte d'heure promise repose sur l'estimation de trajet et la préparation connue. Les simulations ne mesurent pas les aléas réels de circulation, de préparation ou de disponibilité des coursiers.
- Le cycle périodique existant vérifie les expirations toutes les 15 s par défaut. Une commande libérée du quartier ne subit pas les 30 s supplémentaires du regroupement ordinaire.
- La carte Leaflet charge la bibliothèque 1.9.4 et les tuiles OpenStreetMap depuis leurs serveurs ; la liste et les statistiques restent utilisables si ces ressources sont indisponibles.

Références d'intégration : [autorisation puis capture Stripe](https://docs.stripe.com/payments/place-a-hold-on-a-payment-method),
[API de capture](https://docs.stripe.com/api/payment_intents/capture),
[API Checkout](https://docs.stripe.com/api/checkout/sessions/create),
[devises Stripe](https://docs.stripe.com/currencies), [Leaflet](https://leafletjs.com/reference-1.9.4.html).

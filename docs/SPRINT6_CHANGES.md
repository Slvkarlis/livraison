# Sprint 6 — Changements par commit

Branche `sprint-6` depuis `sprint-5`. A = ajouté, M = modifié.
Les chemins Java sont relatifs à `backend/src/{main,test}/java/com/fleetpulse/livraison`.

## fix(sprint-4/5): rétablir la compilation et les scénarios de dispatch

- **M** `backend/mvnw.cmd` : gérer un répertoire Maven qui n'est pas un lien
  (propriété PowerShell Target nulle).
- **M** test `Service/EntrepotServiceTest.java` : qualifier la fabrique `DonneesTest.commande`
  masquée par une méthode locale sans argument.
- **M** test `Service/DispatchServiceTest.java` : simuler explicitement l'absence de
  coursier dans la zone initiale avant de tester le débordement.
- **A** `docs/SPRINT6_PLAN.md` : inventaire des sources et séquence du sprint.
- **A** `docs/SPRINT6_CHANGES.md` : journal initial.

Environnement : Java 25 fourni par l'extension Red Hat Java de VS Code ; Maven système
3.9.12 / wrapper 3.9.16. Le lint nécessite l'accès aux dossiers parents sous Windows.
L'ajout Actuator déjà présent dans `backend/pom.xml` est conservé hors des commits.

## feat(US-309): notation définitive des participants par le client

- **A** main `Model/Notation.java`, `Repository/NotationRepository.java`,
  `Dto/NotationDto.java`, `Service/NotationService.java`, `Controller/NotationController.java` :
  participants contrôlés, verrou de commande, unicité en base, notes immuables et moyenne SQL.
- **M** main `Controller/GestionErreurs.java` : méthode interdite → 405 JSON.
- **A** `mobile/packages/shared/src/notation.ts`, `PanneauNotation.tsx` ; **M** `api.ts`, `index.ts`.
- **M** `mobile/mobile-client/src/app/commande/[id].tsx` : avis après livraison.
- **A** test `Sprint6NotationTest.java`, `scripts/notation.test.cjs`.
- Vérification : parcours HTTP H2 vert (livraison réelle, refus, doublon, moyenne),
  3 tests Node verts, typecheck mobile vert. Une méthode HTTP de test couvre plusieurs assertions.

## feat(US-511): avis croisés des coursiers et des partenaires

- **M** main `Service/NotationService.java` : coursier participant → client ; partenaire
  participant → coursier ; toutes les autres combinaisons interdites.
- **M** `mobile/mobile-client/src/composants/partenaire/DetailCommandeRecue.tsx`,
  `mobile/mobile-livreur/src/composants/missions/EcranMission.tsx` : formulaire partagé.
- **M** `mobile/mobile-livreur/src/composants/caisse/EcranCaisse.tsx` : accès au détail livré.
- **M** test `Sprint6NotationTest.java` : avis croisés, doublon, tiers, isolement des avis.
- Typecheck mobile vert ; scénarios HTTP ajoutés au parcours de notation.

## feat(US-507): dashboard Finance réconciliable avec le ledger

- **A** main `Service/PeriodeBi.java`, `BiFinanceService.java`, `Repository/BiRepository.java`,
  `Dto/BiDto.java`, `Controller/BiFinanceController.java` : périodes Tunis, agrégations SQL/JPA.
- **M** main `Repository/FinanceCommandeRepository.java`, `Service/CaisseService.java`,
  `ClosingService.java` : synthèses agrégées des soldes et des paiements éligibles.
- **A** `mobile/packages/shared/src/bi.ts` : types et règles de période/affichage.
- **A** `web-responsable/src/biApi.ts`, `composants/BiCommun.tsx`, `pages/BiFinance.tsx`.
- **M** `web-responsable/src/App.tsx`, `composants/Layout.tsx`, `styles.css` : navigation
  FINANCE, cartes et filtres adaptables à 390 px, légendes par indicateur.
- **A** tests `Sprint6BiTest.java`, `Service/PeriodeBiTest.java` : jeu de 12 DT d'articles,
  1,440 DT de commission, marge −1 DT, cash 15 DT puis dépôt et net éligible 10,560 DT.
- Vérification : 2 méthodes de test backend vertes, build web vert.

## feat(US-508): volumes, densité Leaflet et couverture des zones

- **M** main `Dto/BiDto.java`, `Repository/BiRepository.java`, `Model/Livraison.java` :
  projections de statuts/zones/disponibilités et index de période, partenaire et coursier.
- **A** main `Service/BiOperationsService.java`, `Controller/BiOperationsController.java`.
- **M** `mobile/packages/shared/src/bi.ts`, `web-responsable/src/biApi.ts`, `App.tsx`,
  `composants/Layout.tsx` ; **A** `pages/BiOperations.tsx`, `composants/CarteDensite.tsx`,
  `public/carte-bi.html` : filtres, carte de densité, tableau accessible et gains indisponibles.
- **A** test `Sprint6OperationsTest.java` : volumes connus, couverture 0 puis 100 %, périodes,
  zone absente/invalide et droits croisés. 2 tests HTTP verts ; build web vert.

## feat(US-509): préparation, décisions et classement partenaires

- **M** main `Dto/BiDto.java`, `Repository/BiRepository.java`, `Controller/BiOperationsController.java` ;
  **A** `Service/BiPartenaireService.java` : moyennes avec échantillons, motifs et classement stable.
- **M** `mobile/packages/shared/src/bi.ts`, `web-responsable/src/biApi.ts`, `App.tsx`, `composants/Layout.tsx` ;
  **A** `composants/useBi.ts`, `pages/BiPartenaires.tsx` : tableau avec légendes et indisponibilités explicites.
- **M** test `Sprint6OperationsTest.java` : préparation 10/12 min, décisions 50/50 %, motif RUPTURE,
  note 5 et classement ; filtre vide et accès FINANCE refusé. 3 tests HTTP verts ; build web vert.

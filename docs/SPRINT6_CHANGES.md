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

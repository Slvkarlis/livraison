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

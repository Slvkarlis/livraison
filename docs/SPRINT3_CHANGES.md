# Sprint 3 — Code changes per commit

What each commit changed, file by file. A new entry is added with every commit.
Branch `sprint-3`, starting from `sprint-2bis` @ `7bd9bd7`. Paths are shortened:

| Short | Full path |
|---|---|
| `B/` | `backend/src/main/java/com/fleetpulse/livraison/` |
| `T/` | `backend/src/test/java/com/fleetpulse/livraison/` |
| `S/` | `mobile/packages/shared/src/` (shared mobile package `@fleetpulse/shared`) |
| `C/` | `mobile/mobile-client/src/` (client + partner app) |
| `L/` | `mobile/mobile-livreur/src/` (courier app) |
| `W/` | `web-responsable/src/` (back-office) |

Markers: **A** added · **M** modified · **D** deleted · **R** renamed/moved.

---

## feat(US-301): courier sends GPS position during missions

**Backend**
- **A** `B/Model/PositionLivreur.java`: entity `position_livreur` (courier, latitude, longitude, accuracy, date), never changed. Index on courier + date.
- **A** `B/Repository/PositionLivreurRepository.java`: a courier's trace in order.
- **A** `B/Service/Distances.java`: haversine distance in km (MySQL without PostGIS).
- **A** `B/Service/SuiviPositionService.java`: `enregistrer` validates the point, ignores it when the accuracy is worse than 150 m or the implied speed is above 150 km/h, keeps the last position on the courier, and writes the trace only while a mission is in progress.
- **M** `B/Model/Livreur.java`: `dernierePositionLe`, `positionConnue()` and `placer()`.
- **M** `B/Service/EspaceLivreurService.java`: going available uses `placer()`, so the position date is known.
- **M** `B/Service/AffectationMissionService.java`: `MISSIONS_EN_COURS` includes `A_PROXIMITE`; new `EN_ROUTE_VERS_CLIENT`.
- **M** `B/Controller/EspaceLivreurController.java`: `PUT /api/livreur/position`.
- **M** `B/Dto/EspaceLivreurDto.java`: `PositionRequest`, `PositionVue`; `MissionVue` gets the delivery address and coordinates, only once the parcel is picked up.
- **A** `T/ParcoursSprint3.java`: shared setup for the Sprint 3 HTTP scenarios (zone, shop, clients, ready order, picked-up order).
- **A** `T/Sprint3PositionTest.java`: trace only during a mission, aberrant points ignored, invalid input and wrong role refused, client address revealed after pickup.
- **A** `T/Service/DistancesTest.java`.

**Courier app**
- **A** `L/composants/suivi/SuiviPosition.tsx`: provider that watches the GPS (`watchPositionAsync`, 10 s / 25 m) while missions are in progress; in demo mode, a simulated route from the shop to the client (50 m every 2 s).
- **A** `L/composants/suivi/CarteSuiviGps.tsx`: "Suivi GPS actif · position transmise à HH:MM:SS", ignored point, error, simulation buttons.
- **M** `L/app/_layout.tsx`: wraps the logged-in courier screens in the provider.
- **M** `L/composants/missions/EcranMissions.tsx`: shows the GPS card; list title "EN COURS".

**Shared mobile**
- **A** `S/suivi.ts`: `PositionEnvoyee`, mission statuses, `SUIVI_GPS`, `distanceKm`, `pointsTrajet`, `enMission`.
- **M** `S/espaceLivreur.ts`: delivery fields on `Mission`, `envoyerPosition()`.
- **M** `S/index.ts`: exports `suivi`.
- **A** `scripts/suivi.test.cjs`: distance, simulated route, mission statuses, API route.

**Other**
- **M** `.gitignore`: `docs/SPRINT3_PLAN.md` stays local, like the Sprint 2 bis plan.
- **A** `docs/SPRINT3_CHANGES.md`: this file.

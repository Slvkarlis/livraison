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

---

## feat(US-302, US-303): client follows the courier live on a map with a rule-based ETA

**Backend**
- **A** `B/Service/EstimationArrivee.java`: rule-based ETA (pure). Remaining preparation, then courier → shop (if known) + 2 min at the shop + shop → client; once picked up, courier → client. Distance = haversine × 1.3, at the zone's average speed.
- **A** `B/Service/SuiviCommandeService.java`: `suivi(email, id)` for the client who owns the order (404 otherwise); `arriveeEstimee()` uses the actual ready time once the order is ready.
- **A** `B/Dto/SuiviDto.java`: `SuiviCommandeVue` (status, courier first name, courier position only once the parcel is on board, shop, destination, ETA) and `PositionCommande` (real-time message).
- **M** `B/Service/SuiviPositionService.java`: after an accepted point, for each picked-up order of the courier: `RECUPEREE → A_PROXIMITE` once within 300 m, and the position + ETA is published for the client.
- **M** `B/Service/DiffusionTempsReel.java`: pushes positions to `/user/queue/positions`, after commit.
- **M** `B/Service/CommandeWorkflow.java`: transition `RECUPEREE → A_PROXIMITE`.
- **M** `B/Model/enums/StatutLivraison.java`: lifecycle comment.
- **M** `B/Model/Zone.java`: `vitesseMoyenneKmh` (null = 20 km/h) and `vitesseMoyenne()`.
- **M** `B/Dto/MarketplaceDto.java`: `ZoneRequest.vitesseMoyenneKmh` (optional) and `ZoneVue.vitesseMoyenneKmh`.
- **M** `B/Service/ZoneService.java`: speed from 5 to 80 km/h, kept when absent.
- **M** `B/Service/Sprint2DemoInitializer.java`: new `ZoneRequest` signature.
- **M** `B/Controller/MarketplaceController.java`: `GET /api/commandes/{id}/suivi`.
- **A** `T/Service/EstimationArriveeTest.java`: preparation, courier far from the shop, parcel on board, no ETA outside delivery.
- **A** `T/Sprint3SuiviTest.java`: ETA before pickup, courier hidden before pickup, proximity only once, real STOMP client receives positions, zone speed validation and effect.

**Client app**
- **A** `C/composants/suivi/useSuiviLivraison.ts`: loads the tracking on each status change, then follows the courier position by position.
- **M** `C/app/commande/[id].tsx`: courier marker on the map, "Arrivée estimée vers HH:MM · dans N min".
- **M** `C/composants/carteLeafletPage.ts`, `CarteLeaflet.tsx`, `CarteLeaflet.web.tsx`: `placerLivreur()` draws the courier and frames it with the destination.

**Shared mobile**
- **M** `S/suivi.ts`: `SuiviCommande`, `PositionCommande`, `STATUTS_SUIVIS`, `messageArrivee`, `lirePositionCommande`, `creerApiSuivi`.
- **M** `S/tempsReel.tsx`: second subscription `/user/queue/positions` and `usePositionsLivreur`.
- **M** `S/api.ts`: tracking API.
- **M** `S/sprint2bis.ts`: client wording for `A_PROXIMITE`.
- **M** `S/sprint2.ts`: `ZoneSaisie.vitesseMoyenneKmh`.
- **M** `scripts/suivi.test.cjs`, `scripts/tempsReel.test.cjs`: ETA message, position parsing, route, wording.

**Web back-office**
- **M** `W/pages/Zones.tsx`: "Vitesse moyenne des livreurs" field and column.

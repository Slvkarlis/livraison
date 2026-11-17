# Sprint 4 — Code changes per commit

What each commit changed, file by file. Branch `sprint-4`, starting from `sprint-3` @ `566d75b`. Paths are shortened:

| Short | Full path |
|---|---|
| `B/` | `backend/src/main/java/com/fleetpulse/livraison/` |
| `T/` | `backend/src/test/java/com/fleetpulse/livraison/` |
| `S/` | `mobile/packages/shared/src/` |
| `C/` | `mobile/mobile-client/src/` |
| `L/` | `mobile/mobile-livreur/src/` |
| `W/` | `web-responsable/src/` |
| `IA/` | `ia/` (Python AI service) |

Markers: **A** added · **M** modified · **D** deleted.

---

## feat(US-401..US-407): AI batch dispatch, offers, ETA promise, supervision and data warehouse

**Model and persistence**
- **A** `B/Model/Lot.java`: batch of 1 to 3 orders (status, accepting courier, compact route `C:12;L:12`, distance, duration, source IA / REGLES / FORCE, excluded couriers).
- **A** `B/Model/OffreLot.java`: offer of a batch to a courier with expiry, overflow flag, distance, score and refusal reason.
- **A** `B/Model/EvenementEntrepot.java`: immutable warehouse event (type, order, courier, zone, batch, value, code).
- **A** `B/Model/enums/StatutLot.java`, `StatutOffre.java`, `TypeEvenement.java`.
- **M** `B/Model/Livraison.java`: `lot`, `promesseLivraison`, `sourcePromesse`.
- **M** `B/Model/enums/ActionAudit.java`: `AFFECTATION_FORCEE`.
- **A** `B/Repository/LotRepository.java`, `OffreLotRepository.java`, `EvenementEntrepotRepository.java` (pessimistic locks on batch and offer).
- **M** `B/Repository/LivraisonRepository.java`: orders of a batch, ready orders without courier, a shop's recent preparations, delivered orders since a date.
- **M** `B/Repository/PositionLivreurRepository.java`: GPS points since a date (export).

**Rules (pure Java, unit tested)**
- **A** `B/Service/Itineraire.java` (US-404): exhaustive search of valid routes, time-on-board limit, route encoding/decoding.
- **A** `B/Service/RegroupementLots.java` (US-403): greedy batching, compatibility (zone / adjacent zone, radius, ready-time gap), gain check.
- **A** `B/Service/ChoixLivreur.java` (US-402): courier score (distance, zone penalty, load, overflow).
- **M** `B/Service/ZoneService.java`: `adjacentes()` and `voisinages()` reuse the existing shared-border rule.

**Services**
- **A** `B/Service/DispatchService.java`: triggers (order ready, courier available/unavailable, periodic cycle), batch creation only with a candidate, offers, accept / refuse / expiry, re-offers, supervision, forced assignment, delegation to `AffectationMissionService` when `par-lots=false`.
- **A** `B/Service/ParametresDispatch.java`: `app.dispatch.*` settings.
- **A** `B/Service/ServiceIa.java`: HTTP client of the Python service, 800 ms timeout, empty answer on any error (degraded mode).
- **A** `B/Service/EstimationLivraisonService.java` (US-406): promise at acceptance (AI or rules), shop punctuality, live ETA along the batch route.
- **A** `B/Service/EntrepotService.java` (US-401): after-commit history of statuses and preparation, ETA training set, export.
- **A** `B/Config/PlanificateurDispatch.java`: scheduled cycle (`@EnableScheduling`), can be switched off.
- **M** `B/Service/CommandePartenaireService.java`: freezes the promise at acceptance; a ready order goes to `DispatchService`.
- **M** `B/Service/EspaceLivreurService.java`: availability changes go to `DispatchService`.
- **M** `B/Service/SuiviCommandeService.java`, `B/Dto/SuiviDto.java`: ETA from `EstimationLivraisonService`; `promesseLivraison`, `sourcePromesse`.
- **M** `B/Service/DiffusionTempsReel.java`: offer announced on `/user/queue/commandes`.

**API**
- **A** `B/Controller/OffreLivreurController.java`: `/api/livreur/offres`, `/offres/{id}/accepter|refuser`, `/lots`.
- **A** `B/Controller/DispatchController.java`: `/api/admin/dispatch`, `/commandes/{id}/forcer`, `/cycle`.
- **A** `B/Controller/EntrepotController.java`: `/api/admin/entrepot/evenements|jeu-eta|export`.
- **A** `B/Dto/DispatchDto.java`, `B/Dto/EntrepotDto.java`.
- **M** `B/Config/OpenApiConfig.java`: version sprint-4, 409 on offer and dispatch routes, parameter descriptions.
- **M** `backend/src/main/resources/application.properties`: `app.dispatch.*`, `app.ia.*`.
- **M** `backend/src/test/resources/application.properties`: earlier scenarios keep the single assignment, no scheduler.

**Tests**
- **A** `T/Service/ItineraireTest.java`, `RegroupementLotsTest.java`, `ChoixLivreurTest.java`, `DispatchServiceTest.java`, `EstimationLivraisonServiceTest.java`, `EntrepotServiceTest.java`, `ServiceIaTest.java`.
- **A** `T/Controller/OffreLivreurControllerTest.java`, `DispatchControllerTest.java`, `EntrepotControllerTest.java`.
- **A** `T/Sprint4DispatchTest.java`: HTTP scenarios on H2 with batch dispatch on.
- **M** `T/Service/EspaceLivreurServiceTest.java`, `CommandePartenaireServiceTest.java`, `SuiviCommandeServiceTest.java`, `T/Controller/MarketplaceControllerTest.java`.

**AI service**
- **A** `IA/fleetpulse_ia/geo.py`, `itineraire.py`, `lots.py` (Clarke–Wright savings), `eta.py` (gradient boosting + simulated history), `app.py` (FastAPI).
- **A** `IA/entrainer.py`, `IA/tests/*`, `IA/README.md`, `IA/requirements.txt`, `IA/.gitignore`.

**Courier app**
- **A** `S/dispatch.ts`: offer / batch types, countdown, summaries, API.
- **M** `S/api.ts`, `S/index.ts`.
- **A** `L/composants/missions/CarteOffre.tsx`: offer with countdown, stops, cash, overflow warning, accept / refuse.
- **A** `L/composants/missions/CarteItineraire.tsx`: ordered route of an accepted batch.
- **M** `L/composants/missions/EcranMissions.tsx`: offers and route above the missions; re-read on real-time events and every 10 s.

**Client app**
- **M** `S/suivi.ts`: `promesseLivraison`, `sourcePromesse`, `messagePromesse()`.
- **M** `C/app/commande/[id].tsx`: "Livraison promise avant HH:MM".

**Back-office**
- **A** `W/pages/Dispatch.tsx`: supervision, offer countdowns, batches, couriers, forced assignment form, manual cycle.
- **M** `W/App.tsx`, `W/composants/Layout.tsx`, `W/api.ts`, `W/types.ts`, `W/styles.css`, `W/pages/Audit.tsx` (`AFFECTATION_FORCEE`).

**Scripts**
- **A** `scripts/dispatch.test.cjs`.

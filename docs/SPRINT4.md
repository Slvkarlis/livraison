# Sprint 4 — AI batch dispatch

Branch `sprint-4` (from `sprint-3` @ `566d75b`), 2026-11-17. Files changed: [`SPRINT4_CHANGES.md`](SPRINT4_CHANGES.md).
Scope: 7 user stories, **45 points**. All 7 are implemented with unit and HTTP tests.

> **Verification status.** The code and tests were written in an environment without access to Maven Central, so
> `mvnw test`, the mobile typecheck and the web build **have not been run yet**. Only the Java syntax of every file was
> checked, and the Python service tests ran (17 tests, 3 skipped without FastAPI). Run the checks below before merging.

## Delivered

| US | Behaviour | Main files |
|---|---|---|
| US-401 | Every status change, the **real vs announced preparation time**, each offer (proposed, accepted, refused, expired, withdrawn) and each assignment are stored in an immutable `evenement_entrepot` table, after the commit and in their own transaction (the warehouse never blocks an order). GPS traces stay in `position_livreur` and are exported with the zones and their neighbours. | `EntrepotService`, `EvenementEntrepot`, `EntrepotController` |
| US-402 | The batch goes to the best available courier by **score** = distance to the first pickup (km) + zone penalty (secondary +1.5, temporary +0.5) + 1 per mission in progress. No candidate in the zone → couriers of an **adjacent zone** (overflow, +4, offer flagged *hors zone*). Still none → the orders wait and are flagged in supervision after **10 min** (max search delay). A courier has one offer at a time and at most 3 missions. | `DispatchService`, `ChoixLivreur` |
| US-403 | Ready orders without a courier are grouped into batches of **2 to 3 pickups**: shops in the same or an adjacent zone, less than **1.5 km** apart, ready within 10 min of each other, and only if the batch is faster than separate deliveries. Python service: Clarke–Wright savings; Java fallback: greedy from the oldest order. A batch is only created once a courier is found, so waiting orders can still be grouped with the next ones. | `RegroupementLots`, `ia/fleetpulse_ia/lots.py` |
| US-404 | Pickups and drops are ordered by **exhaustive search** (≤ 3 orders = at most 720 routes): each pickup before its drop, no parcel on board more than **35 min**, shortest duration then distance. Recomputed from the courier's position when they accept. | `Itineraire`, `ia/fleetpulse_ia/itineraire.py` |
| US-405 | The courier sees the offer with a **countdown (60 s)**, the ordered stops, the total cash and the *hors zone* flag, then accepts or refuses. Refusal or expiry → the batch is offered to the next courier, never again to the same one. The client's address is hidden until pickup. | `OffreLot`, `OffreLivreurController`, app `CarteOffre.tsx`, `CarteItineraire.tsx` |
| US-406 | At the partner's acceptance, a **delivery promise** is frozen: max(predicted prep, 5 min courier approach) + 2 min pickup + trip + 15 % margin (5 min minimum), rounded up to 5 min. Prediction by the AI service (gradient boosting) or, in degraded mode, the announced time × the shop's observed punctuality (last 20 orders, bounded 0.8–1.5). The live ETA follows the remaining route of the courier's batch. | `EstimationLivraisonService`, `ServiceIa`, `ia/fleetpulse_ia/eta.py`, client `commande/[id].tsx` |
| US-407 | Back-office **Dispatch** page (refreshed every 10 s): ready orders without courier (alert past the max delay), offers with their countdown, batches with the offer history, available couriers and their load. The Responsable can **force an assignment** (reason required, audited as `AFFECTATION_FORCEE`) and run a dispatch cycle on demand. | `DispatchController`, web `Dispatch.tsx` |

## Order and batch lifecycle

```
PRETE ──(lot formé + coursier trouvé)──► offre EN_ATTENTE (60 s)
  │                                         ├─ acceptée ──► commandes AFFECTEE, lot ACCEPTE, itinéraire recalculé
  │                                         ├─ refusée / expirée / livreur indisponible ──► offre au livreur suivant
  │                                         └─ commandes annulées ──► offre retirée, lot ANNULE
  └─ responsable : affectation forcée ──► AFFECTEE (lot FORCE), offre en cours retirée
```

- Orders keep their Sprint 3 statuses: the batch only decides **who** gets `AFFECTEE`. Every change goes through `CommandeWorkflow`.
- `app.dispatch.par-lots=false` restores the Sprint 2 bis single assignment (still used by the earlier HTTP tests).

## API contracts

| Route | Role | Purpose |
|---|---|---|
| `GET /api/livreur/offres` | LIVREUR | Pending offers: `expireLe`, `horsZone`, `nbCommandes`, `distanceKm`, `dureeMinutes`, `montantACollecter`, ordered `etapes` |
| `PUT /api/livreur/offres/{id}/accepter` | LIVREUR (offer owner) | Accept; replay-safe; 409 if expired or taken back |
| `PUT /api/livreur/offres/{id}/refuser` `{motif?}` | LIVREUR (offer owner) | Refuse (204), re-offer to the next courier |
| `GET /api/livreur/lots` | LIVREUR | Accepted batches still in progress, with the ordered route |
| `GET /api/admin/dispatch` | OPERATIONS | Supervision (waiting orders, batches, offers, couriers) |
| `PUT /api/admin/dispatch/commandes/{id}/forcer` `{livreurId, motif}` | OPERATIONS | Forced assignment, audited |
| `POST /api/admin/dispatch/cycle` | OPERATIONS | Expire offers and dispatch now |
| `GET /api/admin/entrepot/evenements?depuis&type&limite` | OPERATIONS | Warehouse events |
| `GET /api/admin/entrepot/jeu-eta?depuis` · `/export?depuis` | OPERATIONS | ETA training set · full export for `ia/entrainer.py` |
| `GET /api/commandes/{id}/suivi` | CLIENT | Now also `promesseLivraison` and `sourcePromesse` (`IA` / `REGLES`) |

Real time: an offer is announced to the courier on `/user/queue/commandes` (same queue as missions, status unchanged), and the app also re-reads its offers every 10 s while available.

## AI service (`ia/`)

Python FastAPI service, optional (spec §4.1): `POST /v1/lots`, `POST /v1/eta`, `POST /v1/entrainement`, `GET /sante`.
The backend calls it when `APP_IA_URL` is set, with an 800 ms timeout, and **re-checks every answer** (each order once,
zone/radius rules, time on board). Any error, timeout or inconsistent answer → Java rules (degraded mode).
At first start the ETA model is trained on **simulated** history (spec §4.3), then recalibrated with `python entrainer.py export.json`.
See [`ia/README.md`](../ia/README.md).

## Configuration

| Property (env) | Default | Meaning |
|---|---|---|
| `app.dispatch.par-lots` (`DISPATCH_PAR_LOTS`) | `true` | `false`: Sprint 2 bis single assignment |
| `app.dispatch.delai-offre-secondes` | `60` | Time to answer an offer |
| `app.dispatch.delai-recherche-max-minutes` | `10` | Alert threshold in supervision |
| `app.dispatch.duree-a-bord-max-minutes` | `35` | Max time a parcel stays in the vehicle |
| `app.dispatch.rayon-collecte-km` | `1.5` | Max distance between shops of one batch |
| `app.dispatch.fenetre-regroupement-secondes` | `30` | A freshly ready order waits this long for a neighbour |
| `app.dispatch.planificateur` / `intervalle-ms` | `true` / `15000` | Periodic cycle (expiry, re-offers). Timers are in the database: a restart loses nothing |
| `app.ia.url` (`APP_IA_URL`) · `app.ia.delai-ms` | empty · `800` | AI service |

## Schema

New tables (created by `ddl-auto=update`): `lot`, `offre_lot`, `evenement_entrepot`.
New columns on `livraison`: `lot_id`, `promesse_livraison`, `source_promesse`.

## Tests added

- **Unit (Mockito / pure rules):** `ItineraireTest` (5), `RegroupementLotsTest` (4), `ChoixLivreurTest` (4), `DispatchServiceTest` (12),
  `EstimationLivraisonServiceTest` (6), `EntrepotServiceTest` (5), `ServiceIaTest` (5, real local HTTP server);
  controllers `OffreLivreurControllerTest` (3), `DispatchControllerTest` (3), `EntrepotControllerTest` (2).
- **Updated:** `EspaceLivreurServiceTest`, `CommandePartenaireServiceTest` (promise frozen at acceptance), `SuiviCommandeServiceTest`, `MarketplaceControllerTest`.
- **HTTP (`@SpringBootTest`, H2):** `Sprint4DispatchTest` (5): offer → accept → pickup → handover with promise and warehouse rows;
  refusal and re-offer then supervision; two pickups grouped in one batch; overflow to an adjacent zone; expiry, forced assignment and audit.
- **Node:** `scripts/dispatch.test.cjs` (5). **Python:** `ia/tests` (17; the 3 API tests need FastAPI).

## Verification to run

```powershell
cd backend; .\mvnw.cmd -B -ntp test; cd ..
npm.cmd run typecheck --prefix mobile; npm.cmd run lint --prefix mobile
node --test scripts/*.test.cjs
npm.cmd run build --prefix web-responsable
cd ia; python -m unittest discover -s tests -v
```

Demo: two couriers available in a zone, two orders ready at the same shop → one offer of 2 pickups; refuse it on one phone,
it appears on the other; let it expire (or press *Relancer le dispatch* after 60 s); force an assignment from *Dispatch*.

## Limits

- The ETA model is trained on simulated data until real deliveries accumulate; recalibrate with `ia/entrainer.py`.
- No push notification for offers when the app is closed (real-time queue + polling only, like Sprint 2 bis missions).
- Supervision is polled every 10 s rather than pushed.
- Batching considers ready orders only; joining a batch already accepted by a courier is not done (the courier would not have agreed to it).

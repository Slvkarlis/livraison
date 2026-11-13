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

---

## feat(US-305, US-310): single-use handover QR for the client and 6-digit SMS fallback code

**Backend**
- **A** `B/Service/JetonRemise.java`: QR content `FLEETPULSE-REMISE|<order code>|<nonce>|<expiry>|<HMAC-SHA256>`, valid 2 minutes; `verifier()` refuses a forged, expired, replaced (older nonce) or other order's QR with a readable message.
- **A** `B/Service/SecretRemise.java`: HMAC key (`app.remise.secret`, defaults to the JWT secret, 32 characters minimum).
- **A** `B/Model/CodeRemise.java` + **A** `B/Repository/CodeRemiseRepository.java`: one row per order, BCrypt hash of the 6-digit code, attempts, number of sends, last send. Separate table so failed attempts are counted in their own transaction while the order row is locked.
- **A** `B/Service/CodeRemiseService.java`: `creerEtEnvoyer` (at pickup), `renvoyer` (1 minute apart, 4 sends max, 429 otherwise), `verifier` (`REQUIRES_NEW`, 5 attempts then blocked). The SMS (email if the client has no phone) leaves after commit; a sending failure doesn't cancel the pickup.
- **A** `B/Service/RemiseClientService.java`: `qr()` gives a new QR each time (only the latest is valid); `renvoyerCode()`. Both only while the parcel is on board (409 otherwise), for the owning client (404 otherwise).
- **A** `B/Dto/RemiseDto.java`: `QrRemiseVue`, `CodeRemiseEnvoye` (masked destination, next send time).
- **M** `B/Model/Livraison.java`: `remiseNonce`, `remiseQrExpireLe`.
- **M** `B/Service/EspaceLivreurService.java`: pickup sends the fallback code.
- **M** `B/Controller/MarketplaceController.java`: `GET /api/commandes/{id}/qr-remise`, `POST /api/commandes/{id}/code-remise`.
- **M** `backend/src/main/resources/application.properties`: `app.remise.secret` (env `APP_REMISE_SECRET`).
- **A** `T/Service/JetonRemiseTest.java`: valid QR, expired, other order, replaced, forged expiry, other key, parcel label.
- **A** `T/Sprint3RemiseClientTest.java`: QR only while en route, new QR each time, 2-minute validity, SMS at pickup with the code never stored in clear, resend delay and cap, access rules.

**Client app**
- **A** `C/composants/remise/EcranQrRemise.tsx`: the QR (renewed 20 s before expiry), "Commande livrée" when the handover is validated, and "Recevoir un code par SMS".
- **A** `C/app/commande/remise/[id].tsx`: route. **M** `C/app/_layout.tsx`: screen "Remise du colis".
- **M** `C/app/commande/[id].tsx`: "Afficher mon QR de remise" while the parcel is on board.
- **R** `C/composants/partenaire/etiquette/qrSvg.ts` → `C/composants/qrSvg.ts`: now used by the label and the handover QR. **M** `EcranEtiquette.tsx`: import path.

**Shared mobile**
- **A** `S/remise.ts`: `QrRemise`, `CodeRemiseEnvoye`, `peutValiderRemise`, `delaiRenouvellementQr`, `creerApiRemiseClient`.
- **M** `S/api.ts`, `S/index.ts`: export it.
- **A** `scripts/remise.test.cjs`.

---

## fix(tests): ignore STOMP sessions already closed by the server in teardown

- **M** `T/Sprint2bisTempsReelTest.java`, `T/Sprint3SuiviTest.java`: `@AfterEach` ignores `MessageDeliveryException` when the server closed the session between `isConnected()` and `disconnect()` (seen once in `abonnementHorsDeSesFilesRefuse`, where the refused subscription closes the session).

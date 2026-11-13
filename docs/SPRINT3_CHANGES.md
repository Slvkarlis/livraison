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

---

## feat(US-306): courier confirms the cash amount and validates the handover

**Backend**
- **A** `B/Service/RemiseLivreurService.java`: `valider(email, id, RemiseRequest)` on the locked order:
  - Amount first: required, ≥ 0, 3 decimals max; a gap with the total needs a reason (5 characters minimum). A typing error doesn't use up a code attempt.
  - Then the proof: the client's QR (`JetonRemise`, only the latest one, then cleared so it can't be reused) or the 6-digit SMS code (`CodeRemiseService.verifier`, 5 attempts, failed attempts counted even when the request fails).
  - → `LIVREE` through `CommandeWorkflow`, with `livreeLe`, `montantEncaisse`, `ecartEncaissement`, `motifEcart`, `modeRemise`; COD payment → `ENCAISSE`. The history reason states the mode and any gap.
  - A replay on an order already delivered returns the mission unchanged.
- **A** `B/Model/enums/ModeRemise.java`: `QR`, `CODE`, `MANUELLE` (the last is used by US-311).
- **M** `B/Model/enums/StatutPaiement.java`: `ENCAISSE`.
- **M** `B/Model/Livraison.java`: handover fields.
- **M** `B/Service/CommandeWorkflow.java`: `RECUPEREE → LIVREE`, `A_PROXIMITE → LIVREE`.
- **M** `B/Dto/EspaceLivreurDto.java`: `RemiseRequest`; `MissionVue.livreeLe` / `montantEncaisse`.
- **M** `B/Dto/LivraisonResponse.java`: `livreeLe`, `montantEncaisse`. **M** `B/Dto/CommandePartenaireDto.java`: `livreeLe`.
- **M** `B/Controller/EspaceLivreurController.java`: `POST /api/livreur/missions/{id}/remise`.
- **A** `T/Sprint3RemiseLivreurTest.java`: QR handover with the exact amount (replaced QR refused, replay, QR unusable afterwards, payment collected); gap with reason via the SMS code (attempts counted, gap recorded); code blocked after 5 attempts while the QR still works; access rules (not picked up, other courier, client role, parcel label refused as proof).

**Courier app**
- **A** `L/composants/missions/PanneauRemise.tsx`: step 1, amount received (gap → reason); step 2, scan the client's QR or type the SMS code.
- **M** `L/composants/missions/EcranMission.tsx`: "LIVRAISON" block (client, address, directions, "moins de 300 m"), handover panel while the parcel is on board, "Livrée à HH:MM · X DT encaissés".

**Shared mobile / web**
- **M** `S/espaceLivreur.ts`: `Mission.livreeLe` / `montantEncaisse`, `validerRemise`.
- **M** `S/remise.ts`: `lireMontant`, `ecartEncaissement` (in millimes).
- **M** `S/types.ts`, `S/format.ts`, `S/sprint2bis.ts`, `W/types.ts`, `W/format.ts`: `ENCAISSE` "Réglée au livreur", `livreeLe`.
- **M** `scripts/remise.test.cjs`: amount parsing, gap, courier route.

---

## feat(US-304): client notified at every status change

**Backend**
- **A** `B/Service/NotificationService.java`:
  - Listens to `CommandeStatutChange` after commit, in its own transaction (a notification failure never undoes a status change; a cancelled change never notifies).
  - For each real status change: inbox row, real-time banner on `/user/queue/notifications`, push to the client's phones. Phones the push service reports as uninstalled are forgotten.
  - Inbox (50 latest, unread count), "mark all read".
  - Phone registration: Expo token format checked; a shared phone moves to the last account logged in; removal only by its owner.
- **A** `B/Service/MessagesStatut.java`: client wording per status (Tunis time), same phrasing as the app; none for the order the client just placed.
- **A** `B/Service/PushSender.java` + **A** `B/Service/ExpoPushSender.java`:
  - Expo push API, batches of 100, channel `commandes`, 3 s / 5 s timeouts; reads `DeviceNotRegistered` tickets.
  - Disabled by default (`app.push.expo.actif=false`): logged only.
- **A** `B/Model/Notification.java` (table `notification_utilisateur`), **A** `B/Model/AppareilNotification.java`, **A** both repositories, **A** `B/Dto/NotificationDto.java`.
- **A** `B/Controller/NotificationController.java`: `GET /api/notifications`, `PUT /api/notifications/lues`, `PUT|DELETE /api/notifications/appareil`.
- **M** `backend/src/main/resources/application.properties`: `app.push.expo.actif`, `app.push.expo.jeton-acces` (env `APP_PUSH_EXPO_ACTIF`, `APP_PUSH_EXPO_JETON`).
- **A** `T/Sprint3NotificationTest.java`: one notification per status change in order, push with the order id, read status; token validation, phone changing account, uninstalled phone forgotten, 401 without session.
- **A** `T/Service/ExpoPushSenderTest.java`: ticket parsing, disabled by default.

**Client app**
- **A** `C/composants/notifications/NotificationsClient.tsx`: banner at each real-time notification (6 s, tap → order); registers the phone for push and removes it at logout; a tapped push opens the order.
- **A** `C/composants/notifications/pushNatif.ts`: Android channel, permission, Expo token (only with an EAS `projectId`; otherwise `null` and the banner still works). **A** `pushNatif.web.ts`: web fallback with no push.
- **M** `C/app/_layout.tsx`: mounts it for the active client.
- **M** `mobile/mobile-client/app.json`: plugin `expo-notifications`. **M** `mobile/mobile-client/package.json`, `mobile/package-lock.json`: `expo-notifications ~58.1.9` (`npx expo install`).

**Shared mobile**
- **A** `S/notifications.ts`: types, `lireNotification`, `commandeDuPush`, `DUREE_BANDEAU_MS`, `creerApiNotifications`.
- **M** `S/tempsReel.tsx`: third subscription `/user/queue/notifications`, `useNotificationsTempsReel`.
- **M** `S/auth.tsx`: `surDeconnexion(fn)`, run (3 s max) while the session is still valid.
- **M** `S/api.ts`, `S/index.ts`. **A** `scripts/notifications.test.cjs`. **M** `scripts/tempsReel.test.cjs`: stub.

---

## feat(US-311): Responsable cancels an order or validates a pickup or handover manually

**Backend**
- **A** `B/Service/GestionCommandeService.java` (role `OPERATIONS`). Every action needs a 5–300 character reason, goes through `CommandeWorkflow` (history + notifications) and is audited:
  - `annuler`: any unfinished order; records the reason, who cancelled, and invalidates the handover QR.
  - `validerCollecte`: `AFFECTEE → RECUPEREE` without a scan; the client still gets the SMS code.
  - `validerRemise`: `RECUPEREE / A_PROXIMITE → LIVREE`, mode `MANUELLE`, same amount and gap checks as the courier.
  - `suivi`: actions allowed at the current status + full history.
- **A** `B/Controller/GestionCommandeController.java`: `GET /api/admin/commandes/{id}/suivi`, `PUT …/annuler`, `PUT …/collecte`, `PUT …/remise`.
- **A** `B/Dto/GestionCommandeDto.java`: `MotifRequest`, `RemiseManuelleRequest`, `SuiviResponsable`, `ActionResponsable`.
- **M** `B/Service/CommandeWorkflow.java`: `ANNULEE` reachable up to the handover (the client stays limited by `CommandeService.ANNULABLES`); the event carries the actor's role.
- **M** `B/Service/CommandeStatutChange.java`: `acteurRole`.
- **M** `B/Service/NotificationService.java`: no notification to the client for their own actions. **M** `B/Service/MessagesStatut.java`: cancellation by customer service, with the reason.
- **M** `B/Service/RemiseLivreurService.java`: amount check and handover recording shared with `validerManuellement`.
- **M** `B/Model/enums/ActionAudit.java`: `COMMANDE_ANNULEE`, `COLLECTE_VALIDEE_MANUELLEMENT`, `REMISE_VALIDEE_MANUELLEMENT`.
- **M** `B/Model/Livraison.java`: `annuleeParService`. **M** `B/Dto/LivraisonResponse.java`: `annuleeParService`.
- **A** `T/Sprint3GestionCommandeTest.java`: cancellation with the parcel on board (reason required, history, audit, client notified with the reason, QR and handover refused afterwards, mission removed); manual pickup then manual handover with a gap; client not notified of their own cancellation; access rules.
- **M** `T/Service/CommandeWorkflowTest.java`: new transitions and event.

**Web back-office**
- **A** `W/composants/InterventionsCommande.tsx`: order timeline (status, date, role, reason), handover details (mode, amount, gap), allowed action buttons and reason form (amount + gap reason for the handover). Hidden for sub-roles without access (403).
- **M** `W/pages/Commandes.tsx`: in the order detail, list refreshed after an action. **M** `W/api.ts`, `W/types.ts`, `W/styles.css` (`.chronologie`). **M** `W/pages/Audit.tsx`: new actions in the filter.

**Shared mobile**
- **M** `S/types.ts`: `Livraison.annuleeParService`. **M** `S/sprint2bis.ts`: "Commande annulée par notre service client : <reason>". **M** `scripts/suivi.test.cjs`.

---

## docs(sprint-3): sprint report and tracking update

- **A** `docs/SPRINT3.md`: delivered stories, order lifecycle, API contracts, rules, schema, verification (106 backend / 67 Node tests; live demo and device pass still to do), demo scenario, limits and follow-ups.
- **M** `docs/SPRINT_TRACKING.md`: Sprint 3 rows filled in, overview and totals (~163 pts done), current verification, schedule check, change log.
- **M** `README.md`: link to the Sprint 3 report, new environment variables, Node test command for all scripts.
- **M** `docs/SPRINT3_CHANGES.md`: this entry.

# Sprint 3 — Real-time tracking and Last Mile

Branch `sprint-3` (from `sprint-2bis`), 2026-11-13. One commit per step; the files changed by each commit are listed in [`SPRINT3_CHANGES.md`](SPRINT3_CHANGES.md).
Scope: 8 user stories, **42 points**. All 8 are implemented and covered by automated tests. The browser demo on MySQL and the phone pass are **still to do** (see Verification).

## Delivered

| US | Behaviour | Main files |
|---|---|---|
| US-301 | While it has a mission, the courier app sends its GPS position (every 10 s or 25 m), plus a "GPS" card on the Missions tab. Implausible points are rejected: accuracy worse than 150 m, or a jump faster than 150 km/h. The track is stored only during missions. In demo mode a "Simuler le trajet" button replays the shop → client route, because the browser is far from the demo zones. | `SuiviPositionService`, `PositionLivreur`, `Distances`, `SuiviPosition.tsx`, `CarteSuiviGps.tsx`, `suivi.ts` |
| US-302 | The client follows the courier on the order map (🛵 marker) once the parcel is on board, through the STOMP queue `/user/queue/positions`. Within **300 m** the order moves to `A_PROXIMITE` ("Le livreur arrive"), once. | `SuiviCommandeService`, `DiffusionTempsReel`, `useSuiviLivraison.ts`, `CarteLeaflet*`, `commande/[id].tsx` |
| US-303 | Rule-based ETA: remaining preparation time, then courier → shop, 2 min at the shop, then shop → client. Once picked up, courier → client. Distance is haversine × 1.3, at the zone's **average speed** (set in the back-office, 20 km/h by default). Shown as "Arrivée estimée vers 14:12 · dans 12 min". | `EstimationArrivee`, `Zone.vitesseMoyenneKmh`, web `Zones.tsx` |
| US-304 | At every status change the client gets an inbox entry, a live banner in the app (tap → order), and an Expo push on their phones. The client is not notified of their own actions. | `NotificationService`, `MessagesStatut`, `ExpoPushSender`, `NotificationsClient.tsx`, `pushNatif.ts` / `.web.ts` |
| US-305 | Once the parcel is on board, the client shows a **dynamic QR** (HMAC-signed, valid 2 min, renewed automatically). Each display replaces the previous QR, and the handover consumes it: single use. | `JetonRemise`, `RemiseClientService`, `EcranQrRemise.tsx` |
| US-306 | At the client's door, the courier first confirms the **amount actually received**; any gap needs a reason. Then they scan the client's QR or type the SMS code. The order moves to `LIVREE` and the payment to `ENCAISSE`, with mode, amount and gap recorded. | `RemiseLivreurService`, `PanneauRemise.tsx`, `EcranMission.tsx` |
| US-310 | A 6-digit code is sent to the client by SMS (email if no phone) at pickup. The client can ask for a new one: 1 minute apart, 4 sends in all. It is stored as a BCrypt hash and allows 5 attempts. | `CodeRemiseService`, `CodeRemise` |
| US-311 | The Responsable (OPERATIONS) can cancel any unfinished order, validate a pickup without a scan, or validate a handover without client proof (with the amount). A reason is required each time. The action shows in the history (role + reason) and the audit log, and the client sees "annulée par notre service client : <motif>". | `GestionCommandeService`, `GestionCommandeController`, web `InterventionsCommande.tsx` |

The courier mission screen now shows the client's **delivery address** once the parcel is on board (with directions), then "Livrée à HH:MM · X DT encaissés".

## Order lifecycle

```
… AFFECTEE ─scan / responsable─► RECUPEREE ─< 300 m─► A_PROXIMITE
                                     │                    │
                                     └──── remise (QR · code SMS · responsable) ───► LIVREE
Responsable: ANNULEE from any status before LIVREE (client: only PENDING_PARTNER / ACCEPTEE, unchanged)
```

- Every change still goes through `CommandeWorkflow.transition`. The event now carries the actor's role (`acteurRole`).
- `EN_COURS`, `ARRIVEE`, `ECHEC` and `RETOURNEE` remain unused. Delivery failures belong to Sprint 7.

## API contracts

| Route | Role | Purpose |
|---|---|---|
| `PUT /api/livreur/position` `{latitude, longitude, precision?}` | LIVREUR | Position; returns `{acceptee, raison, date, enMission}` |
| `GET /api/commandes/{id}/suivi` | CLIENT (owner) | Status, courier position (parcel on board only), shop, destination, `arriveeEstimee` |
| `GET /api/commandes/{id}/qr-remise` | CLIENT (owner) | `{contenuQr, expireLe}`; parcel on board only (409 otherwise) |
| `POST /api/commandes/{id}/code-remise` | CLIENT (owner) | New SMS code; `{destination (masked), prochainEnvoiPossibleLe}`; 429 if too soon or too many |
| `POST /api/livreur/missions/{id}/remise` `{montantEncaisse, motifEcart?, preuve}` | LIVREUR (assigned) | `preuve` = QR content or 6-digit code; replay-safe |
| `GET /api/notifications` · `PUT /api/notifications/lues` | any | Inbox (50 latest + unread count) |
| `PUT` / `DELETE /api/notifications/appareil` `{jeton}` | any | Register / remove the phone's Expo token |
| `GET /api/admin/commandes/{id}/suivi` | OPERATIONS | History + allowed actions + handover details |
| `PUT /api/admin/commandes/{id}/annuler` · `/collecte` `{motif}` | OPERATIONS | Cancel / validate pickup |
| `PUT /api/admin/commandes/{id}/remise` `{motif, montantEncaisse, motifEcart?}` | OPERATIONS | Validate handover |

Real-time queues (STOMP, `/user/queue/…`): `commandes` (Sprint 2 bis), **`positions`**, **`notifications`**.

## Rules worth knowing

- **Privacy.** The courier sees the client's address only after pickup. The client sees the courier's position only while their parcel is on board. GPS points outside missions are not stored.
- **Handover QR.** `FLEETPULSE-REMISE|<code>|<nonce>|<expiry>|<HMAC-SHA256>`. The key is `APP_REMISE_SECRET`, which defaults to the JWT secret. The server refuses a QR that is forged, expired, for another order, or no longer the latest. A screenshot shared earlier is useless.
- **Amount first, proof second.** A mistyped amount doesn't burn a code attempt. A failed code attempt is counted in its own transaction, so it sticks even when the request fails.
- **Gaps.** The gap is recorded as received − total (e.g. −0.500), with its reason, and shown in the back-office. It doesn't block the handover.
- **Notifications** are written after the commit, in their own transaction: a notification failure never undoes a status change.
- **Push** is off by default (`APP_PUSH_EXPO_ACTIF=false`): the server only logs it, and the in-app banner and inbox still work. To turn it on: build the client app with EAS (a `projectId` is needed for the token), then set `APP_PUSH_EXPO_ACTIF=true` (and `APP_PUSH_EXPO_JETON` if Expo's enhanced push security is enabled).

## Schema

- New tables:
  - `position_livreur`: GPS track during missions.
  - `code_remise`: fallback code hash, attempts, sends.
  - `notification_utilisateur`: inbox.
  - `appareil_notification`: Expo tokens.
- New nullable columns:
  - `livraison`: `remise_nonce`, `remise_qr_expire_le`, `livree_le`, `montant_encaisse`, `ecart_encaissement`, `motif_ecart`, `mode_remise`, `annulee_par_service`.
  - `zone`: `vitesse_moyenne_kmh`.
  - `livreur`: `derniere_position_le`.
- New enum values, all stored in `varchar` columns so MySQL accepts them without a change:
  - `StatutPaiement.ENCAISSE`.
  - `ActionAudit.COMMANDE_ANNULEE`, `COLLECTE_VALIDEE_MANUELLEMENT`, `REMISE_VALIDEE_MANUELLEMENT`.
  - `ModeRemise` (`QR`, `CODE`, `MANUELLE`).

As in Sprint 2 bis, development uses `ddl-auto=update` and **no migration script was written** for these changes.

## Verification (2026-11-13)

| Check | Result |
|---|---|
| Backend `./mvnw test` (H2) | **106 / 106** (Sprint 2 bis: 77). Sprint 3 adds 29 tests:<br>• HTTP: `Sprint3PositionTest` (4), `Sprint3SuiviTest` (4, including a real STOMP client), `Sprint3RemiseClientTest` (2), `Sprint3RemiseLivreurTest` (4), `Sprint3NotificationTest` (2), `Sprint3GestionCommandeTest` (3).<br>• Unit: `EstimationArriveeTest` (4), `JetonRemiseTest` (2), `ExpoPushSenderTest` (2), `DistancesTest` (2).<br>• `CommandeWorkflowTest` updated. |
| Node tests `node --test scripts/*.test.cjs` | **67 / 67** (was 49): `suivi` (9), `remise` (6), `notifications` (3) |
| Mobile typecheck + ESLint | Pass, no warnings |
| Web back-office build | Pass |
| Browser demo on MySQL | **Not done.** Docker (MySQL 8.4) was not running in this session, so no step was demoed live. To do before merging, following the scenario below. |
| Phone (development build) | **Not done.** To check: background GPS behaviour, camera scan of the client QR, Expo push (needs an EAS development build: remote push is not available in Expo Go since SDK 53). |

The HTTP tests cover, among others:
- GPS jumps and poor accuracy rejected;
- the courier hidden from the client before pickup;
- proximity triggered only once;
- an ETA that uses the actual ready time;
- QR refused when replaced, expired, forged, for another order, or the parcel label;
- the SMS code never stored in clear, plus the resend delay and cap;
- code blocked after 5 attempts while the QR still works;
- handover replay;
- the client not notified of their own cancellation;
- Responsable actions only for OPERATIONS, each with history and audit.

`expo-doctor` reports three problems that **exist on `sprint-2bis` too** (checked with Sprint 3 changes stashed):
- `expo` 58.0.22 instead of ~58.0.25;
- `react-native-safe-area-context` 5.10 instead of ~5.11;
- a duplicate `react-dom`.

Run `npx expo install --fix` in a separate commit.

## Demo

Same setup as Sprint 2 bis (MySQL 8 on port 3307, `SPRING_PROFILES_ACTIVE=demo`, `APP_DEMO_ENABLED=true`, `SPRINT2_DONNEES_DEMO=true`). Start the client on 8081, the courier on 8082 and the back-office on 5173. In demo mode, SMS codes appear in the backend log.

1. **Up to pickup**: run steps 1–6 of the Sprint 2 bis demo. The client gets a banner at each stage, and the SMS code appears in the log at pickup.
2. **Live tracking**: on the courier's Missions tab, the "Suivi GPS" card offers **Simuler le trajet vers <prénom>**, which moves the courier from the shop toward the client. The client's order screen shows the 🛵 marker and "Arrivée estimée vers …", then "Le livreur arrive" within 300 m.
3. **Handover**: the client taps **Afficher mon QR de remise**. The courier enters 15,000 (or less, with a reason) and scans the QR, or types the logged code. Both sides see "Livrée".
4. **Responsable**: in **Commandes**, open an order. The timeline shows each step. Try **Annuler la commande** with a reason, then check **Journal d'audit**.
5. **Zones**: change a zone's "Vitesse moyenne" and watch the ETA change.

## What users can do after Sprint 3

| Who | Can do (in addition to Sprint 2 bis) |
|---|---|
| **Client** | See the courier on the map with an arrival time. Get a banner (and a push, once built with EAS) at every stage. Show a QR to receive the parcel, or ask for an SMS code. |
| **Courier** | Send their position automatically during missions. See the delivery address and directions after pickup. Record the amount received (with a reason for any gap) and validate the handover by QR or code. |
| **Partner** | See the delivery (`LIVREE`, with its time) in the order history. |
| **Responsable** | Set each zone's average speed. Open an order's full timeline. Cancel any unfinished order, or validate a pickup or handover manually; each action needs a reason and is audited. |

## Limits and follow-ups

- **Not demoed live and no device pass** (see Verification). These are the first things to do on this branch.
- **Push**:
  - It needs an EAS project (`projectId`) and a development build. Without them the app registers nothing and relies on the banner and inbox.
  - Push receipts (delivery confirmation about 15 min later) are not checked; only `DeviceNotRegistered` tickets are acted on.
  - Only the client is notified; partner and courier keep the Sprint 2 bis live events.
- **Inbox screen.** The API exists (`GET /api/notifications`), but the client app only shows the banner. A notifications list screen is a small follow-up.
- **Background GPS.** Positions are sent while the courier app is open (foreground). Tracking with the screen locked needs `expo-location` background mode and a development build.
- **ETA**: straight-line distance × 1.3 at a fixed zone speed, with no traffic data. Sprint 4 (dispatch) can replace it.
- **Notification wording** is duplicated between `MessagesStatut.java` and `messageDecisionClient` (TypeScript); keep them in sync.
- **Security pass**: the 6-digit code is rate-limited per code (5 attempts, 4 sends). There is no global per-courier limit. Add one with the pickup code limit carried over from Sprint 2 bis.
- **Migration**: no MySQL script for the new tables and columns (see Schema).

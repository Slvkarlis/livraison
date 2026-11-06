# Sprint 2 bis — Partner interface and First Mile

Branch `sprint-2bis` (from `corrections`), 2026-11-04 → 2026-11-06. One commit per validated step; the files changed by each commit are listed in [`SPRINT2BIS_CHANGES.md`](SPRINT2BIS_CHANGES.md).
Scope: 9 user stories, **40 points** (US-2B3, the 2-minute expiry, was descoped on 2026-11-03).

## Delivered

| US | Behaviour | Main files |
|---|---|---|
| US-2B1 | The partner has its own tabs (**Commandes · Catalogue · Profil**) in `mobile-client`. Orders are grouped as Nouvelles / En cours / Prêtes / Terminées, each with a detail screen and status history. New orders and status changes arrive **live over WebSocket**, with a banner and a sound while the app is open. | `CommandePartenaireService`, `CommandeWorkflow`, `DiffusionTempsReel`, `AuthentificationStomp`, `partenaire/*`, `AlerteNouvelleCommande.tsx`, `tempsReel.tsx` |
| US-2B2 | The partner accepts with a preparation time (5 / 10 / 15 / 20 / 30 min or custom, 1–180), or refuses with a reason: out of stock, closing, too many orders, or other (a comment is required for "other"). The client sees the decision. | `CommandePartenaireService.accepter/refuser`, `DecisionCommande` |
| US-2B4 | The partner starts preparation and can adjust the announced time **at most twice**. The client sees the new ready time. | `commencerPreparation`, `ajusterPreparation`, `SuiviPreparation` |
| US-2B5 | The partner marks the order ready. That generates the parcel code and triggers courier assignment. | `marquerPrete` |
| US-2B8 | The courier goes available or unavailable. The GPS position must be inside a zone that is currently authorised for them. Ready orders are assigned automatically (simple rule below), and the courier sees their pickup missions. | `EspaceLivreurService`, `AffectationMissionService`, `mobile-livreur` `missions/*`, `position.ts` |
| US-2B9 | At the shop, the courier **scans the parcel QR** (camera) or types the 6-character code. The order moves to `RECUPEREE`, and the partner and client see it live. | `CodeCollecte`, `EspaceLivreurService.confirmerCollecte`, `PanneauCollecte.tsx`, `ScannerQr.tsx` |
| US-2B10 | The partner opens the parcel label: QR, order code, pickup code, client first name, item count and zone. It can print or share it (PDF through `expo-print`, browser print dialog on web). | `EtiquetteColis`, `partenaire/etiquette/*` |
| US-2B11 | The Responsable gives each courier **one main zone**, secondary zones and dated temporary reinforcements, in the web back-office. The action is audited. | `AffectationZoneService`, `AffectationZoneController`, `web-responsable` `ZonesLivreur.tsx` |
| US-2B12 | The client cancels at no cost while the order is `PENDING_PARTNER` or `ACCEPTEE`, with an optional reason. The partner sees "Annulée par le client". | `CommandeService.annuler`, `AnnulationCommande.tsx` |

The client app now shows a **timeline** of its order (`FriseHistorique.tsx`) and a sentence for each stage: accepted, in preparation, ready, courier assigned, picked up, refused, cancelled.

Housekeeping done in the same sprint (step 0):
- Stripe and the old card/depot/slot order flow were removed (`ASSESSMENT.md` §4.3 group A, plus the CARTE UI branches in the mobile app).
- The client and courier apps run in the browser (Expo web), which is how each step was demoed.
- The address map got a web version (`CarteLeaflet.web.tsx`).

## Order lifecycle

```
PENDING_PARTNER ─accepter─► ACCEPTEE ─début─► EN_PREPARATION ─prête─► PRETE ─affectation─► AFFECTEE ─scan─► RECUPEREE
      │                        │  └──────────── prête ─────────────────►┘
      ├─refuser─► REFUSEE      └─annulation client─► ANNULEE
      └─annulation client─► ANNULEE
```

- Status codes keep the existing French style. The new values are `ACCEPTEE`, `REFUSEE`, `PRETE`, `RECUPEREE` and `ANNULEE`. `EN_COURS` and the later statuses stay reserved for Sprint 3.
- **Every status change goes through `CommandeWorkflow.transition`.** It checks the allowed-transition table and writes an immutable `HistoriqueStatut` row (who, role, from → to, reason, time). After the database commit, it publishes an event that is pushed to the partner, the client and the courier.
- History conventions: `ancien = null` means the order was created, and `ancien = nouveau` means "Délai ajusté" (a preparation time change).

## API contracts

Paths are under `/api`, JSON, with a Bearer token. Errors keep the existing `{code, message}` format: 400 invalid input, 403 wrong role, 404 not yours or not found, 409 `ETAT_INVALIDE` (state no longer allows the action).

| Method / path | Body | Response / rule |
|---|---|---|
| `GET /partenaire/commandes` | — | 200 the shop's orders, newest first ; PARTENAIRE |
| `GET /partenaire/commandes/{id}` | — | 200 detail (lines, notes, amounts, preparation, courier first name, history) ; owner shop only |
| `PUT /partenaire/commandes/{id}/accepter` | `{tempsPreparationMinutes}` | 200 ; only from `PENDING_PARTNER` |
| `PUT /partenaire/commandes/{id}/refuser` | `{motif, commentaire?}` | 200 ; only from `PENDING_PARTNER` |
| `PUT /partenaire/commandes/{id}/preparation/debut` | — | 200 ; `ACCEPTEE` → `EN_PREPARATION` |
| `PUT /partenaire/commandes/{id}/preparation/temps` | `{tempsPreparationMinutes}` | 200 ; at most 2 adjustments, then 409 |
| `PUT /partenaire/commandes/{id}/prete` | — | 200 ; from `ACCEPTEE` or `EN_PREPARATION`, generates the pickup code, tries to assign a courier |
| `GET /partenaire/commandes/{id}/etiquette` | — | 200 `{codeSuivi, codeCollecte, contenuQr, …}` ; only while `PRETE` or `AFFECTEE` |
| `PUT /commandes/{id}/annuler` | `{motif?}` | 200 ; client owner, `PENDING_PARTNER` or `ACCEPTEE` |
| `GET /commandes/{id}/historique` | — | 200 status history ; client owner |
| `GET/POST /admin/livreurs/{livreurId}/zones` | `{zoneId, type, debut?, fin?}` | 200 list / 201 ; ADMIN, OPERATIONS |
| `DELETE /admin/livreurs/{livreurId}/zones/{affectationId}` | — | 204 ; same roles |
| `GET /livreur/disponibilite` | — | 200 `{disponible, miseAJourLe, zones[{nom, type, enVigueur}]}` ; LIVREUR |
| `PUT /livreur/disponibilite` | `{disponible, latitude?, longitude?}` | 200 ; going available needs a position inside a zone currently in force, otherwise 409 with the zone names |
| `GET /livreur/missions` · `GET /livreur/missions/{id}` | — | 200 current missions (`AFFECTEE`, `RECUPEREE`) ; assigned courier only |
| `POST /livreur/missions/{id}/collecte` | `{code}` (QR content or typed code) | 200 mission ; `AFFECTEE` → `RECUPEREE` ; repeated call returns the same result |

**WebSocket.** STOMP endpoint `/ws`. The JWT is checked on `CONNECT`, clients may subscribe only to `/user/queue/...`, and sending messages is refused. Each status change sends `{commandeId, ancien, nouveau}` to `/user/queue/commandes` for the shop, the client and the assigned courier. The apps reload the order when they receive it, so the message itself carries no personal data.

## Rules worth knowing

- **Simple courier assignment (US-2B8).** Placeholder until the Sprint 4 AI dispatch.
  - When an order becomes `PRETE`, the system picks an available courier authorised on the shop's zone: main zone first, then secondary, then a reinforcement in force. Ties go to the courier with the fewest missions in progress.
  - A courier carries at most **3 missions** (`AFFECTEE` + `RECUPEREE`).
  - When nobody is free, the order waits as `PRETE` and is assigned as soon as a courier of that zone becomes available.
  - The order row is locked (pessimistic lock), so two couriers can't receive the same order.
- **Zones (US-2B11).**
  - One main zone per courier, and no duplicate zone for the same courier.
  - A temporary reinforcement needs a start and an end, the end after the start and in the future.
  - A zone can't be deleted while couriers are assigned to it.
- **Pickup code (US-2B10 / US-2B9).**
  - 6 characters drawn with `SecureRandom` from an alphabet without look-alikes (no 0/O, 1/I/L).
  - The QR contains `FLEETPULSE|<order code>|<pickup code>`. A QR from another order is refused with "Ce colis appartient à une autre commande".
  - The code is compared in constant time.
  - It is accepted only from the assigned courier, only while the order is `AFFECTEE`. After pickup, the label is no longer available.
  - The code is stored **in clear** because the partner has to be able to reprint the label.
- **Cancellation (US-2B12).** It locks the client and then the order, the same order as order creation, so it can't race with the partner's decision. A cancelled order no longer counts toward the 3-active-orders limit.
- **Timestamps** are truncated to microseconds so they match what MySQL stores.

## Schema

- New tables: `historique_statut` and `affectation_zone`.
- New nullable columns on `livraison`: preparation (`temps_preparation_minutes`, `acceptee_le`, `prete_prevue_le`, `nb_ajustements_preparation`, `preparation_debut_le`, `prete_le`), refusal (`motif_refus`, `commentaire_refus`), cancellation (`annulee_le`, `motif_annulation`), courier (`livreur_id`, `affectee_le`), pickup (`code_collecte`, `recuperee_le`).
- New columns on `livreur`: `disponible`, last position, `disponibilite_mise_a_jour_le`.

Development still uses `ddl-auto=update`, and **no migration script was written for these changes**. Write one before any controlled deployment, like `backend/migrations/sprint2-mysql.sql` for Sprint 2. Orders from before this sprint keep working: they have no history before their first new transition, no pickup code, and stay readable.

## Verification (2026-11-06)

| Check | Result |
|---|---|
| Backend `./mvnw test` | **77 / 77**. Sprint 2 bis adds `CommandeWorkflowTest` (4), `CodeCollecteTest` (4), `Sprint2bisParcoursTest` (12 HTTP scenarios), `Sprint2bisTempsReelTest` (3, real STOMP client), `Sprint2bisZonesLivreurTest` (3), `Sprint2bisMissionsTest` (8), `CorsConfigureTest` / `CorsNonConfigureTest` (3). Stripe/tariff tests were removed with that code. |
| Node tests `node --test scripts/*.test.cjs` | **49 / 49**. Sprint 2 bis: `sprint2bis` (10), `tempsReel` (2), `etiquette` (2), `espaceLivreur` (3) |
| Mobile typecheck + ESLint (`npm run typecheck` / `npm run lint` in `mobile/`) | Pass, no warnings |
| Web back-office build (`npm run build --prefix web-responsable`) | Pass |
| Browser demo, step by step | Each step demoed in the browser preview on MySQL 8.4 and validated before its commit. Covered: client app, partner screens, courier app on `:8082`, back-office on `:5173`, two tabs for the live updates. |
| Phone (Expo Go) | **Not done for this sprint.** To do: sound alert, camera QR scan, GPS availability and label printing on a real phone. `expo-camera`, `expo-location`, `expo-audio` and `expo-print` are all included in Expo Go. |

The HTTP tests cover, among others:
- one shop can't see or act on another's orders;
- forbidden transitions return 409;
- the third preparation adjustment is refused;
- cancellation after preparation has started is refused;
- going available outside one's zones is refused;
- main > secondary > temporary priority, the 3-mission cap, and waiting orders assigned when a courier becomes available;
- pickup with a wrong code, another order's QR, another courier, or a repeated call.

## Demo

Backend on MySQL 8 (Docker, port 3307, see `README.md`) with `SPRING_PROFILES_ACTIVE=demo`, `APP_DEMO_ENABLED=true`, `SPRINT2_DONNEES_DEMO=true`. Then, from the repository root:

```powershell
npm.cmd run web --prefix mobile/mobile-client -- --port 8081    # client + partner
npm.cmd run web --prefix mobile/mobile-livreur -- --port 8082   # courier
npm.cmd run dev --prefix web-responsable                        # back-office, port 5173
```

On a phone, use `npm run client` / `npm run livreur` in `mobile/` with Expo Go instead.

1. **Courier setup (once).** The demo data has no courier.
   1. Apply in the courier app.
   2. Validate the application in the back-office (**Dossiers**).
   3. Give the courier **Tunis centre démo** as main zone (**Livreurs → Zones**).
   4. In the courier app, go available using the "Tunis centre" demo position.
2. **Client places the order.** `client@sprint2.demo` orders from Chez Amira.
3. **Partner prepares it.** `restaurant@sprint2.demo` hears the alert and accepts with 10 min. Then it starts preparation, adjusts the time, and marks the order ready.
4. **Courier is assigned.** The order is assigned at once. The partner sees "Livreur assigné", and the client sees "<prénom> va récupérer votre commande".
5. **Partner prints the label.** It opens **Étiquette du colis** and prints it.
6. **Courier picks up.** The courier opens the mission, then scans the QR or types the code. Partner and client see "Récupérée" live.

The demo accounts use the Sprint 2 password `sprint2-demo-password`.

## What users can do after Sprint 2 bis

| Who | Can do (in addition to Sprint 2) |
|---|---|
| **Client** | Follow each order live with a timeline (accepted, preparing with ready time, ready, courier assigned, picked up). Cancel for free before preparation starts. |
| **Partner** | Receive new orders live with sound. Accept with a preparation time or refuse with a reason. Start preparation, adjust the time twice, and mark the order ready. Print or share the parcel label. See who picks up and when. |
| **Courier** | Go available or unavailable inside authorised zones. Receive pickup missions automatically, see the shop address with directions, the item count and the cash to collect. Confirm pickup by scanning the label. |
| **Responsable** | Assign main, secondary and temporary zones to couriers. See those actions in the audit log. |

**Still not possible** (Sprint 3+): taking the order to the client (`EN_COURS` → `LIVREE`), live courier tracking, ETA, background push notifications, and Responsable cancellation or override.

## Limits and follow-ups

- **Background push.** Alerts and sound only work while the app is open. Push notifications need Expo push and come with US-304 (Sprint 3).
- **Pickup code.**
  - Wrong attempts are not rate-limited. 31⁶ ≈ 887 million combinations, and only the assigned courier may try, so the risk is low. Belongs in the security pass.
  - The code is not signed. It is a random secret checked by the server, which the spec's "signed token" intent allows.
- **Older orders.** Orders made ready before US-2B10 have no pickup code and can't be picked up. This only affects development data.
- **Migration.** There is no MySQL migration script for the new tables and columns yet (see Schema).
- **Leftover fields.** Group C of `ASSESSMENT.md` §4.3 (`creneau*`, `typeLivraison`, `distanceKm`, `stripePaymentIntentId`, …) is still in the entity. The web back-office order detail still shows Type / Créneau / Distance.
- **Sessions on web.** Tokens are kept in memory, so reloading the page logs you out. Phones are not affected.
- **Device pass** still to do (see Verification).

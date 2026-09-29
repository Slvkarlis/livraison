# FleetPulse — Roadmap

> **How to use this file:** start a new session with
> *"Read ROADMAP.md and continue with the next unchecked phase."*
> Work one phase at a time, check the boxes when done, and keep the "Current state" section up to date.

---

## 0. Current state (end of session 2026-09-29)

**Session 2026-09-29 (2) — user feedback on the client app:**
- 500 on order creation = `nettoyage_sprint1.sql` never run: stale NOT NULL columns dropped from the (empty) `livraison` and `livreur` tables. Old tables (`offre_livraison`, `zone`, ...) left untouched.
- Price is now **computed by the backend**, never typed by the client: `TarificationService` (depot → address distance × road factor, livreur pay + fuel, × (1 + 30 % margin), min 3 DT), config `app.tarification.*` / `app.depot.*`, `POST /api/livraisons/devis`, unit tests.
- `TypeLivraison`: `IMMEDIATE` (+50 %, livreur within 60 min) or `PLANIFIEE` (slot, livreur guaranteed, normal fee).
- JSON errors `{code, message}` via `GestionErreurs` (`@RestControllerAdvice`).
- Client app: full-screen address picker (fixes the black map: no rounded/clipped MapView inside a ScrollView), "Maintenant / Planifier" choice, price breakdown, "Avant de commander" checklist + confirmation sheet.
- Distinct identities: client = light lavender/violet, rounded; livreur = dark UI, green accent, plate-style vehicle card. Shared UI now takes a full `Theme`.
- e2e 26/26, pricing tests 5/5. **Still not tried in Expo Go on a phone by me** (no emulator installed).

**Session 2026-09-29 — mobile apps (sprint 1 scope):**
- Git repo initialised (`main`). npm workspaces at the root: `mobile-client/`, `mobile-livreur/`, `packages/shared/` (Expo SDK 57, Expo Router, TypeScript). See `README.md` for how to run.
- Backend **not moved** to `backend/` yet: VS Code's Java language server locks `src/`. Do it with the editor closed (`git mv src pom.xml mvnw mvnw.cmd .mvn backend/`).
- Backend additions: `GET /api/me` (profile + role + livreur's vehicle), `GET /api/livraisons/mes` (client's orders), 401 (not 403) when the JWT is missing/invalid.
- Client app: login, signup, orders list with status chips, new order (map pin / "Utiliser ma position" + reverse geocoding, 2 h slots, COD, amount), order detail with map.
- Livreur app: login (LIVREUR accounts only), home with assigned vehicle + profile, pull to refresh.
- Checks: typecheck + ESLint + `expo export` (Android bundle) + expo-doctor pass for both apps; `scripts/e2e_mobile_api.py` 20/20 against a scratch DB (`livraison_e2e`, can be dropped). **Not yet tried on a real phone with Expo Go.**

**End of session 2026-09-28:**


- Backend = **sprint 1 only** (US-01 … US-07), Spring Boot 4.1 / Java 17 / MySQL, JWT auth, port `8083`.
  - Roles: `CLIENT`, `LIVREUR`, `RESPONSABLE`. Public signup creates clients only; admin seeded at startup (`admin@fleetpulse.tn` / `admin12345`).
  - Entities: `Utilisateur` (→ `Client`, `Livreur`, `Responsable`), `Vehicule`, `Livraison`.
- **Pending on the user's side:** run `nettoyage_sprint1.sql` on the real `livraison` database (old NOT NULL columns break inserts).
- **Reusable code backed up** in `C:\Users\user\Downloads\livraison_backup_avant_sprint1\`:
  Glovo-style pricing (`TarificationService` + unit tests), driver offers (`DispatchService`, `OffreLivraison`, accept/refuse/expire),
  GPS positions (`PositionGps`), SSE notifications. Reuse instead of rewriting.
- ~~Not a git repo yet~~ → done 2026-09-29.
- Stripe: **later**, not in this roadmap's scope (keep `ModePaiement` extensible: `COD`, later `CARTE`).

---

## 1. Target architecture

```
livraison/                     (monorepo)
├── backend/                   Spring Boot (move current src/ + pom.xml here)
├── web-responsable/           React + Vite + TypeScript  (responsable web app)
├── mobile-livreur/            React Native (Expo) + TypeScript
├── mobile-client/             React Native (Expo) + TypeScript
└── packages/shared/           shared TS: API types, API client, status labels/colors, map helpers
```

| Concern | Choice | Why |
|---|---|---|
| Mobile | **Expo** (React Native) | fast setup, Expo Go for demos, easy push notifications |
| Web | React + Vite | same language/components logic as mobile |
| Realtime | **WebSocket STOMP** (`spring-boot-starter-websocket`, `@stomp/stompjs` on all 3 front-ends) | one channel for GPS, status changes, chat, notifications; replaces the old SSE code |
| Push (app in background) | **Expo Push Notifications** (backend calls `https://exp.host/--/api/v2/push/send`) | free, no Firebase config needed with Expo |
| Maps mobile | `react-native-maps` | standard |
| Maps web | **Leaflet** + `react-leaflet`, OpenStreetMap tiles | free, no API key |
| Directions | **OSRM** (public demo server `router.project-osrm.org`, or self-host later) called **by the backend** | see "map synchronization" below |
| Fake orders | `net.datafaker:datafaker` on the backend | client button calls one endpoint |
| UI style | clean & minimal: white background, 1 accent color, system font, cards with soft shadow, bottom-tab nav on mobile, sidebar on web | user requirement |

### Map synchronization rule (important — user requirement)
"The same map for livreur and responsable, coordinates not messed up":
1. **Single source of truth = backend.** All coordinates stored as WGS84 `latitude`/`longitude` doubles (never swapped: always `lat, lng` in API, convert to `[lng, lat]` only inside GeoJSON/OSRM helpers in `packages/shared`).
2. The **route polyline is computed once by the backend** (OSRM) when the delivery is accepted/picked up, stored on the `Livraison` (encoded polyline), and sent to **both** livreur app and responsable web → they draw the exact same line.
3. Livreur app sends GPS every ~5 s → backend saves + broadcasts on `/topic/livreurs/positions` (responsable) and `/topic/livraisons/{id}/position` (client of that order).
4. Shared helper `packages/shared/geo.ts` for all conversions + a unit test with a known point (Tunis 36.8065, 10.1815).

---

## 2. Domain model changes (backend)

### Enum warning
Hibernate maps `@Enumerated(STRING)` to a MySQL `ENUM(...)` column and `ddl-auto=update` **never** adds new values → inserting a new status fails.
Fix once, at the start of phase A: add `@JdbcTypeCode(SqlTypes.VARCHAR)` (or `columnDefinition = "varchar(32)"`) on every enum field, and `ALTER TABLE ... MODIFY statut VARCHAR(32)` on existing tables. Consider switching to **Flyway** migrations at this point.

### Order lifecycle (`StatutLivraison`)
```
CREEE ─► PRETE ─► AFFECTEE ─► EN_ROUTE_RECUPERATION ─► RECUPEREE ─► EN_LIVRAISON ─► LIVREE
                     │                  │
                     └── (refus) ◄──────┘
                                        └─► ECHEC_RECUPERATION (incident, reported to responsable)
                                                           EN_LIVRAISON ─► ECHEC_LIVRAISON
```
Client-facing labels (shared package): *Commande reçue, Prête, Livreur assigné, Livreur en route, Récupérée, En chemin, Livrée, Échec*.
Every transition goes through **one** method (`LivraisonWorkflow.transition(livraison, nouveauStatut, acteur, commentaire)`) that validates the allowed transition, writes `HistoriqueStatut`, and broadcasts over WebSocket.

### New entities
| Entity | Key fields |
|---|---|
| `Creneau` (shift slot) | `debut`, `fin`, `capaciteLivreurs` — created by responsable (or generated weekly) |
| `AffectationCreneau` | `livreur`, `creneau`, `vehicule` (auto-assigned), `presenceMarqueeA`, `statut` (`RESERVEE`, `PRESENT`, `ABSENT`, `ANNULEE`) |
| `HistoriqueStatut` | `livraison`, `statut`, `date`, `acteur`, `commentaire` (restore from backup) |
| `PositionGps` | `livreur`, `lat`, `lng`, `vitesse`, `precision`, `horodatage` (restore from backup) |
| `Incident` | `livraison`, `livreur`, `motif` (`COMMANDE_INTROUVABLE`, `COMMANDE_NON_PRETE`, `ADRESSE_INTROUVABLE`, `CLIENT_ABSENT`, `AUTRE`), `commentaire`, `photoUrl?`, `traite` |
| `OffreLivraison` | restore from backup (offer to one livreur, expires) |
| `Message` (chat) | `livraison`, `auteur`, `contenu`, `dateEnvoi`, `lu` |
| `DevicePushToken` | `utilisateur`, `expoToken`, `plateforme` |
| `Livraison` additions | (pickup = single depot from config, no per-order field), `routePolyline`, `livreur`, `vehicule`, `dateRecuperation`, `dateLivraison` |

### Vehicle auto-assignment on shift booking
When a livreur books a `Creneau`: pick an **active** vehicle **not already assigned** to an overlapping `AffectationCreneau`
(prefer the lowest consumption, then the largest capacity). If none is free → booking refused with a clear message.
The chosen vehicle becomes the livreur's car for that shift (used by pricing/offers). This replaces the static admin "assign vehicle" for daily operations (keep the admin endpoint for overrides).

### Presence ("marquer sa présence")
Allowed from 15 min before `debut` until `fin`, only if the livreur sends a GPS position (optionally within X km of the depot).
Only livreurs `PRESENT` on the current shift receive order notifications.

---

## 3. Phases

Each phase ends with: backend tests passing, a scripted end-to-end check (like `sprint1.py` used before), and a short demo note.

### Phase A — Foundation
- [x] `git init`, create monorepo folders (npm workspaces), root README with how to run everything
- [ ] Move backend to `backend/` (blocked by the IDE lock on 2026-09-29)
- [ ] Enum → VARCHAR fix + Flyway (baseline from current schema)
- [x] Global exception handler (`@RestControllerAdvice`) returning `{code, message}` JSON — all front-ends rely on it
- [ ] CORS config for the web app (not needed for native Expo apps)
- [x] `GET /api/me` (profile + role + livreur vehicle) for all apps
- [ ] WebSocket STOMP endpoint `/ws` with JWT auth on CONNECT (token in STOMP header), user destinations `/user/queue/...`
- [x] `packages/shared`: hand-written API types, fetch client with token, JWT session (SecureStore), status labels/colors, UI kit
- [ ] `packages/shared/geo.ts` + unit test (with phase D)

### Phase B — Shifts & vehicles (livreur)
- [ ] `Creneau` + `AffectationCreneau` entities, responsable CRUD for shifts (`/api/admin/creneaux`)
- [ ] Livreur: `GET /api/livreur/creneaux` (available slots), `POST /api/livreur/creneaux/{id}/reserver` (auto vehicle), `DELETE` (cancel ≥ 2 h before)
- [ ] `POST /api/livreur/presence` (mark presence), `GET /api/livreur/shift-courant` (current shift + car)
- [ ] Tests: vehicle picked by availability, no double booking of a car, presence window

### Phase C — Order lifecycle, dispatch & notifications (backend)
- [ ] Single depot pickup point (config `app.depot.*`); `LivraisonWorkflow` state machine + `HistoriqueStatut`
- [ ] Order becomes `PRETE`: responsable action `PUT /api/admin/livraisons/{id}/prete` (+ demo mode: auto-ready N seconds after creation, configurable)
- [ ] Dispatch when `PRETE`: restore `DispatchService`/`OffreLivraison`/`TarificationService` from backup, candidates = livreurs `PRESENT` on the current shift with their shift car
- [ ] Manual assignment by responsable: `PUT /api/admin/livraisons/{id}/livreur/{livreurId}` (imposed: livreur is notified and cannot refuse — confirmed 2026-09-29)
- [ ] Notifications: WebSocket `/user/queue/offres` + Expo push when app in background (`DevicePushToken` registration endpoint)
- [ ] Livreur actions: accept / refuse offer, `POST .../recuperation` (validate pickup — scan code or button), `POST .../incident` (→ `ECHEC_RECUPERATION`, notifies responsable), `POST .../livree`, `POST .../echec`
- [ ] Tests for every allowed and forbidden transition

### Phase D — Realtime GPS & routes
- [ ] `PUT /api/livreur/position` (also via STOMP `/app/position`), store `PositionGps`, broadcast
- [ ] OSRM client in backend: route livreur→pickup and pickup→client, stored as encoded polyline on the order, recomputed on pickup
- [ ] `GET /api/livraisons/{id}/suivi` (current position + polyline + status) for client and responsable
- [ ] Throttle/validate positions (ignore accuracy > 100 m, jumps > 200 km/h)

### Phase E — Mobile livreur app (React Native / Expo)
Screens (bottom tabs: **Planning · Courses · Profil**):
- [x] Login
- [x] Sprint 1 home: assigned vehicle + profile (becomes the Profil tab when Planning/Courses exist)
- [ ] Planning: week view of shifts, book/cancel, shows assigned car
- [ ] Current shift card: "Marquer ma présence" button (asks location permission)
- [ ] Offer modal (push + in-app): pickup/drop-off, distance, earnings, countdown, Accept / Refuse
- [ ] Active delivery screen: full-screen map with backend polyline, big action button that changes with status (Arrivé au point de retrait → Valider la récupération → Livrée), "Signaler un problème" sheet with incident reasons
- [ ] "Open in Google Maps/Waze" fallback button for turn-by-turn
- [ ] Background location while a delivery is active (`expo-location` + `expo-task-manager`)

### Phase F — Mobile client app (React Native / Expo)
Screens (bottom tabs: **Commandes · Profil**):
- [x] Signup / Login
- [ ] "Générer une commande" button → `POST /api/client/livraisons/faker` (Datafaker: random products, amount, address around Tunis with valid GPS, slot in the next 2 h)
- [x] Orders list with colored status chips
- [x] New order form (sprint 1 US-05/06): map pin or current position + reverse geocoding, 2 h slot chips, COD, amount
- [x] Order detail: info + static map (timeline/live map come with phases C/D)
- [ ] Order detail: status timeline (from `HistoriqueStatut`), live map (livreur marker + polyline), live updates over WebSocket
- [ ] Chat with the livreur (if time allows — see phase H)

### Phase G — Responsable web app (React + Vite)
Layout: left sidebar (**Carte · Commandes · Livreurs · Véhicules · Créneaux · Incidents**), content area.
- [ ] Login (RESPONSABLE only)
- [ ] Commandes: table with status filter + search, detail drawer with timeline, "Assigner à un livreur" (select among present livreurs, sorted by distance)
- [ ] Livreurs: CRUD + activate/deactivate (existing API)
- [ ] Véhicules: CRUD + activate/deactivate (existing API)
- [ ] Créneaux: create shifts, see who booked which car
- [ ] Incidents: list, mark as handled
- [ ] **Carte temps réel**: Leaflet map, livreur markers updated via STOMP without reload, click marker → current order + same polyline as the livreur app

### Phase H — Chat (optional, "if possible")
- [ ] `Message` entity, STOMP `/app/chat/{livraisonId}` → `/topic/chat/{livraisonId}`, history endpoint
- [ ] Only the order's client, its livreur and responsables may read/write; chat opens at `AFFECTEE`, closes 1 h after `LIVREE`
- [ ] UI bubble chat in both mobile apps (+ read-only in web detail drawer)

### Phase I — Polish & demo
- [ ] Seed/demo data script (shifts for the week, vehicles, 3 livreurs, 2 clients)
- [ ] Demo scenario doc: client generates order → ready → livreur notified → accepts → pickup → map moves on web + client → delivered; plus a failed-pickup scenario
- [ ] Update the school sprint backlog / US list to match what was built

### Later (explicitly out of scope for now)
- Stripe payments (`ModePaiement.CARTE`, PaymentIntent created at order, captured on `LIVREE`)
- Self-hosted OSRM, proof of delivery photo/signature, returns, COD cash reconciliation

---

## 4. Open questions

**Answered 2026-09-29:**
1. "Prête": **responsable action + configurable demo auto-ready**.
2. Manual assignment by the responsable is **imposed** — the livreur cannot refuse (only report an incident).
3. Shift rules: not answered → default 4 h slots, cancel ≥ 2 h before; confirm when phase B starts.
4. Pickup: **single depot** (address + GPS in config) — drop per-order `adresseRecuperation`.
5. French only (assumed).
6. User asked to build the React Native apps now; they were built on the sprint 1 API only. Before phases B–D, ask again whether sprint 2+ US must be written first.

**Original questions:**
1. Who marks an order **"prête"** — the responsable, or automatic after a preparation delay (demo mode)?
2. When the responsable **assigns** an order manually, can the livreur still refuse it?
3. Shift length and booking rules (e.g. 4 h slots, max per week, cancellation deadline)?
4. Is the pickup point always the same depot, or does each order have its own pickup address?
5. Does the web app need to be French only? (assumed yes, all UIs in French)
6. Do the new features need to be split into sprints/US for the school backlog (sprint 2, 3...)? If yes, write the US list first and follow it strictly — only implement the current sprint (user rule).

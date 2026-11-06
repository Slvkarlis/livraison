# First deliverly — Sprint tracking

Source: *Cahier des charges — First deliverly* (9 sprints × 2 weeks, 72 US, 372 points, capacity 40–45 pts/sprint).
Branch reviewed: `corrections` @ `1962784` — 2026-11-03.

How each sprint is planned, run and documented: [`SPRINT_PLAN.md`](SPRINT_PLAN.md).

Legend: ✅ done · 🟡 partial (see note) · ⬜ not started · ➖ descoped · 🧪 verified by automated tests · 📱 not yet verified on a device

## Decisions

| Date | Decision | Impact |
|---|---|---|
| 2026-11-03 | **Database stays MySQL** (no PostgreSQL/PostGIS, unlike spec §4.2). | Zones keep JTS + WKT. MySQL **8+** is required: MAMP's 5.7 is not enough for Hibernate 7 and `sprint2-mysql.sql`. |
| 2026-11-03 | **Payment is cash on delivery only.** Stripe card payment is out of scope. | Remove the Stripe code and the old card/depot order flow (see `ASSESSMENT.md` §4.3). |
| 2026-11-03 | ~~The partner interface moves to a responsive web app.~~ **Revised the same day: the partner stays in the mobile app for now** (inside `mobile-client`, as today). | No new front-end. Sprint 2 bis partner stories are built in the mobile app. The spec's "web + tablet" partner interface can be revisited later. The backend `/api/partenaire/**` endpoints don't depend on this choice. |
| 2026-11-03 | **The 2-minute order expiry is not needed.** | US-2B3 is descoped. Acceptance criterion 1 is reduced to "client can place a COD order". |
| 2026-11-03 | **Security findings are handled last**, after the functional sprints. | Tracked in `ASSESSMENT.md` §4.1. Not part of the next sprint. |
| 2026-11-04 | **Product options (US-202) are not implemented for now.** | US-202 is accepted as products + prices + availability. |

## Overview

| Sprint | Theme | US | Pts | Status | Done pts (est.) |
|---|---|---|---|---|---|
| 1 | Authentification, rôles et gestion des comptes | 9 | 42 | ✅ Done | 42 |
| 2 | Catalogue, zones et prise de commande | 9 | 44 | 🟡 Nearly done | ~39 |
| 2 bis | Interface partenaire et First Mile | 10 (1 descoped) | 43 (40 in scope) | ✅ Done (device pass pending) | 40 |
| 3 | Tracking temps réel et Last Mile | 8 | 42 | ⬜ **Next** | 0 |
| 4 | Dispatch IA par lots | 7 | 45 | ⬜ | 0 |
| 5 | Chaîne financière | 7 | 40 | ⬜ | 0 |
| 6 | Dashboard BI et notation | 8 | 42 | ⬜ | 0 |
| 7 | Échecs, litiges et pilote | 8 | 37 | ⬜ | 0 |
| 8 | Prospection automatisée et prévision de la demande | 6 | 37 | ⬜ | 0 |
| **Total** | | **72 (1 descoped)** | **372 (369 in scope)** | | **~121 (≈ 33 %)** |

Current verification on branch `sprint-2bis` (2026-11-06): backend `mvn test` **77/77**, Node tests **49/49**, mobile typecheck ✅, mobile ESLint ✅, web build ✅. Runs locally on MySQL 8.4 (Docker); every Sprint 2 bis step demoed in the browser preview. Sprint 2 bis report: [`SPRINT2BIS.md`](SPRINT2BIS.md).

_2026-11-03 baseline on `corrections`: 53/53 backend, 32/32 Node; client app opened on an iPhone through Expo Go._

---

## Sprint 1 — Authentification, rôles et gestion des comptes (42 pts) ✅

| ID | User story | Pts | Status | Notes / evidence |
|---|---|---|---|---|
| US-101 | Client signup with phone + OTP | 5 | ✅ 🧪 📱 | `AuthService`, `InscriptionOtp` (shared). No real SMS provider: codes only in the server log (demo mode). |
| US-102 | Secure login/logout, access + refresh token | 3 | ✅ 🧪 | Refresh rotation + reuse detection, logout revokes. **Gap:** no login rate limiting / lockout. Access token lasts 24 h. |
| US-103 | Roles CLIENT / PARTENAIRE / LIVREUR / ADMIN + sub-roles OPERATIONS / FINANCE | 8 | ✅ 🧪 | `UtilisateurDetailsService` authorities, route guards on web and mobile. |
| US-104 | Merchant submits their application | 5 | ✅ 🧪 | Partner application in the **client** app. Text fields only, no document upload. |
| US-105 | Responsable validates / refuses (reason) / asks for more on partner files | 5 | ✅ 🧪 | Web `/dossiers`. |
| US-106 | Courier application (identity, vehicle) + validation | 5 | ✅ 🧪 | Courier app `candidature.tsx`. No document upload. |
| US-107 | Password reset | 3 | ✅ 🧪 | 6-digit code, revokes refresh tokens. |
| US-108 | Audit log of sensitive actions | 3 | ✅ 🧪 | Paginated, filters. Visible to FINANCE. |
| US-109 | Suspend / reactivate an account with a recorded reason | 5 | ✅ 🧪 | Web `/comptes`. Takes effect immediately. |

Known limits carried forward: no real SMS/email gateway (`NotificationSender` only logs), no UI to create OPERATIONS/FINANCE responsables (API only), an OTP client cannot convert to partner/courier.

---

## Sprint 2 — Catalogue, zones et prise de commande (44 pts) 🟡

| ID | User story | Pts | Status | Notes / evidence |
|---|---|---|---|---|
| US-201 | Browse open partners serving my address (category filter, search) | 5 | ✅ 🧪 📱 | `CatalogueService.rechercher`. Filtering happens in memory after `findAll()`, which won't scale. |
| US-202 | View a partner's catalogue (products, prices, **options**) | 3 | 🟡 🧪 | Products, prices and availability are done. **Product options are not implemented** (no model). No product photo or description. |
| US-203 | Partner manages catalogue (create, edit, mark unavailable) | 8 | ✅ 🧪 | Currently **only in the client mobile app** (`mobile-client/src/app/catalogue-partenaire.tsx` → `composants/CataloguePartenaire.tsx`, React Native). There's no web version, and it **stays in the mobile app** (decision 2026-11-03). No delete or photo. |
| US-204 | Single-partner cart (quantities, notes) | 5 | ✅ 🧪 | Enforced server-side as well. The cart lives in memory only and is lost when the app restarts. |
| US-205 | Save a geolocated delivery address | 5 | ✅ 🧪 | Up to 20 addresses, Leaflet map + GPS. |
| US-206 | See delivery fee + total before confirming | 5 | ✅ 🧪 | Server quote with a SHA-256 fingerprint, fee taken from the zone. |
| US-207 | Confirm a COD order with anti-abuse checks | 5 | ✅ 🧪 | Idempotency key, min/max, 3 active orders max, 30 s interval, pessimistic locks. Status `PENDING_PARTNER`. |
| US-208 | Draw zones (polygons, **adjacent zones**, partner coverage) + fee per zone | 5 | 🟡 🧪 | Polygon CRUD, fees and overlap checks are done (JTS, stored as WKT). Shared borders are allowed, but **zone adjacency is not modelled**, although Sprint 4 batching (US-403) will need it. A partner serves only its own zone. |
| US-209 | Order history | 3 | ✅ 🧪 📱 | `GET /livraisons/mes`, enriched detail. |

### To close Sprint 2

**Missing scope (from the backlog):**
- [x] ~~**US-202, product options**~~: **not implemented for now** (decision 2026-11-04). US-202 is accepted without options and can be revisited later.
- [ ] **US-208, adjacent zones:** shared borders are accepted but not recorded. Store each zone's adjacent zones (computed with JTS `touches` when a zone is saved) and show them on the web zones page. Estimated ~1–2 pts. Sprint 4 batching (US-403) needs it.

**Clean-up (decided 2026-11-03, COD only):**
- [x] Remove Stripe and the old depot/slot order flow: groups A and the mobile part of B done in Sprint 2 bis step 0. **Left:** group C (entity fields + migration).
- [ ] Remove the leftover fields from the responsable order detail (Type / Créneau / Distance / Supplément immédiat).

**Small gaps worth closing in the same pass:**
- [ ] US-201: category is a free-text field that must match exactly. Replace it with chips built from the categories of the open partners.
- [ ] US-203: no product delete. A soft delete (hide) is enough, so frozen order lines stay intact.
- [ ] US-204: the cart is lost when the app restarts. Optionally persist it per account with AsyncStorage.

**Verification:**
- [x] Database on MySQL **8** (Docker `mysql:8.4` on port 3307, see README).
- [ ] Run `backend/migrations/sprint2-mysql.sql` on a copy (it has never been run).
- [ ] Device pass of the full flow on Android + iOS (Expo Go): partner opens shop → client orders → responsable sees the order.
- [ ] Full test suite green + sprint review with the PO.

### What users can do once Sprint 2 is closed

| Who | Where | Can do |
|---|---|---|
| **Client** | `mobile-client` app | Sign up with phone + SMS code, log in/out, reset password. Save up to 20 delivery addresses (map pin or GPS). Browse the **open** partners that serve the chosen address, filtered by category and name. Open a partner's catalogue (prices, availability, options if kept). Build a single-partner cart with quantities and notes. See items + zone delivery fee + total before confirming. Place a **cash-on-delivery** order (anti-abuse limits apply). See order history and order detail. Apply to become a partner (with a separate account). |
| **Partner** | `mobile-client` app (partner screens) | Submit an application (shop, category, address/GPS, tax number), follow it and correct it when asked. Once validated: create/edit products, set prices and availability (and options if kept), open or close the shop. A shop outside every zone can't open. |
| **Courier** | `mobile-livreur` app | Apply (identity, declared vehicle), follow and correct the application. Once validated: log in, see the vehicle assigned by the Responsable and the profile. |
| **Responsable: main admin / OPERATIONS** | `web-responsable` | Review partner and courier applications (validate / refuse with reason / ask for more). Suspend or reactivate any account with a reason. Draw zones on the map and set their delivery fees (and see adjacent zones). See all orders with filters and detail. Manage couriers and vehicles and assign vehicles. Read the audit log. The main admin can create OPERATIONS/FINANCE accounts through the API (there's no screen for it). |
| **Responsable: FINANCE** | `web-responsable` | Read the audit log only, for now. |

**What still doesn't happen after Sprint 2** (this is Sprint 2 bis and later): the partner **doesn't see or answer incoming orders**, so every order stays "En attente du partenaire". There's no client cancellation, no courier mission, pickup or delivery, no tracking, and no real SMS (codes appear in the server log in demo mode).
---

## Sprint 2 bis — Interface partenaire et First Mile (43 pts, 40 in scope) ✅

All partner stories are built in the **mobile app** (partner screens inside `mobile-client`, decision 2026-11-03). Branch `sprint-2bis`, one commit per step. Full report, API contracts and limits: [`SPRINT2BIS.md`](SPRINT2BIS.md). 📱 = device pass still to do for the whole sprint.

| ID | User story | Pts | Status | Prerequisites / notes |
|---|---|---|---|---|
| US-2B1 | Partner gets new orders in real time (notification, sound ~~, 2-min countdown~~) | 5 | ✅ 🧪 📱 | Partner tabs + order list/detail/history; STOMP WebSocket `/ws` with JWT; banner + sound (`expo-audio`) while the app is open. **Background push** (app closed) moves to US-304, Sprint 3. |
| US-2B2 | Partner accepts / refuses (reason, incl. out of stock) | 5 | ✅ 🧪 | `CommandeWorkflow` state machine + `HistoriqueStatut`. Accept with prep time; refuse with RUPTURE / FERMETURE / TROP_DE_COMMANDES / AUTRE (+comment). |
| US-2B3 | ~~Order auto-expires after 2 min with no answer~~ | 3 | ➖ | **Descoped 2026-11-03.** An unanswered order stays `PENDING_PARTNER` until the partner answers, the client cancels (US-2B12) or the Responsable cancels (US-311). |
| US-2B4 | Partner sets / adjusts (max 2×) prep time, signals prep start | 3 | ✅ 🧪 | Client sees the updated ready time and a timeline. |
| US-2B5 | Partner signals the order is ready | 3 | ✅ 🧪 | Generates the pickup code and triggers courier assignment. |
| US-2B8 | Courier goes available / unavailable in authorised zones and receives pickup missions (simple assignment) | 8 | ✅ 🧪 📱 | GPS must be inside a zone in force. Assignment: main > secondary > temporary, then fewest missions, max 3; waiting orders assigned when a courier frees up. Replaced by AI dispatch in Sprint 4. |
| US-2B9 | Courier scans the parcel QR in store → `PICKED_UP` | 5 | ✅ 🧪 📱 | Status `RECUPEREE`. `expo-camera` scan or typed 6-char code; wrong code / other order's QR / other courier refused. No rate limit on wrong attempts yet (security pass). |
| US-2B10 | Partner generates and prints the parcel QR | 3 | ✅ 🧪 | Random single-use code (not signed, stored in clear for reprint). Label with QR, print/share via `expo-print`. |
| US-2B11 | Responsable assigns each courier a main zone, secondary zones and temporary assignments | 5 | ✅ 🧪 | `AffectationZone` + web "Zones" dialog in **Livreurs**, audited. |
| US-2B12 | Client cancels while `PENDING_PARTNER` or `ACCEPTED` | 3 | ✅ 🧪 | Free, optional reason; partner sees "Annulée par le client". |

---

## Sprint 3 — Tracking temps réel et Last Mile (42 pts) ⬜

| ID | User story | Pts | Status |
|---|---|---|---|
| US-301 | Courier GPS sent during missions | 5 | ⬜ |
| US-302 | Client follows the courier live on a map + status | 8 | ⬜ (the Leaflet WebView map already exists in the client app) |
| US-303 | Rule-based ETA (prep time + distance ÷ zone average speed) | 3 | ⬜ |
| US-304 | Notification on every status change | 5 | ⬜ (no push infrastructure) |
| US-305 | Single-use dynamic client QR | 5 | ⬜ |
| US-306 | Courier confirms the exact cash amount (gap must be justified), scans the client QR → `DELIVERED` | 8 | ⬜ |
| US-310 | 6-digit SMS fallback code | 3 | ⬜ (reuse `CodeVerificationService`) |
| US-311 | Responsable cancels / manually validates a pickup or handover, with recorded reason | 5 | ⬜ |

## Sprint 4 — Dispatch IA par lots (45 pts) ⬜

| ID | User story | Pts | Status |
|---|---|---|---|
| US-401 | Event history into the data warehouse (statuses, GPS, prep, offers, zones) | 3 | ⬜ |
| US-402 | Auto-assign by proximity / load / availability / zones | 8 | ⬜ |
| US-403 | Batch 2–3 nearby pickups (same or adjacent zones) | 8 | ⬜ (depends on zone adjacency from US-208) |
| US-404 | Optimise pickup/drop order under a max in-vehicle time | 8 | ⬜ (OR-Tools in the Python service) |
| US-405 | Courier accepts/refuses a batch offer with a time limit, re-offer on refusal | 5 | ⬜ |
| US-406 | AI ETA + promised time frozen at acceptance | 8 | ⬜ |
| US-407 | Responsable supervises dispatch live, forces an assignment | 5 | ⬜ |

## Sprint 5 — Chaîne financière (40 pts) ⬜

| ID | User story | Pts | Status |
|---|---|---|---|
| US-501 | Auto commission (12 % default) + partner net at delivery | 5 | ⬜ |
| US-502 | Commission rates global / category / partner (most specific wins) | 3 | ⬜ |
| US-503 | Immutable financial ledger per order | 8 | ⬜ |
| US-504 | Courier sees cash balance, collected orders, deposit receipts | 3 | ⬜ |
| US-505 | FINANCE records the full cash deposit, receipt, reconciliation | 5 | ⬜ |
| US-506 | Weekly closing with payout statement per partner (reconciled cash only) | 8 | ⬜ |
| US-512 | Pay scale per zone, pay per mission, weekly courier statement | 8 | ⬜ |

## Sprint 6 — Dashboard BI et notation (42 pts) ⬜

| ID | User story | Pts | Status |
|---|---|---|---|
| US-507 | BI Finance dashboard | 8 | ⬜ |
| US-508 | BI Operations dashboard (heatmap, zone coverage, batching gains) | 8 | ⬜ |
| US-514 | Configurable alert thresholds in the cockpit | 5 | ⬜ |
| US-509 | BI Partners dashboard | 5 | ⬜ |
| US-510 | BI Couriers & Zones dashboard | 5 | ⬜ |
| US-511 | Courier/partner rate the client / courier | 3 | ⬜ |
| US-309 | Client rates partner + courier | 3 | ⬜ |
| US-2B7 | Partner sales dashboard | 5 | ⬜ |

## Sprint 7 — Échecs, litiges et pilote (37 pts) ⬜

| ID | User story | Pts | Status |
|---|---|---|---|
| US-308 | Courier declares a failed delivery with a reason | 5 | ⬜ |
| US-312 | Responsable decides re-delivery / return / loss + financial policy | 5 | ⬜ |
| US-516 | Client opens a claim after delivery | 3 | ⬜ |
| US-517 | Responsable handles the dispute, refund + who bears the cost | 5 | ⬜ |
| US-2B6 | Partner opening hours + pause ~~(incl. auto-pause after repeated expiries)~~ | 3 | ⬜ (only a manual `ouvert` flag exists; with no expiry, there's no auto-pause trigger. Unanswered or refused orders could replace it if wanted.) |
| US-307 | Courier guided to the store then to the client | 3 | ⬜ |
| US-518 | Simulator + batches vs single dispatch comparison | 8 | ⬜ |
| US-519 | Pilot on 1–3 zones, KPI supervision, recalibration | 5 | ⬜ |

## Sprint 8 — Prospection automatisée et prévision de la demande (37 pts) ⬜

| ID | User story | Pts | Status |
|---|---|---|---|
| US-801 | Collect prospective merchants per zone from authorised sources (OSM/Overpass) | 8 | ⬜ |
| US-802 | AI prospect potential score | 8 | ⬜ |
| US-803 | Prioritised prospect list + status follow-up | 5 | ⬜ |
| US-804 | Order forecast per zone × time slot | 8 | ⬜ |
| US-805 | Forecast vs available couriers, under-coverage alert, reinforcement suggestion | 5 | ⬜ |
| US-806 | Evaluate / retrain both models (precision; MAE, WAPE) | 3 | ⬜ |

---

## Global acceptance criteria (spec §7.2)

| # | Criterion | Status |
|---|---|---|
| 1 | Client can place a COD order ~~; it expires at 2 min without a partner answer~~ | ✅ (expiry descoped 2026-11-03) |
| 2 | Accepted order auto-assigned to an authorised courier, in a batch of 2–3 when possible | 🟡 Simple single-order assignment done (Sprint 2 bis); batching is Sprint 4 |
| 3 | Live tracking + updated ETA + promised time | ⬜ |
| 4 | Delivery validated only after amount confirmation + valid QR (or fallback code) | ⬜ |
| 5 | Cash traced per courier and reconcilable | ⬜ |
| 6 | Weekly closing produces partner payout + courier pay statements | ⬜ |
| 7 | Failed delivery declared with a reason and resolved by the Responsable | ⬜ |
| 8 | BI dashboard with financial, operational and performance indicators | ⬜ |
| 9 | Prospection model gives a scored merchant list with status tracking | ⬜ |
| 10 | Forecast per zone × slot with an under-coverage alert | ⬜ |

## Schedule check

6 sprints (3 → 8, **243 pts**, plus ~5 pts left in Sprint 2) remain, about 12 weeks at 2 weeks per sprint. The team's capacity is 40–45 pts, which roughly matches the plan. Sprints 4 and 8 also need a Python AI service that **doesn't exist yet**, so start setting it up during Sprint 3 at the latest. See `docs/ASSESSMENT.md` for risks and recommendations.

## Change log

| Date | Change |
|---|---|
| 2026-11-03 | File created from the spec + review of branch `corrections` (`1962784`). |
| 2026-11-03 | Decisions recorded: MySQL kept, COD only, partner web app, US-2B3 descoped, security last. |
| 2026-11-03 | Partner decision revised: stays in the mobile app for now. |
| 2026-11-06 | Sprint 2 bis done on branch `sprint-2bis` (9 US, 40 pts), report in `SPRINT2BIS.md`. Device pass pending. |
| 2026-11-06 | Added `SPRINT_PLAN.md`: the general structure every sprint follows (plan template, steps, checks, commits, docs). |

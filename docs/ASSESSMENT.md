# First deliverly — Project & codebase assessment

Reviewer: senior consultant onboarding · Date: 2026-11-03 · Branch: `corrections` @ `1962784` (4 commits ahead of `main`)
Sprint progress detail: [`SPRINT_TRACKING.md`](SPRINT_TRACKING.md)

## 1. Executive summary

The project is **at the end of Sprint 2 (~22 % of the 372 points)**, and the delivered scope is solid. The team has secure authentication and account management, plus a working marketplace with zones, a catalogue, a cart and COD orders. It has good automated tests and unusually thorough sprint reports. Everything builds and passes on this machine, and backend, web and the client app run end to end. The client app also opened on an iPhone.

The main concerns are **not about quality but about what comes next**:

1. **The real-time foundation doesn't exist yet**: no WebSocket, push notifications or order state machine. Sprint 2 bis and every later sprint depend on it.
2. **The partner interface lives inside the client phone app.** The spec asks for web + tablet, but it stays mobile for now by decision (below).
3. **Leftover code from the pre-spec prototype**: Stripe card payment, depot/km pricing, delivery slots, a separate order flow. It adds confusion and surface area, and is now confirmed out of scope (COD only).
4. **Other gaps from the spec**: no Python AI service, event bus, Docker or CI. MySQL is kept deliberately instead of PostgreSQL/PostGIS.
5. **Hygiene**: very dense code formatting with no formatter, a stale `ROADMAP.md` that contradicts the spec, and weak git practice. Committed secrets are known and deferred.

### Decisions taken (2026-11-03)

| Topic | Decision | Effect on this assessment |
|---|---|---|
| Database | **Stay on MySQL.** | A4 closed. MySQL 8+ is still required. |
| Payment | **Cash on delivery only.** No Stripe. | §4.3: remove the Stripe and legacy order flow. |
| Partner interface | **Stays in the mobile app for now** (inside `mobile-client`). Revised the same day from "responsive web app". | A7 closed for now. No new front-end. |
| 2-minute order expiry | **Not needed.** | A2 closed. US-2B3 descoped. |
| Security findings | **Handled last**, after the functional sprints. | §4.1 kept as a backlog, removed from the pre-Sprint 2 bis plan. |

**Overall rating: B−.** The engineering quality of what exists is good. The foundation needed for the remaining 78 % is missing, and the schedule leaves little slack.

| Area | Rating | One-liner |
|---|---|---|
| Functional progress vs plan | 🟢 On track | Sprints 1–2 delivered within ~5 pts. |
| Backend design & correctness | 🟢 Good | Layered, idempotent, locked, BigDecimal money, consistent error format. |
| Security | 🟡 Fair | Strong token handling. Committed secrets, no login throttling, 24 h access token. Deferred to the end by decision. |
| Tests | 🟢 Good | 53 backend + 32 shared tests. Browser scripts exist. No device or CI runs. |
| Code readability / maintainability | 🔴 Weak | Very dense lines (up to ~490 chars), no formatter, mixed injection styles, FR/EN mixing. |
| Architecture fit for Sprints 2 bis–8 | 🔴 At risk | No real-time, scheduling, events, AI service or spatial database. |
| DevOps / delivery | 🔴 Missing | No CI, Docker, migrations tool, environments or PR flow. |
| Documentation | 🟢 Very good | `docs/SPRINT1.md` and `docs/SPRINT2.md` are excellent. `ROADMAP.md` is outdated. |

## 2. What's in the repository

| Part | Stack | Size (approx.) | State |
|---|---|---|---|
| `backend/` | Spring Boot **4.1.1**, Java **25**, JPA/Hibernate 7, MySQL, JJWT 0.12, JTS 1.20, stripe-java | ~4.1k lines main, ~0.9k test | Sprints 1–2 + legacy prototype |
| `web-responsable/` | React 19, Vite 8, TypeScript 7, react-router 7 | ~1.3k lines | Back-office: dossiers, comptes, audit, zones, commandes, livreurs, véhicules |
| `mobile/mobile-client/` | Expo SDK 58, RN 0.88, Expo Router | ~1.8k lines | Client + **partner** (catalogue) + legacy card-payment flow |
| `mobile/mobile-livreur/` | Same | ~0.4k lines | Login, application, vehicle/profile home only |
| `mobile/packages/shared/` | TS | ~1.1k lines | HTTP client with refresh, session, forms, UI kit, Sprint 1/2 rules |
| `scripts/` | Node, Python | — | Unit tests, browser checks (H2), e2e API script |

Verification run during this review (no code modified):

| Check | Result |
|---|---|
| `./mvnw test` (Java 25, H2) | ✅ 53/53 |
| `node --test scripts/sprint1.test.cjs scripts/sprint2.test.cjs` | ✅ 32/32 |
| `npm run typecheck --prefix mobile` | ✅ |
| `npm run lint --prefix mobile` | ✅ |
| `npm run build --prefix web-responsable` | ✅ |
| Backend on MySQL (MAMP **5.7.24**) + web login + client app on iPhone (Expo Go) | ✅ runs |

## 3. Strengths (keep doing this)

- **Careful order integrity**: server-side recalculation (the client's amounts are ignored), a quote fingerprint, an idempotency key with a unique constraint, pessimistic locks on client and partner, prices and names frozen at order time, `BigDecimal` for new amounts. Several of these are part-way to Sprint 5's ledger requirements already.
- **Mature auth**: refresh-token rotation with reuse detection, revocation on logout and password reset, account status enforced on every request, demo-only code logging guarded by both flag and profile, secrets hidden from `toString()`.
- **Clear authorisation model**: roles + OPERATIONS/FINANCE sub-roles mapped to Spring authorities, `@PreAuthorize` on every endpoint, ownership checks in services.
- **Consistent API errors**: `{code, message}` through `GestionErreurs`, and front-ends that handle 401/403/409/429.
- **Shared mobile package**: one HTTP/session layer for both apps, with refresh concurrency covered by tests.
- **Honest documentation**: each sprint report lists what was *not* verified. Keep that culture.

## 4. Findings & risks

Severity: 🔴 high · 🟠 medium · 🟡 low. ✔️ = closed by a decision.

### 4.1 Security

> **Deferred (decision 2026-11-03):** handled last, after the functional sprints. Kept here as the security backlog. Exception worth considering earlier: S1 only means rotating the test keys and replacing them with placeholders, and once Stripe is removed (§4.3) the keys go away with it.

| # | Sev | Finding | Where | Recommendation |
|---|---|---|---|---|
| S1 | 🔴 | **Stripe test secret + publishable keys committed**, although the README says *"Les clés ne doivent jamais être commitées"*. | `backend/src/main/resources/application.properties` | Rotate the keys in the Stripe dashboard, restore `${STRIPE_SECRET_KEY:}` placeholders, add a secret-scanning hook (gitleaks). |
| S2 | 🟠 | JWT signing secret committed, and the same secret is used in every environment. | same file | `${APP_JWT_SECRET}` with no default outside the `dev` profile. |
| S3 | 🟠 | **No throttling or lockout on `/api/auth/login`** (OTP and reset codes do have attempt limits). | `AuthService.login` | Per-identifier + per-IP rate limit (bucket4j or a DB counter). |
| S4 | 🟡 | Access token lifetime is 24 h even though refresh tokens exist. | `app.jwt.expiration-ms` | 10–15 min access token. |
| S5 | 🟡 | `telephone` isn't unique in the database, and login by phone uses `findFirst`. | `Utilisateur`, `UtilisateurRepository` | Clean the data, then add a unique constraint. |
| S6 | 🟡 | Default admin `admin@fleetpulse.tn / admin12345` is created whenever it's missing, in any profile. | `AdminInitializer` | Require `ADMIN_PASSWORD` outside dev/demo. |

### 4.2 Architecture & spec alignment

| # | Sev | Finding | Recommendation |
|---|---|---|---|
| A1 | 🔴 | **No real-time channel.** The spec requires WebSocket for positions, statuses and offers, with ≤ 5 s position latency. Sprint 2 bis already needs partner alerts. | Add Spring WebSocket/STOMP with JWT on CONNECT as the **first** Sprint 2 bis task. Expo client: `@stomp/stompjs`. |
| A2 | ✔️ | ~~No scheduling for the 2-min order expiry.~~ **Closed: expiry not needed (US-2B3 descoped).** | A scheduler will still be needed later for time-based jobs (weekly closing in Sprint 5, forecast refresh in Sprint 8), but not for Sprint 2 bis. |
| A3 | 🔴 | **No order state machine.** `StatutLivraison` mixes the spec's English (`PENDING_PARTNER`) with legacy French (`EN_PREPARATION`, `AFFECTEE`, `A_PROXIMITE`…). States the spec needs are missing (`ACCEPTED`, `REFUSED`, `READY`, `PICKED_UP`, `DELIVERED`, `CANCELLED`, `FAILED`), and so are transition guards and status history. | Define the full lifecycle once (all sprints), implement one `transition()` service with an allowed-transition table + a `HistoriqueStatut` entity (US-401 needs it) + an event publish. |
| A4 | ✔️ 🟠 | **Database: decided to stay on MySQL** (the spec listed PostgreSQL/PostGIS + Redis). The current approach (JTS in Java, WKT text column, bounding-box index) works for zones. For Sprints 3/4/6 (GPS history, nearest courier, heatmaps), use MySQL 8 spatial features (`POINT` columns + `SPATIAL INDEX`, `ST_Distance_Sphere`) and an archiving/partitioning strategy for positions. | **Require MySQL 8+** for everyone: MAMP's 5.7.24 is not supported by Hibernate 7 and `sprint2-mysql.sql`. Swap MAMP's MySQL for 8.x or use a MySQL 8 Docker container. Document it in the README. |
| A5 | 🟠 | **No Python AI service**, but Sprints 4 and 8 depend on one (batching, VRP/OR-Tools, ETA, prospection, forecasting) with a rule-based fallback. | Set up a FastAPI skeleton + Docker + contract (OpenAPI) during Sprint 3, and implement rules-based fallbacks in Java first. |
| A6 | 🟠 | **No event bus / data warehouse** (US-401, BI). | Start with a transactional outbox table + Spring events, and add RabbitMQ later if needed. Don't block on Kafka. |
| A7 | ✔️ 🟡 | **Partner interface lives inside the client mobile app** (the spec says web + tablet). **Decided: keep it in the mobile app for now.** | Keep partner screens isolated (their own route group and components) so a later move to web or a separate app stays cheap. For Sprint 2 bis on mobile: in-app sound (`expo-av`) + Expo push for background alerts (push needs a development build, not Expo Go). QR printing via `expo-print` (PDF share/print). |
| A8 | 🟡 | Domain naming differs from the spec (Livraison = Commande, Livreur = Coursier, FleetPulse = First deliverly). | Fine to keep, but add a glossary to the README so the class diagram and code can be mapped. |

### 4.3 Leftover code from before the spec

The first prototype (Sept. 2026) followed a different design: single depot, km-based price, delivery slots, Stripe card payment, immediate +50 %. Most of it is still wired in:

Inventory (traced 2026-11-03). "Reachable" means something in the running system can still call it.

**A. Dead in the app: no UI entry point, only reachable by calling the API directly**

| Code | Where | Status |
|---|---|---|
| Old card order screen (488 lines) | `mobile/mobile-client/src/app/livraison-carte.tsx` | Registered as route "Livraison par carte (ancien parcours)" in `mobile-client/src/app/_layout.tsx:53`, but **no button or link navigates to it**. Only reachable by deep link. |
| Old order creation | `POST /api/livraisons` → `LivraisonService.createForUser` | Only caller is `api.creerLivraison` (shared `api.ts:68`), used only by `livraison-carte.tsx`. COD without items is already refused (400). Only the CARTE path still works. |
| Old km-based quote | `POST /api/livraisons/devis` → `LivraisonService.devis` → `TarificationService` (+ `DepotProperties`, `TarificationProperties`, `app.depot.*`, `app.tarification.*`) | Only caller is `api.devis` (shared `api.ts:66`), used by `livraison-carte.tsx`. The real Sprint 2 quote is `POST /api/commandes/devis` (zone fees). |
| Stripe backend | `PaiementController` (`/api/paiements/config`, `/api/livraisons/{id}/paiement`, `…/verifier`, `/api/stripe/webhook`), `PaiementService`, `StripeService`, `StripeProperties`, `app.stripe.*`, `stripe-java` in `pom.xml` | The webhook is public (`SecurityConfig` permits it). Payment can only start for a CARTE order, and those can only come from the dead screen. |
| Stripe mobile | `mobile/mobile-client/src/paiement.ts`, `@stripe/stripe-react-native` (`package.json`, plugin in `app.json`), `api.paiementConfig` | Used by `livraison-carte.tsx` and by the order detail (below). |
| Their tests | `PaiementServiceTest` (8), `TarificationServiceTest` (5) | 13 of the 53 backend tests cover leftover code. |
| One-shot cleanup script | `nettoyage_sprint1.sql` (repo root) | Already applied in September. Not used. |

**B. Still wired into live screens (the code runs, but shows nothing useful for COD-only orders)**

| Code | Where | What it does today |
|---|---|---|
| "Pay by card" block + button | `mobile/mobile-client/src/app/commande/[id].tsx:21,47–58,89–119` | Rendered only when `modePaiement === 'CARTE'`. Never shown for new orders, but imports Stripe. |
| "À payer" badge | `mobile/mobile-client/src/app/(onglets)/index.tsx:107` | Same CARTE-only condition. |
| Immediate / slot display | `mobile/mobile-client/src/app/(onglets)/index.tsx:88`, `web-responsable/src/pages/Commandes.tsx:78,114–123` | Shows "Type", "Créneau", "Distance", "Supplément immédiat" in the responsable's order detail. For new COD orders these are dummy values. |
| Type definitions | `mobile/packages/shared/src/types.ts:59–66,95–113`, `web-responsable/src/types.ts:82–89` | `TypeLivraison`, `ModePaiement`, `StatutPaiement`, `distanceKm`, `supplementImmediat`, `creneau*`. |

**C. Legacy fields the current Sprint 2 code is *forced* to fill**

| Code | Where | Why it matters |
|---|---|---|
| `Livraison.creneauDebut/Fin` (NOT NULL), `typeLivraison`, `distanceKm`, `supplementImmediat`, `modePaiement`, `statutPaiement`, `stripePaymentIntentId`, `double fraisLivraison/montantACollecter` | `backend/.../Model/Livraison.java`, `Dto/LivraisonResponse.java` | `CommandeService.commander` sets dummy values (`creneauDebut = creneauFin = now`, `typeLivraison = IMMEDIATE`, `modePaiement = COD`) just to satisfy the old columns. Removing them needs a DB migration. |

**Shared pieces that look legacy but are used by the live flow (keep):** `choisir-adresse.tsx` and `CarteLeaflet.tsx` (address picker for the Sprint 2 order), `GET /api/livraisons/mes` and `GET /api/livraisons` (order history and responsable order list).

**Recommendation (🟠), confirmed 2026-11-03: COD only.** Remove the leftover flow in one dedicated PR, in this order:
1. Group A: delete it outright, nothing live depends on it.
2. Group B: remove the CARTE/slot UI branches and types.
3. Group C: drop the fields from the entity/DTO and the columns through a migration, not `ddl-auto`. Check that no existing CARTE orders in the database need to be kept first. Existing tests for these (`PaiementServiceTest`, `TarificationServiceTest`) go with them. It currently appears in UI routes, inflates the `Livraison` entity, and would collide with Sprint 5's ledger (two ways to handle money). Removing Stripe also gets rid of the committed Stripe keys (S1).

### 4.4 Code quality & maintainability

| # | Sev | Finding | Recommendation |
|---|---|---|---|
| Q1 | 🔴 | **Very dense formatting**: several statements per line, lines up to ~490 chars (`MarcheClient.tsx`, `Zones.tsx`, `CommandeService.java`). Hard to review, diff and onboard into. | Add Prettier (TS) + Spotless/google-java-format or palantir (Java), reformat once in a standalone commit, enforce in CI. |
| Q2 | 🟠 | Mixed dependency injection: Sprint 1 commit says "field injection everywhere" (`@Autowired` fields), Sprint 2 services use constructor injection (`@RequiredArgsConstructor`). | Pick **constructor injection** (testable, immutable) and convert gradually. |
| Q3 | 🟠 | Queries load whole tables and filter in Java: `partenaires.findAll()` in `CatalogueService.rechercher` and `ZoneService.lister`. `GET /api/livraisons` returns every order without pagination. | Repository queries by zone/status, pagination for admin lists. The spec's performance target is API p95 < 500 ms. |
| Q4 | 🟠 | Schema managed by `ddl-auto=update` + one hand-written SQL file (MySQL 8 only, never executed). | Adopt **Flyway** now: baseline the current schema, then one migration per US. Use `validate` outside dev. |
| Q5 | 🟡 | No linter for `web-responsable`, no backend static analysis. | ESLint for web, plus SpotBugs/Error Prone or Sonar later. |
| Q6 | 🟡 | DTOs grouped in one big `MarketplaceDto` file of records, while Sprint 1 uses one class per file. | Keep one convention. |
| Q7 | 🟡 | Bleeding-edge versions (Spring Boot 4.1, Java 25, Expo 58, RN 0.88, TypeScript 7, Vite 8). | OK for a school project, but pin exact versions and document required tool versions (Node, JDK, MySQL) in one place. |
| Q8 | 🟡 | README says Stripe currency defaults to `tnd`, config defaults to `eur`. `ROADMAP.md` says `mvnw` is broken, but it works. | Doc sync. |

### 4.5 Process & delivery

| # | Sev | Finding | Recommendation |
|---|---|---|---|
| P1 | 🔴 | **No CI.** Tests only run when someone remembers to run them. | GitHub Actions: backend `mvn verify`, `node --test`, mobile typecheck + lint, web build, on every PR. |
| P2 | 🟠 | All Sprint 1–2 work sits on one long branch `corrections`, and `main` is behind. Commit messages like `eeee` (the Expo 57→58 upgrade). | Merge `corrections` to `main` once Sprint 2 is accepted, then one branch + PR per US, with a review rule and meaningful commit messages (`US-2B2: partner accept/refuse`). |
| P3 | 🟠 | `ROADMAP.md` describes the **old** design (shifts/créneaux, single depot, vehicle auto-assignment), which contradicts the spec. It's also written as instructions for an AI coding session. | Archive it (`docs/archive/`) and use `SPRINT_TRACKING.md` + the spec as the source of truth. |
| P4 | 🟠 | No Docker / docker-compose. Each developer's local setup differs (MAMP 5.7 here, JDK 17 on a teammate's machine per the roadmap). | `docker-compose.yml` with the database (MySQL 8 or PostGIS), backend and later the AI service and Redis. |
| P5 | 🟡 | Native behaviour never validated on devices (reports say so). | Add a short device test checklist to each sprint's definition of done. |
| P6 | 🟡 | No demo dataset beyond the Sprint 2 seed. Sprint 4 and Sprint 8 need simulated history. | Start a seed/simulator script early (it feeds US-518 too). |

## 5. Recommended plan

### Before starting Sprint 2 bis (≈ 2–3 days, "Sprint 0.5")

1. 🔴 CI pipeline + formatter + one reformat commit (P1, Q1).
2. 🟠 Remove Stripe and the legacy order flow (§4.3, COD only).
3. 🟠 Flyway baseline (Q4), MySQL 8 for everyone (A4), docker-compose for the database (P4).
4. 🟠 Merge `corrections` → `main`, adopt branch-per-US + PR (P2). Archive `ROADMAP.md` (P3).
5. 🟡 Confirm with the PO: product options (US-202), zone adjacency (US-208).

Security (§4.1) is deferred until after the functional sprints.

### Sprint 2 bis — suggested order

1. Order state machine + status history + domain events (A3), which everything else depends on.
2. WebSocket/STOMP with JWT (A1), used by the partner screens and the courier app.
3. Partner order inbox in the mobile app: list, real-time alert + sound, accept/refuse, prep time, ready (US-2B1, 2B2, 2B4, 2B5).
4. `AffectationZone` + courier availability (US-2B11, US-2B8), simple assignment.
5. Signed single-use parcel QR, shown/printed from the partner screens, scanned in the courier app (US-2B10, US-2B9).
6. Client cancellation (US-2B12). US-2B3 (expiry) is descoped.

### Later sprints — risks to plan for now

- **Sprint 3**: background GPS on iOS/Android needs a **development build** (Expo Go can't run background location in production mode) and push notifications (Expo Push). Plan an EAS build early.
- **Sprint 4 / 8**: the AI service, simulated data and the rules-based fallback. Start the skeleton in Sprint 3.
- **Sprint 5**: ledger immutability (insert-only table, no update/delete grants, idempotent postings). Remove the `double` money fields before this sprint.
- **After Sprint 8**: the security backlog (§4.1). Budget time for it in the last sprint, because S1/S2 (secrets) and S3 (login throttling) must be fixed before any public demo or deployment.

## 6. Open questions for the team / PO

Answered 2026-11-03:
- ~~Is MySQL a hard constraint?~~ → Stay on MySQL.
- ~~Partner interface: web/tablet or inside the client app?~~ → Stays in the mobile app for now.
- ~~Is Stripe card payment in scope?~~ → No, COD only.
- ~~Is the 2-minute expiry needed?~~ → No.

Still open:
1. Product options (US-202): what do they mean (sizes, add-ons)? Required for the demo?
2. Zone adjacency (US-208): needed for Sprint 4 batching. Model it in Sprint 2 bis or Sprint 4?
3. Who is the product owner for acceptance, and what is the demo/defence date?
4. Which phone models / OS versions must the demo run on?
5. Without the expiry, should an unanswered order raise an alert to the Responsable after some delay (cockpit, Sprint 6 US-514)?

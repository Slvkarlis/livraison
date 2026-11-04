# Sprint 2 bis — Implementation plan

Scope: [`SPRINT_TRACKING.md`](SPRINT_TRACKING.md) § Sprint 2 bis (9 US, 40 pts, US-2B3 descoped).
Decisions applied: MySQL, COD only, partner stays in the mobile app (`mobile-client`), no 2-min expiry, security last.

**How we work:** one step at a time. Each step ends with automated checks + a demo in the **web preview** (Expo web in the browser pane), then your validation before the next step starts.

**Git:**
- Everything goes on branch `sprint-2bis` (created from `corrections`), with **one commit per step**, made after you validate the step.
- Commits are authored by your git identity only, with no co-author line.
- **Nothing is pushed until the whole sprint is done.**

| Step | Commit message |
|---|---|
| docs | `docs: add sprint tracking, project assessment and Sprint 2 bis plan` |
| 0 | `chore(sprint-2bis): remove Stripe and legacy order flow, enable Expo web preview` |
| 1 | `feat(US-2B1): partner tabs, incoming orders list and order status history` |
| 2 | `feat(US-2B2): partner accepts or refuses orders with a reason` |
| 3 | `feat(US-2B4, US-2B5): preparation time, adjustments and ready status` |
| 4 | `feat(US-2B12): client cancels a pending or accepted order` |
| 5 | `feat(US-2B1): real-time order updates over WebSocket with sound alert` |
| 6 | `feat(US-2B10): single-use parcel QR code with print and share` |
| 7 | `feat(US-2B11): assign main, secondary and temporary zones to couriers` |
| 8 | `feat(US-2B8): courier availability in authorised zones and simple mission assignment` |
| 9 | `feat(US-2B9): courier confirms pickup by scanning the parcel QR` |
| 10 | `docs(sprint-2bis): sprint report and tracking update` |

Every step's checks:
- Backend: `./mvnw test` (new tests for the step) + existing 53 green.
- Mobile: `npm run typecheck --prefix mobile` + `npm run lint --prefix mobile` + `node --test scripts/*.test.cjs`.
- Web (when touched): `npm run build --prefix web-responsable`.
- Web preview demo following the step's checklist, then you validate.

---

## What exists today (exploration, 2026-11-04)

**Partner side (`mobile/mobile-client`)**
- `src/app/_layout.tsx`: one Expo Router stack for client + partner. `AuthProvider role="CLIENT"` also accepts `PARTENAIRE` (`packages/shared/src/auth.tsx`). A validated partner gets **one** screen, `catalogue-partenaire` (`composants/CataloguePartenaire.tsx`): open/close shop + product form + product list + logout. There are no tabs, no orders and no profile.
- A partner whose application is still pending sees `dossier` (shared `SuiviDossier`).

**Shared mobile package (`mobile/packages/shared/src`)**
- `api.ts` + `sprint2.ts` (`creerApiMarche`): typed REST calls. `http.ts`: fetch client with JWT + refresh, 10 s timeout.
- `config.ts`: backend URL = `EXPO_PUBLIC_API_URL`, otherwise the Expo host on port 8083. In the browser that means `http://localhost:8083`.
- `types.ts` / `format.ts`: `StatutLivraison` + labels and colours (`STATUTS`). `ui.tsx`: `Bouton`, `Carte`, `Champ`, `Titre`, `PastilleStatut`, `EtatVide`, `Chargement`, `MessageErreur`, theme.
- `auth.tsx`: on web, tokens stay **in memory**, so reloading the page logs you out. That's fine for previews.

**Courier app (`mobile/mobile-livreur`)**: login, application, and one home screen (profile + assigned vehicle). No missions, availability or GPS.

**Backend**
- `Livraison` = Commande. `StatutLivraison { PENDING_PARTNER, EN_PREPARATION, AFFECTEE, EN_COURS, A_PROXIMITE, ARRIVEE, LIVREE, ECHEC, RETOURNEE }`. New orders are created as `PENDING_PARTNER` by `CommandeService.commander`, and **nothing changes the status after that**.
- No partner-facing order endpoint, no status history, no WebSocket, no QR, no courier–zone assignment.
- `CatalogueService.titulaire(email)` is the reusable "current validated partner" lookup (with lock + zone attach).
- Test style: full HTTP scenarios on H2 (`Sprint2ParcoursTest`), mocked `NotificationSender`.

**Web preview: not possible yet**
- `react-native-web` is not installed (`react-dom` is).
- The backend has **no CORS**. Expo web on `http://localhost:8081` calling `http://localhost:8083` will be blocked by the browser.
- Some native-only modules would fail in a browser: `@stripe/stripe-react-native` (leftover, to remove) and `react-native-webview` (Leaflet map in `CarteLeaflet.tsx`, used by address selection).

---

## Target order lifecycle (Sprint 2 bis part)

Codes **keep the existing code style** (decision 2026-11-04): existing values are reused, and new ones are added in the same French style. Labels live in `format.ts`.

```
PENDING_PARTNER ──accepter──► ACCEPTEE ──début prépa──► EN_PREPARATION ──prête──► PRETE ──affecter──► AFFECTEE ──scan──► RECUPEREE
      │                          │
      ├──refuser──► REFUSEE      └──annulation client──► ANNULEE
      └──annulation client──► ANNULEE
```

- New values: `ACCEPTEE`, `REFUSEE`, `PRETE`, `RECUPEREE`, `ANNULEE`. Reused: `PENDING_PARTNER`, `EN_PREPARATION`, `AFFECTEE`. The others (`EN_COURS`, `A_PROXIMITE`, `ARRIVEE`, `LIVREE`, `ECHEC`, `RETOURNEE`) are kept for Sprint 3+.
- One service `CommandeWorkflow.transition(commande, cible, acteur, motif)` holds the allowed-transition table, writes a `HistoriqueStatut` row (who, when, from → to, reason) and publishes a Spring event, which the real-time step hooks into later.
- Sprint 3 continues from `RECUPEREE` (→ `EN_COURS` → `LIVREE`, etc.).

---

## Steps

### Step 0 — Web preview + clean-up (foundation, no new feature)
1. Install the web dependencies with `npx expo install react-native-web @expo/metro-runtime` in `mobile/` (SDK-matched versions).
2. Backend **CORS for development only** (`dev`/`demo` profile): allow `http://localhost:8081` and `http://localhost:8082` on `/api/**`.
3. Remove Stripe and the old card/depot order flow (`ASSESSMENT.md` §4.3, group A + the CARTE UI branches). This also removes a module that can't run in a browser.
4. Add a web fallback for the map: `CarteLeaflet.web.tsx` rendering Leaflet in an `<iframe srcdoc>` (same HTML), so address selection works in the preview.
5. Start the backend with `APP_DEMO_ENABLED=true SPRING_PROFILES_ACTIVE=demo SPRINT2_DONNEES_DEMO=true` (demo zone, 2 shops, products, client), then `npx expo start --web` for the client app and open it in the browser pane.

**Demo checklist:** client logs in → orders from "Chez Amira" → order shows "En attente du partenaire". Partner `restaurant@sprint2.demo` logs in (second tab) → catalogue screen works.

### Step 1 — Partner app shell + incoming orders list (US-2B1, read part)
- **Backend:**
  - Add the new statuses (`ACCEPTEE`, `REFUSEE`, `PRETE`, `RECUPEREE`, `ANNULEE`; reuse `EN_PREPARATION`, `AFFECTEE`) + labels.
  - Add the `HistoriqueStatut` entity + `CommandeWorkflow` (transition table, history, event), with unit tests for allowed and forbidden transitions.
  - `GET /api/partenaire/commandes?statut=` (own orders only, newest first) and `GET /api/partenaire/commandes/{id}` (lines, notes, client first name, address label, history).
- **Mobile:**
  - Replace the single `catalogue-partenaire` screen with a partner tab group `src/app/(partenaire)/`: **Commandes · Catalogue · Profil** (Catalogue reuses `CataloguePartenaire`, Profil = shop info + open/close + logout).
  - Commandes tab: status filter chips (Nouvelles / En cours / Prêtes / Terminées), order cards, pull to refresh, detail screen `(partenaire)/commande/[id].tsx`.
  - Shared: `api.partenaireCommandes()`, `api.partenaireCommande(id)`, types, labels.
- **Demo checklist:** client places an order → partner Commandes tab shows it under "Nouvelles" with items, total, notes → detail opens. Another partner doesn't see it.

### Step 2 — Accept / refuse (US-2B2)
- **Backend:**
  - `PUT /api/partenaire/commandes/{id}/accepter` with `{tempsPreparationMinutes}`, which feeds step 3.
  - `PUT …/refuser` with `{motif: RUPTURE | FERMETURE | TROP_DE_COMMANDES | AUTRE, commentaire?}`. A comment is required for `AUTRE`.
  - Only from `PENDING_PARTNER`. Audit entry. Idempotent when repeated with the same action.
- **Mobile:**
  - Partner: Accept (prep-time picker: 5 / 10 / 15 / 20 / 30 / custom) and Refuse (reason sheet) on new orders.
  - Client: order detail shows "Acceptée — prête dans ~N min" or "Refusée : motif".
- **Demo checklist:**
  - Accept one order and refuse another with a reason, then check both on the client side.
  - Refusing an already-accepted order shows a clear error.

### Step 3 — Preparation time + ready (US-2B4, US-2B5)
- **Backend:**
  - Fields: `tempsPreparationMinutes`, `nbAjustementsPreparation`, `acceptedAt`, `preparationDebutAt`, `preteAt`.
  - `PUT …/preparation/debut` (ACCEPTEE → EN_PREPARATION).
  - `PUT …/preparation/temps` (adjust, **max 2 times**, then 409).
  - `PUT …/prete` (EN_PREPARATION → PRETE; also allowed from ACCEPTEE).
- **Mobile:**
  - Partner: "Commencer la préparation", "Ajuster le temps (N restants)", "Commande prête".
  - Client: timeline (from `HistoriqueStatut`) + estimated ready time.
- **Demo checklist:**
  - Accept → start → adjust twice → third adjustment refused → ready.
  - The client timeline shows each step with its time.

### Step 4 — Client cancellation (US-2B12)
- **Backend:** `PUT /api/commandes/{id}/annuler` (client owner, only `PENDING_PARTNER` / `ACCEPTEE`, optional reason). Cancelled orders stop counting toward the 3-active-orders limit.
- **Mobile:**
  - Client: "Annuler la commande" with confirmation, only while it's allowed.
  - Partner: the order moves to "Terminées" as "Annulée par le client".
- **Demo checklist:**
  - Cancel while pending ✅, and while accepted ✅.
  - Once in preparation, the button is hidden and the API returns 409.

### Step 5 — Real time: live order alerts (US-2B1, live part)
- **Backend:** Spring WebSocket + STOMP at `/ws`, JWT checked on CONNECT. `CommandeWorkflow` events are pushed to `/user/queue/commandes`, so partner, client and later courier each receive their own orders' changes.
- **Mobile (shared):**
  - `@stomp/stompjs` client hook `useCommandesTempsReel()` with automatic reconnect and token refresh.
  - Partner: new order → banner + sound (`expo-audio`, version per SDK docs) + list refresh.
  - Client: status updates live.
- **Background push** (when the app is closed) needs Expo push + a development build. Plan it with Sprint 3 notifications (US-304), not testable in web preview.
- **Demo checklist:** two tabs, client and partner. A new order appears on the partner side within ~1 s without a refresh, with sound after the first click (browser autoplay rule). Accepting updates the client tab live.

### Step 6 — Parcel QR (US-2B10)
- **Backend:**
  - When the order becomes `PRETE`, generate a random single-use pickup token (stored hashed, bound to the order, invalidated after use).
  - `GET /api/partenaire/commandes/{id}/qr` returns the payload.
- **Mobile:**
  - Partner: "QR du colis" screen (order code, items, QR via `react-native-qrcode-svg`, works on web).
  - "Imprimer / partager" via `expo-print` (on web: browser print dialog).
- **Demo checklist:** ready order → QR displayed → print preview opens. A non-ready order has no QR.

### Step 7 — Courier zone assignment (US-2B11), web-responsable
- **Backend:**
  - `AffectationZone` entity (`livreur`, `zone`, `type: PRINCIPALE | SECONDAIRE | TEMPORAIRE`, `debut`, `fin` for temporary).
  - Rule: one main zone per courier. CRUD under `/api/admin/livreurs/{id}/zones`. Audit.
- **Web:** "Zones" section in the courier detail of `web-responsable` (`pages/Livreurs.tsx`): add/remove, type, dates for temporary ones.
- **Demo checklist (Vite preview):** assign a main zone + a secondary one + a temporary one with an end date. A second main zone is refused.

### Step 8 — Courier availability + simple pickup missions (US-2B8)
- **Backend:**
  - `PUT /api/livreur/disponibilite` with `{disponible, latitude, longitude}`. Allowed only if the position is inside one of the courier's current zones (main/secondary/active temporary).
  - **Simple assignment:** when an order becomes `PRETE`, assign it to an available courier authorised on the partner's zone (main first, then secondary, then temporary; tie-break = fewest active missions). Status becomes `AFFECTEE`.
  - `GET /api/livreur/missions` (current missions with shop address and pickup code state). The Sprint 4 AI dispatch replaces this assignment logic later.
- **Mobile (`mobile-livreur`):**
  - Tabs **Missions · Profil**.
  - "Disponible" switch that reads the position (`expo-location`; on web, browser geolocation; out-of-zone shows a clear message).
  - Missions list + detail (shop, items count, client area).
- **Demo checklist:**
  - Courier goes available inside the demo zone ✅ (outside → refused).
  - Partner marks an order ready → it appears in the courier's Missions.
- Needs the courier app in web preview too (`npx expo start --web` in `mobile-livreur`, another port).

### Step 9 — Pickup scan (US-2B9)
- **Backend:** `POST /api/livreur/missions/{id}/collecte` with `{token}`. Must be the assigned courier and a valid, unused token. AFFECTEE → RECUPEREE, token consumed, history + live event.
- **Mobile:**
  - Courier: "Scanner le QR" (`expo-camera` barcode scanning on device) + **"Saisir le code"** fallback, which is also how it's tested in web preview.
  - Partner and client see "Récupérée" live.
- **Demo checklist:**
  - Scan/enter the code → picked up ✅.
  - Reusing the code ❌, another courier ❌, wrong code ❌.

### Step 10 — Sprint closure
- `docs/SPRINT2BIS.md` report (same format as `SPRINT1.md`/`SPRINT2.md`), `SPRINT_TRACKING.md` updated.
- Full test run, device pass on a real phone (Expo Go) for partner + client + courier.
- Sprint review with the PO.

---

## Notes and risks

- **Web preview ≠ device:** camera scanning, background push, haptics and native maps must be checked on a phone at step 10. Every native-only feature gets a web fallback (code entry, iframe map, browser print).
- **Expo SDK 58 APIs:** check each new Expo module against the SDK 58 docs before use (`mobile-client/AGENTS.md`), and install with `npx expo install`.
- **Order of steps:** 0 → 6 are partner/client and testable in one app. 7 is web back-office. 8–9 need the courier app.
- **Leftover legacy fields** (`creneau*`, `typeLivraison`…) stay until the clean-up migration, and new code doesn't use them.
- **Branching:** a single branch `sprint-2bis` from `corrections`, one commit per validated step, pushed once at the end of the sprint.

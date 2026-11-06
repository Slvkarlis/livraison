# Sprint 2 bis — Code changes per commit

What each commit changed, file by file. A new entry is added with every commit.
Branch `sprint-2bis`, starting from `corrections` @ `1962784`. Paths are shortened:

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

## `0d6d04a` docs: add sprint tracking, project assessment and Sprint 2 bis plan

- **A** `docs/SPRINT_TRACKING.md`: the 9 sprints and 72 user stories with their status, the decisions log, and what is left to close Sprint 2.
- **A** `docs/ASSESSMENT.md`: assessment of the project and code: strengths, security, architecture, leftover prototype code (§4.3), and recommendations.
- **A** `docs/SPRINT2BIS_PLAN.md`: the step-by-step plan, one commit message per step.

---

## `c1c700b` chore(sprint-2bis): remove Stripe and legacy order flow, enable Expo web preview

**Backend: removed**
- **D** `B/Controller/PaiementController.java`, `B/Service/PaiementService.java`, `B/Service/StripeService.java`, `B/Config/StripeProperties.java`, `B/Dto/PaiementConfigResponse.java`, `B/Dto/PaiementResponse.java`: Stripe card payment and its webhook.
- **D** `B/Service/TarificationService.java`, `B/Config/TarificationProperties.java`, `B/Config/DepotProperties.java`, `B/Dto/DevisRequest.java`, `B/Dto/DevisResponse.java`, `B/Dto/CreateLivraisonRequest.java`: the old depot / per-km quote and order creation.
- **D** `T/Service/PaiementServiceTest.java`, `T/Service/TarificationServiceTest.java`: their tests.
- **M** `backend/pom.xml`: removed the `stripe-java` dependency.
- **M** `backend/src/main/resources/application.properties`: removed the `app.depot.*`, `app.tarification.*` and `app.stripe.*` settings. Added `app.cors.origines` (env `CORS_ORIGINES`).

**Backend: modified**
- **M** `B/Controller/LivraisonController.java`: removed `POST /api/livraisons/devis` and `POST /api/livraisons`. Order creation is now only `POST /api/commandes`. The history and list reads are kept.
- **M** `B/Service/LivraisonService.java`: removed the old quote, slot and creation code.
- **M** `B/Repository/LivraisonRepository.java`: removed `findByStripePaymentIntentId`.
- **M** `B/Security/SecurityConfig.java`: removed the `/api/stripe/webhook` permitAll. Added CORS for the origins listed in `app.cors.origines`, so the Expo web preview can call the API.
- **M** `T/Sprint2ParcoursTest.java`: `ancienCodSansArticlesRefuse…` became `ancienneCommandeLisible`, since the old endpoint no longer exists.

**Client app**
- **D** `C/app/livraison-carte.tsx` (old card order screen, 488 lines) and `C/paiement.ts` (Stripe helper).
- **M** `C/app/_layout.tsx`: removed the `livraison-carte` route.
- **M** `C/app/commande/[id].tsx`: removed the "Payer par carte" block.
- **M** `C/app/(onglets)/index.tsx`: removed the "À payer" badge.
- **M** `C/composants/CarteLeaflet.tsx`: the Leaflet HTML moved out to `carteLeafletPage.ts`, and the component keeps only the WebView part.
- **A** `C/composants/carteLeafletPage.ts`: builds the Leaflet HTML page. Shared by phone and web.
- **A** `C/composants/CarteLeaflet.web.tsx`: web version of the map, the same page inside an `<iframe srcdoc>`.
- **M** `mobile/mobile-client/package.json` + `app.json`: removed `@stripe/stripe-react-native` and its plugin. Added `react-native-web`, `react-dom` and `@expo/metro-runtime` for the browser preview.

**Shared mobile**
- **M** `S/api.ts`: removed `devis`, `creerLivraison` and `paiementConfig`.
- **M** `S/types.ts`: removed the old order request type (`CreateLivraisonRequest`) and the card-payment / quote types.

**Other**
- **M** `README.md`: MySQL 8 with Docker on port 3307, PowerShell env vars, web preview command, cash on delivery only.
- **M** `mobile/package-lock.json`: dependency changes above.

---

## `dda63d6` feat(US-2B1): partner tabs, incoming orders list and order status history

**Backend**
- **M** `B/Model/enums/StatutLivraison.java`: added `ACCEPTEE`, `REFUSEE`, `PRETE`, `RECUPEREE` and `ANNULEE`, plus a comment describing the lifecycle.
- **A** `B/Model/HistoriqueStatut.java`: entity `historique_statut`. Each row records the order, `ancien` → `nouveau`, actor email + role, reason and date. Rows are never changed.
- **A** `B/Repository/HistoriqueStatutRepository.java`: `findAllByCommandeIdOrderByDateAscIdAsc`.
- **A** `B/Service/CommandeWorkflow.java`: the **only place where a status changes**. It holds the table of allowed transitions, and `creer()` / `transition()` write the history row and publish an event.
- **A** `B/Service/CommandeStatutChange.java`: the event record (order id, partner id, client id, from, to).
- **A** `B/Service/CommandePartenaireService.java`: `lister` and `detail` of the logged-in shop's orders. Another shop's order returns 404.
- **A** `B/Controller/CommandePartenaireController.java`: `GET /api/partenaire/commandes` and `GET /api/partenaire/commandes/{id}` (role PARTENAIRE).
- **A** `B/Dto/CommandePartenaireDto.java`: `CommandeResume`, `CommandeDetail` and `HistoriqueVue`.
- **M** `B/Service/CommandeService.java`: order creation goes through `workflow.creer`. The `ACTIVES` set gained the new active statuses.
- **M** `B/Repository/LivraisonRepository.java`: `findAllByPartenaireIdOrderByDateCreationDesc` and `…AndStatutIn…`.
- **M** `B/Repository/PartenaireRepository.java`: `findByEmail`.
- **A** `T/Service/CommandeWorkflowTest.java`: allowed and forbidden transitions, and history rows.
- **A** `T/Sprint2bisParcoursTest.java`: HTTP scenarios, starting with a partner seeing its orders and history, and orders hidden from other shops.

**Client app: partner screens**
- **D** `C/app/catalogue-partenaire.tsx`: replaced by the partner tabs.
- **A** `C/app/partenaire/_layout.tsx`: stack for the partner area.
- **A** `C/app/partenaire/(onglets)/_layout.tsx`: tabs **Commandes · Catalogue · Profil**.
- **A** `C/app/partenaire/(onglets)/index.tsx`, `catalogue.tsx`, `profil.tsx`, `C/app/partenaire/commande/[id].tsx`: one-line routes pointing to the components below.
- **A** `C/composants/partenaire/CommandesRecues.tsx`: order list with group filters (Nouvelles / En cours / Prêtes / Terminées) and pull to refresh.
- **A** `C/composants/partenaire/DetailCommandeRecue.tsx`: order detail with items, amounts and history.
- **A** `C/composants/partenaire/ProfilPartenaire.tsx`: shop info, open/close switch, logout.
- **M** `C/composants/CataloguePartenaire.tsx`: open/close and logout moved to Profil. The screen keeps only the products.
- **M** `C/app/_layout.tsx`: route `catalogue-partenaire` replaced by `partenaire`.
- **M** `C/app/(onglets)/_layout.tsx` and **A** `C/composants/couleurIcone.ts`: the tab-icon colour helper moved into its own file.

**Shared mobile**
- **A** `S/sprint2bis.ts`: types `CommandeResume` / `CommandeDetail` / `HistoriqueEntree`, `GROUPES_COMMANDES`, partner labels (`libelleStatutPartenaire`, `libelleEtapePartenaire`), and `creerApiPartenaire`.
- **M** `S/format.ts`: labels and colours for the 5 new statuses.
- **M** `S/types.ts`: `StatutLivraison` gets the new values.
- **M** `S/ui.tsx`: `PastilleStatut` takes an optional `libelle`, used for the partner wording.
- **M** `S/api.ts`, `S/index.ts`: export the partner API.
- **A** `scripts/sprint2bis.test.cjs`: tests for groups, labels and API routes.

**Web back-office**
- **M** `W/format.ts`, `W/types.ts`: the new statuses.

---

## `c84a3e1` feat(US-2B2): partner accepts or refuses orders with a reason

**Backend**
- **A** `B/Model/enums/MotifRefus.java`: `RUPTURE`, `FERMETURE`, `TROP_DE_COMMANDES`, `AUTRE`.
- **M** `B/Model/Livraison.java`: new fields `tempsPreparationMinutes`, `accepteeLe`, `motifRefus`, `commentaireRefus`.
- **M** `B/Service/CommandePartenaireService.java`: `accepter` (prep time 1–180 min) and `refuser` (a comment is required for `AUTRE`, max 300 characters). Only from `PENDING_PARTNER`. Repeating the same decision returns the same result.
- **M** `B/Controller/CommandePartenaireController.java`: `PUT …/{id}/accepter` and `PUT …/{id}/refuser`.
- **M** `B/Dto/CommandePartenaireDto.java`: `TempsPreparationRequest`, `RefusRequest`, and the new detail fields.
- **M** `B/Dto/LivraisonResponse.java`: the client sees the decision fields.
- **M** `B/Repository/LivraisonRepository.java`: `verrouiller(id)`, a pessimistic write lock on the order row.
- **M** `T/Sprint2bisParcoursTest.java`: accept, refuse with a reason, decision fixed once taken, only the order's own shop can decide.

**Client app**
- **A** `C/composants/partenaire/DecisionCommande.tsx`: accept (prep-time chips + custom value) and refuse (reason + comment).
- **A** `C/composants/partenaire/Puce.tsx`: small selectable chip.
- **M** `C/composants/partenaire/DetailCommandeRecue.tsx`: shows the decision block and the accepted/refused banners.
- **M** `C/composants/partenaire/CommandesRecues.tsx`: list refresh after a decision.
- **M** `C/app/commande/[id].tsx`: the client sees "accepté : prête vers HH:MM" or "a refusé : motif".

**Shared mobile**
- **M** `S/sprint2bis.ts`: `MOTIFS_REFUS`, `TEMPS_PREPARATION_PROPOSES`, `verifierTempsPreparation`, `verifierRefus`, `libelleMotifRefus`, `messageDecisionClient`, and `accepterCommande` / `refuserCommande` in the API.
- **M** `S/types.ts`: `MotifRefus`, and the decision fields on `Livraison`.
- **M** `scripts/sprint2bis.test.cjs`: validation and message tests.

---

## `ed9a051` feat(US-2B4, US-2B5): preparation time, adjustments and ready status

**Backend**
- **M** `B/Model/Livraison.java`: `pretePrevueLe`, `nbAjustementsPreparation`, `preparationDebutLe`, `preteLe`, plus helpers `heurePretePrevue()` and `ajustementsPreparation()`.
- **M** `B/Service/CommandePartenaireService.java`: `commencerPreparation` (`ACCEPTEE` → `EN_PREPARATION`), `ajusterPreparation` (max 2, then 409) and `marquerPrete` (from `ACCEPTEE` or `EN_PREPARATION`). `maintenant()` truncates to microseconds to match MySQL.
- **M** `B/Service/CommandeWorkflow.java`: `noter()` adds a history row without a status change ("Délai ajusté", `ancien = nouveau`).
- **M** `B/Controller/CommandePartenaireController.java`: `PUT …/preparation/debut`, `PUT …/preparation/temps` and `PUT …/prete`.
- **M** `B/Service/CommandeService.java` + `B/Controller/MarketplaceController.java`: `GET /api/commandes/{id}/historique` for the client who owns the order.
- **M** `B/Dto/CommandePartenaireDto.java`, `B/Dto/LivraisonResponse.java`: preparation fields.
- **M** `T/Sprint2bisParcoursTest.java`: adjustments limited to 2, ready straight after acceptance, the client sees only its own history.

**Client app**
- **A** `C/composants/partenaire/SuiviPreparation.tsx`: buttons "Commencer la préparation", "Ajuster le temps (N restants)" and "Commande prête".
- **A** `C/composants/FriseHistorique.tsx`: vertical timeline of the order's history.
- **M** `C/composants/partenaire/DetailCommandeRecue.tsx`: banner "À préparer pour HH:MM" and "Prête depuis HH:MM".
- **M** `C/app/commande/[id].tsx`: the client sees the timeline and the ready time.
- **M** `C/app/(onglets)/index.tsx`: the item count sums quantities.

**Shared mobile**
- **M** `S/sprint2bis.ts`: `AJUSTEMENTS_PREPARATION_MAX`, client step labels, preparation API calls, and `creerApiSuiviClient.historiqueCommande`.
- **M** `S/types.ts`, `S/api.ts`: preparation fields, and the client tracking API is exported.
- **M** `scripts/sprint2bis.test.cjs`: label and message tests.

---

## `c6816f0` feat(US-2B12): client cancels a pending or accepted order

**Backend**
- **M** `B/Model/Livraison.java`: `annuleeLe` and `motifAnnulation`.
- **M** `B/Service/CommandeService.java`: `annuler(email, id, AnnulationRequest)`. Only from `PENDING_PARTNER` or `ACCEPTEE`. It locks the client and then the order. The cancelled order no longer counts as active.
- **M** `B/Controller/MarketplaceController.java`: `PUT /api/commandes/{id}/annuler`.
- **M** `B/Dto/MarketplaceDto.java`: `AnnulationRequest(motif)`.
- **M** `B/Dto/LivraisonResponse.java`, `B/Dto/CommandePartenaireDto.java`: cancellation fields.
- **M** `T/Sprint2bisParcoursTest.java`: cancelling while pending works and is visible to the partner. Cancelling is refused once preparation has started. Only the client can cancel, and doing so frees an active-order slot.

**Client app**
- **A** `C/composants/AnnulationCommande.tsx`: "Annuler la commande" with confirmation and an optional reason.
- **M** `C/app/commande/[id].tsx`: shows the cancel button while allowed.
- **M** `C/composants/partenaire/DetailCommandeRecue.tsx`: banner "Annulée par le client à HH:MM · motif".

**Shared mobile**
- **M** `S/sprint2bis.ts`: `peutAnnuler`, `MOTIF_ANNULATION_MAX`, `annulerCommande`, and the cancelled message for the client.
- **M** `S/types.ts`: cancellation fields.
- **M** `scripts/sprint2bis.test.cjs`: tests for `peutAnnuler`.

---

## `b28dff9` feat(US-2B1): real-time order updates over WebSocket with sound alert

**Backend**
- **M** `backend/pom.xml`: `spring-boot-starter-websocket`.
- **A** `B/Config/WebSocketConfig.java`: STOMP endpoint `/ws`, simple broker, user destinations `/user/queue/...`.
- **A** `B/Security/AuthentificationStomp.java`: checks the JWT on `CONNECT`, allows subscribing only to your own `/user/queue/...`, and refuses `SEND`.
- **A** `B/Service/DiffusionTempsReel.java`: runs after the database commit and pushes the event to the partner and the client on `/user/queue/commandes`.
- **A** `B/Dto/EvenementCommande.java`: `{commandeId, ancien, nouveau}`.
- **M** `B/Service/CommandeStatutChange.java`, `B/Service/CommandeWorkflow.java`: the event also carries the partner and client emails.
- **M** `B/Security/SecurityConfig.java`: `/ws` is reachable without HTTP auth. The JWT is checked in STOMP instead.
- **M** `T/Service/CommandeWorkflowTest.java`: event content.
- **A** `T/Sprint2bisTempsReelTest.java`: real STOMP client. Partner and client receive updates, a connection without a token is refused, and subscribing to someone else's queue is refused.

**Client app**
- **A** `C/composants/partenaire/AlerteNouvelleCommande.tsx`: banner + sound (`expo-audio`) when a new order arrives.
- **A** `mobile/mobile-client/assets/nouvelle-commande.wav`: alert sound.
- **M** `C/app/_layout.tsx`: wraps the app in `TempsReelProvider`.
- **M** `C/app/partenaire/_layout.tsx`: shows the alert above every partner screen.
- **M** `C/composants/partenaire/CommandesRecues.tsx`, `DetailCommandeRecue.tsx`, `C/app/commande/[id].tsx`, `C/app/(onglets)/index.tsx`: reload when a live event arrives.
- **M** `mobile/mobile-client/package.json`: `expo-audio`.

**Shared mobile**
- **A** `S/tempsReel.tsx`: `TempsReelProvider` (STOMP client with automatic reconnect), `useEvenementsCommandes`, `useTempsReelConnecte`, `urlTempsReel` and `lireEvenement`.
- **M** `S/index.ts`: exports it.
- **M** `mobile/packages/shared/package.json`: `@stomp/stompjs`.
- **A** `scripts/tempsReel.test.cjs`: URL and event parsing.

---

## `15f3056` feat(US-2B10): single-use parcel QR code with print and share

**Backend**
- **A** `B/Service/CodeCollecte.java`: random 6-character code (no 0/O/1/I/L) and the QR content `FLEETPULSE|<order code>|<code>`.
- **M** `B/Model/Livraison.java`: `codeCollecte`.
- **M** `B/Service/CommandePartenaireService.java`: `marquerPrete` generates the code. `etiquette()` only works while `PRETE` or `AFFECTEE`.
- **M** `B/Controller/CommandePartenaireController.java`: `GET …/{id}/etiquette`.
- **M** `B/Dto/CommandePartenaireDto.java`: `EtiquetteColis`.
- **A** `T/Service/CodeCollecteTest.java`: 6 characters without ambiguous symbols, and QR content tied to the order.
- **M** `T/Sprint2bisParcoursTest.java`: the label exists only once the order is ready.

**Client app**
- **A** `C/app/partenaire/etiquette/[id].tsx`: route.
- **A** `C/composants/partenaire/etiquette/EcranEtiquette.tsx`: label screen with the QR, codes, client, item count and zone, plus print/share.
- **A** `C/composants/partenaire/etiquette/qrSvg.ts`: builds the QR as SVG (with `qrcode`).
- **A** `C/composants/partenaire/etiquette/etiquetteHtml.ts`: printable HTML of the label.
- **A** `C/composants/partenaire/etiquette/imprimerEtiquette.ts` (phone: `expo-print` PDF + share) and **A** `imprimerEtiquette.web.ts` (browser print dialog).
- **M** `C/app/partenaire/_layout.tsx`: label screen registered.
- **M** `C/composants/partenaire/DetailCommandeRecue.tsx`: "Étiquette du colis (QR)" button.
- **M** `mobile/mobile-client/package.json`: `expo-print`, `qrcode`, `react-native-svg` and `@types/qrcode`.

**Shared mobile**
- **M** `S/sprint2bis.ts`: `EtiquetteColis` type and `etiquetteColis()` API.
- **A** `scripts/etiquette.test.cjs`: label HTML and QR tests.

---

## `f4b9be0` fix(cors): restore back-office login through the Vite proxy

- **M** `B/Security/SecurityConfig.java`: CORS is turned on **only when `app.cors.origines` is set**. Before, an empty list made the back-office login fail with 403.
- **M** `web-responsable/vite.config.ts`: the `/api` proxy removes the `Origin` header (shared `relaisApi` for dev and preview).
- **A** `T/CorsNonConfigureTest.java`: without origins, a request carrying an Origin header still works.
- **A** `T/CorsConfigureTest.java`: with origins, allowed origins pass and others are refused.

---

## `2ac7f8d` feat(US-2B11): assign main, secondary and temporary zones to couriers

**Backend**
- **A** `B/Model/AffectationZone.java`: entity `affectation_zone` (courier, zone, type, `debut`, `fin`, `enVigueur(now)`).
- **A** `B/Model/enums/TypeAffectation.java`: `PRINCIPALE`, `SECONDAIRE`, `TEMPORAIRE`. The declaration order is also the priority order.
- **A** `B/Repository/AffectationZoneRepository.java`: queries by courier, zone and type, plus existence checks.
- **A** `B/Service/AffectationZoneService.java`:
  - lists, adds and removes a courier's zones;
  - one main zone per courier, no duplicate zone;
  - a temporary assignment needs a valid future period;
  - every change is audited.
- **A** `B/Controller/AffectationZoneController.java`: `GET/POST /api/admin/livreurs/{livreurId}/zones` and `DELETE …/{affectationId}` (ADMIN, OPERATIONS).
- **A** `B/Dto/AffectationZoneDto.java`: `AffectationRequest` and `AffectationVue`.
- **M** `B/Model/enums/ActionAudit.java`: `ZONE_LIVREUR_AFFECTEE` and `ZONE_LIVREUR_RETIREE`.
- **M** `B/Service/ZoneService.java`: a zone with couriers assigned can't be deleted (409).
- **M** `B/Service/AdminService.java`, `B/Dto/LivreurResponse.java`: the courier list shows `zonePrincipale`.
- **A** `T/Sprint2bisZonesLivreurTest.java`: one main zone and one assignment per zone, temporary period rules, access limited to responsables.

**Web back-office**
- **A** `W/composants/ZonesLivreur.tsx`: "Zones" dialog to list, add (type + dates) and remove.
- **M** `W/pages/Livreurs.tsx`: "Zone principale" column and a "Zones" button.
- **M** `W/pages/Audit.tsx`: labels for the two new audit actions.
- **M** `W/api.ts`, `W/types.ts`, `W/styles.css`: zone-assignment API, types and styles.

---

## `8deffca` feat(US-2B8): courier availability in authorised zones and simple mission assignment

**Backend**
- **M** `B/Model/Livreur.java`: `disponible`, `derniereLatitude` / `derniereLongitude`, `disponibiliteMiseAJourLe`, and `estDisponible()`.
- **M** `B/Model/Livraison.java`: `livreur` (ManyToOne) and `affecteeLe`.
- **A** `B/Service/EspaceLivreurService.java`:
  - `disponibilite` and `changerDisponibilite`: the position must be inside a zone currently in force, otherwise 409 with the zone names;
  - `missions` and `mission` (the logged-in courier's own only).
- **A** `B/Service/AffectationMissionService.java`:
  - `affecterSiPossible` picks main > secondary > temporary, then the courier with the fewest missions, max 3, with the order row locked;
  - `affecterCommandesEnAttente` runs when a courier becomes available.
- **A** `B/Controller/EspaceLivreurController.java`: `GET/PUT /api/livreur/disponibilite`, `GET /api/livreur/missions` and `GET /api/livreur/missions/{id}`.
- **A** `B/Dto/EspaceLivreurDto.java`: `DisponibiliteRequest`, `DisponibiliteVue`, `ZoneAutorisee` and `MissionVue`.
- **M** `B/Service/CommandePartenaireService.java`: `marquerPrete` calls `affecterSiPossible`.
- **M** `B/Service/CommandeWorkflow.java`, `B/Service/CommandeStatutChange.java`, `B/Service/DiffusionTempsReel.java`: the assigned courier also receives live events.
- **M** `B/Dto/CommandePartenaireDto.java`, `B/Dto/LivraisonResponse.java`: `livreurPrenom`.
- **M** `B/Repository/LivraisonRepository.java`: courier missions, mission count, and ready orders without a courier per zone.
- **M** `B/Repository/LivreurRepository.java`: `findByEmail`.
- **M** `B/Repository/AffectationZoneRepository.java`: `findAllByZoneId`.
- **M** `T/Service/CommandeWorkflowTest.java`: courier email on the event.
- **A** `T/Sprint2bisMissionsTest.java`: available only inside authorised zones, reinforcement only during its period, assignment to the zone's courier, main-zone priority and waiting orders, max 3 missions, courier-only access.

**Courier app**
- **R** `L/app/index.tsx` → `L/composants/ProfilLivreur.tsx`: the profile screen moved out of the routes folder.
- **A** `L/app/(onglets)/_layout.tsx`: tabs **Missions · Profil**.
- **A** `L/app/(onglets)/index.tsx`, `L/app/(onglets)/profil.tsx`, `L/app/mission/[id].tsx`: one-line routes.
- **M** `L/app/_layout.tsx`: `TempsReelProvider` + stack screens.
- **A** `L/composants/missions/EcranMissions.tsx`: availability card + mission list, reloaded on live events.
- **A** `L/composants/missions/CarteDisponibilite.tsx`: available/unavailable button, zones in force, demo positions.
- **A** `L/composants/missions/CarteMission.tsx`: one mission in the list.
- **A** `L/composants/missions/EcranMission.tsx`: mission detail (shop, directions link, order, cash to collect).
- **A** `L/composants/position.ts`: `positionActuelle()` (`expo-location`, 15 s timeout) and `POSITIONS_DEMO`.
- **M** `mobile/mobile-livreur/package.json` + `app.json`: `expo-location` (with a French permission text) plus the web-preview packages.

**Client app**
- **M** `C/composants/partenaire/DetailCommandeRecue.tsx`: banner "Livreur assigné : X".
- **D** `C/composants/couleurIcone.ts`: moved to shared `ui.tsx`. **M** `C/app/(onglets)/_layout.tsx` and `C/app/partenaire/(onglets)/_layout.tsx` import it from there.

**Shared mobile**
- **A** `S/espaceLivreur.ts`: types `Mission`, `Disponibilite` and `ZoneAutorisee`, plus `LIBELLES_AFFECTATION`, `zonesEnVigueur` and `creerApiLivreur`.
- **M** `S/ui.tsx`: `couleurIcone` moved here.
- **M** `S/parcours.tsx`: `useConfiguration()`, used to read demo mode.
- **M** `S/sprint2bis.ts`: client message for `AFFECTEE` ("X va récupérer votre commande").
- **M** `S/types.ts`, `S/api.ts`, `S/index.ts`: `livreurPrenom`, and the courier API is exported.
- **A** `scripts/espaceLivreur.test.cjs`: zones in force, API routes, client message.

---

## `5f7cd74` feat(US-2B9): courier confirms pickup by scanning the parcel QR

**Backend**
- **M** `B/Service/CodeCollecte.java`:
  - `lire(saisie, codeSuivi)` accepts a scanned QR or a typed code. It ignores case and spaces, and refuses another order's QR.
  - `correspond()` compares codes in constant time.
- **M** `B/Model/Livraison.java`: `recupereeLe`.
- **M** `B/Service/EspaceLivreurService.java`: `confirmerCollecte` locks the mission.
  - Wrong courier → 404. Not `AFFECTEE` → 409. Wrong code → 400.
  - Already `RECUPEREE` → returns the same mission.
  - Otherwise `AFFECTEE` → `RECUPEREE`, with the reason "Colis scanné à la boutique".
- **M** `B/Controller/EspaceLivreurController.java`: `POST /api/livreur/missions/{id}/collecte`.
- **M** `B/Dto/EspaceLivreurDto.java`: `CollecteRequest(code)`, and `MissionVue.recupereeLe`.
- **M** `B/Dto/LivraisonResponse.java`, `B/Dto/CommandePartenaireDto.java`: `recupereeLe`.
- **M** `T/Service/CodeCollecteTest.java`: reading QR or typed code, comparison.
- **M** `T/Sprint2bisMissionsTest.java`: `collecteParScanDuQrDuBonColis` and `collecteParSaisieManuelleDuCode`.

**Courier app**
- **A** `L/composants/missions/PanneauCollecte.tsx`: "Scanner le QR du colis" button, or type the code and press "Confirmer la collecte". Shows errors from the server.
- **A** `L/composants/missions/ScannerQr.tsx`: full-screen `expo-camera` QR scanner with a permission request. Only the first read counts.
- **M** `L/composants/missions/EcranMission.tsx`: shows the panel while `AFFECTEE`, and the banner "Colis récupéré à HH:MM" once picked up.
- **M** `L/composants/missions/CarteMission.tsx`: "récupérée à HH:MM" in the list. The screen-reader label no longer reads "chez Chez …".
- **M** `mobile/mobile-livreur/package.json` + `app.json`: `expo-camera` with a French camera permission text, and no microphone.

**Client app**
- **M** `C/composants/partenaire/DetailCommandeRecue.tsx`: banner "Récupérée par X à HH:MM".

**Shared mobile**
- **M** `S/espaceLivreur.ts`: `Mission.recupereeLe` and `confirmerCollecte(id, code)`.
- **M** `S/sprint2bis.ts`: client timeline step "Récupérée par le livreur" and message "X a récupéré votre commande".
- **M** `S/types.ts`: `Livraison.recupereeLe`.
- **M** `scripts/espaceLivreur.test.cjs`: pickup API route and client message.

---

## `807ba0c` docs(sprint-2bis): sprint report and tracking update

- **A** `docs/SPRINT2BIS.md`: sprint report covering delivered stories, lifecycle, API contracts, rules, schema, verification, demo and limits.
- **M** `docs/SPRINT_TRACKING.md`: Sprint 2 bis done (40 pts) with each user story's notes, Sprint 3 next, overall progress about 33 %, new test counts, change log.
- **M** `docs/ASSESSMENT.md`: A1 (no real-time channel) closed, and a note on what is left of the legacy code in §4.3.

---

## docs(sprint-2bis): per-commit change log; keep plan and assessment local

- **A** `docs/SPRINT2BIS_CHANGES.md`: this file, the exact per-file changes of every Sprint 2 bis commit.
- **M** `.gitignore`: ignores `docs/SPRINT2BIS_PLAN.md` and `docs/ASSESSMENT.md` (internal working docs).
- **D** `docs/SPRINT2BIS_PLAN.md`, `docs/ASSESSMENT.md`: removed from git only (`git rm --cached`). The files stay on disk, and earlier commits still contain them.
- **M** `docs/SPRINT2BIS.md`: the header links to this change log instead of the plan.

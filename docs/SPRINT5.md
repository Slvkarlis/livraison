# Sprint 5 — Financial chain

Branch `sprint-5` (from `sprint-4`), 2026-11-17. Files changed: [`SPRINT5_CHANGES.md`](SPRINT5_CHANGES.md).
Scope: 7 user stories, **40 points**. All 7 are implemented with unit and HTTP tests.

> **Verification status.** Like Sprint 4, this code was written without access to Maven Central: `mvnw test`, the mobile
> typecheck/lint, the Node tests and the web build **have not been run yet**. Every Java file passed a syntax check and
> the expected amounts in the tests were recomputed by hand. Run the checks below before merging.

## Delivered

| US | Behaviour | Main files |
|---|---|---|
| US-501 | At delivery (same transaction as the handover), the order is booked once: commission = items × rate, **net partner** = items − commission. Delivery fees stay with the platform. Default rate **12 %**. | `ComptabiliteService`, `FinanceCommande`, `CalculsFinanciers` |
| US-502 | FINANCE sets rates **global, per category, per partner**; the most specific one wins. The rate is frozen on each delivered order, so a change never rewrites the past. | `CommissionService`, `TauxCommission`, web *Finance › Commissions et barèmes* |
| US-503 | **Immutable ledger** (`@Immutable`, never updated, corrections by new entries): GMV, commission, net partner, delivery fee, courier cash, courier pay, collection gap; then cash deposit and deposit gap; then partner payout and courier payment. Compensation and refund types are reserved for Sprint 7 disputes. | `EcritureLedger`, `TypeEcriture`, `GET /api/admin/finance/ledger` |
| US-504 | The courier app gets a **Caisse** tab: cash to deposit, collected orders, deposit receipts, pay waiting for the next closing and weekly statements. Advice to deposit after 24 h. | `CaisseService.caisseDuLivreur`, app `EcranCaisse.tsx`, `finance.ts` |
| US-505 | FINANCE records the **full deposit** of a courier: all their collected orders are reconciled and a receipt `RC-2026-000042` is issued. A different amount is accepted only with a reason (shortage or surplus written to the ledger). Same idempotency key → same receipt. | `CaisseService.deposer`, `DepotCash`, web *Finance › Cash des livreurs* |
| US-506 | **Weekly closing** (Monday 00:00 → Monday, Tunis time), only once the week is over, once per week: one payout statement per partner, **only for orders whose cash is reconciled**. Orders still in a courier's hands are listed apart and carried to a later closing. | `ClosingService`, `Closing`, `ReleveReversement`, web *Finance › Closing hebdomadaire* |
| US-512 | **Pay scale per zone** (base per mission + price per km, default 3 DT + 0.5 DT/km), pay computed per mission at delivery (shop → client distance × 1.3), **weekly statement per courier** in the closing. | `BaremeService`, `BaremeZone`, `ReleveCoursier` |

## Money flow

```
Livraison (LIVREE)
  ├─ GMV 12,000 · COMMISSION 1,440 (12 %) · NET_PARTENAIRE 10,560 · FRAIS_LIVRAISON 3,000
  ├─ CASH_COURSIER 15,000 (encaissé) · REMUNERATION_COURSIER 4,000 · [ECART_ENCAISSEMENT]
Dépôt (FINANCE) ── DEPOT_CASH par commande · [ECART_DEPOT] ── reçu RC-AAAA-NNNNNN, commandes « rapprochées »
Closing (semaine terminée)
  ├─ REVERSEMENT_PARTENAIRE par commande rapprochée → relevé par partenaire
  └─ PAIEMENT_COURSIER par mission livrée → relevé par livreur
```

Amounts are in dinars with 3 decimals (millimes), rounded half up, all in `CalculsFinanciers`.

## API contracts

All `/api/admin/finance/**` routes require the FINANCE sub-role (or the main administrator).

| Route | Purpose |
|---|---|
| `GET` · `PUT /commissions` `{portee, categorie?, partenaireId?, taux}` · `DELETE /commissions/{id}` | Commission rates (US-502) |
| `GET /baremes` · `PUT /baremes/{zoneId}` `{base, parKm}` | Pay scale per zone (US-512) |
| `GET /ledger?commandeId&partenaireId&livreurId&type&depuis&limite` | Ledger entries, newest first |
| `GET /commandes/{id}` | Frozen amounts, receipt, closings and entries of an order |
| `GET /caisses` · `GET /caisses/{livreurId}` | Cash in circulation, per courier |
| `POST /depots` `{livreurId, montantRecu, motifEcart?, cleIdempotence}` → 201 | Full deposit and receipt |
| `GET /depots?livreurId` · `GET /depots/{id}` | Receipts |
| `GET /closings/apercu?semaine=2026-11-16` | Preview (nothing saved) |
| `POST /closings` `{semaine}` → 201 · `GET /closings` · `GET /closings/{id}` | Validate and read closings |
| `GET /api/livreur/caisse` (LIVREUR) | Courier cash, receipts, pending pay, statements |

New audit actions: `COMMISSION_MODIFIEE`, `COMMISSION_SUPPRIMEE`, `BAREME_MODIFIE`, `DEPOT_CASH_ENREGISTRE`, `CLOSING_VALIDE`.

## Rules worth knowing

- **Idempotent and atomic.** The booking runs inside the handover transaction (synchronous listener): no delivered order without its entries. A replay never books twice (`finance_commande.commande_id` is unique). Deposits use an idempotency key; closings are unique per week and run in a serializable transaction; two deposits for the same courier are serialised by a lock on the courier.
- **Nothing is paid twice.** An order is marked by its deposit, its partner payout and its courier payment.
- **Rates and pay scales apply to future deliveries only.**
- **Closing timing.** A week can only be closed once it is over; orders delivered earlier but not yet closed are included (carry-over).

## Schema

New tables (`ddl-auto=update`): `finance_commande`, `ecriture_ledger`, `taux_commission`, `bareme_zone`, `depot_cash`, `closing`, `releve_reversement`, `releve_coursier`.

## Tests added

- **Unit:** `CalculsFinanciersTest` (4), `CommissionServiceTest` (4), `BaremeServiceTest` (3), `ComptabiliteServiceTest` (5), `CaisseServiceTest` (5),
  `ClosingServiceTest` (3); controllers `FinanceControllerTest` (4), `CaisseLivreurControllerTest` (1).
- **HTTP (`@SpringBootTest`, H2):** `Sprint5FinanceTest` (2): two deliveries (12 % then a partner rate of 10 %), courier cash, deposit with a refused gap,
  receipt and replay, closing of the previous week with payout and pay statements, ledger entries; access limited to FINANCE.
- **Node:** `scripts/finance.test.cjs` (3).

## Verification to run

```powershell
cd backend; .\mvnw.cmd -B -ntp test; cd ..
npm.cmd run typecheck --prefix mobile; npm.cmd run lint --prefix mobile
node --test scripts/*.test.cjs
npm.cmd run build --prefix web-responsable
```

Demo: deliver two orders with one courier → *Finance › Cash des livreurs* shows 30 DT → record the deposit → receipt in the
courier's *Caisse* tab → *Closing hebdomadaire* of a finished week → statements per partner and courier.

## Limits

- No partner screen for payout statements yet (the data is in `releve_reversement`); the BI finance dashboard is Sprint 6.
- Payouts and courier payments are recorded, not executed (no bank or wallet integration).
- Refunds and compensations (ledger types already defined) arrive with disputes in Sprint 7.

# Sprint 5 — Code changes per commit

Branch `sprint-5`, starting from `sprint-4`. Short paths as in [`SPRINT4_CHANGES.md`](SPRINT4_CHANGES.md)
(`B/` backend main, `T/` backend tests, `S/` shared mobile, `L/` courier app, `W/` back-office).
Markers: **A** added · **M** modified.

---

## feat(US-501..US-506, US-512): financial chain with commissions, ledger, cash deposits, weekly closing and courier pay

**Model and persistence**
- **A** `B/Model/FinanceCommande.java`: per-order frozen amounts (items, rate, commission, net, fees, cash, gap, pay, distance) and links to deposit and closings; unique per order.
- **A** `B/Model/EcritureLedger.java` (immutable), `B/Model/enums/TypeEcriture.java`.
- **A** `B/Model/TauxCommission.java`, `B/Model/enums/PorteeCommission.java`.
- **A** `B/Model/BaremeZone.java`.
- **A** `B/Model/DepotCash.java`, `B/Model/enums/StatutDepot.java`.
- **A** `B/Model/Closing.java`, `B/Model/ReleveReversement.java`, `B/Model/ReleveCoursier.java`.
- **M** `B/Model/enums/ActionAudit.java`: five finance actions.
- **A** `B/Repository/FinanceCommandeRepository.java`, `EcritureLedgerRepository.java`, `TauxCommissionRepository.java`, `BaremeZoneRepository.java`, `DepotCashRepository.java`, `ClosingRepository.java`, `ReleveReversementRepository.java`, `ReleveCoursierRepository.java`.
- **M** `B/Repository/LivreurRepository.java`: pessimistic lock on a courier (deposits).

**Services**
- **A** `B/Service/CalculsFinanciers.java`: commission, net, pay, closing week, receipt number, input checks.
- **A** `B/Service/CommissionService.java` (US-502), `B/Service/BaremeService.java` (US-512).
- **A** `B/Service/ComptabiliteService.java` (US-501, US-503): booking at delivery (synchronous listener), ledger queries, order detail.
- **A** `B/Service/CaisseService.java` (US-504, US-505): balances, deposit with receipt and reconciliation, courier view.
- **A** `B/Service/ClosingService.java` (US-506, US-512): preview, validation, statements, ledger payouts.

**API**
- **A** `B/Controller/FinanceController.java`: `/api/admin/finance/**` (FINANCE).
- **A** `B/Controller/CaisseLivreurController.java`: `GET /api/livreur/caisse`.
- **A** `B/Dto/FinanceDto.java`.
- **M** `B/Config/OpenApiConfig.java`: version sprint-5, 409 on finance routes, parameter descriptions.

**Tests**
- **A** `T/Service/CalculsFinanciersTest.java`, `CommissionServiceTest.java`, `BaremeServiceTest.java`, `ComptabiliteServiceTest.java`, `CaisseServiceTest.java`, `ClosingServiceTest.java`.
- **A** `T/Controller/FinanceControllerTest.java`, `CaisseLivreurControllerTest.java`.
- **A** `T/Sprint5FinanceTest.java`.

**Courier app**
- **A** `S/finance.ts`: cash types, deposit advice, week label, API. **M** `S/api.ts`, `S/index.ts`.
- **A** `L/app/(onglets)/caisse.tsx`, `L/composants/caisse/EcranCaisse.tsx`; **M** `L/app/(onglets)/_layout.tsx` (Caisse tab).

**Back-office**
- **A** `W/pages/Finance.tsx`: cash in circulation and deposit form, weekly closing (preview, validation, history), commissions and pay scales, ledger.
- **M** `S/sprint1.ts`: `peutFinance()`; **M** `W/App.tsx`, `W/composants/Layout.tsx` (Finance page for FINANCE and the main admin), `W/api.ts`, `W/types.ts`, `W/pages/Audit.tsx`.

**Scripts**
- **A** `scripts/finance.test.cjs`.

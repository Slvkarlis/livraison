# Sprint plan — how we run a sprint

The structure every sprint follows, from planning to push. Sprint 2 bis was run this way.
To start a sprint, copy the [template](#template-sprintn_planmd) below into `docs/SPRINT<N>_PLAN.md` and fill it in.

## Documents per sprint

| File | When | Content |
|---|---|---|
| `docs/SPRINT<N>_PLAN.md` | Before coding | Scope, exploration of the existing code, target design, steps with commit messages and demo checklists. |
| `docs/SPRINT<N>_CHANGES.md` | With every commit | For each commit, the exact list of files: **A** added · **M** modified · **D** deleted · **R** renamed, with what changed in each. Example: [`SPRINT2BIS_CHANGES.md`](SPRINT2BIS_CHANGES.md). |
| `docs/SPRINT<N>.md` | Last step | Sprint report: delivered stories, lifecycle/model, API contracts, rules, schema, verification, demo, limits. Example: [`SPRINT2BIS.md`](SPRINT2BIS.md). |
| `docs/SPRINT_TRACKING.md` | Last step | Story statuses, points done, decisions, change log. |

## How we work

1. **One step at a time.** Each step is small enough to demo on its own and ends with:
   1. automated checks (below);
   2. a demo in the **browser preview** (Expo web for the mobile apps, Vite for the back-office), following the step's checklist;
   3. **validation by the PO / lead before the next step starts.**
2. **One commit per validated step**, on the sprint branch `sprint-<n>`. Only commit after validation.
3. Commits are authored by the developer's own git identity, with no co-author line.
4. Every commit adds its entry to `docs/SPRINT<N>_CHANGES.md`.
5. **Push only when agreed**, usually at the end of the sprint. Never push to `main` or `corrections` directly.
6. Code must be **readable**: small components and services, names in the domain language (French, like the existing code), short comments explaining *why*. One place per rule. For example, every status change goes through `CommandeWorkflow`.

### Commit messages

[Conventional Commits](https://www.conventionalcommits.org/), with the user story in the scope:

| Type | Use | Example |
|---|---|---|
| `feat(US-xxx)` | A user story, or part of one | `feat(US-2B9): courier confirms pickup by scanning the parcel QR` |
| `fix(area)` | A bug fix, ideally with a regression test | `fix(cors): restore back-office login through the Vite proxy` |
| `chore(sprint-<n>)` | Clean-up or setup with no new feature | `chore(sprint-2bis): remove Stripe and legacy order flow, enable Expo web preview` |
| `docs(sprint-<n>)` | Documentation only | `docs(sprint-2bis): sprint report and tracking update` |

### Checks for every step

Run from the repository root (Java 25 in `JAVA_HOME`):

```powershell
cd backend; .\mvnw.cmd -B -ntp test; cd ..       # backend: new tests for the step + all existing tests green
npm.cmd run typecheck --prefix mobile             # mobile + shared TypeScript
npm.cmd run lint --prefix mobile                  # ESLint, no warnings
node --test scripts/*.test.cjs                    # shared mobile logic
npm.cmd run build --prefix web-responsable        # when the back-office is touched
```

Each step adds tests close to what it changes:
- Backend: HTTP scenarios (`Sprint<N>…Test`, `@SpringBootTest` on H2) for the user-visible behaviour, plus unit tests for pure rules.
- Shared mobile logic: `scripts/<topic>.test.cjs`.

### Mobile rules

- Expo SDK changes often: check the **versioned docs** of the installed SDK before using an Expo API. Install packages with `npx expo install`, never `npm install` (see `mobile/*/AGENTS.md`).
- Routes in `src/app/` are one-line re-exports. Screens and logic live in `src/composants/`. Code used by both apps goes in `mobile/packages/shared`.
- Every native-only feature gets a **web fallback**, so it can be demoed in the preview. Examples: camera scan → typed code, print → browser print dialog, native map → iframe. The real device is checked at the end of the sprint.

---

## Template: `SPRINT<N>_PLAN.md`

````markdown
# Sprint <N> — <theme> — Implementation plan

Scope: <list of US with points> (<total> pts). Descoped: <US + reason, or "none">.
Decisions applied: <decisions from SPRINT_TRACKING.md that affect this sprint>.
Branch: `sprint-<n>` from `<base branch>`.

| Step | Commit message |
|---|---|
| 0 | `chore(sprint-<n>): <setup / clean-up needed first>` |
| 1 | `feat(US-xxx): <what the user can now do>` |
| … | … |
| last | `docs(sprint-<n>): sprint report and tracking update` |

---

## What exists today

What the code already has for this sprint, found by reading it, per area:
- **Backend:** entities, services, endpoints that can be reused; what is missing.
- **Mobile (client / partner / courier):** screens and shared helpers that can be reused.
- **Web back-office:** pages involved.
- **Gaps / risks found:** anything that blocks a step or needs a decision first.

## Target design

The model or lifecycle this sprint adds (diagram if useful), new statuses or entities,
and the single place where each new rule will live.

## Steps

### Step <k> — <title> (US-xxx)
- **Backend:** entities/fields, service rules, endpoints (method, path, body, who may call it, error cases).
- **Mobile:** screens/components per app, shared helpers.
- **Web:** pages/components, if any.
- **Tests:** scenarios to add.
- **Demo checklist:** the clicks in the browser preview that prove the step works,
  including at least one refusal (wrong role, wrong state, invalid input).

### Last step — Sprint closure
- `docs/SPRINT<N>.md` report and `SPRINT_TRACKING.md` updated.
- Full test run, then a device pass on a real phone (Expo Go) for every app touched.
- Sprint review with the PO, then push.

## Notes and risks

What can't be checked in the browser preview, dependencies between steps, legacy code
that new code must not use, and anything left for a later sprint.
````

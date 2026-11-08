# Testing Strategy & Verification

## Test Layers

### 1. Backend Unit & API Integration Tests (`server/tests/`)
Executed with **Vitest + Supertest + `mongodb-memory-server`**:
- `server/tests/conflict.test.js` (8 unit tests):
  - No overlap, partial overlap, fully contained overlap, identical time range, touching endpoints, cancelled activity exclusion, overnight midnight-spanning activity, self-update exclusion.
- `server/tests/expense.test.js` (6 unit tests):
  - Deterministic `₹100.00 / 3` integer paise remainder split (`3334 + 3333 + 3333`), custom split validation & mismatch rejection, invalid/negative/outside-participant rejection, paid-only settlement generation (`A paid 1200, B paid 600 -> C pays A 600` while excluding planned expenses), What-If Budget Simulator non-mutation, zero-sum balance invariant.
- `server/tests/api.test.js` (19 integration tests):
  - Health endpoint, registration/login/logout, `httpOnly` cookies, duplicate email `409`, invalid credentials `401`, untrusted `Origin` `403`, trip creation & `endDate < startDate` rejection, cross-trip outsider denial `403`, malformed ObjectId `400`, SHA-256 hashed invitation acceptance & token reuse denial `409`, owner-only delete/settings enforcement, activity overlap detection & resolution, booking safe URL validation, task member validation, expense CRUD, member removal ledger guard `409`, and expense deletion unlinking.

### 2. Frontend Component & Route Tests (`client/src/__tests__/app.test.jsx`)
Executed with **Vitest + React Testing Library + `jsdom`**:
- Protected route redirection to `/login` when unauthenticated
- Login form validation error rendering
- Empty state rendering on `MyTripsPage`
- Error state rendering on API failure
- Conflict alert banner & `Adjust Time` rendering in `ItineraryPage`
- Per-person cost table and settlement transfer rendering in `ExpensesPage`

### 3. Full Browser End-to-End Tests (`tests/e2e/tripsplit.spec.js`)
Executed with **Playwright** against the compiled production React bundle served by Express with an isolated `MongoMemoryServer`:
- Covers all 14 required flows across three independent browser contexts (Owner, Collaborator, Outsider) plus `375x812` mobile viewport responsiveness and zero browser console error verification.

## Commands

```bash
npm run lint
npm test
npm run build
npm run test:e2e
```

# Security upgrade verification and live walkthrough

Use Node 24 LTS (or another version supported by the root `engines` field).
The security release upgrades Zod, React Router, the form resolver, and Vitest.

```bash
npm ci --include=dev
npm run lint
npm run build
npm test
npm audit
npm run test:e2e
```

`npm test` always uses isolated MongoDB in test mode, even if a developer's
environment contains an Atlas URI. Do not run production seeds.

For the deployed application, explicit authorization is required because the
browser suite creates three disposable accounts and a test trip, and exercises
deletion only on its own newly created expense. It does not reset databases.

PowerShell:

```powershell
$env:PLAYWRIGHT_BASE_URL = 'https://tripsplit-planner.onrender.com'
$env:PLAYWRIGHT_ALLOW_LIVE = '1'
npx playwright test
Remove-Item Env:PLAYWRIGHT_BASE_URL
Remove-Item Env:PLAYWRIGHT_ALLOW_LIVE
```

Live traces are disabled to avoid recording cookies and invitation tokens.
Passwords are randomly generated per run. Test trips are prefixed
`DISPOSABLE CIA-2 Browser QA`. The 14 serial cases cover authenticated desktop
flows plus all seven workspace tabs at 375px and 768px widths. They are separate
named cases sharing one scenario; later cases depend on earlier setup.

The default browser is installed Chrome. Runners may set
`PLAYWRIGHT_CHANNEL=chromium` for an installed Playwright Chromium or
`PLAYWRIGHT_EXECUTABLE_PATH` for an official compatible Chrome/headless-shell
executable. These options never change the production service.

---


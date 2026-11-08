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


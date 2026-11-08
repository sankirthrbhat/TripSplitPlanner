# TripSplit Planner — Independent Pre-Submission Audit Report (CIA-2)

- **Audit Date:** 2026-11-08
- **Repository:** `TripSplitPlanner` (MERN Workspaces Monorepo: `client/`, `server/`, `tests/e2e/`)
- **Original Baseline Commit (`master` & tag `pre-audit-checkpoint`):** `cd405e9`
- **Audited & Fixed Branch:** `audit/pre-submission-fixes` (`d7b2d37`)
- **Runtime Environment Verified:** Windows 11, Node.js `v24.21.0`, Google Chrome (via Playwright `channel: 'chrome'`)
- **Live Cloud Deployment Status:** **Not deployed yet (no live Render URL exists).** All production build, startup, security, and routing checks were verified via local production simulation (`NODE_ENV=production`). Live Render + MongoDB Atlas verification remains pending actual cloud deployment.

---

## 1. Executive Summary & Audit Verdict

An independent, code-first audit was conducted across the full **TripSplit Planner** MERN codebase, database layer, financial and scheduling engines, automated test suites, Git history, and Render deployment configuration.

### Key Conclusions
1. **All 13 University CIA-2 requirements are genuinely implemented** in working React and Node.js/Express/MongoDB code—none are stubbed, mocked, or documentation-only claims.
2. **Core differentiating algorithms are mathematically sound:**
   - **Financial Engine ([`expense.service.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/services/expense.service.js)):** Stores all currency values in integer paise (`1 INR = 100 paise`), sorts participant IDs lexicographically for deterministic equal-split remainder distribution (`₹100.00 / 3 → 3334, 3333, 3333` paise), validates custom splits (`sum === amountMinor`), separates planned estimates from paid expenses, prevents double-counting between Bookings/Activities and Expenses via single-ledger `linkedExpenseId` references, and verified `sum(netBalanceMinor) === 0` across 600 randomized equal-split cases and 400 randomized multi-expense ledgers.
   - **Conflict Detection Engine ([`conflict.service.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/services/conflict.service.js)):** Compares UTC intervals (`startA < endB && startB < endA`), ignores `cancelled` activities, allows touching endpoints (`endA === startB`), and formats conflict explanations in the trip's IANA timezone across multi-day and overnight spans.
3. **Seven real defects (1 P0, 5 P1, 1 P2) were reproduced, fixed on `audit/pre-submission-fixes`, and covered by regression tests:**
   - **BUG-01 (P0 — Deployment):** `render.yaml` set `NODE_ENV=production`, causing `npm ci` to omit `devDependencies` (`vite`, `tailwindcss`, `postcss`, `autoprefixer`) and fail `npm run build` (`'vite' is not recognized`). Fixed in `41a88f9`.
   - **BUG-02 (P1 — API Routing):** Unknown `/api/*` paths returned Express default HTML (or SPA `index.html` in production) instead of JSON `404` because `notFoundHandler` checked `req.path.startsWith('/api')` after `app.use('/api', ...)` stripped `/api`. Fixed in `e2040d0`.
   - **BUG-03 (P1 — Concurrency / Security):** Concurrent `POST /api/invitations/:token/accept` requests bypassed single-use invitation enforcement via a non-atomic read-modify-save race. Fixed with atomic `findOneAndUpdate` in `e2040d0`.
   - **BUG-04 (P1 — Database Durability):** Embedded persistent MongoDB (`.data/mongodb`) terminated `mongod` on shutdown without running `{ fsync: 1 }`, losing recent writes in 5 of 8 restarts (and leaving the repo's own `.data/mongodb` with 4 users but 0 trips/expenses). Fixed in `a6fa6ed`.
   - **BUG-05 (P1 — Seed Reliability & Safety):** `npm run seed:demo` silently fell back to a throwaway in-memory database when `.data/mongodb` was locked by `npm run dev` (printing success while persisting nothing) and lacked a remote-host guard when `NODE_ENV !== 'production'`. Fixed in `a6fa6ed`.
   - **BUG-06 (P1 — Responsive UI & E2E Coverage):** The Playwright suite had only 1 monolithic `test()` block ("1 passed" while claiming 14 browser flows), skipped explicit task-assignee selection and custom-split E2E assertions, and only checked mobile overflow on the Overview page—hiding a **78px horizontal overflow** on `/trips/:tripId/expenses` at `375x812` caused by missing `min-w-0` on CSS Grid cards. Fixed in `d7b2d37`.
   - **BUG-07 (P2 — Error Handling):** Payloads exceeding the `100kb` JSON limit returned `500 INTERNAL_SERVER_ERROR` instead of `413 PAYLOAD_TOO_LARGE`. Fixed in `e2040d0`.

---

## 2. University CIA-2 Requirement-by-Requirement Coverage Matrix

| # | CIA-2 Requirement | Status | Actual Implementation Evidence (Frontend + Backend) | Automated Test Verification |
| :- | :--- | :--- | :--- | :--- |
| **1** | **React frontend** | **VERIFIED** | React 18 + Vite 7 SPA in [`client/src/App.jsx`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/client/src/App.jsx), 13 pages in [`client/src/pages/`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/client/src/pages), 3 layouts in [`client/src/layouts/`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/client/src/layouts), React Router v6, TanStack Query v5, React Hook Form + Zod. | `client/src/__tests__/app.test.jsx` (6 tests), `audit.format.test.js` (42 tests), `tripsplit.spec.js` (14 E2E tests). |
| **2** | **Node.js + Express REST API** | **VERIFIED** | Express 4 app in [`server/src/app.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/app.js) mounting 28 REST endpoints under `/api` via [`server/src/routes/index.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/routes/index.js), [`auth.routes.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/routes/auth.routes.js), [`trip.routes.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/routes/trip.routes.js), and [`invitation.routes.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/routes/invitation.routes.js). | `server/tests/api.test.js` (19 tests) + `server/tests/audit.test.js` (44 tests). |
| **3** | **MongoDB persistence** | **VERIFIED** | 7 Mongoose models ([`User`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/models/User.model.js), [`Trip`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/models/Trip.model.js), [`Invitation`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/models/Invitation.model.js), [`Activity`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/models/Activity.model.js), [`Booking`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/models/Booking.model.js), [`Task`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/models/Task.model.js), [`Expense`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/models/Expense.model.js)) with compound indexes; connection manager in [`server/src/config/db.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/config/db.js). | Verified across 15 consecutive process restarts (`0/15` data loss after `fsync` fix) and E2E reload tests. |
| **4** | **Shared trip planning** | **VERIFIED** | Multi-member workspace with owner/member roles, 7-day SHA-256 hashed invitation links ([`invitation.controller.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/controllers/invitation.controller.js)), and Trip Pulse readiness score ([`pulse.service.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/services/pulse.service.js)). | E2E Tests 04, 06, 07, 13; `api.test.js` #6–#11; `audit.test.js` atomic invite race test. |
| **5** | **Itinerary management** | **VERIFIED** | Full CRUD in [`activity.controller.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/controllers/activity.controller.js) and [`ItineraryPage.jsx`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/client/src/pages/ItineraryPage.jsx) with day/status/category filters, participant tags, and optional linked planned cost. | E2E Tests 05 & 13; `api.test.js` #12–#13; `audit.test.js` activity CRUD & filter tests. |
| **6** | **Booking management** | **VERIFIED** | Full CRUD in [`booking.controller.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/controllers/booking.controller.js) and [`BookingsPage.jsx`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/client/src/pages/BookingsPage.jsx) with vendor, reference number, safe URL validation, and single-ledger expense linking. | E2E Test 09; `api.test.js` #14; `audit.test.js` single-ledger booking-expense test. |
| **7** | **Responsibility management** | **VERIFIED** | Full CRUD in [`task.controller.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/controllers/task.controller.js) and [`TasksPage.jsx`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/client/src/pages/TasksPage.jsx) with trip-member assignee validation, priority/status filters, and completion progress bar. | E2E Test 08 (explicit assignee selection + completion); `api.test.js` #15. |
| **8** | **Shared expense calculations** | **VERIFIED** | Equal & custom splitting in integer paise ([`expense.service.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/services/expense.service.js), [`ExpensesPage.jsx`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/client/src/pages/ExpensesPage.jsx)) plus greedy debtor-to-creditor paid-only settlement engine. | E2E Tests 10, 11, 12; `expense.test.js` (6 tests); `audit.test.js` (600 equal-split + 400 settlement property tests). |
| **9** | **Estimated per-person costs** | **VERIFIED** | Computes `plannedShareMinor`, `paidShareMinor`, `estimatedTotalMinor`, `totalPaidOutMinor`, and `netBalanceMinor` per member + non-mutating What-If Simulator. | E2E Tests 11 & 12; `expense.test.js` #4–#5; `app.test.jsx` #6. |
| **10** | **Overlapping activity detection** | **VERIFIED** | Pairwise UTC interval comparison in [`conflict.service.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/services/conflict.service.js), amber alert banner & `Adjust Time` modal flow in [`ItineraryPage.jsx`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/client/src/pages/ItineraryPage.jsx). | E2E Tests 05 & 13; `conflict.test.js` (8 tests); `audit.test.js` timezone/overnight tests. |
| **11** | **Input validation** | **VERIFIED** | Server-side Zod body/query schemas in [`server/src/validators/`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/validators) via [`validate.middleware.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/middleware/validate.middleware.js) + client-side Zod + React Hook Form validation. | E2E Tests 01, 04, 10; `api.test.js` #7, #9, #14, #15, #17; `audit.test.js`. |
| **12** | **Error handling** | **VERIFIED** | Centralized [`error.middleware.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/middleware/error.middleware.js) normalizing `AppError`, `ZodError`, Mongoose `11000`/`CastError`/`ValidationError`, malformed JSON (`400`), oversized payload (`413`), and unknown `/api/*` (`404`) into `{ success: false, error: { code, message } }`. | `audit.test.js` (malformed JSON, 413 payload, API 404 JSON, no stack trace leaks); `app.test.jsx` #4. |
| **13** | **Responsive UI** | **VERIFIED** | Mobile navigation drawer in [`AppShellLayout.jsx`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/client/src/layouts/AppShellLayout.jsx), scrollable section tabs in [`TripWorkspaceLayout.jsx`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/client/src/layouts/TripWorkspaceLayout.jsx), and `min-w-0` + `overflow-x-auto` containers in [`Card.jsx`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/client/src/components/ui/Card.jsx). | E2E Test 14 verifies `scrollWidth - innerWidth <= 4` at `375x812` across Overview, Itinerary, Bookings, Tasks, Expenses, and Members. |

---

## 3. Detailed Audit Findings by Priority Area

### 3.1 Authentication & Authorization (Audit Priority 2)
- **Password Hashing:** [`User.model.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/models/User.model.js#L26-L38) stores `passwordHash` with `select: false`, hashes passwords using ` bcrypt.hash(plainPassword, 10)`, and strips `passwordHash` in `toJSON`. Verified in `audit.test.js` that `passwordHash` never appears in API responses and starts with `$2a$10$` or `$2b$10$` in MongoDB.
- **JWT Cookie Handling:** [`tokens.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/utils/tokens.js#L24-L33) sets `tripsplit_token` with `httpOnly: true`, `sameSite: 'lax'`, `path: '/'`, and `secure: env.NODE_ENV === 'production'`. Verified in real Chrome (E2E Test 02) that `window.localStorage` and `window.sessionStorage` are completely empty (`[]`) and `document.cookie` cannot read `tripsplit_token`.
- **Session Persistence & Logout:** `GET /api/auth/me` restores the user session across browser reloads (E2E Test 13). `POST /api/auth/logout` clears `tripsplit_token` and [`useAuth.jsx`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/client/src/hooks/useAuth.jsx#L43-L50) purges cached trip queries (E2E Test 03).
- **Cross-Trip & Role Authorization:** [`tripAccess.middleware.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/middleware/tripAccess.middleware.js) enforces `requireTripMember` (`403 FORBIDDEN_TRIP_ACCESS` for non-members) on all `/api/trips/:tripId/*` routes and `requireTripOwner` (`403 OWNER_REQUIRED`) on `PATCH /api/trips/:tripId`, `DELETE /api/trips/:tripId`, member removal, and invitation generation/revocation.
- **Race Condition Found & Fixed:** Concurrent `POST /api/invitations/:token/accept` calls previously both succeeded (`[200, 200]`) on a single-use token. Fixed with atomic `Invitation.findOneAndUpdate({ _id: invitation._id, status: 'pending' }, ...)` in [`invitation.controller.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/controllers/invitation.controller.js#L130-L176).

### 3.2 MongoDB Persistence & Demo Seed Safety (Audit Priority 3)
- **Connection Modes ([`db.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/config/db.js)):**
  - When `MONGODB_URI` is set: connects directly to MongoDB Atlas / external `mongod` (`mode: 'uri'`).
  - When `NODE_ENV === 'production'` and `MONGODB_URI` is empty: fails fast at startup ([`env.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/config/env.js#L38-L45) + [`db.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/config/db.js#L33-L37)) even if `ALLOW_EMBEDDED_MONGO=true`.
  - In local development without `MONGODB_URI`: starts `mongodb-memory-server` backed by `.data/mongodb` (`mode: 'embedded-persistent'`).
- **Three Defects Found & Fixed:**
  1. **Shutdown Data Loss (`embedded-persistent`):** Stopping `mongodb-memory-server` on Windows killed `mongod` before WiredTiger flushed its journal. Inspection of the repository's original `.data/mongodb` revealed 4 demo users but **0 trips, 0 activities, and 0 expenses**—direct proof that the previous seed run had lost its writes on exit. Fixed in [`db.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/config/db.js#L78-L87) by running `await mongoose.connection.db.admin().command({ fsync: 1 })` before disconnecting. Verified with 15 consecutive write-restart cycles (`0/15` lost) and re-verified on `.data/mongodb` after running `npm run seed:demo` (4 users, 1 trip, 8 activities, 2 bookings, 4 tasks, 6 expenses persisted on disk).
  2. **Silent Ephemeral Fallback in `seedDemo.js`:** When `.data/mongodb` was locked by a running server (`npm run dev`), `connectDB()` fell back to an in-memory instance (`embedded-ephemeral`), seeded into RAM, printed success, and lost all data on exit. Fixed in [`seedDemo.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/scripts/seedDemo.js#L18-L26) to abort with an explicit error when `mode === 'embedded-ephemeral'`.
  3. **Remote URI Guard in `seedDemo.js`:** Added [`seedGuard.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/utils/seedGuard.js) (`assertSafeSeedTarget`) to block seeding any non-local `MONGODB_URI` (e.g., `mongodb+srv://...` Atlas) unless `ALLOW_REMOTE_SEED=true` is explicitly set, without echoing credentials in error logs.
- **Non-Destructive Idempotency Verified:** [`seed.service.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/services/seed.service.js#L59-L74) only replaces trips matching `{ title: 'Coorg Weekend Escape', ownerId: aarav._id }`. Verified by planting a bystander user with 2 trips (including one also named `"Coorg Weekend Escape"`) and running `seedDemo` twice: 100% of bystander data was preserved.

### 3.3 Financial Calculations Engine (Audit Priority 4)
- **Equal Splitting:** [`computeEqualShares`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/services/expense.service.js#L26-L52) deduplicates and lexicographically sorts `participantIds`, computes `baseShare = Math.floor(amountMinor / count)` and `remainder = amountMinor % count`, and assigns `+1` paise to the first `remainder` sorted IDs.
- **Custom Splitting:** [`validateAndNormalizeCustomShares`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/services/expense.service.js#L58-L108) rejects non-integers, negative shares, duplicate participants, non-trip members, all-zero shares, and any split where `sum(shareMinor) !== amountMinor`.
- **Planned vs. Paid & Settlements:** [`buildTripFinancialSummary`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/services/expense.service.js#L114-L227) includes both `planned` and `paid` shares in `estimatedTotalMinor`, but computes `netBalanceMinor = totalPaidOutMinor - paidShareMinor` and settlement transfers strictly from `paid` expenses.
- **Single-Ledger Referential Integrity:** Creating a Booking or Activity with an optional cost creates one linked `Expense` document (`linkedExpenseId` ↔ `linkedBookingId` / `linkedActivityId`). [`Booking.model.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/models/Booking.model.js) and [`Activity.model.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/models/Activity.model.js) store no separate price field, eliminating double-counting. Deleting an Expense unlinks `linkedExpenseId` on any referencing Booking or Activity; deleting a Booking/Activity unlinks the Expense without deleting financial history.

### 3.4 Itinerary Conflict Detection (Audit Priority 5)
- **Interval Logic:** [`detectActivityConflicts`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/services/conflict.service.js#L64-L163) sorts activities chronologically by UTC `startAt` and flags pairs where `actA.status !== 'cancelled'`, `actB.status !== 'cancelled'`, and `startA < endB && startB < endA`.
- **Edge Cases Verified:**
  - Partial overlap (`09:00–12:00` vs `11:00–13:00` → `overlapMinutes: 60`).
  - Full containment (`09:00–17:00` vs `11:00–12:00` → `overlapMinutes: 60`).
  - Identical slot (`10:00–11:00` vs `10:00–11:00` → `overlapMinutes: 60`).
  - Adjacent/touching (`09:00–12:00` vs `12:00–14:00` → `0` conflicts).
  - Overnight across local midnight (`23:00 Day 1 – 01:30 Day 2` vs `00:30–02:00 Day 2` → `60 min` overlap, and grouped under both local dates in [`activity.controller.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/controllers/activity.controller.js#L35-L45)).
  - Timezone conversion in [`client/src/utils/format.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/client/src/utils/format.js#L77-L154) (`zonedDateTimeToUtcIso` & `utcIsoToZonedInput`) verified across `Asia/Kolkata`, `America/New_York`, `Pacific/Auckland`, and every 15-minute increment across a full US DST spring-forward week (42 tests in `audit.format.test.js`).

### 3.5 Playwright Report Investigation & Browser Verification (Audit Priorities 6, 7, 9)
- **Why Playwright Originally Reported `"1 passed"`:**
  - [`tests/e2e/tripsplit.spec.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/tests/e2e/tripsplit.spec.js) previously contained a single `test('full collaborative group trip lifecycle...')` block with 14 numbered comments.
  - **Audit of the original 14 steps revealed gaps:**
    - Step 7 ("User assigns task") only filled the task title and clicked `Create Task` without selecting an assignee or asserting who it was assigned to, nor testing task completion.
    - Step 9 only tested equal expenses; **custom splits**, **split-sum validation**, **What-If Simulator**, and **expense deletion/recalculation** were not E2E-tested.
    - **Logout and re-login**, **unauthenticated redirect**, **invalid login error alert**, **single-use invitation replay rejection**, **collaborator read-only settings**, and **conflict resolution (`Adjust Time`)** were not E2E-tested.
    - `pageerror` and `console` listeners were only attached to `ownerPage`, ignoring `memberPage` and `outsiderPage`.
    - Mobile responsiveness (`375x812`) was only checked on the Overview page, missing a **78px horizontal overflow** on `/trips/:tripId/expenses`.
- **Resolution:**
  - Fixed the mobile grid overflow in [`Card.jsx`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/client/src/components/ui/Card.jsx) and [`ExpensesPage.jsx`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/client/src/pages/ExpensesPage.jsx) by adding `min-w-0`.
  - Refactored [`tests/e2e/tripsplit.spec.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/tests/e2e/tripsplit.spec.js) into **14 separate, self-asserting `test()` blocks** with `pageerror`, `console.error`, and `5xx` response listeners attached to all three browser contexts (`owner`, `member`, `outsider`).
  - Set `reuseExistingServer: false` in [`playwright.config.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/playwright.config.js) so E2E tests always run against the isolated [`startE2EServer.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/scripts/startE2EServer.js) in-memory database.

### 3.6 Git Hygiene & Dependency Audit (Audit Priority 10)
- **Tracked Files & History Scan:** Verified via `git ls-files` and full commit history scan across all commits that zero `.env` files, zero `.data/` database files, zero `dist/` or `node_modules/` artifacts, and zero real API keys/credentials have ever been committed.
- **`.gitignore` Verification:** Properly ignores `node_modules/`, `dist/`, `.env`, `.env.*` (preserving `.env.example`), `.data/`, `coverage/`, `playwright-report/`, and `test-results/`.
- **Branch Safety:** Original `master` branch remains untouched at `cd405e9` (tagged `pre-audit-checkpoint`). All audit fixes and tests are committed cleanly on `audit/pre-submission-fixes`.

---

## 4. Bugs Found & Fixed

| ID | Severity | Summary | Root Cause | Fix & Files Modified | Commit & Regression Test |
| :- | :--- | :--- | :--- | :--- | :--- |
| **BUG-01** | **P0** | Render production build fails (`'vite' is not recognized`) | `render.yaml` set `NODE_ENV=production`, causing `npm ci` to skip `devDependencies` (`vite`, `tailwindcss`, `postcss`, `autoprefixer`), and `vite` was not listed in `client/package.json`. | Changed `buildCommand` in [`render.yaml`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/render.yaml#L8) and [`README.md`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/README.md#L136) to `npm ci --include=dev && npm run build`; added `"vite": "^7.3.7"` to [`client/package.json`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/client/package.json). | Commit `41a88f9` — Verified in clean copy with `NODE_ENV=production` (`BUILD_EXIT=0`). |
| **BUG-02** | **P1** | Unknown `/api/*` paths return HTML instead of JSON `404` | `app.use('/api', notFoundHandler)` strips `/api` from `req.path`, so `req.path.startsWith('/api')` in [`error.middleware.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/middleware/error.middleware.js#L5-L14) evaluated to `false` and fell through to SPA HTML. | Checked `req.originalUrl.startsWith('/api')` in [`error.middleware.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/middleware/error.middleware.js#L8). | Commit `e2040d0` — `server/tests/audit.test.js` (`GET /api/does-not-exist` & `POST /api/trips/bad/route`). |
| **BUG-03** | **P1** | Concurrent invitation accept race allows multiple joins on single-use token | [`invitation.controller.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/controllers/invitation.controller.js) read `invitation.status === 'pending'` and saved non-atomically, allowing parallel requests to both succeed (`[200, 200]`). | Used atomic `Invitation.findOneAndUpdate({ _id, status: 'pending' }, ...)` + guarded `Trip.updateOne({ _id, 'members.userId': { $ne: req.user._id } })` with rollback in [`invitation.controller.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/controllers/invitation.controller.js#L130-L176). | Commit `e2040d0` — `server/tests/audit.test.js` (`Promise.all` concurrent accept returns `[200, 409]`). |
| **BUG-04** | **P1** | Embedded persistent MongoDB loses recent writes on clean shutdown | `disconnectDB()` in [`db.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/config/db.js) stopped `mongodb-memory-server` without flushing WiredTiger to disk; 5 of 8 restarts lost writes, and repo `.data/mongodb` had lost its seeded trip. | Added `await mongoose.connection.db.admin().command({ fsync: 1 })` before disconnecting when `activeMode === 'embedded-persistent'` in [`db.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/config/db.js#L79-L87). | Commit `a6fa6ed` — Verified across 15 consecutive restart cycles (`0/15` lost) and `npm run seed:demo`. |
| **BUG-05** | **P1** | `npm run seed:demo` silently seeds throwaway RAM DB when `.data/mongodb` is locked & lacks remote URI guard | [`seedDemo.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/scripts/seedDemo.js) did not check `getDbStatus().mode === 'embedded-ephemeral'` and only checked `NODE_ENV === 'production'`. | Updated [`seedDemo.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/scripts/seedDemo.js), [`db.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/config/db.js#L59-L62), and added [`seedGuard.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/utils/seedGuard.js). | Commit `a6fa6ed` — `server/tests/seedGuard.test.js` (12 unit tests). |
| **BUG-06** | **P1** | `78px` mobile horizontal overflow on `ExpensesPage` (`375px` viewport) & monolithic 1-test E2E suite | CSS Grid children in [`ExpensesPage.jsx`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/client/src/pages/ExpensesPage.jsx) and [`Card.jsx`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/client/src/components/ui/Card.jsx) lacked `min-w-0`, so the 6-column table stretched the grid track to `453px`; original E2E only checked mobile overflow on Overview. | Added `min-w-0` to [`Card.jsx`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/client/src/components/ui/Card.jsx) and [`ExpensesPage.jsx`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/client/src/pages/ExpensesPage.jsx#L499); split [`tripsplit.spec.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/tests/e2e/tripsplit.spec.js) into 14 independent tests. | Commit `d7b2d37` — E2E Test 14 verifies `scrollWidth - innerWidth <= 4` across 6 views. |
| **BUG-07** | **P2** | JSON payloads `>100kb` return `500` instead of `413` | `body-parser` `entity.too.large` error was not handled in [`error.middleware.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/middleware/error.middleware.js). | Added `err?.type === 'entity.too.large'` branch returning `413 PAYLOAD_TOO_LARGE` in [`error.middleware.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/middleware/error.middleware.js#L90-L98). | Commit `e2040d0` — `server/tests/audit.test.js` (`150kb` payload returns `413`). |

---

## 5. Test Commands Executed & Actual Results

All commands were executed from `c:\Users\HP\OneDrive\Desktop\TripSplitPlanner`:

| Command | Exit Code | Actual Result Summary |
| :--- | :---: | :--- |
| `npm run lint` | `0` | ESLint v9 checked `client/`, `server/`, `tests/e2e/`, and `playwright.config.js` with **0 errors and 0 warnings**. |
| `npm run build` | `0` | Vite v7.3.7 transformed 2,093 modules and emitted `client/dist/index.html` (`0.73 kB`), CSS (`29.37 kB`), and JS (`861.97 kB`, gzip `240.32 kB`) in `4.23s`. |
| `npm test` | `0` | **Server Vitest:** 5 files, **89 passed** (`audit.test.js` [44], `api.test.js` [19], `seedGuard.test.js` [12], `conflict.test.js` [8], `expense.test.js` [6]).<br>**Client Vitest:** 2 files, **48 passed** (`audit.format.test.js` [42], `app.test.jsx` [6]).<br>**Total Unit/Integration Tests:** **137 passed (0 failed)**. |
| `npm run test:e2e` | `0` | Built production client bundle, launched isolated E2E server, and ran **14 independent Playwright tests in Google Chrome**: **14 passed (21.6s)** with zero `pageerror`, zero unexpected `console.error`, and zero `5xx` responses across all 3 browser contexts. |
| `npm run seed:demo` | `0` | Connected to `embedded-persistent`, seeded `"Coorg Weekend Escape"` (4 users, 1 trip, 8 activities, 2 bookings, 4 tasks, 6 expenses), flushed WiredTiger via `fsync`, and verified all documents persisted on disk after process exit. |

---

## 6. Remaining P2/P3 Risks & Non-Blocking Observations

1. **Cookie `maxAge` vs. `JWT_EXPIRES_IN` (P3):** [`tokens.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/utils/tokens.js#L31) hardcodes the browser cookie `maxAge` to 7 days (`7 * 24 * 60 * 60 * 1000`), matching the default `JWT_EXPIRES_IN=7d`. If an operator changes `JWT_EXPIRES_IN` without updating `maxAge`, the JWT validator still enforces token expiry server-side, though cookie lifetime would remain 7 days.
2. **Requests Without `Origin` or `Referer` Header (P3):** [`origin.middleware.js`](file:///c:/Users/HP/OneDrive/Desktop/TripSplitPlanner/server/src/middleware/origin.middleware.js#L17-L19) allows requests that carry neither `Origin` nor `Referer` (for CLI/Supertest compatibility), relying on `SameSite=Lax` cookies to prevent cross-site browser mutations when `Referer` is suppressed.
3. **Client Bundle Chunk Size Notice (P3):** Vite logs a standard notice that the main JS bundle (`861.97 kB` minified / `240.32 kB` gzipped) exceeds 500 kB due to `recharts` + `lucide-react`. This does not affect functionality or build success.
4. **React Router v7 Future Flags & Recharts `jsdom` Notice in Unit Tests (P3):** `app.test.jsx` prints benign stderr notices from React Router v6 future flags and Recharts `ResponsiveContainer` zero-width measurement inside headless `jsdom`. Real Chrome E2E runs have zero layout warnings.

---

## 7. Production Deployment Readiness (Local Simulation vs. Live Cloud)

> **Important Distinction:** No live Render URL exists yet. Live cloud deployment has **not** been tested. The table below distinguishes what was verified locally in production mode (`NODE_ENV=production`) from what must be verified after deploying to Render + MongoDB Atlas.

| Check | Local `NODE_ENV=production` Simulation Result | Live Render + Atlas Status |
| :--- | :--- | :--- |
| **`npm ci --include=dev && npm run build`** | **VERIFIED** (`BUILD_EXIT=0` in clean copy with `NODE_ENV=production`) | Ready for Render build pipeline |
| **Missing `MONGODB_URI` or weak `JWT_SECRET` in prod** | **VERIFIED** (Server refuses to start with exit code `1`; never falls back to embedded Mongo) | Must set `MONGODB_URI` & `JWT_SECRET` in Render dashboard |
| **SPA deep-link routing (`/trips/abc123`)** | **VERIFIED** (Returns `200 text/html` `client/dist/index.html`) | Ready |
| **Unknown API routing (`/api/nonexistent`)** | **VERIFIED** (Returns `404 application/json` `ROUTE_NOT_FOUND`) | Ready |
| **Auth cookie flags in production** | **VERIFIED** (`HttpOnly; Secure; SameSite=Lax; Path=/`) | Requires Render HTTPS (`TRUST_PROXY=true` set in `render.yaml`) |
| **CORS & `Origin` protection** | **VERIFIED** (Untrusted `Origin: https://evil.example.com` blocked with `403`) | Set `CLIENT_ORIGIN=https://<your-service>.onrender.com` in Render |
| **Live Render health check & Atlas persistence** | Simulated locally against local Mongo instance | **NOT YET TESTED LIVE** (No live Render URL provided) |

---

## 8. Exact Manual Testing & Viva Demonstration Steps

1. **Seed the Demo Workspace (with dev server stopped):**
   ```bash
   npm run seed:demo
   ```
2. **Start the Application:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in Google Chrome.
3. **Authentication & `httpOnly` Cookie Check:**
   - Click **Log in**, click the **Aarav (Owner)** quick-fill button (`aarav@tripsplit.demo` / `DemoPassword123`), and sign in.
   - Open Chrome DevTools → **Application** → **Cookies** (`tripsplit_token` has `HttpOnly` checked) and **Local Storage** (empty).
4. **Overview & Trip Pulse Readiness:**
   - Open **Coorg Weekend Escape** and inspect the **Trip Pulse Readiness** score (`60 / 100`), **1 Schedule Overlap Detected** badge, and **Estimated Per-Person Cost Breakdown** chart/table.
5. **Itinerary Conflict Detection & Resolution:**
   - Open **Itinerary**. Verify the amber conflict banner flagging **Mandalpatti 4x4 Jeep Safari** (`3:30 PM – 5:30 PM`) vs **Raja's Seat Sunset Point Walk** (`4:30 PM – 6:00 PM`) with a `60 min` overlap, while adjacent (`12:30 PM`) and `Cancelled` activities have no conflict.
   - Click **Adjust Time** on **Raja's Seat Sunset Point Walk**, change start time to `17:30`, save, and observe the conflict banner disappear immediately.
6. **Financial Engine (Paise Remainder, Custom Split, Settlements & What-If Simulator):**
   - Open **Expenses**.
   - Inspect **Highway Toll & Fastag Top-up (`₹100.00`)** split equally across 3 members: `₹33.34`, `₹33.33`, `₹33.33` (exact 10,000 paise sum).
   - Inspect **Coorg Spice & Arabica Coffee Tasting Basket (`₹2,400.00`)** custom split (`₹400`, `₹800`, `₹600`, `₹600`).
   - Verify **Settlement Recommendations (Paid Expenses Only)** excludes planned items (`₹9,000.00` Innova + `₹3,600.00` Dinner).
   - Click **What-If Simulator**, enter `₹4,000.00`, click **Run Simulation Preview**, verify before/after deltas, and close the modal to confirm the database ledger is unchanged.
7. **Multi-User Invitation & Cross-Trip Access Control:**
   - In **Members**, click **Generate 7-Day Invite Link** and copy the link.
   - Open an Incognito window, register a new user, and try visiting `/trips/<tripId>` directly → verify **403 Access Denied**.
   - Paste the invite link in the Incognito window, click **Accept Invitation & Join Trip**, and verify immediate access.

---

## 9. Final Submission Checklist

- [x] All 13 University CIA-2 functional and technical requirements verified in source code and runtime
- [x] `npm run lint` passes with 0 errors and 0 warnings
- [x] `npm run build` succeeds cleanly in both development and `NODE_ENV=production`
- [x] `npm test` passes all 137 backend and frontend unit/integration tests (`89` server + `48` client)
- [x] `npm run test:e2e` passes all 14 independent Playwright browser tests in Google Chrome (`0` console/page/5xx errors)
- [x] `npm run seed:demo` verified idempotent, non-destructive, guarded against locked/remote DBs, and durable across restarts
- [x] No `.env` files, secrets, `node_modules/`, `dist/`, or `.data/` artifacts tracked in Git
- [x] Original `master` branch preserved untouched at tag `pre-audit-checkpoint` (`cd405e9`); all fixes committed on `audit/pre-submission-fixes`

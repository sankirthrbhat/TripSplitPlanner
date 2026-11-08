# TripSplit Planner

**Semester 3 Backend Development CIA-2 — Collaborative Shared Trip Workspace & Deterministic Expense Engine**

TripSplit Planner is a production-ready MERN (MongoDB, Express, React, Node.js) web application designed for groups of friends planning trips together. It unifies itinerary scheduling with automatic overlap detection, reservation organizing, task delegation, and an authoritative integer-paise financial ledger that computes exact per-person cost estimates and paid-only settlement recommendations.

---

## University Assignment Alignment (CIA-2)

- **Project Title:** TripSplit Planner
- **Theme:** Shared trip planning and expenses
- **Problem Statement:** Friends planning a trip need to coordinate itinerary, bookings, responsibilities, and shared costs in one place via a group trip workspace.
- **Mandatory Differentiating Features:**
  1. **Estimated Per-Person Cost Engine** (integer paise precision, deterministic equal & custom splits, paid vs planned breakdown, paid-only settlements).
  2. **Schedule Conflict Detection** (backend UTC timestamp overlap detection, touching endpoint allowance, cancelled exclusion, timezone-aware display, conflict metadata & alerts).
- **Mandatory Stack Requirements:** React UI, Node.js + Express REST API, MongoDB persistence via Mongoose ODM, Zod input validation, centralized error handling, and responsive design (`375px`, `768px`, desktop).

---

## Technology Stack

### Frontend (`client/`)
- React 18 + Vite 7 (JavaScript)
- React Router v6
- TanStack Query v5 for server-state caching and invalidation
- React Hook Form + Zod schema validation
- Tailwind CSS v3 + Lucide React icons
- Recharts for financial visualizations + accessible numeric tables
- Custom accessible Toast notification system (`aria-live="polite"`)

### Backend (`server/`)
- Node.js + Express REST API
- MongoDB Atlas / `mongod` via Mongoose ODM
- Zod server-side body, query, and startup environment validation
- `bcryptjs` password hashing
- JWT session authentication stored strictly in `httpOnly`, `SameSite=Lax` cookies
- `helmet`, `express-rate-limit`, `cors`, and mutating request `Origin`/`Referer` verification
- Centralized structured JSON error handling

### Testing & Tooling
- npm Workspaces (`client`, `server`)
- ESLint v9 flat config
- Vitest + Supertest + `mongodb-memory-server` (backend unit & API integration tests)
- Vitest + React Testing Library + `jsdom` (frontend component & routing tests)
- Playwright (real Chromium browser end-to-end multi-user & mobile tests)

---

## Key Features

1. **Authentication & Security:** Register/login/logout with `bcryptjs` password hashing, `httpOnly` cookie JWTs, rate limiting on `/api/auth/login` and `/api/auth/register`, no `localStorage` tokens, and Origin checks.
2. **Collaborative Trip Workspaces & Invitations:** Create trips with IANA timezones and INR budgets; invite friends via 7-day cryptographically random tokens (only SHA-256 hashes stored in MongoDB); role-based enforcement (`owner` vs `member` vs `403 Forbidden` for outsiders).
3. **Chronological Itinerary & Overlap Alerts:** Schedule activities in trip timezone (stored in UTC); detects partial, full-containment, identical, and overnight overlaps while treating touching endpoints (`endA === startB`) and `cancelled` items as conflict-free.
4. **Bookings & Tasks:** Track accommodation, transport, and activity reservations with safe `http`/`https` URL validation and optional single-ledger expense linking; assign/filter tasks with completion progress.
5. **Authoritative Financial Ledger & Settlements:** Stores all INR currency values in integer paise (`₹1,250.75 -> 125075`). Supports deterministic equal remainder distribution (e.g., `₹100.00 / 3 = ₹33.34 + ₹33.33 + ₹33.33`), exact custom splits, per-person cost estimation, paid-only greedy debtor/creditor settlements, and a non-mutating **What-If Budget Simulator**.
6. **Trip Pulse Readiness Widget:** Transparent rule-based 100-point readiness indicator across task completion, booking confirmations, schedule conflicts, and budget variance.

---

## Prerequisites

- **Node.js** `>= 20.0.0` (verified on `v24.21.0`)
- **npm** `>= 10.0.0`
- **MongoDB Atlas** cluster URI (recommended for production/shared persistence) or local `mongod` (note: in local development without `MONGODB_URI`, the server automatically launches a persistent embedded `mongod` instance backed by `.data/mongodb` if `ALLOW_EMBEDDED_MONGO=true`).
- **Google Chrome** or Playwright Chromium for running browser E2E tests.

---

## Local Setup & Running

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `server/.env.example` to `server/.env`:
```bash
cp server/.env.example server/.env
```

Review `server/.env`:
```env
NODE_ENV=development
PORT=5000
MONGODB_URI=
JWT_SECRET=replace-with-a-long-random-secret-key-at-least-32-chars
JWT_EXPIRES_IN=7d
CLIENT_ORIGIN=http://localhost:5173
TRUST_PROXY=false
ALLOW_EMBEDDED_MONGO=true
```
> If you have a MongoDB Atlas connection string, set `MONGODB_URI=mongodb+srv://...` in `server/.env`. Never commit `.env` files to Git.

### 3. (Optional) Seed Sample Demo Workspace
Populates the **"Coorg Weekend Escape"** trip with 4 demo accounts (`aarav@tripsplit.demo`, `diya@tripsplit.demo`, `kabir@tripsplit.demo`, `meera@tripsplit.demo`, password `DemoPassword123`), an intentional overlap, bookings, tasks, and equal/custom expenses:
```bash
npm run seed:demo
```

### 4. Run Development Servers (Frontend + Backend)
Runs Express on `http://localhost:5000` and Vite on `http://localhost:5173` (with `/api` proxied to Express):
```bash
npm run dev
```

### 5. Run Production Build & Single-Service Mode
Builds `client/dist/` and starts Express serving both `/api` and the compiled React SPA on `http://localhost:5000`:
```bash
npm run build
npm start
```

---

## Running Tests & Quality Gates

```bash
# ESLint across client, server, and E2E tests
npm run lint

# Backend unit/API integration tests + Frontend component tests
npm test

# Rebuild client and run Playwright browser E2E tests
npm run test:e2e
```

---

## Deployment (Single Render Web Service)

1. Push the repository (including `package-lock.json` and `render.yaml`) to GitHub.
2. Create a new **Web Service** on Render connected to the repository:
   - **Build Command:** `npm ci --include=dev && npm run build`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/api/health`
3. Configure Environment Variables in the Render Dashboard:
   - `NODE_ENV=production`
   - `TRUST_PROXY=true`
   - `ALLOW_EMBEDDED_MONGO=false`
   - `MONGODB_URI=<your MongoDB Atlas connection string>`
   - `JWT_SECRET=<strong 32+ character random string>`
   - `CLIENT_ORIGIN=https://<your-render-service>.onrender.com`
4. Notice that Render terminates TLS at its proxy (`TRUST_PROXY=true`), enabling `Secure` `httpOnly` session cookies over HTTPS automatically.

---

## Key Design Decisions

1. **Integer Paise Everywhere:** Avoiding IEEE-754 floats for INR prevents `0.1 + 0.2 !== 0.3` rounding drift. Deterministic lexicographic sorting before equal remainder allocation guarantees repeatable splits.
2. **Single Authoritative Financial Ledger:** Activities and Bookings reference `Expense._id` (`linkedExpenseId`) rather than carrying independent price totals, preventing double-counting.
3. **Overlap Warnings Over Hard Blocking:** Real group trips often have split-group activities (e.g., two friends go kayaking while two visit a cafe). The backend flags overlaps with rich explanatory metadata so users can resolve unintended double-bookings without blocking valid parallel plans.
4. **Member Removal Guard (`409 Conflict`):** Removing a member who paid or shared an existing expense is blocked to preserve historical ledger balance invariants (`sum(netBalance) === 0`).

---

## Known Limitations

- Currency support is scoped to **INR** (`₹`, integer paise) for the MVP, without live multi-currency FX conversion.
- Invitation links are generated for copy/paste sharing rather than dispatched via a paid SMTP email provider.
- Reservations are tracked for group coordination and do not connect to external airline/hotel booking APIs.


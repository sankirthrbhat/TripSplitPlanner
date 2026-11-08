# 3–5 Minute Live Demonstration Script (CIA-2)

## Pre-Demo Setup
1. Run `npm run seed:demo` to populate **"Coorg Weekend Escape"**.
2. Start the app with `npm run dev` (or `npm run build && npm start`).
3. Open `http://localhost:5173` (or `http://localhost:5000`).

---

## Minute 1 — Authentication, Security & Trip Workspace
1. Open the public landing page and highlight the core problem statement and architecture.
2. Click **Log in**, use the demo quick-fill for **Aarav (Owner)** (`aarav@tripsplit.demo`), and sign in.
3. Open **DevTools → Application → Cookies / Local Storage**:
   - Show that `tripsplit_token` is stored in an **`httpOnly` cookie** and **zero tokens** are in `localStorage`.
4. Open **Coorg Weekend Escape** from **My Trips**.
5. Point out the **Trip Overview**:
   - **Trip Pulse Readiness** rule-based score across Tasks, Bookings, Schedule Conflicts, and Budget.
   - **Estimated Per-Person Cost Breakdown** table & stacked bar chart.

## Minute 2 — Differentiating Feature #1: Schedule Conflict Detection
1. Click the **Itinerary** tab.
2. Point out the amber **Schedule Conflict Alert** at the top explaining that `"Mandalpatti 4x4 Jeep Safari"` overlaps with `"Raja's Seat Sunset Point Walk"` by 60 minutes in `Asia/Kolkata`.
3. Also note that adjacent activities (`12:30 PM` touching `12:30 PM`) and the `Cancelled` backup activity do **not** trigger false conflicts.
4. Click **Adjust Time** on `"Raja's Seat Sunset Point Walk"`, change start time to `17:30` (touching endpoint `5:30 PM`), save, and show the conflict alert clearing live!

## Minute 3 — Differentiating Feature #2: Deterministic Paise Expense & Settlement Engine
1. Click the **Expenses** tab.
2. Highlight the **Financial Summary Strip** (`Trip Total Estimate` = `Total Paid Out` + `Remaining Planned`).
3. Show the **Highway Toll & Fastag Top-up (`₹100.00`)** split among 3 members (`₹33.34 + ₹33.33 + ₹33.33`), proving exact integer paise rounding with zero lost paise.
4. Show the **Coorg Spice Basket (`₹2,400.00`)** custom split and **Planned Dinner (`₹3,600.00`)**.
5. Point to **Settlement Recommendations (Paid Expenses Only)** showing exact transfers (`Meera`/`Diya` → `Aarav`/`Kabir`) and explain why planned costs contribute to **Estimated Total** but are excluded from **Settlements**.
6. Click **What-If Simulator**, preview adding a `₹4,000.00` planned excursion, and show the before/after per-person deltas without modifying MongoDB.

## Minute 4 — Bookings, Tasks, Collaboration & Access Control
1. Show **Bookings** (`Silver Oak Homestay` linked to its single-ledger expense) and **Tasks** (filtering & toggling status).
2. Open **Members**, generate a **7-day Invitation Link** (note only the SHA-256 hash is stored in MongoDB).
3. Open a private browser window, try visiting the Trip URL directly while logged in as a non-member → demonstrate **`403 Access Denied`**.
4. Open the invitation link in the second session, accept it, and verify immediate collaboration persistence across browser refreshes.


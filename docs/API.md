# REST API Reference

Base URL: `/api`  
All responses share a consistent JSON envelope:

```json
// Success
{ "success": true, "data": { ... } }

// Error
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description",
    "details": {}
  }
}
```

## Status Codes
- `200 OK` — Successful read, update, or deletion
- `201 Created` — Successful resource creation
- `400 Bad Request` — Zod validation error, invalid ObjectId, invalid split sum, or invalid date range
- `401 Unauthorized` — Missing, expired, or invalid `httpOnly` JWT cookie or wrong login credentials
- `403 Forbidden` — Authenticated user is not a trip member, non-owner attempting owner-only action, or untrusted `Origin`
- `404 Not Found` — Missing trip, activity, booking, task, expense, or invitation
- `409 Conflict` — Duplicate email, already-used invitation, duplicate membership, or member linked to historical expenses
- `410 Gone` — Expired or revoked invitation token
- `429 Too Many Requests` — Auth rate limiter triggered
- `500 Internal Server Error` — Unhandled server fault

---

## Health
- `GET /api/health` — Returns service health and MongoDB readiness (`status: 'connected'`).

## Authentication
- `POST /api/auth/register` — `{ displayName, email, password }` → `201` + sets `httpOnly` cookie `tripsplit_token`.
- `POST /api/auth/login` — `{ email, password }` → `200` + sets `httpOnly` cookie `tripsplit_token`.
- `POST /api/auth/logout` — Clears `tripsplit_token` cookie → `200`.
- `GET /api/auth/me` — Requires auth cookie → `200 { user }`.

## Trips & Members
- `GET /api/trips` — List trips where signed-in user is owner or member, enriched with `quickStats`.
- `POST /api/trips` — `{ title, destination, description?, startDate, endDate, timezone, currency, budgetLimitMinor }` → `201`.
- `GET /api/trips/:tripId` — Member-scoped trip details + hydrated `members[]`.
- `PATCH /api/trips/:tripId` — Owner-only update of trip settings.
- `DELETE /api/trips/:tripId` — Owner-only cascading delete of trip and all dependent collections.
- `GET /api/trips/:tripId/members` — Member-scoped roster.
- `DELETE /api/trips/:tripId/members/:memberUserId` — Owner-only member removal (`409` if member participates in expenses).

## Invitations
- `GET /api/trips/:tripId/invitations` — List trip invitations (without exposing token hashes).
- `POST /api/trips/:tripId/invitations` — Owner-only; generates 256-bit random token, persists SHA-256 hash with 7-day TTL, returns raw `inviteToken` and `invitePath` once.
- `DELETE /api/trips/:tripId/invitations/:invitationId` — Owner-only revoke pending invitation.
- `GET /api/invitations/:token/preview` — Authenticated preview of trip metadata before joining.
- `POST /api/invitations/:token/accept` — Validates token hash, expiry, and single-use status; adds user to `trip.members`.

## Itinerary Activities
- `GET /api/trips/:tripId/activities?date=YYYY-MM-DD&status=...&category=...` — Returns chronological activities annotated with `hasConflict`, `conflicts`, plus full `conflictReport`.
- `POST /api/trips/:tripId/activities` — Creates activity (with optional `plannedCostMinor` single-ledger link) and returns updated `conflictReport`.
- `PATCH /api/trips/:tripId/activities/:activityId` — Updates activity (`startAt < endAt` validated) and recalculates conflicts.
- `DELETE /api/trips/:tripId/activities/:activityId` — Deletes activity and unlinks `linkedActivityId` on any referencing expense.

## Bookings
- `GET /api/trips/:tripId/bookings?category=...&status=...`
- `POST /api/trips/:tripId/bookings` — Supports optional `costMinor` / `costStatus` / `paidByUserId` to atomically create one linked `Expense`.
- `PATCH /api/trips/:tripId/bookings/:bookingId`
- `DELETE /api/trips/:tripId/bookings/:bookingId`

## Tasks
- `GET /api/trips/:tripId/tasks?assignedTo=...&status=...&priority=...&dueBefore=...`
- `POST /api/trips/:tripId/tasks` — Validates `assignedTo` belongs to trip.
- `PATCH /api/trips/:tripId/tasks/:taskId`
- `DELETE /api/trips/:tripId/tasks/:taskId`

## Expenses & Budget Simulator
- `GET /api/trips/:tripId/expenses?status=...&category=...` — Returns filtered expenses and full trip `financialSummary`.
- `POST /api/trips/:tripId/expenses` — Validates `amountMinor > 0`, `paidByUserId` when `paid`, and deterministic equal or custom split (`sum === amountMinor`).
- `PATCH /api/trips/:tripId/expenses/:expenseId` — Updates expense and recalculates shares cleanly.
- `DELETE /api/trips/:tripId/expenses/:expenseId` — Deletes expense and clears `linkedExpenseId` references on Activities/Bookings.
- `POST /api/trips/:tripId/expenses/simulate` — Non-mutating preview computing before/after trip totals and per-person deltas.

## Insights
- `GET /api/trips/:tripId/summary` — Returns trip metadata, **Trip Pulse** readiness score, `financialSummary`, `conflictReport`, `upcomingActivities`, `outstandingTasks`, and `bookingStats`.
- `GET /api/trips/:tripId/conflicts` — Full pairwise overlap report in `trip.timezone`.
- `GET /api/trips/:tripId/settlements` — Paid-only per-member balances and greedy debtor-to-creditor transfer recommendations.


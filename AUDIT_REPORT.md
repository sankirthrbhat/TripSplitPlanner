# TripSplit Planner — Final CIA-2 Submission Audit

Audit date: 8 November 2026. Repository: https://github.com/sankirthrbhat/TripSplitPlanner

**Verdict: ready to submit for the functionality and environments verified below. No unresolved functional or dependency-security blocker was found after the fixes and final reruns. This is a tested readiness assessment, not a guarantee of zero future defects or full marks.** Check your university's required report/video format and submission deadline separately.

## Live release

- Website: https://tripsplit-planner.onrender.com
- Backend health: https://tripsplit-planner.onrender.com/api/health
- Tested application commit: `17ca37d6427f141a29637a2b548b14df92b80ed5` on `master`.
- Existing Render service: `tripsplit-planner`, Node.js, Free, Singapore. Deployment succeeded and was marked Live.
- Existing Atlas cluster: Cluster0, Mumbai; application database: `tripsplit`.
- Health returned HTTP 200, `status: ok`, database `status: connected`, `mode: uri`.
- Final disposable writes were inspected in Atlas Data Explorer under `tripsplit.trips`. Earlier test data remained accessible after redeployment, refresh, and re-login.
- This report is a documentation-only update after the tested application release. Consult Git history for the earlier audit; its "not deployed yet" statement is historical.

## Changes completed in this follow-up

1. Upgraded Zod to 4.6.7, React Router DOM/router to 7.18.5, and the compatible React Hook Form resolver to 7.0.3. Updated schema constructor error options while preserving actionable validation behavior.
2. Upgraded Vitest to 5.1.0 and adjusted the declared supported Node engines. Use Node 24 LTS for local work.
3. Regenerated the lockfile. Both the full dependency audit and the production-only audit report **zero vulnerabilities**, including the previously reported one high/two moderate production findings and the test-tooling findings.
4. Prevented automated test mode from using an inherited Atlas connection URI; explicit remote test URIs are rejected. Added eight validation/database-isolation regression tests.
5. Fixed tablet navigation overflow at 768px by switching to the drawer below the large-screen breakpoint and constraining account text.
6. Added guarded live Playwright execution, random disposable account passwords, disabled live traces, and broader phone/tablet checks.
7. **Live-only defect found and fixed:** an owner could open Add Expense before the current ledger roster arrived. Cached trip metadata could omit a newly joined collaborator from the default equal split. Creation and simulation now wait for current roster data; the simulator initializes from that roster; loading/retry feedback is provided. The E2E suite deliberately holds the ledger request and verifies both participants' shares before saving.
8. Drafted a temporary frontend UI-polish specification (since applied on `ui/travel-polish`, merged into `master`, and the temporary prompt file removed).

All uploaded source files were compared with the locally tested Git blob hashes before merging. Existing history was preserved through pull requests. No production seed/reset, database-user changes, paid resources, duplicate services, or broad network allowlist were introduced in this follow-up.

## Actual verification results

| Check | Result |
|---|---|
| Clean install with `NODE_ENV=production npm ci --include=dev` and production build | Passed |
| `npm run lint` | Passed |
| `npm run build` | Passed locally and on Render |
| `npm test` | **145 passed**: 97 server + 48 client |
| Local Chrome/Playwright suite after fixes | **14 passed**, 29.1 seconds |
| Final live Chrome/Playwright suite | **14 passed**, no skipped/unexpected/flaky tests |
| Final live API checks | **29/29 passed** |
| Full `npm audit` | **0 vulnerabilities** |
| `npm audit --omit=dev` | **0 production vulnerabilities** |
| Production startup without URI or strong JWT secret | Both invalid configurations rejected |
| HTTPS response headers | HSTS, CSP, nosniff, and SAMEORIGIN observed |
| Authenticated visual review | Desktop 1365px and mobile 375px reviewed |
| Responsive workspace review | All seven tabs checked at 375x812 and 768x1024; no page overflow over 4px |
| Browser diagnostics | No unexpected console errors, page errors, or HTTP 5xx responses in the final suite |
| Git hygiene | No tracked real `.env`, database directory, node_modules, or build output; only `.env.example` tracked |

The first live browser run could not connect until this test runner used the workspace proxy and its existing trusted CA. Certificate checking remained enabled. Once connected, it reproduced the roster race above; the corrected version was then retested successfully. The 14 browser scenarios are serial and share their setup/data; they are not 14 independent isolated fixtures.

## Final live browser scenarios

- PASS — 01. Unauthenticated access redirects to login and blocks invalid credentials
- PASS — 02. User registration sets httpOnly cookie and stores zero tokens in Web Storage
- PASS — 03. Logout clears session cookie and re-login restores workspace
- PASS — 04. Trip creation enforces date validation and initializes trip workspace
- PASS — 05. Itinerary scheduling detects partial overlaps and allows touching endpoints
- PASS — 06. Cross-trip authorization blocks authenticated non-members with 403 Access Denied
- PASS — 07. Invitation generation, preview, single-use acceptance, and replay prevention
- PASS — 08. Responsibility management assigns tasks to a specific member and tracks completion
- PASS — 09. Booking management records reservation details and reference numbers
- PASS — 10. Expense ledger supports equal splits, custom splits, and split-sum validation
- PASS — 11. Per-person estimates, paid-only settlements, and What-If Simulator operate accurately
- PASS — 12. Deleting an expense immediately recalculates estimates and settlement transfers
- PASS — 13. Collaborator role restrictions, reload persistence, and conflict resolution
- PASS — 14. Mobile and tablet layouts render every workspace tab without horizontal overflow

## Final live API results

- PASS — HTTPS health and Atlas URI connection
- PASS — React frontend served over HTTPS
- PASS — Unauthenticated API access rejected: HTTP 401
- PASS — Unknown API route returns JSON 404
- PASS — Register Owner and secure authentication cookie
- PASS — Register Member and secure authentication cookie
- PASS — Register Outsider and secure authentication cookie
- PASS — Invalid trip dates rejected
- PASS — Create persistent trip
- PASS — Cross-trip non-member access denied: HTTP 403
- PASS — Invitation join and single-use replay protection
- PASS — Three-account trip collaboration
- PASS — Member cannot edit owner-only trip settings
- PASS — Backend detects exact activity overlap: 30-minute overlap
- PASS — Touching endpoints and conflict resolution
- PASS — Member task assignment and completion
- PASS — Booking creation and confirmation
- PASS — Paid equal expense split
- PASS — Exact paise rounding across three participants
- PASS — Invalid custom split sum rejected
- PASS — Custom expense split persisted
- PASS — Paid/planned totals and per-person estimates: ₹1,200 paid + ₹700 planned = ₹1,900
- PASS — Settlements exclude planned costs: Two transfers of ₹400 to payer
- PASS — What-If simulator does not mutate ledger
- PASS — Expense edit recalculates totals
- PASS — Logout clears session
- PASS — Re-login retains trip and expense data
- PASS — Untrusted mutation origin rejected
- PASS — Incorrect login credentials rejected

## CIA-2 requirement cross-check

The 13 requirements documented in the repository were mapped back to the implementation and exercised by the current automated and/or live checks:

| Requirement | Evidence in current verification |
|---|---|
| React frontend | Production build, HTTPS rendering, authenticated browser navigation |
| Node/Express REST API | Server integration tests and live endpoint checks |
| MongoDB persistence | Atlas URI health, Atlas document inspection, reload/re-login and redeploy persistence |
| Shared trip planning | Three-account API collaboration, invitation/browser flows, owner/member restrictions |
| Itinerary management | Creation and conflict adjustment in browser; API CRUD coverage locally |
| Booking management | Live browser/API creation and reservation details; CRUD coverage locally |
| Responsibility management | Live named assignee selection and task completion |
| Shared expenses | Live equal/custom splitting, sum validation, expense deletion/recalculation |
| Per-person estimates | Live totals, exact paise remainders, paid-only settlement and What-If checks |
| Overlap detection | Exact 30-minute overlap and touching-endpoint resolution |
| Validation | Date/amount/custom-split errors, schema migration tests, invalid login |
| Error handling | JSON 404 and authorization live; malformed JSON/413 and response-sanitization integration coverage |
| Responsive UI | All seven tabs at phone/tablet widths, mobile drawer, authenticated screenshots |

Authentication was additionally verified through Secure/HttpOnly/SameSite=Lax cookies, empty browser token storage, logout/re-login, unauthorized redirects, cross-trip 403 protection, invitation replay protection, and rejected untrusted mutation origins. Local integration tests cover the concurrent invitation-acceptance race; no production load/stress test was performed.

## Configuration and safety

The existing service uses `npm ci --include=dev && npm run build`, `npm start`, and `/api/health`. Production requires an Atlas URI and a strong JWT secret. Its connection code refuses embedded fallback in production. Existing approved Render outbound ranges are `74.220.52.0/24` and `74.220.60.0/24`; `0.0.0.0/0` was not introduced. Secret values are deliberately absent from this report.

Only generated disposable test accounts/trips were used. Test records remain in Atlas for verification; genuine user data was not deleted. Browser expense-deletion testing removed only the expense created by that same disposable test workflow. Demo seeding was not run against production. Local seed behavior was covered by the previous audit and current seed-guard tests; a new Windows seed/restart cycle was not repeated in this Linux workspace.

## Remaining limitations

- Render Free can sleep; allow 50 seconds or more for a cold start before a presentation. Open the site and health page ahead of the demo.
- The production bundle is about 909 kB before gzip; Vite reports a non-blocking chunk-size warning. Zod's dependency comments also produce non-blocking Rollup annotation notices. Builds succeed.
- Browser checks use desktop Chrome with mobile/tablet viewport sizes. Physical iOS/Android devices, Safari/Firefox, exhaustive accessibility compliance, load testing, and multi-day uptime were not verified.
- Currency remains INR; reservations are tracked rather than purchased through booking providers; invitation sharing is manual. These are declared MVP boundaries.
- A changed JWT lifetime would require reviewing the seven-day cookie lifetime. The deployed seven-day setting is consistent.
- Dependency audits are a point-in-time result and do not prove absence of all security defects.

## Final submission checklist

- [x] Audited source merged to GitHub `master` with history preserved.
- [x] Existing Render service live and connected to Atlas `tripsplit`.
- [x] Final functional, authentication, mobile/tablet, and dependency checks completed.
- [x] README, architecture, API, testing, demo, and audit documentation available.
- [ ] In your Antigravity checkout, commit or stash any personal local edits, then run `git checkout master` and `git pull --ff-only origin master` before packaging or recording.
- [ ] Submit the GitHub repository and live URL, plus your university's required report, ER diagram, screenshots, and demo video. Include your name, roll number, class/section, and CIA-2 details where required.
- [ ] Follow `docs/DEMO.md`; use your own demo account or newly created disposable data. Do not put secrets in your recording or submission archive.
- [ ] Ensure any source ZIP excludes real `.env`, `.data`, node_modules, test traces, and generated build/test artifacts.
- [ ] Open the live site before the demonstration to warm Render. Explain conflict detection, integer-paise rounding, and planned-versus-paid settlement behavior.
- [x] Warm travel-notebook UI refinements implemented on `ui/travel-polish`, verified across lint/build/unit/E2E checks, and merged into `master`.

The applied travel-notebook UI refinements implement a warm off-white palette, teal/coral/sunshine accents, travel-ticket trip cards, a vertical itinerary timeline, responsive financial presentation, reduced-motion support, accessibility improvements, and mobile navigation controls while strictly preserving backend, authentication, conflict-detection, and integer-paise financial behavior.

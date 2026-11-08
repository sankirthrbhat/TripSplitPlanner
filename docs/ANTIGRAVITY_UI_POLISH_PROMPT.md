# Optional Antigravity prompt — TripSplit Planner UI polish

Use this in the existing TripSplitPlanner workspace on a new `ui/travel-polish` branch. Use an available capable model with High reasoning and Planning mode. This is optional work after the verified security release; any UI edits require fresh tests before deployment.

```text
Improve the EXISTING TripSplit Planner interface so planning a trip feels inviting, joyful, and easy. This is a modest visual refinement of a working CIA-2 MERN application, not a rebuild.

FIRST
Read README.md, AUDIT_REPORT.md and docs/TESTING.md, client/src/styles/index.css, client/tailwind.config.js, the reusable components in client/src/components/ui/, and the page/layout files. Inspect the running app at desktop, 768px, and 375px widths before editing. Confirm Git is clean; create branch ui/travel-polish. Preserve the verified release on master.

SCOPE
Change frontend presentation and small interaction details only. Preserve React, Vite, Tailwind, React Router 7, Zod 4, React Hook Form, TanStack Query, and the existing APIs. Do not downgrade security-patched packages. Do not alter backend routes, schemas, environment variables, authentication, cookies, trip membership, invitation tokens, expense algorithms, integer-paise storage, timezone handling, or MongoDB data. Do not introduce paid APIs or new subscriptions. Never seed or reset Atlas. Keep existing accessible labels and test IDs usable by the regression suite.

VISUAL DIRECTION
Use a warm, light travel-notebook style with a restrained teal identity:
- Page background: warm off-white #F7F6F2.
- Cards: white with subtle #E4E9E7 borders, modest shadows, 16–20px corners.
- Main text: deep navy #142C3A; body text #485C66.
- Primary actions: deep teal #0F766E with white labels.
- Small joyful accents: coral #F27A62 and sunshine #F4C95D used decoratively, not for low-contrast small text.
- Preserve distinct accessible success, warning, and error states.
- Reuse existing fonts or system fonts; do not add blocking remote font requests.
- Use consistent spacing, line lengths, number alignment, and a clear heading hierarchy. Keep the app compact enough for real use.

WELCOME PAGE — client/src/pages/WelcomePage.jsx
Create one clear headline such as “Good trips start together.” Follow it with a short explanation of itineraries and shared costs. Keep Create Account and Sign In as the obvious actions. Add a small original travel-route illustration using CSS or a local inline SVG, rather than a heavy image. A destination-themed decorative preview must be labelled “Example trip” so visitors never confuse it with their data. Avoid fake users, ratings, savings, testimonials, counters, or AI claims.

MY TRIPS — client/src/pages/MyTripsPage.jsx
Make trip cards feel like useful travel tickets: destination, dates, member count, and real budget information, with one clear entry action. Keep long names readable. Improve the genuine empty state with a short welcoming message and a working Create Trip action. Use initials or existing local visuals; do not fetch arbitrary external photos for each destination.

WORKSPACE — client/src/layouts/TripWorkspaceLayout.jsx and client/src/pages/TripOverviewPage.jsx
Polish the trip heading with destination, dates, and member initials. Use calm white surfaces and one teal accent. Keep estimated total, paid, planned, and per-person figures easy to compare with aligned tabular numerals. Explain Trip Pulse using the existing transparent rules; never invent a score. Make itinerary-conflict warnings prominent and actionable. Keep the workspace tabs readable and useful on mobile.

ITINERARY — client/src/pages/ItineraryPage.jsx
Refine day separators and activity cards into a clear vertical timeline. Use small consistent icons for time and location. Keep actual timezone labels visible. Preserve conflict metadata and Adjust Time actions; never hide a conflict for visual neatness. Do not invent weather or map data.

EXPENSES — client/src/pages/ExpensesPage.jsx
Keep financial clarity ahead of decoration. Separate planned and paid amounts with labelled badges. Preserve equal/custom split forms, validation, rounding, per-person details, settlement recommendations, and the What-If simulator. Distinguish “Preview — not saved” from stored results. Keep wide tables scrolling inside their cards; retain min-w-0 on grid/flex children. Show friendly empty states and meaningful error messages.

BOOKINGS, TASKS, MEMBERS
Apply the same card, badge, form, and button system in BookingsPage.jsx, TasksPage.jsx, and MembersPage.jsx. Make assignment, booking status, and invitation state scannable. Keep the difference between owner and collaborator permissions clear. Invitation links and secrets must never appear in screenshots or logs shared outside the application workflow.

SMALL MOMENTS OF DELIGHT
Use short 120–180ms transitions for hover/focus/expanded states. Celebrate task completion with a modest icon/check transition and the existing toast, without sound, repeated confetti, or distracting animations. Respect prefers-reduced-motion. Preserve keyboard focus and do not animate large financial numbers while users are reading them.

ACCESSIBILITY AND MOBILE
Maintain at least WCAG AA contrast for normal text. Provide clear focus rings, visible labels, helpful errors, and approximately 44px touch targets. Test at 375x812, 768x1024, and desktop. Verify every tab, drawer, modal, date input, split form, and table without page-level horizontal overflow. Do not rely on color alone. Keep dialogs usable with a small viewport and keyboard navigation. Avoid decorative elements that obstruct controls.

IMPLEMENTATION
1. Propose a small reusable token/component change, then apply it consistently.
2. Refine Welcome, My Trips, and Overview first, then the remaining workspace screens.
3. Use live authorized data and genuine empty/loading/error states.
4. Do not introduce dead buttons, placeholder actions, fake charts, or mock production data.
5. Do not change the audited backend to support decoration.

VERIFICATION
Run npm run lint, npm run build, npm test, npm audit, and npm run test:e2e. Execute the authenticated desktop/mobile walkthrough and verify browser errors and failed requests. Use only new disposable QA accounts/trips for testing. Never use a production seeding command. For live browser tests, follow the documented guarded PLAYWRIGHT_BASE_URL and PLAYWRIGHT_ALLOW_LIVE configuration; do not enable traces that capture cookies or invitation tokens.

DELIVER
Provide a concise list of actual visual changes, screenshots of safe non-secret views, executed test results, and any remaining defects. Preserve existing financial and authorization behavior. Do not claim perfection or test success without running the checks. Do not merge or redeploy this optional UI branch until the checks pass and I authorize publishing the visual changes.
```

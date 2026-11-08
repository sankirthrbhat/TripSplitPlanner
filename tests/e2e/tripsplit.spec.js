import { expect, test } from '@playwright/test';
import { randomBytes } from 'node:crypto';

test.describe.serial('TripSplit Planner End-to-End Browser Flows', () => {
  const uniqueSuffix = Date.now();
  const ownerEmail = `aarav.e2e.${uniqueSuffix}@example.com`;
  const memberEmail = `diya.e2e.${uniqueSuffix}@example.com`;
  const outsiderEmail = `outsider.e2e.${uniqueSuffix}@example.com`;
  const password = randomBytes(24).toString('base64url') + 'A7';
  const tripTitle = `DISPOSABLE CIA-2 Browser QA ${uniqueSuffix}`;

  let ownerContext;
  let memberContext;
  let outsiderContext;

  let ownerPage;
  let memberPage;
  let outsiderPage;

  let tripId;
  let inviteFullUrl;

  const pageErrors = [];
  const consoleErrors = [];
  const serverErrors = [];

  function attachDiagnostics(page, label) {
    page.on('pageerror', (err) => {
      pageErrors.push(`[${label}] ${err.message}`);
    });
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      // Expected 4xx responses from negative auth/validation tests log network messages in Chrome
      const isExpected4xxResourceMsg =
        text.includes('Failed to load resource') &&
        /status of (400|401|403|404|409)\b/.test(text);
      if (!isExpected4xxResourceMsg) {
        consoleErrors.push(`[${label}] ${text}`);
      }
    });
    page.on('response', (res) => {
      if (res.status() >= 500) {
        const safeUrl = res.url().replace(/\/(invite|invitations)\/[^/?]+/g, '/$1/[redacted]');
        serverErrors.push(`[${label}] ${res.status()} ${safeUrl}`);
      }
    });
  }

  test.beforeAll(async ({ browser }) => {
    ownerContext = await browser.newContext();
    memberContext = await browser.newContext();
    outsiderContext = await browser.newContext();

    ownerPage = await ownerContext.newPage();
    memberPage = await memberContext.newPage();
    outsiderPage = await outsiderContext.newPage();

    attachDiagnostics(ownerPage, 'owner');
    attachDiagnostics(memberPage, 'member');
    attachDiagnostics(outsiderPage, 'outsider');
  });

  test.afterAll(async () => {
    await ownerContext?.close();
    await memberContext?.close();
    await outsiderContext?.close();
  });

  test('01. Unauthenticated access redirects to login and blocks invalid credentials', async () => {
    await ownerPage.goto('/trips');
    await expect(ownerPage).toHaveURL(/\/login\?redirect=%2Ftrips/);

    await ownerPage.getByLabel(/email address/i).fill(ownerEmail);
    await ownerPage.getByLabel(/^password/i).fill('WrongPassword999');
    await ownerPage.getByRole('button', { name: /sign in/i }).click();

    const alert = ownerPage.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/invalid email or password/i);
  });

  test('02. User registration sets httpOnly cookie and stores zero tokens in Web Storage', async () => {
    await ownerPage.goto('/register');
    await ownerPage.getByLabel(/full name/i).fill('Aarav E2E');
    await ownerPage.getByLabel(/email address/i).fill(ownerEmail);
    await ownerPage.getByLabel(/^password/i).fill(password);
    await ownerPage.getByRole('button', { name: /create account/i }).click();

    await expect(ownerPage).toHaveURL(/\/trips$/);
    await expect(ownerPage.getByText(/no trips created yet/i)).toBeVisible();

    const storageCheck = await ownerPage.evaluate(() => ({
      localStorageKeys: Object.keys(window.localStorage),
      sessionStorageKeys: Object.keys(window.sessionStorage),
      documentCookie: document.cookie,
    }));

    expect(storageCheck.localStorageKeys).toEqual([]);
    expect(storageCheck.sessionStorageKeys).toEqual([]);
    expect(storageCheck.documentCookie).not.toContain('tripsplit_token');

    const cookies = await ownerContext.cookies();
    const sessionCookie = cookies.find((c) => c.name === 'tripsplit_token');
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie.httpOnly).toBe(true);
    expect(sessionCookie.sameSite).toBe('Lax');
    if (process.env.PLAYWRIGHT_BASE_URL?.startsWith('https://')) {
      expect(sessionCookie.secure).toBe(true);
    }
  });

  test('03. Logout clears session cookie and re-login restores workspace', async () => {
    await ownerPage.getByRole('button', { name: /log out/i }).click();
    await expect(ownerPage).toHaveURL(/\/login(\?redirect=%2Ftrips)?$/);

    const cookiesAfterLogout = await ownerContext.cookies();
    const activeToken = cookiesAfterLogout.find(
      (c) => c.name === 'tripsplit_token' && c.value
    );
    expect(activeToken).toBeUndefined();

    // Navigating to protected route after logout redirects back to /login
    await ownerPage.goto('/trips');
    await expect(ownerPage).toHaveURL(/\/login\?redirect=%2Ftrips/);

    await ownerPage.getByLabel(/email address/i).fill(ownerEmail);
    await ownerPage.getByLabel(/^password/i).fill(password);
    await ownerPage.getByRole('button', { name: /sign in/i }).click();

    await expect(ownerPage).toHaveURL(/\/trips$/);
    await expect(ownerPage.getByText(/no trips created yet/i)).toBeVisible();
  });

  test('04. Trip creation enforces date validation and initializes trip workspace', async () => {
    await ownerPage.getByRole('link', { name: /plan your first trip/i }).click();
    await expect(ownerPage).toHaveURL(/\/trips\/new$/);

    await ownerPage.getByLabel(/trip title/i).fill(tripTitle);
    await ownerPage.getByLabel(/destination/i).fill('Munnar, Kerala');
    await ownerPage.getByLabel(/start date/i).fill('2026-12-20');
    await ownerPage.getByLabel(/end date/i).fill('2026-12-18');
    await ownerPage.getByLabel(/total group budget cap/i).fill('15000.00');
    await ownerPage.getByRole('button', { name: /create trip workspace/i }).click();

    await expect(
      ownerPage.getByText(/end date cannot be before start date/i)
    ).toBeVisible();

    await ownerPage.getByLabel(/start date/i).fill('2026-12-18');
    await ownerPage.getByLabel(/end date/i).fill('2026-12-20');
    await ownerPage.getByRole('button', { name: /create trip workspace/i }).click();

    await expect(ownerPage).toHaveURL(/\/trips\/[a-f0-9]{24}$/);
    tripId = ownerPage.url().split('/trips/')[1];

    await expect(
      ownerPage.getByRole('heading', { name: tripTitle })
    ).toBeVisible();
    await expect(ownerPage.getByText('Trip Pulse Readiness')).toBeVisible();
  });

  test('05. Itinerary scheduling detects partial overlaps and allows touching endpoints', async () => {
    await ownerPage.getByRole('link', { name: 'Itinerary', exact: true }).click();
    await ownerPage.getByRole('button', { name: /add activity/i }).click();

    await ownerPage.getByLabel(/activity title/i).fill('Eravikulam Morning Trek');
    await ownerPage.getByLabel(/start date & time/i).fill('2026-12-19T09:00');
    await ownerPage.getByLabel(/end date & time/i).fill('2026-12-19T12:00');
    await ownerPage.getByRole('button', { name: /^add activity$/i }).last().click();

    await expect(
      ownerPage.getByRole('heading', { name: 'Eravikulam Morning Trek' })
    ).toBeVisible();
    await expect(ownerPage.getByTestId('conflict-alert-panel')).toHaveCount(0);

    // Overlapping activity: 11:00 - 13:00 overlaps 09:00 - 12:00 by 60 minutes
    await ownerPage.getByRole('button', { name: /add activity/i }).click();
    await ownerPage.getByLabel(/activity title/i).fill('Mattupetty Boating');
    await ownerPage.getByLabel(/start date & time/i).fill('2026-12-19T11:00');
    await ownerPage.getByLabel(/end date & time/i).fill('2026-12-19T13:00');
    await ownerPage.getByRole('button', { name: /^add activity$/i }).last().click();

    const conflictPanel = ownerPage.getByTestId('conflict-alert-panel');
    await expect(conflictPanel).toBeVisible();
    await expect(conflictPanel).toContainText(/1 schedule conflict detected/i);
    await expect(conflictPanel).toContainText(/60 min/i);

    // Adjacent activity touching at 13:00 -> must NOT add a second conflict
    await ownerPage.getByRole('button', { name: /add activity/i }).click();
    await ownerPage.getByLabel(/activity title/i).fill('Tea Museum Guided Walk');
    await ownerPage.getByLabel(/start date & time/i).fill('2026-12-19T13:00');
    await ownerPage.getByLabel(/end date & time/i).fill('2026-12-19T14:30');
    await ownerPage.getByRole('button', { name: /^add activity$/i }).last().click();

    await expect(
      ownerPage.getByRole('heading', { name: 'Tea Museum Guided Walk' })
    ).toBeVisible();
    await expect(conflictPanel).toContainText(/1 schedule conflict detected/i);
  });

  test('06. Cross-trip authorization blocks authenticated non-members with 403 Access Denied', async () => {
    await outsiderPage.goto('/register');
    await outsiderPage.getByLabel(/full name/i).fill('Vikram Outsider');
    await outsiderPage.getByLabel(/email address/i).fill(outsiderEmail);
    await outsiderPage.getByLabel(/^password/i).fill(password);
    await outsiderPage.getByRole('button', { name: /create account/i }).click();
    await expect(outsiderPage).toHaveURL(/\/trips$/);

    await outsiderPage.goto(`/trips/${tripId}`);
    await expect(
      outsiderPage.getByRole('heading', { name: /access denied/i })
    ).toBeVisible();

    await outsiderPage.goto(`/trips/${tripId}/expenses`);
    await expect(
      outsiderPage.getByRole('heading', { name: /access denied/i })
    ).toBeVisible();
  });

  test('07. Invitation generation, preview, single-use acceptance, and replay prevention', async () => {
    await ownerPage.getByRole('link', { name: 'Members', exact: true }).click();
    await ownerPage.getByLabel(/recipient note/i).fill('Diya Invite');
    await ownerPage
      .getByRole('button', { name: /generate 7-day invite link/i })
      .click();

    const inviteInput = ownerPage.getByLabel('Generated invitation link');
    await expect(inviteInput).toBeVisible();
    inviteFullUrl = await inviteInput.inputValue();

    await memberPage.goto('/register');
    await memberPage.getByLabel(/full name/i).fill('Diya E2E');
    await memberPage.getByLabel(/email address/i).fill(memberEmail);
    await memberPage.getByLabel(/^password/i).fill(password);
    await memberPage.getByRole('button', { name: /create account/i }).click();
    await expect(memberPage).toHaveURL(/\/trips$/);

    await memberPage.goto(inviteFullUrl);
    await expect(
      memberPage.getByRole('heading', { name: tripTitle })
    ).toBeVisible();
    await expect(memberPage.getByText(/invited by/i)).toContainText('Aarav E2E');
    await memberPage
      .getByRole('button', { name: /accept invitation & join trip/i })
      .click();

    await expect(memberPage).toHaveURL(new RegExp(`/trips/${tripId}$`));
    await expect(memberPage.getByText('2 members')).toBeVisible();

    // Outsider visiting the already-used single-use invite link cannot accept it
    await outsiderPage.goto(inviteFullUrl);
    await expect(
      outsiderPage.getByText(/can no longer be accepted/i)
    ).toBeVisible();
    await expect(
      outsiderPage.getByRole('button', { name: /accept invitation & join trip/i })
    ).toHaveCount(0);
  });

  test('08. Responsibility management assigns tasks to a specific member and tracks completion', async () => {
    await memberPage.getByRole('link', { name: 'Tasks', exact: true }).click();
    await memberPage.getByRole('button', { name: /new task/i }).click();

    const taskDialog = memberPage.getByRole('dialog');
    await taskDialog.getByLabel(/task title/i).fill('Carry trekking raincoats');
    await taskDialog
      .getByLabel(/assigned member/i)
      .selectOption({ label: 'Diya E2E' });
    await taskDialog.getByLabel(/priority/i).selectOption('high');
    await taskDialog.getByLabel(/due date/i).fill('2026-12-18');
    await taskDialog.getByRole('button', { name: /create task/i }).click();

    await expect(
      memberPage.getByRole('heading', { name: 'Carry trekking raincoats' })
    ).toBeVisible();
    await expect(memberPage.getByText('0/1 completed (0%)')).toBeVisible();

    // Filter by Assignee = Diya E2E to prove the task was assigned to Diya E2E specifically
    await memberPage
      .getByLabel(/assignee:/i)
      .selectOption({ label: 'Diya E2E' });
    await expect(
      memberPage.getByRole('heading', { name: 'Carry trekking raincoats' })
    ).toBeVisible();

    // Mark task Done and verify completion progress bar reaches 100%
    await memberPage
      .getByLabel('Change status for Carry trekking raincoats')
      .selectOption('done');
    await expect(memberPage.getByText('1/1 completed (100%)')).toBeVisible();
  });

  test('09. Booking management records reservation details and reference numbers', async () => {
    await memberPage.getByRole('link', { name: 'Bookings', exact: true }).click();
    await memberPage.getByRole('button', { name: /add booking/i }).click();

    const bookingDialog = memberPage.getByRole('dialog');
    await bookingDialog
      .getByLabel(/booking title/i)
      .fill('Tea Valley Eco Cottage');
    await bookingDialog
      .getByLabel(/provider \/ vendor/i)
      .fill('Tea Valley Stays');
    await bookingDialog.getByLabel(/reference number/i).fill('TV-7721');
    await bookingDialog.getByRole('button', { name: /save booking/i }).click();

    await expect(
      memberPage.getByRole('heading', { name: 'Tea Valley Eco Cottage' })
    ).toBeVisible();
    await expect(memberPage.getByText('Ref: TV-7721')).toBeVisible();
  });

  test('10. Expense ledger supports equal splits, custom splits, and split-sum validation', async () => {
    // Hold the first ledger request to reproduce real-network latency while
    // the owner's cached trip still predates the invitation acceptance.
    let releaseLedger;
    const ledgerGate = new Promise((resolve) => { releaseLedger = resolve; });
    const ledgerUrl = `**/api/trips/${tripId}/expenses*`;
    const holdLedger = async (route) => {
      if (route.request().method() === 'GET') await ledgerGate;
      await route.continue();
    };
    await ownerPage.route(ledgerUrl, holdLedger);
    // 1) Paid equal split by Aarav: ₹2,000.00 (₹1,000.00 each)
    await ownerPage.getByRole('link', { name: 'Expenses', exact: true }).click();
    await expect(ownerPage.getByRole('button', { name: /add expense/i })).toBeDisabled();
    releaseLedger();
    await expect(ownerPage.getByRole('button', { name: /add expense/i })).toBeEnabled();
    await ownerPage.unroute(ledgerUrl, holdLedger);
    await ownerPage.getByRole('button', { name: /add expense/i }).click();
    const ownerExpenseDialog = ownerPage.getByRole('dialog');
    await ownerExpenseDialog.getByLabel(/^title/i).fill('Cottage Booking Advance');
    await ownerExpenseDialog.getByLabel(/amount \(₹ inr\)/i).fill('2000.00');
    await ownerExpenseDialog.getByLabel(/expense status/i).selectOption('paid');
    await ownerExpenseDialog.getByLabel(/paid by/i).selectOption({ label: 'Aarav E2E' });
    await expect(ownerExpenseDialog.getByLabel('Aarav E2E', { exact: true })).toBeChecked();
    await expect(ownerExpenseDialog.getByLabel('Diya E2E', { exact: true })).toBeChecked();
    await expect(ownerExpenseDialog.getByText('₹1,000.00', { exact: true })).toHaveCount(2);
    await ownerExpenseDialog.getByRole('button', { name: /save expense/i }).click();

    await expect(
      ownerPage.getByRole('heading', { name: 'Cottage Booking Advance' })
    ).toBeVisible();

    // 2) Planned equal split by Diya: ₹1,000.00 (₹500.00 each)
    await memberPage.getByRole('link', { name: 'Expenses', exact: true }).click();
    await memberPage.getByRole('button', { name: /add expense/i }).click();
    const memberExpenseDialog = memberPage.getByRole('dialog');
    await memberExpenseDialog.getByLabel(/^title/i).fill('Planned Jeep Hire');
    await memberExpenseDialog.getByLabel(/amount \(₹ inr\)/i).fill('1000.00');
    await memberExpenseDialog.getByRole('button', { name: /save expense/i }).click();

    await expect(
      memberPage.getByRole('heading', { name: 'Planned Jeep Hire' })
    ).toBeVisible();

    // 3) Custom split expense by Diya: ₹1,500.00 (first test invalid sum, then valid ₹900 + ₹600)
    await memberPage.getByRole('button', { name: /add expense/i }).click();
    const customDialog = memberPage.getByRole('dialog');
    await customDialog.getByLabel(/^title/i).fill('Spice Plantation Lunch');
    await customDialog.getByLabel(/amount \(₹ inr\)/i).fill('1500.00');
    await customDialog.getByLabel(/expense status/i).selectOption('paid');
    await customDialog
      .getByLabel(/paid by/i)
      .selectOption({ label: 'Diya E2E' });
    await customDialog.getByRole('button', { name: /custom split/i }).click();

    await customDialog.getByLabel('Custom share for Aarav E2E').fill('800.00');
    await customDialog.getByLabel('Custom share for Diya E2E').fill('500.00');
    await customDialog.getByRole('button', { name: /save expense/i }).click();

    await expect(customDialog.getByRole('alert')).toContainText(
      /custom shares total \(₹1,300\.00\) must equal expense amount \(₹1,500\.00\)/i
    );

    await customDialog.getByLabel('Custom share for Aarav E2E').fill('900.00');
    await customDialog.getByLabel('Custom share for Diya E2E').fill('600.00');
    await customDialog.getByRole('button', { name: /save expense/i }).click();

    await expect(
      memberPage.getByRole('heading', { name: 'Spice Plantation Lunch' })
    ).toBeVisible();
    await expect(memberPage.getByText('Aarav E2E: ₹900.00')).toBeVisible();
    await expect(memberPage.getByText('Diya E2E: ₹600.00')).toBeVisible();
  });

  test('11. Per-person estimates, paid-only settlements, and What-If Simulator operate accurately', async () => {
    await ownerPage.reload();

    // Total Estimate = 2000 + 1000 + 1500 = ₹4,500.00; Total Paid = ₹3,500.00; Planned = ₹1,000.00
    await expect(ownerPage.getByText('₹4,500.00').first()).toBeVisible();
    await expect(ownerPage.getByText('₹3,500.00').first()).toBeVisible();
    await expect(ownerPage.getByText('₹1,000.00').first()).toBeVisible();

    // Paid-only net balance: Aarav paid 2000, share 1900 (+100); Diya paid 1500, share 1600 (-100)
    const settlements = ownerPage.getByTestId('settlement-transfers-list');
    await expect(settlements).toBeVisible();
    await expect(settlements).toContainText('Diya E2E');
    await expect(settlements).toContainText('Aarav E2E');
    await expect(settlements).toContainText('₹100.00');

    // Run non-mutating What-If Budget Simulator
    await ownerPage.getByRole('button', { name: /what-if simulator/i }).click();
    const simDialog = ownerPage.getByRole('dialog');
    await simDialog.getByLabel(/simulated amount/i).fill('2000.00');
    await expect(simDialog.getByRole('button', { name: 'Diya E2E', exact: true })).toBeVisible();
    await simDialog
      .getByRole('button', { name: /run simulation preview/i })
      .click();

    await expect(
      simDialog.getByText(/simulation preview \(unsaved\)/i)
    ).toBeVisible();
    await expect(simDialog.getByText('₹6,500.00')).toBeVisible();
    await simDialog.getByRole('button', { name: /close modal/i }).click();

    // Persisted ledger total remains ₹4,500.00
    await expect(ownerPage.getByText('₹4,500.00').first()).toBeVisible();
  });

  test('12. Deleting an expense immediately recalculates estimates and settlement transfers', async () => {
    await ownerPage
      .getByRole('button', { name: 'Delete Spice Plantation Lunch' })
      .click();
    const confirmDialog = ownerPage.getByRole('dialog');
    await confirmDialog
      .getByRole('button', { name: /delete expense/i })
      .click();

    await expect(
      ownerPage.getByRole('heading', { name: 'Spice Plantation Lunch' })
    ).toHaveCount(0);

    // Totals recalculate to ₹3,000.00 total, ₹2,000.00 paid, and Diya -> Aarav ₹1,000.00 transfer
    await expect(ownerPage.getByText('₹3,000.00').first()).toBeVisible();
    await expect(ownerPage.getByText('₹2,000.00').first()).toBeVisible();

    const settlements = ownerPage.getByTestId('settlement-transfers-list');
    await expect(settlements).toContainText('₹1,000.00');
  });

  test('13. Collaborator role restrictions, reload persistence, and conflict resolution', async () => {
    // Collaborator sees read-only settings and cannot delete the trip
    await memberPage.getByRole('link', { name: 'Settings', exact: true }).click();
    await expect(
      memberPage.getByText(/read-only view \(collaborator role\)/i)
    ).toBeVisible();
    await expect(
      memberPage.getByRole('button', { name: /delete trip permanently/i })
    ).toHaveCount(0);

    // Browser reload preserves session and overview metrics
    await ownerPage.goto(`/trips/${tripId}`);
    await ownerPage.reload();
    await expect(ownerPage.getByText('Trip Pulse Readiness')).toBeVisible();
    await expect(
      ownerPage.getByText('1 Schedule Overlap Detected')
    ).toBeVisible();

    // Resolve the itinerary conflict via Adjust Time (move Mattupetty Boating to 12:00 - 13:00)
    await ownerPage.getByRole('link', { name: 'Itinerary', exact: true }).click();
    await ownerPage.getByRole('button', { name: /adjust time/i }).last().click();
    const editDialog = ownerPage.getByRole('dialog');
    await editDialog.getByLabel(/start date & time/i).fill('2026-12-19T12:00');
    await editDialog.getByLabel(/end date & time/i).fill('2026-12-19T13:00');
    await editDialog.getByRole('button', { name: /save changes/i }).click();

    await expect(ownerPage.getByTestId('conflict-alert-panel')).toHaveCount(0);
  });

  test('14. Mobile and tablet layouts render every workspace tab without horizontal overflow', async () => {
    for (const viewport of [{ width: 375, height: 812 }, { width: 768, height: 1024 }]) {
      await ownerPage.setViewportSize(viewport);
      for (const subPath of ['', '/itinerary', '/bookings', '/tasks', '/expenses', '/members', '/settings']) {
        await ownerPage.goto(`/trips/${tripId}${subPath}`);
        await ownerPage.waitForLoadState('networkidle');
        const overflow = await ownerPage.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth
        );
        expect(overflow, `${viewport.width}px overflow on ${subPath || 'overview'}`).toBeLessThanOrEqual(4);
      }
    }

    await ownerPage.setViewportSize({ width: 375, height: 812 });
    const mobileMenuButton = ownerPage.getByRole('button', {
      name: /open menu/i,
    });
    await expect(mobileMenuButton).toBeVisible();
    await mobileMenuButton.click();
    await expect(
      ownerPage.getByRole('link', { name: 'My Trips', exact: true })
    ).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(serverErrors).toEqual([]);
  });
});

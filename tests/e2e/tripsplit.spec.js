import { expect, test } from '@playwright/test';

test.describe('TripSplit Planner End-to-End Browser Flows', () => {
  test('full collaborative group trip lifecycle, security isolation, and mobile responsiveness', async ({
    browser,
  }) => {
    const uniqueSuffix = Date.now();
    const ownerEmail = `aarav.e2e.${uniqueSuffix}@example.com`;
    const memberEmail = `diya.e2e.${uniqueSuffix}@example.com`;
    const outsiderEmail = `outsider.e2e.${uniqueSuffix}@example.com`;

    const ownerContext = await browser.newContext();
    const memberContext = await browser.newContext();
    const outsiderContext = await browser.newContext();

    const ownerPage = await ownerContext.newPage();
    const memberPage = await memberContext.newPage();
    const outsiderPage = await outsiderContext.newPage();

    const pageErrors = [];
    const consoleErrors = [];
    ownerPage.on('pageerror', (err) => pageErrors.push(err.message));
    ownerPage.on('console', (msg) => {
      if (msg.type() === 'error' && !msg.text().includes('401')) {
        consoleErrors.push(msg.text());
      }
    });

    // 1. New user registers
    await ownerPage.goto('/register');
    await ownerPage.getByLabel(/full name/i).fill('Aarav E2E');
    await ownerPage.getByLabel(/email address/i).fill(ownerEmail);
    await ownerPage.getByLabel(/^password/i).fill('StrongPass123');
    await ownerPage.getByRole('button', { name: /create account/i }).click();

    await expect(ownerPage).toHaveURL(/\/trips$/);
    await expect(ownerPage.getByText(/no trips created yet/i)).toBeVisible();

    // 2. User creates trip
    await ownerPage.getByRole('link', { name: /plan your first trip/i }).click();
    await expect(ownerPage).toHaveURL(/\/trips\/new$/);

    await ownerPage.getByLabel(/trip title/i).fill('Munnar Tea Hills E2E');
    await ownerPage.getByLabel(/destination/i).fill('Munnar, Kerala');
    await ownerPage.getByLabel(/start date/i).fill('2026-12-18');
    await ownerPage.getByLabel(/end date/i).fill('2026-12-20');
    await ownerPage.getByLabel(/total group budget cap/i).fill('15000.00');
    await ownerPage.getByRole('button', { name: /create trip workspace/i }).click();

    await expect(ownerPage).toHaveURL(/\/trips\/[a-f0-9]{24}$/);
    const tripUrl = ownerPage.url();
    const tripId = tripUrl.split('/trips/')[1];

    await expect(ownerPage.getByRole('heading', { name: 'Munnar Tea Hills E2E' })).toBeVisible();

    // 3. User adds activities (including an intentional overlap)
    await ownerPage.getByRole('link', { name: 'Itinerary', exact: true }).click();
    await ownerPage.getByRole('button', { name: /add activity/i }).click();

    await ownerPage.getByLabel(/activity title/i).fill('Eravikulam Morning Trek');
    await ownerPage.getByLabel(/start date & time/i).fill('2026-12-19T09:00');
    await ownerPage.getByLabel(/end date & time/i).fill('2026-12-19T12:00');
    await ownerPage.getByRole('button', { name: /^add activity$/i }).last().click();

    await expect(
      ownerPage.getByRole('heading', { name: 'Eravikulam Morning Trek' })
    ).toBeVisible();

    // 4. Overlapping activity warning appears
    await ownerPage.getByRole('button', { name: /add activity/i }).click();
    await ownerPage.getByLabel(/activity title/i).fill('Mattupetty Boating');
    await ownerPage.getByLabel(/start date & time/i).fill('2026-12-19T11:00');
    await ownerPage.getByLabel(/end date & time/i).fill('2026-12-19T13:00');
    await ownerPage.getByRole('button', { name: /^add activity$/i }).last().click();

    const conflictPanel = ownerPage.getByTestId('conflict-alert-panel');
    await expect(conflictPanel).toBeVisible();
    await expect(conflictPanel).toContainText(/1 schedule conflict detected/i);
    await expect(conflictPanel).toContainText(/60 min/i);

    // 5. User creates invitation
    await ownerPage.getByRole('link', { name: 'Members', exact: true }).click();
    await ownerPage.getByLabel(/recipient note/i).fill('Diya Invite');
    await ownerPage.getByRole('button', { name: /generate 7-day invite link/i }).click();

    const inviteInput = ownerPage.getByLabel('Generated invitation link');
    await expect(inviteInput).toBeVisible();
    const inviteFullUrl = await inviteInput.inputValue();

    // 13 (pre-join check). Unauthorized outsider user is blocked from accessing trip
    await outsiderPage.goto('/register');
    await outsiderPage.getByLabel(/full name/i).fill('Vikram Outsider');
    await outsiderPage.getByLabel(/email address/i).fill(outsiderEmail);
    await outsiderPage.getByLabel(/^password/i).fill('StrongPass123');
    await outsiderPage.getByRole('button', { name: /create account/i }).click();
    await expect(outsiderPage).toHaveURL(/\/trips$/);

    await outsiderPage.goto(`/trips/${tripId}`);
    await expect(outsiderPage.getByRole('heading', { name: /access denied/i })).toBeVisible();

    // 6. Second user registers/logs in and joins via invitation link
    await memberPage.goto('/register');
    await memberPage.getByLabel(/full name/i).fill('Diya E2E');
    await memberPage.getByLabel(/email address/i).fill(memberEmail);
    await memberPage.getByLabel(/^password/i).fill('StrongPass123');
    await memberPage.getByRole('button', { name: /create account/i }).click();
    await expect(memberPage).toHaveURL(/\/trips$/);

    await memberPage.goto(inviteFullUrl);
    await expect(memberPage.getByRole('heading', { name: 'Munnar Tea Hills E2E' })).toBeVisible();
    await memberPage.getByRole('button', { name: /accept invitation & join trip/i }).click();

    await expect(memberPage).toHaveURL(new RegExp(`/trips/${tripId}$`));
    await expect(memberPage.getByText('2 members')).toBeVisible();

    // 7. User assigns task
    await memberPage.getByRole('link', { name: 'Tasks', exact: true }).click();
    await memberPage.getByRole('button', { name: /new task/i }).click();
    const taskDialog = memberPage.getByRole('dialog');
    await taskDialog.getByLabel(/task title/i).fill('Carry trekking raincoats');
    await taskDialog.getByRole('button', { name: /create task/i }).click();
    await expect(
      memberPage.getByRole('heading', { name: 'Carry trekking raincoats' })
    ).toBeVisible();

    // 8. User records booking
    await memberPage.getByRole('link', { name: 'Bookings', exact: true }).click();
    await memberPage.getByRole('button', { name: /add booking/i }).click();
    const bookingDialog = memberPage.getByRole('dialog');
    await bookingDialog.getByLabel(/booking title/i).fill('Tea Valley Eco Cottage');
    await bookingDialog.getByLabel(/provider \/ vendor/i).fill('Tea Valley Stays');
    await bookingDialog.getByLabel(/reference number/i).fill('TV-7721');
    await bookingDialog.getByRole('button', { name: /save booking/i }).click();
    await expect(
      memberPage.getByRole('heading', { name: 'Tea Valley Eco Cottage' })
    ).toBeVisible();
    await expect(memberPage.getByText('Ref: TV-7721')).toBeVisible();

    // 9. Users enter planned and paid expenses
    await ownerPage.getByRole('link', { name: 'Expenses', exact: true }).click();
    // Paid expense by Aarav: ₹2,000.00 split equally between Aarav and Diya (₹1,000 each)
    await ownerPage.getByRole('button', { name: /add expense/i }).click();
    const ownerExpenseDialog = ownerPage.getByRole('dialog');
    await ownerExpenseDialog.getByLabel(/^title/i).fill('Cottage Booking Advance');
    await ownerExpenseDialog.getByLabel(/amount \(₹ inr\)/i).fill('2000.00');
    await ownerExpenseDialog.getByLabel(/expense status/i).selectOption('paid');
    await ownerExpenseDialog.getByRole('button', { name: /save expense/i }).click();

    await expect(
      ownerPage.getByRole('heading', { name: 'Cottage Booking Advance' })
    ).toBeVisible();

    // Planned expense by Diya: ₹1,000.00 split equally (₹500 each)
    await memberPage.getByRole('link', { name: 'Expenses', exact: true }).click();
    await memberPage.getByRole('button', { name: /add expense/i }).click();
    const memberExpenseDialog = memberPage.getByRole('dialog');
    await memberExpenseDialog.getByLabel(/^title/i).fill('Planned Jeep Hire');
    await memberExpenseDialog.getByLabel(/amount \(₹ inr\)/i).fill('1000.00');
    await memberExpenseDialog.getByRole('button', { name: /save expense/i }).click();

    await expect(
      memberPage.getByRole('heading', { name: 'Planned Jeep Hire' })
    ).toBeVisible();

    // 10 & 11. Cost summary recalculates and settlement recommendation is correct
    await ownerPage.reload();
    await expect(ownerPage.getByText('₹3,000.00').first()).toBeVisible(); // Trip Total Estimate
    await expect(ownerPage.getByText('₹2,000.00').first()).toBeVisible(); // Total Paid Out

    const settlements = ownerPage.getByTestId('settlement-transfers-list');
    await expect(settlements).toBeVisible();
    // Diya owes Aarav ₹1,000.00 from paid expense ONLY (planned expense excluded)
    await expect(settlements).toContainText('Diya E2E');
    await expect(settlements).toContainText('Aarav E2E');
    await expect(settlements).toContainText('₹1,000.00');

    // 12. Browser refresh preserves session & persisted data
    await ownerPage.goto(`/trips/${tripId}`);
    await ownerPage.reload();
    await expect(ownerPage.getByText('Trip Pulse Readiness')).toBeVisible();
    await expect(ownerPage.getByText('1 Schedule Overlap Detected')).toBeVisible();

    // 14. Mobile layout (375px) is usable with accessible menu
    await ownerPage.setViewportSize({ width: 375, height: 812 });
    const mobileMenuButton = ownerPage.getByRole('button', { name: /open menu/i });
    await expect(mobileMenuButton).toBeVisible();
    await mobileMenuButton.click();
    await expect(ownerPage.getByRole('link', { name: 'My Trips', exact: true })).toBeVisible();

    const overflowDiff = await ownerPage.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflowDiff).toBeLessThanOrEqual(4);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);

    await ownerContext.close();
    await memberContext.close();
    await outsiderContext.close();
  });
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { AuthProvider } from '../hooks/useAuth';
import { ToastProvider } from '../hooks/useToast';
import { ExpensesPage } from '../pages/ExpensesPage';
import { ItineraryPage } from '../pages/ItineraryPage';
import { LoginPage } from '../pages/LoginPage';
import { MyTripsPage } from '../pages/MyTripsPage';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function mockFetchJson(routes) {
  globalThis.fetch = vi.fn(async (url, init) => {
    const path = String(url);
    const method = (init?.method || 'GET').toUpperCase();

    for (const r of routes) {
      if (path.includes(r.match) && (!r.method || r.method === method)) {
        const status = r.status ?? 200;
        return {
          ok: status >= 200 && status < 300,
          status,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => r.body,
        };
      }
    }

    return {
      ok: false,
      status: 404,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: false,
        error: { code: 'NOT_FOUND', message: `No mock for ${method} ${path}` },
      }),
    };
  });
}

const sampleTrip = {
  id: 'trip-1',
  title: 'Coorg Weekend Escape',
  destination: 'Madikeri, Coorg',
  startDate: '2026-12-11T00:00:00.000Z',
  endDate: '2026-12-13T23:59:59.000Z',
  timezone: 'Asia/Kolkata',
  currency: 'INR',
  budgetLimitMinor: 3200000,
  viewerRole: 'owner',
  members: [
    { userId: 'u-1', displayName: 'Aarav Sharma', email: 'aarav@demo.test', role: 'owner' },
    { userId: 'u-2', displayName: 'Diya Nair', email: 'diya@demo.test', role: 'member' },
  ],
};

function renderWithProviders(ui, { initialEntries = ['/'] } = {}) {
  const queryClient = makeQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <ToastProvider>
          <AuthProvider>{ui}</AuthProvider>
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('TripSplit Planner Frontend Component & Route Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. redirects unauthenticated user from protected /trips route to /login', async () => {
    mockFetchJson([
      {
        match: '/api/auth/me',
        status: 401,
        body: { success: false, error: { code: 'UNAUTHENTICATED', message: 'Login required' } },
      },
    ]);

    renderWithProviders(<App />, { initialEntries: ['/trips'] });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /sign in to tripsplit/i })).toBeInTheDocument();
    });
  });

  it('2. displays form validation errors on LoginPage when submitting invalid input', async () => {
    mockFetchJson([
      {
        match: '/api/auth/me',
        status: 401,
        body: { success: false, error: { code: 'UNAUTHENTICATED', message: 'Login required' } },
      },
    ]);

    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/enter a valid email address/i)).toBeInTheDocument();
    expect(await screen.findByText(/password is required/i)).toBeInTheDocument();
  });

  it('3. renders empty state on MyTripsPage when authenticated user has zero trips', async () => {
    mockFetchJson([
      {
        match: '/api/auth/me',
        status: 200,
        body: { success: true, data: { user: { id: 'u-1', displayName: 'Aarav', email: 'a@b.com' } } },
      },
      {
        match: '/api/trips',
        status: 200,
        body: { success: true, data: { trips: [] } },
      },
    ]);

    renderWithProviders(<MyTripsPage />);

    expect(await screen.findByText(/no trips created yet/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /plan your first trip/i })).toBeInTheDocument();
  });

  it('4. renders API error state cleanly when trips request fails', async () => {
    mockFetchJson([
      {
        match: '/api/auth/me',
        status: 200,
        body: { success: true, data: { user: { id: 'u-1', displayName: 'Aarav', email: 'a@b.com' } } },
      },
      {
        match: '/api/trips',
        status: 500,
        body: { success: false, error: { code: 'SERVER_ERR', message: 'Database unavailable' } },
      },
    ]);

    renderWithProviders(<MyTripsPage />);

    expect(await screen.findByText(/failed to load trips/i)).toBeInTheDocument();
    expect(screen.getByText(/database unavailable/i)).toBeInTheDocument();
  });

  it('5. renders schedule conflict alert banner and conflict explanations in ItineraryPage', async () => {
    mockFetchJson([
      {
        match: '/api/auth/me',
        status: 200,
        body: { success: true, data: { user: { id: 'u-1', displayName: 'Aarav', email: 'a@b.com' } } },
      },
      {
        match: '/api/trips/trip-1/activities',
        status: 200,
        body: {
          success: true,
          data: {
            activities: [
              {
                id: 'act-1',
                title: 'Jeep Safari',
                category: 'adventure',
                status: 'planned',
                startAt: '2026-12-12T10:00:00.000Z',
                endAt: '2026-12-12T12:00:00.000Z',
                localStartDate: '2026-12-12',
                localEndDate: '2026-12-12',
                hasConflict: true,
                conflicts: [
                  {
                    conflictingActivityId: 'act-2',
                    explanation: '"Jeep Safari" overlaps with "Sunset Walk" for 60 min.',
                  },
                ],
                assignedParticipantIds: ['u-1'],
              },
            ],
            conflictReport: {
              conflictCount: 1,
              conflicts: [
                {
                  id: 'act-1_act-2',
                  explanation: '"Jeep Safari" overlaps with "Sunset Walk" for 60 min.',
                },
              ],
            },
          },
        },
      },
    ]);

    const queryClient = makeQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/trips/trip-1/itinerary']}>
          <ToastProvider>
            <AuthProvider>
              <Routes>
                <Route element={<Outlet context={{ trip: sampleTrip, tripId: 'trip-1' }} />}>
                  <Route path="/trips/:tripId/itinerary" element={<ItineraryPage />} />
                </Route>
              </Routes>
            </AuthProvider>
          </ToastProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    const panel = await screen.findByTestId('conflict-alert-panel');
    expect(panel).toHaveTextContent(/1 schedule conflict detected/i);
    expect(screen.getByText(/time conflict/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /adjust time/i })).toBeInTheDocument();
  });

  it('6. displays per-person cost summary and paid-only settlements in ExpensesPage', async () => {
    mockFetchJson([
      {
        match: '/api/auth/me',
        status: 200,
        body: { success: true, data: { user: { id: 'u-1', displayName: 'Aarav', email: 'a@b.com' } } },
      },
      {
        match: '/api/trips/trip-1/expenses',
        status: 200,
        body: {
          success: true,
          data: {
            expenses: [
              {
                id: 'exp-1',
                title: 'Coorg Estate Stay',
                amountMinor: 400000,
                currency: 'INR',
                category: 'accommodation',
                status: 'paid',
                paidByUserId: { _id: 'u-1', displayName: 'Aarav Sharma' },
                expenseDate: '2026-12-11T10:00:00.000Z',
                shareMode: 'equal',
                participantShares: [
                  { userId: { _id: 'u-1', displayName: 'Aarav Sharma' }, shareMinor: 200000 },
                  { userId: { _id: 'u-2', displayName: 'Diya Nair' }, shareMinor: 200000 },
                ],
              },
            ],
            financialSummary: {
              currency: 'INR',
              expenseCount: 1,
              plannedCount: 0,
              paidCount: 1,
              tripTotalPlannedMinor: 0,
              tripTotalPaidMinor: 400000,
              tripTotalEstimatedMinor: 400000,
              remainingEstimatedMinor: 0,
              budgetLimitMinor: 3200000,
              hasBudget: true,
              budgetDifferenceMinor: 2800000,
              isOverBudget: false,
              participantSummaries: [
                {
                  userId: 'u-1',
                  displayName: 'Aarav Sharma',
                  plannedShareMinor: 0,
                  paidShareMinor: 200000,
                  estimatedTotalMinor: 200000,
                  totalPaidOutMinor: 400000,
                  netBalanceMinor: 200000,
                },
                {
                  userId: 'u-2',
                  displayName: 'Diya Nair',
                  plannedShareMinor: 0,
                  paidShareMinor: 200000,
                  estimatedTotalMinor: 200000,
                  totalPaidOutMinor: 0,
                  netBalanceMinor: -200000,
                },
              ],
              settlements: {
                transfers: [
                  {
                    fromUserId: 'u-2',
                    fromDisplayName: 'Diya Nair',
                    toUserId: 'u-1',
                    toDisplayName: 'Aarav Sharma',
                    amountMinor: 200000,
                  },
                ],
                totalTransferMinor: 200000,
                isSettled: false,
              },
              byCategory: [
                { category: 'accommodation', plannedMinor: 0, paidMinor: 400000, totalMinor: 400000 },
              ],
            },
          },
        },
      },
    ]);

    const queryClient = makeQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/trips/trip-1/expenses']}>
          <ToastProvider>
            <AuthProvider>
              <Routes>
                <Route element={<Outlet context={{ trip: sampleTrip, tripId: 'trip-1' }} />}>
                  <Route path="/trips/:tripId/expenses" element={<ExpensesPage />} />
                </Route>
              </Routes>
            </AuthProvider>
          </ToastProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText('Coorg Estate Stay')).toBeInTheDocument();
    const settlementList = await screen.findByTestId('settlement-transfers-list');
    expect(settlementList).toHaveTextContent('Diya Nair');
    expect(settlementList).toHaveTextContent('Aarav Sharma');
    expect(settlementList).toHaveTextContent('₹2,000.00');
  });
});


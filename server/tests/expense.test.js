import { describe, expect, it } from 'vitest';
import {
  computeEqualShares,
  computeSettlements,
  computeTripFinancialSummary,
  simulateExpenseImpact,
  validateAndNormalizeCustomShares,
} from '../src/services/expense.service.js';

describe('Expense & Settlement Engine (Integer Paise)', () => {
  const members = [
    { userId: 'u_a', displayName: 'Alice', email: 'alice@example.com', role: 'owner' },
    { userId: 'u_b', displayName: 'Bob', email: 'bob@example.com', role: 'member' },
    { userId: 'u_c', displayName: 'Charlie', email: 'charlie@example.com', role: 'member' },
  ];
  const memberIds = members.map((m) => m.userId);

  it('1. splits ₹100.00 (10000 paise) equally among 3 members deterministically with exact sum', () => {
    const shares = computeEqualShares(10000, ['u_c', 'u_a', 'u_b'], memberIds);
    expect(shares).toEqual([
      { userId: 'u_a', shareMinor: 3334 },
      { userId: 'u_b', shareMinor: 3333 },
      { userId: 'u_c', shareMinor: 3333 },
    ]);
    const sum = shares.reduce((acc, s) => acc + s.shareMinor, 0);
    expect(sum).toBe(10000);
  });

  it('2. validates custom splits and rejects totals that do not equal amountMinor', () => {
    const valid = validateAndNormalizeCustomShares(
      125075,
      [
        { userId: 'u_a', shareMinor: 50000 },
        { userId: 'u_b', shareMinor: 50075 },
        { userId: 'u_c', shareMinor: 25000 },
      ],
      memberIds
    );
    expect(valid.reduce((s, i) => s + i.shareMinor, 0)).toBe(125075);

    expect(() =>
      validateAndNormalizeCustomShares(
        10000,
        [
          { userId: 'u_a', shareMinor: 4000 },
          { userId: 'u_b', shareMinor: 4000 },
        ],
        memberIds
      )
    ).toThrow(/must equal the expense amount/i);
  });

  it('3. rejects negative amounts, fractional paise, empty participants, and non-trip participants', () => {
    expect(() => computeEqualShares(-500, ['u_a'], memberIds)).toThrow();
    expect(() => computeEqualShares(100.5, ['u_a'], memberIds)).toThrow();
    expect(() => computeEqualShares(1000, [], memberIds)).toThrow();
    expect(() => computeEqualShares(1000, ['u_outsider'], memberIds)).toThrow(
      /not a member/i
    );
  });

  it('4. computes exact settlement recommendation from PAID expenses and excludes PLANNED expenses', () => {
    // Prompt specification:
    // A paid ₹1,200 (120000 paise) shared among A, B, C (40000 each)
    // B paid ₹600 (60000 paise) shared among A, B, C (20000 each)
    // Plus a PLANNED expense of ₹900 (90000 paise) shared among A, B, C (30000 each)
    const expenses = [
      {
        id: 'exp-1',
        title: 'Hotel Advance',
        amountMinor: 120000,
        status: 'paid',
        paidByUserId: 'u_a',
        category: 'accommodation',
        participantShares: computeEqualShares(120000, memberIds, memberIds),
      },
      {
        id: 'exp-2',
        title: 'Cab Deposit',
        amountMinor: 60000,
        status: 'paid',
        paidByUserId: 'u_b',
        category: 'transport',
        participantShares: computeEqualShares(60000, memberIds, memberIds),
      },
      {
        id: 'exp-3',
        title: 'Planned Group Dinner',
        amountMinor: 90000,
        status: 'planned',
        paidByUserId: null,
        category: 'food',
        participantShares: computeEqualShares(90000, memberIds, memberIds),
      },
    ];

    const summary = computeTripFinancialSummary({
      trip: { currency: 'INR', budgetLimitMinor: 300000 },
      members,
      expenses,
    });

    expect(summary.tripTotalPaidMinor).toBe(180000);
    expect(summary.tripTotalPlannedMinor).toBe(90000);
    expect(summary.tripTotalEstimatedMinor).toBe(270000);
    expect(summary.remainingEstimatedMinor).toBe(90000);
    expect(summary.budgetDifferenceMinor).toBe(30000);

    const byUser = new Map(summary.participantSummaries.map((p) => [p.userId, p]));

    // Each participant has 60000 paid share + 30000 planned share = 90000 estimated total
    expect(byUser.get('u_a').paidShareMinor).toBe(60000);
    expect(byUser.get('u_a').plannedShareMinor).toBe(30000);
    expect(byUser.get('u_a').estimatedTotalMinor).toBe(90000);
    expect(byUser.get('u_a').netBalanceMinor).toBe(60000); // +₹600

    expect(byUser.get('u_b').netBalanceMinor).toBe(0); // ₹0
    expect(byUser.get('u_c').netBalanceMinor).toBe(-60000); // -₹600

    // Sum of all participant balances must equal zero
    const netSum = summary.participantSummaries.reduce(
      (s, p) => s + p.netBalanceMinor,
      0
    );
    expect(netSum).toBe(0);

    // Expected recommendation: Charlie (u_c) pays Alice (u_a) ₹600 (60000 paise)
    expect(summary.settlements.transfers).toEqual([
      {
        fromUserId: 'u_c',
        fromDisplayName: 'Charlie',
        fromEmail: 'charlie@example.com',
        toUserId: 'u_a',
        toDisplayName: 'Alice',
        toEmail: 'alice@example.com',
        amountMinor: 60000,
      },
    ]);
  });

  it('5. runs What-If Budget Simulator without modifying existing expenses', () => {
    const existingExpenses = [
      {
        id: 'exp-1',
        title: 'Base Stay',
        amountMinor: 60000,
        status: 'planned',
        paidByUserId: null,
        shareMode: 'equal',
        participantShares: computeEqualShares(60000, memberIds, memberIds),
      },
    ];

    const sim = simulateExpenseImpact({
      trip: { currency: 'INR', budgetLimitMinor: 100000 },
      members,
      existingExpenses,
      simulationInput: {
        title: 'Scuba Add-on',
        amountMinor: 30000,
        shareMode: 'equal',
        participantIds: ['u_a', 'u_b'],
      },
    });

    expect(sim.isSimulationPreview).toBe(true);
    expect(sim.before.tripTotalEstimatedMinor).toBe(60000);
    expect(sim.after.tripTotalEstimatedMinor).toBe(90000);
    expect(sim.tripTotalDeltaMinor).toBe(30000);
    expect(existingExpenses).toHaveLength(1); // Unmodified
  });

  it('6. enforces zero-sum balance invariant in computeSettlements', () => {
    expect(() =>
      computeSettlements([
        { userId: 'u_a', displayName: 'A', email: '', netBalanceMinor: 500 },
        { userId: 'u_b', displayName: 'B', email: '', netBalanceMinor: -400 },
      ])
    ).toThrow(/invariant/i);
  });
});


import { AppError } from '../utils/AppError.js';

export function formatPaiseToINR(paise) {
  const rupees = (Number(paise || 0) / 100).toFixed(2);
  return `₹${rupees}`;
}

/**
 * Deterministic equal splitting in integer paise.
 * Sorts unique participant IDs lexicographically so remainder paise distribution
 * is 100% deterministic regardless of client input array order.
 */
export function computeEqualShares(amountMinor, participantIds, allowedMemberIds = null) {
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    throw new AppError(
      'Expense amountMinor must be a positive integer in paise.',
      400,
      'INVALID_AMOUNT'
    );
  }

  if (!Array.isArray(participantIds) || participantIds.length === 0) {
    throw new AppError(
      'At least one participant is required to split an expense.',
      400,
      'EMPTY_PARTICIPANTS'
    );
  }

  const uniqueSortedIds = [...new Set(participantIds.map(String))].sort((a, b) =>
    a.localeCompare(b)
  );

  if (allowedMemberIds) {
    const allowedSet = new Set(allowedMemberIds.map(String));
    for (const id of uniqueSortedIds) {
      if (!allowedSet.has(id)) {
        throw new AppError(
          `Participant ${id} is not a member of this trip.`,
          400,
          'INVALID_PARTICIPANT'
        );
      }
    }
  }

  const count = uniqueSortedIds.length;
  const baseShare = Math.floor(amountMinor / count);
  const remainder = amountMinor % count;

  const shares = uniqueSortedIds.map((userId, index) => ({
    userId,
    shareMinor: baseShare + (index < remainder ? 1 : 0),
  }));

  const sumCheck = shares.reduce((acc, s) => acc + s.shareMinor, 0);
  if (sumCheck !== amountMinor) {
    throw new AppError(
      'Internal split calculation mismatch.',
      500,
      'SPLIT_INVARIANT_FAILED'
    );
  }

  return shares;
}

/**
 * Validates custom participant shares and ensures exact sum === amountMinor.
 */
export function validateAndNormalizeCustomShares(
  amountMinor,
  customShares,
  allowedMemberIds = null
) {
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    throw new AppError(
      'Expense amountMinor must be a positive integer in paise.',
      400,
      'INVALID_AMOUNT'
    );
  }

  if (!Array.isArray(customShares) || customShares.length === 0) {
    throw new AppError(
      'Custom split requires at least one participant share.',
      400,
      'EMPTY_PARTICIPANTS'
    );
  }

  const allowedSet = allowedMemberIds ? new Set(allowedMemberIds.map(String)) : null;
  const seenUsers = new Set();
  const normalized = [];

  for (const entry of customShares) {
    const userId = String(entry.userId || '');
    const shareMinor = entry.shareMinor;

    if (!userId) {
      throw new AppError('Each custom share must specify a userId.', 400, 'INVALID_PARTICIPANT');
    }

    if (seenUsers.has(userId)) {
      throw new AppError(
        'Duplicate participant found in custom shares.',
        400,
        'DUPLICATE_PARTICIPANT'
      );
    }

    if (allowedSet && !allowedSet.has(userId)) {
      throw new AppError(
        `Participant ${userId} is not a member of this trip.`,
        400,
        'INVALID_PARTICIPANT'
      );
    }

    if (!Number.isInteger(shareMinor) || shareMinor < 0) {
      throw new AppError(
        'Custom share amounts must be non-negative integers in paise.',
        400,
        'INVALID_CUSTOM_SHARE'
      );
    }

    seenUsers.add(userId);
    normalized.push({ userId, shareMinor });
  }

  const sumMinor = normalized.reduce((acc, s) => acc + s.shareMinor, 0);
  if (sumMinor !== amountMinor) {
    const diff = amountMinor - sumMinor;
    const diffHint =
      diff > 0
        ? `short by ${formatPaiseToINR(diff)}`
        : `over by ${formatPaiseToINR(Math.abs(diff))}`;
    throw new AppError(
      `Custom shares total (${formatPaiseToINR(sumMinor)}) must equal the expense amount (${formatPaiseToINR(
        amountMinor
      )}). Currently ${diffHint}.`,
      400,
      'CUSTOM_SPLIT_MISMATCH',
      {
        expectedMinor: amountMinor,
        actualMinor: sumMinor,
        differenceMinor: diff,
      }
    );
  }

  return normalized.sort((a, b) => a.userId.localeCompare(b.userId));
}

/**
 * Resolves participant shares according to shareMode ('equal' | 'custom') and validates trip membership.
 */
export function resolveExpenseShares({
  amountMinor,
  shareMode,
  participantIds,
  customShares,
  tripMemberIds,
}) {
  if (shareMode === 'equal') {
    return computeEqualShares(amountMinor, participantIds, tripMemberIds);
  }
  if (shareMode === 'custom') {
    return validateAndNormalizeCustomShares(amountMinor, customShares, tripMemberIds);
  }
  throw new AppError('Invalid shareMode. Must be equal or custom.', 400, 'INVALID_SHARE_MODE');
}

/**
 * Generates deterministic settlements from PAID expense balances only.
 * Sum of all netBalanceMinor MUST equal 0.
 */
export function computeSettlements(participantSummaries) {
  const totalNet = participantSummaries.reduce(
    (sum, item) => sum + item.netBalanceMinor,
    0
  );

  if (totalNet !== 0) {
    throw new AppError(
      `Settlement balance invariant violated (net sum = ${totalNet}).`,
      500,
      'SETTLEMENT_INVARIANT_FAILED'
    );
  }

  const creditors = participantSummaries
    .filter((p) => p.netBalanceMinor > 0)
    .map((p) => ({
      userId: p.userId,
      displayName: p.displayName,
      email: p.email,
      remainingMinor: p.netBalanceMinor,
    }))
    .sort((a, b) => b.remainingMinor - a.remainingMinor || a.userId.localeCompare(b.userId));

  const debtors = participantSummaries
    .filter((p) => p.netBalanceMinor < 0)
    .map((p) => ({
      userId: p.userId,
      displayName: p.displayName,
      email: p.email,
      remainingMinor: Math.abs(p.netBalanceMinor),
    }))
    .sort((a, b) => b.remainingMinor - a.remainingMinor || a.userId.localeCompare(b.userId));

  const transfers = [];
  let cIdx = 0;
  let dIdx = 0;

  while (cIdx < creditors.length && dIdx < debtors.length) {
    const creditor = creditors[cIdx];
    const debtor = debtors[dIdx];

    const transferMinor = Math.min(creditor.remainingMinor, debtor.remainingMinor);
    if (transferMinor > 0) {
      transfers.push({
        fromUserId: debtor.userId,
        fromDisplayName: debtor.displayName,
        fromEmail: debtor.email,
        toUserId: creditor.userId,
        toDisplayName: creditor.displayName,
        toEmail: creditor.email,
        amountMinor: transferMinor,
      });
    }

    creditor.remainingMinor -= transferMinor;
    debtor.remainingMinor -= transferMinor;

    if (creditor.remainingMinor === 0) cIdx += 1;
    if (debtor.remainingMinor === 0) dIdx += 1;
  }

  return {
    transfers,
    totalTransferMinor: transfers.reduce((acc, t) => acc + t.amountMinor, 0),
    isSettled: transfers.length === 0,
  };
}

/**
 * Computes authoritative financial ledger summary, per-person cost estimates,
 * category breakdown, budget variance, and paid-only settlements.
 */
export function computeTripFinancialSummary({ trip, members, expenses }) {
  const memberMap = new Map();

  for (const m of members || []) {
    const userId = String(m.userId || m.id || m._id);
    memberMap.set(userId, {
      userId,
      displayName: m.displayName || 'Trip Member',
      email: m.email || '',
      role: m.role || 'member',
      plannedShareMinor: 0,
      paidShareMinor: 0,
      estimatedTotalMinor: 0,
      totalPaidOutMinor: 0,
      netBalanceMinor: 0,
    });
  }

  // Ensure any historical user referenced in an expense still appears safely in summary
  const ensureParticipant = (userId) => {
    const id = String(userId);
    if (!memberMap.has(id)) {
      memberMap.set(id, {
        userId: id,
        displayName: 'Former Member',
        email: '',
        role: 'member',
        plannedShareMinor: 0,
        paidShareMinor: 0,
        estimatedTotalMinor: 0,
        totalPaidOutMinor: 0,
        netBalanceMinor: 0,
      });
    }
    return memberMap.get(id);
  };

  let tripTotalPlannedMinor = 0;
  let tripTotalPaidMinor = 0;
  const categoryMap = new Map();

  for (const exp of expenses || []) {
    const amountMinor = Number(exp.amountMinor || 0);
    const status = exp.status === 'paid' ? 'paid' : 'planned';
    const category = exp.category || 'misc';

    if (!categoryMap.has(category)) {
      categoryMap.set(category, {
        category,
        plannedMinor: 0,
        paidMinor: 0,
        totalMinor: 0,
        count: 0,
      });
    }
    const catStats = categoryMap.get(category);
    catStats.count += 1;
    catStats.totalMinor += amountMinor;

    if (status === 'paid') {
      tripTotalPaidMinor += amountMinor;
      catStats.paidMinor += amountMinor;

      if (exp.paidByUserId) {
        const payer = ensureParticipant(exp.paidByUserId);
        payer.totalPaidOutMinor += amountMinor;
      }

      for (const share of exp.participantShares || []) {
        const participant = ensureParticipant(share.userId);
        participant.paidShareMinor += Number(share.shareMinor || 0);
      }
    } else {
      tripTotalPlannedMinor += amountMinor;
      catStats.plannedMinor += amountMinor;

      for (const share of exp.participantShares || []) {
        const participant = ensureParticipant(share.userId);
        participant.plannedShareMinor += Number(share.shareMinor || 0);
      }
    }
  }

  const tripTotalEstimatedMinor = tripTotalPlannedMinor + tripTotalPaidMinor;
  const remainingEstimatedMinor = tripTotalPlannedMinor;
  const budgetLimitMinor = Number(trip?.budgetLimitMinor || 0);
  const hasBudget = budgetLimitMinor > 0;
  const budgetDifferenceMinor = hasBudget ? budgetLimitMinor - tripTotalEstimatedMinor : null;
  const isOverBudget = hasBudget ? tripTotalEstimatedMinor > budgetLimitMinor : false;
  const budgetUtilizationPercent = hasBudget
    ? Math.round((tripTotalEstimatedMinor / budgetLimitMinor) * 100)
    : null;

  const memberCount = Math.max(1, memberMap.size);
  const perPersonBudgetGuideMinor = hasBudget
    ? Math.floor(budgetLimitMinor / memberCount)
    : null;

  const participantSummaries = [...memberMap.values()].map((p) => {
    const estimatedTotalMinor = p.plannedShareMinor + p.paidShareMinor;
    const netBalanceMinor = p.totalPaidOutMinor - p.paidShareMinor;
    const individualBudgetDiffMinor =
      perPersonBudgetGuideMinor !== null
        ? perPersonBudgetGuideMinor - estimatedTotalMinor
        : null;

    return {
      ...p,
      estimatedTotalMinor,
      netBalanceMinor,
      perPersonBudgetGuideMinor,
      individualBudgetDiffMinor,
    };
  });

  const settlements = computeSettlements(participantSummaries);

  const byCategory = [...categoryMap.values()].sort(
    (a, b) => b.totalMinor - a.totalMinor
  );

  return {
    currency: trip?.currency || 'INR',
    expenseCount: (expenses || []).length,
    plannedCount: (expenses || []).filter((e) => e.status === 'planned').length,
    paidCount: (expenses || []).filter((e) => e.status === 'paid').length,
    tripTotalPlannedMinor,
    tripTotalPaidMinor,
    tripTotalEstimatedMinor,
    remainingEstimatedMinor,
    budgetLimitMinor,
    hasBudget,
    budgetDifferenceMinor,
    isOverBudget,
    budgetUtilizationPercent,
    participantSummaries,
    settlements,
    byCategory,
  };
}

/**
 * Pure What-If Budget Simulator:
 * Evaluates adding or modifying a planned expense without mutating the database.
 */
export function simulateExpenseImpact({
  trip,
  members,
  existingExpenses,
  simulationInput,
}) {
  const tripMemberIds = members.map((m) => String(m.userId || m.id || m._id));
  const simulatedShares = resolveExpenseShares({
    amountMinor: simulationInput.amountMinor,
    shareMode: simulationInput.shareMode,
    participantIds: simulationInput.participantIds,
    customShares: simulationInput.customShares,
    tripMemberIds,
  });

  const before = computeTripFinancialSummary({
    trip,
    members,
    expenses: existingExpenses,
  });

  let simulatedExpenses;
  const targetId = simulationInput.expenseId ? String(simulationInput.expenseId) : null;

  if (targetId) {
    const exists = existingExpenses.some((e) => String(e._id || e.id) === targetId);
    if (!exists) {
      throw new AppError(
        'Target expense for simulation not found in this trip.',
        404,
        'EXPENSE_NOT_FOUND'
      );
    }
    simulatedExpenses = existingExpenses.map((e) => {
      if (String(e._id || e.id) !== targetId) return e;
      const plain = typeof e.toJSON === 'function' ? e.toJSON() : { ...e };
      return {
        ...plain,
        title: simulationInput.title || plain.title,
        amountMinor: simulationInput.amountMinor,
        shareMode: simulationInput.shareMode,
        participantShares: simulatedShares,
        status: 'planned',
        paidByUserId: null,
      };
    });
  } else {
    simulatedExpenses = [
      ...existingExpenses,
      {
        id: 'simulated-preview',
        title: simulationInput.title || 'What-If Planned Expense',
        amountMinor: simulationInput.amountMinor,
        currency: trip.currency || 'INR',
        category: 'misc',
        status: 'planned',
        paidByUserId: null,
        shareMode: simulationInput.shareMode,
        participantShares: simulatedShares,
      },
    ];
  }

  const after = computeTripFinancialSummary({
    trip,
    members,
    expenses: simulatedExpenses,
  });

  const beforeByUser = new Map(
    before.participantSummaries.map((p) => [p.userId, p])
  );

  const participantDeltas = after.participantSummaries.map((afterP) => {
    const beforeP = beforeByUser.get(afterP.userId);
    const beforeEst = beforeP ? beforeP.estimatedTotalMinor : 0;
    return {
      userId: afterP.userId,
      displayName: afterP.displayName,
      beforeEstimatedMinor: beforeEst,
      afterEstimatedMinor: afterP.estimatedTotalMinor,
      deltaMinor: afterP.estimatedTotalMinor - beforeEst,
    };
  });

  return {
    isSimulationPreview: true,
    mode: targetId ? 'modify_existing' : 'add_hypothetical',
    simulatedShares,
    before: {
      tripTotalEstimatedMinor: before.tripTotalEstimatedMinor,
      tripTotalPlannedMinor: before.tripTotalPlannedMinor,
      budgetDifferenceMinor: before.budgetDifferenceMinor,
      isOverBudget: before.isOverBudget,
    },
    after: {
      tripTotalEstimatedMinor: after.tripTotalEstimatedMinor,
      tripTotalPlannedMinor: after.tripTotalPlannedMinor,
      budgetDifferenceMinor: after.budgetDifferenceMinor,
      isOverBudget: after.isOverBudget,
    },
    tripTotalDeltaMinor:
      after.tripTotalEstimatedMinor - before.tripTotalEstimatedMinor,
    participantDeltas,
  };
}


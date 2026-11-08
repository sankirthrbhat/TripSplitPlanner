import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Calculator,
  CheckCircle2,
  Edit2,
  FlaskConical,
  Plus,
  ReceiptIndianRupee,
  Trash2,
} from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { Badge, StatusBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState, Skeleton } from '../components/ui/EmptyState';
import { FormField, inputClassName } from '../components/ui/FormField';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../hooks/useToast';
import { expensesApi } from '../services/api';
import {
  formatDate,
  formatINR,
  paiseToRupeesInput,
  rupeesToPaise,
} from '../utils/format';

const EXPENSE_CATEGORIES = [
  'accommodation',
  'transport',
  'food',
  'activities',
  'shopping',
  'misc',
];

const CHART_COLORS = [
  '#0f766e',
  '#0f172a',
  '#d97706',
  '#0284c7',
  '#059669',
  '#64748b',
];

function computeLocalEqualPreview(amountMinor, participantIds) {
  if (!amountMinor || amountMinor <= 0 || !participantIds.length) return [];
  const sorted = [...new Set(participantIds)].sort((a, b) => a.localeCompare(b));
  const base = Math.floor(amountMinor / sorted.length);
  const rem = amountMinor % sorted.length;
  return sorted.map((userId, idx) => ({
    userId,
    shareMinor: base + (idx < rem ? 1 : 0),
  }));
}

export function ExpensesPage() {
  const { trip, tripId } = useOutletContext();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Expense form state (controlled for exact live equal/custom split preview)
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amountRupees, setAmountRupees] = useState('');
  const [category, setCategory] = useState('food');
  const [status, setStatus] = useState('planned');
  const [paidByUserId, setPaidByUserId] = useState(trip.members?.[0]?.userId || '');
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [shareMode, setShareMode] = useState('equal');
  const [selectedParticipantIds, setSelectedParticipantIds] = useState(
    trip.members.map((m) => m.userId)
  );
  const [customSharesRupees, setCustomSharesRupees] = useState({});
  const [formError, setFormError] = useState('');

  // What-If Budget Simulator state
  const [simOpen, setSimOpen] = useState(false);
  const [simTargetId, setSimTargetId] = useState('');
  const [simTitle, setSimTitle] = useState('Paragliding Add-on');
  const [simAmountRupees, setSimAmountRupees] = useState('4000.00');
  const [simParticipantIds, setSimParticipantIds] = useState(
    trip.members.map((m) => m.userId)
  );
  const [simResult, setSimResult] = useState(null);

  const expensesQuery = useQuery({
    queryKey: ['trip', tripId, 'expenses', statusFilter, categoryFilter],
    queryFn: () =>
      expensesApi.list(tripId, {
        status: statusFilter || undefined,
        category: categoryFilter || undefined,
      }),
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['trip', tripId, 'expenses'] });
    queryClient.invalidateQueries({ queryKey: ['trip', tripId, 'summary'] });
    queryClient.invalidateQueries({ queryKey: ['trip', tripId, 'bookings'] });
    queryClient.invalidateQueries({ queryKey: ['trip', tripId, 'activities'] });
    queryClient.invalidateQueries({ queryKey: ['trips'] });
  };

  const createMutation = useMutation({
    mutationFn: (payload) => expensesApi.create(tripId, payload),
    onSuccess: () => {
      invalidateAll();
      setModalOpen(false);
      toast.success('Expense recorded', 'Per-person costs and settlements updated.');
    },
    onError: (err) => setFormError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => expensesApi.update(tripId, id, payload),
    onSuccess: () => {
      invalidateAll();
      setModalOpen(false);
      setEditingExpense(null);
      toast.success('Expense updated', 'Ledger recalculated.');
    },
    onError: (err) => setFormError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => expensesApi.remove(tripId, id),
    onSuccess: () => {
      invalidateAll();
      setDeleteTarget(null);
      toast.info('Expense deleted', 'Financial summary recalculated.');
    },
    onError: (err) => toast.error('Could not delete expense', err.message),
  });

  const simMutation = useMutation({
    mutationFn: (payload) => expensesApi.simulate(tripId, payload),
    onSuccess: (data) => setSimResult(data.simulation),
    onError: (err) => toast.error('Simulation error', err.message),
  });

  const expenses = expensesQuery.data?.expenses || [];
  const summary = expensesQuery.data?.financialSummary;
  // Cached trip metadata can predate a collaborator joining. Wait for the
  // authoritative ledger roster before initializing any participant selection.
  const memberDataReady = Boolean(summary) && !expensesQuery.isFetching;

  const liveMembers = useMemo(
    () =>
      summary?.participantSummaries?.length
        ? summary.participantSummaries
        : trip.members || [],
    [summary, trip.members]
  );

  const memberNameById = useMemo(() => {
    const map = new Map();
    for (const m of liveMembers) {
      map.set(m.userId, m.displayName);
    }
    return map;
  }, [liveMembers]);

  const openCreateModal = () => {
    setEditingExpense(null);
    setTitle('');
    setDescription('');
    setAmountRupees('');
    setCategory('food');
    setStatus('planned');
    setPaidByUserId(liveMembers?.[0]?.userId || '');
    setExpenseDate(new Date().toISOString().slice(0, 10));
    setShareMode('equal');
    const allIds = liveMembers.map((m) => m.userId);
    setSelectedParticipantIds(allIds);
    const initialCustom = {};
    for (const id of allIds) initialCustom[id] = '';
    setCustomSharesRupees(initialCustom);
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (exp) => {
    setEditingExpense(exp);
    setTitle(exp.title);
    setDescription(exp.description || '');
    setAmountRupees(paiseToRupeesInput(exp.amountMinor));
    setCategory(exp.category);
    setStatus(exp.status);
    setPaidByUserId(
      exp.paidByUserId?._id ||
        exp.paidByUserId?.id ||
        exp.paidByUserId ||
        trip.members?.[0]?.userId ||
        ''
    );
    setExpenseDate(new Date(exp.expenseDate).toISOString().slice(0, 10));
    setShareMode(exp.shareMode);

    const participantIds = (exp.participantShares || []).map((s) =>
      String(s.userId?._id || s.userId?.id || s.userId)
    );
    setSelectedParticipantIds(participantIds);

    const customMap = {};
    for (const m of trip.members) customMap[m.userId] = '';
    for (const s of exp.participantShares || []) {
      const uid = String(s.userId?._id || s.userId?.id || s.userId);
      customMap[uid] = paiseToRupeesInput(s.shareMinor);
    }
    setCustomSharesRupees(customMap);
    setFormError('');
    setModalOpen(true);
  };

  const parsedAmountMinor = rupeesToPaise(amountRupees);
  const equalPreview = useMemo(
    () => computeLocalEqualPreview(parsedAmountMinor, selectedParticipantIds),
    [parsedAmountMinor, selectedParticipantIds]
  );

  const customSumMinor = useMemo(() => {
    let sum = 0;
    for (const uid of selectedParticipantIds) {
      const val = customSharesRupees[uid] || '0';
      const paise = rupeesToPaise(val);
      if (paise === null) return null;
      sum += paise;
    }
    return sum;
  }, [selectedParticipantIds, customSharesRupees]);

  const toggleParticipant = (uid) => {
    setSelectedParticipantIds((prev) =>
      prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]
    );
  };

  const handleExpenseSubmit = (e) => {
    e.preventDefault();
    setFormError('');

    if (title.trim().length < 2) {
      setFormError('Expense title must be at least 2 characters.');
      return;
    }

    const amountMinor = rupeesToPaise(amountRupees);
    if (!amountMinor || amountMinor <= 0) {
      setFormError('Enter a valid positive amount in INR (e.g. 1250.75).');
      return;
    }

    if (selectedParticipantIds.length === 0) {
      setFormError('Select at least one participant.');
      return;
    }

    if (status === 'paid' && !paidByUserId) {
      setFormError('Select who paid for this expense.');
      return;
    }

    const payload = {
      title: title.trim(),
      description: description.trim(),
      amountMinor,
      currency: 'INR',
      category,
      status,
      paidByUserId: status === 'paid' ? paidByUserId : null,
      expenseDate: new Date(`${expenseDate}T12:00:00.000Z`).toISOString(),
      shareMode,
    };

    if (shareMode === 'equal') {
      payload.participantIds = selectedParticipantIds;
    } else {
      const customShares = [];
      for (const uid of selectedParticipantIds) {
        const raw = (customSharesRupees[uid] || '0').trim() || '0';
        const shareMinor = rupeesToPaise(raw);
        if (shareMinor === null || shareMinor < 0) {
          setFormError(
            `Invalid custom share amount for ${memberNameById.get(uid) || 'member'}.`
          );
          return;
        }
        customShares.push({ userId: uid, shareMinor });
      }
      const sum = customShares.reduce((acc, s) => acc + s.shareMinor, 0);
      if (sum !== amountMinor) {
        setFormError(
          `Custom shares total (${formatINR(sum)}) must equal expense amount (${formatINR(
            amountMinor
          )}).`
        );
        return;
      }
      payload.customShares = customShares;
    }

    if (editingExpense) {
      updateMutation.mutate({ id: editingExpense.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleRunSimulation = (e) => {
    e.preventDefault();
    const amountMinor = rupeesToPaise(simAmountRupees);
    if (!amountMinor || amountMinor <= 0) {
      toast.error('Invalid simulated amount', 'Enter a positive INR amount.');
      return;
    }
    if (simParticipantIds.length === 0) {
      toast.error('No participants', 'Select at least one participant for simulation.');
      return;
    }

    simMutation.mutate({
      expenseId: simTargetId || null,
      title: simTitle.trim() || 'Simulated Expense',
      amountMinor,
      shareMode: 'equal',
      participantIds: simParticipantIds,
    });
  };

  const pieData = (summary?.byCategory || []).map((c) => ({
    name: c.category.charAt(0).toUpperCase() + c.category.slice(1),
    value: Number((c.totalMinor / 100).toFixed(2)),
    totalMinor: c.totalMinor,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-navy-900">
            Financial Ledger, Splits & Settlements
          </h2>
          <p className="text-xs text-slate-600">
            Single authoritative ledger in integer paise (INR). Planned expenses inform
            estimates; only paid expenses generate settlements.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            disabled={!memberDataReady}
            onClick={() => {
              setSimResult(null);
              setSimParticipantIds(liveMembers.map((member) => member.userId));
              setSimOpen(true);
            }}
          >
            <FlaskConical className="h-4 w-4 text-teal-700" />
            What-If Simulator
          </Button>
          <Button onClick={openCreateModal} disabled={!memberDataReady}>
            <Plus className="h-4 w-4" />
            Add Expense
          </Button>
        </div>
      </div>

      {expensesQuery.isLoading ? (
        <p role="status" className="text-sm text-slate-600">
          Loading the latest expenses and trip participants…
        </p>
      ) : expensesQuery.isError ? (
        <Card role="alert" className="p-4 space-y-3">
          <p className="text-sm text-rose-700">Could not load the latest expenses and participants. Please retry before adding an expense.</p>
          <Button variant="secondary" onClick={() => expensesQuery.refetch()}>Retry loading expenses</Button>
        </Card>
      ) : null}

      {/* Top Financial Summary Strip */}
      {summary ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-4">
            <p className="text-xs font-medium text-slate-500">Trip Total Estimate</p>
            <p className="mt-1.5 text-2xl font-bold text-navy-900 tabular-nums">
              {formatINR(summary.tripTotalEstimatedMinor)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {summary.paidCount} paid + {summary.plannedCount} planned
            </p>
          </Card>

          <Card className="p-4">
            <p className="text-xs font-medium text-slate-500">Total Paid Out</p>
            <p className="mt-1.5 text-2xl font-bold text-emerald-700 tabular-nums">
              {formatINR(summary.tripTotalPaidMinor)}
            </p>
            <p className="mt-1 text-xs text-slate-500">Included in settlements</p>
          </Card>

          <Card className="p-4">
            <p className="text-xs font-medium text-slate-500">Remaining Planned</p>
            <p className="mt-1.5 text-2xl font-bold text-teal-700 tabular-nums">
              {formatINR(summary.remainingEstimatedMinor)}
            </p>
            <p className="mt-1 text-xs text-slate-500">Excluded from settlements</p>
          </Card>

          <Card className="p-4">
            <p className="text-xs font-medium text-slate-500">Trip Budget Variance</p>
            <p
              className={`mt-1.5 text-2xl font-bold tabular-nums ${
                summary.isOverBudget ? 'text-rose-600' : 'text-navy-900'
              }`}
            >
              {summary.hasBudget
                ? summary.isOverBudget
                  ? `-${formatINR(Math.abs(summary.budgetDifferenceMinor))}`
                  : `+${formatINR(summary.budgetDifferenceMinor)}`
                : 'No cap'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {summary.hasBudget
                ? `Budget cap: ${formatINR(summary.budgetLimitMinor)}`
                : 'Set cap in Trip Settings'}
            </p>
          </Card>
        </div>
      ) : null}

      {/* Per-Person Estimates + Paid-Only Settlements + Category Chart */}
      {summary ? (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Per-person breakdown table */}
          <Card className="p-5 lg:col-span-7 space-y-4">
            <div>
              <h3 className="text-base font-bold text-navy-900">
                Per-Person Estimated Cost & Paid Net Balance
              </h3>
              <p className="text-xs text-slate-500">
                Estimated total = member&apos;s share of planned + paid items. Net balance =
                paid out minus paid share.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-2 font-semibold">Participant</th>
                    <th className="py-2 px-2 font-semibold text-right">Planned</th>
                    <th className="py-2 px-2 font-semibold text-right">Paid Share</th>
                    <th className="py-2 px-2 font-semibold text-right">Est. Total</th>
                    <th className="py-2 px-2 font-semibold text-right">Paid Out</th>
                    <th className="py-2 pl-2 font-semibold text-right">Net Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summary.participantSummaries.map((p) => (
                    <tr key={p.userId}>
                      <td className="py-2.5 pr-2 font-semibold text-navy-900">
                        {p.displayName}
                      </td>
                      <td className="py-2.5 px-2 text-right tabular-nums text-slate-600">
                        {formatINR(p.plannedShareMinor)}
                      </td>
                      <td className="py-2.5 px-2 text-right tabular-nums text-slate-700">
                        {formatINR(p.paidShareMinor)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-bold tabular-nums text-navy-900">
                        {formatINR(p.estimatedTotalMinor)}
                      </td>
                      <td className="py-2.5 px-2 text-right tabular-nums text-emerald-700">
                        {formatINR(p.totalPaidOutMinor)}
                      </td>
                      <td
                        className={`py-2.5 pl-2 text-right font-bold tabular-nums ${
                          p.netBalanceMinor > 0
                            ? 'text-emerald-700'
                            : p.netBalanceMinor < 0
                              ? 'text-rose-600'
                              : 'text-slate-500'
                        }`}
                      >
                        {p.netBalanceMinor > 0
                          ? `+${formatINR(p.netBalanceMinor)}`
                          : formatINR(p.netBalanceMinor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Settlements + Category Chart */}
          <div className="min-w-0 lg:col-span-5 space-y-6">
            <Card className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-navy-900">
                  Settlement Recommendations
                </h3>
                <Badge variant="emerald">Paid Expenses Only</Badge>
              </div>
              {summary.settlements.transfers.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  No outstanding settlement transfers required.
                </div>
              ) : (
                <ul className="space-y-2" data-testid="settlement-transfers-list">
                  {summary.settlements.transfers.map((tx, idx) => (
                    <li
                      key={`${tx.fromUserId}-${tx.toUserId}-${idx}`}
                      className="flex items-center justify-between rounded-xl border border-teal-200 bg-teal-50/70 px-3.5 py-2.5 text-xs"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-navy-900">
                          {tx.fromDisplayName}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-teal-700" />
                        <span className="font-bold text-navy-900">
                          {tx.toDisplayName}
                        </span>
                      </div>
                      <span className="font-bold text-teal-800 tabular-nums text-sm">
                        {formatINR(tx.amountMinor)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {pieData.length > 0 ? (
              <Card className="p-5 space-y-3">
                <h3 className="text-sm font-bold text-navy-900">
                  Spend by Category
                </h3>
                <div className="h-44 w-full" aria-label="Spend by category chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={38}
                        outerRadius={66}
                        paddingAngle={2}
                      >
                        {pieData.map((entry, idx) => (
                          <Cell
                            key={entry.name}
                            fill={CHART_COLORS[idx % CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) =>
                          `₹${Number(value).toLocaleString('en-IN')}`
                        }
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="grid grid-cols-2 gap-1.5 text-xs">
                  {pieData.map((item, idx) => (
                    <li key={item.name} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 truncate text-slate-700">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{
                            backgroundColor: CHART_COLORS[idx % CHART_COLORS.length],
                          }}
                        />
                        {item.name}
                      </span>
                      <span className="font-semibold tabular-nums text-navy-900">
                        {formatINR(item.totalMinor)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Ledger Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-canvas-border bg-white p-3">
        <span className="text-xs font-semibold text-slate-500">Filter ledger:</span>
        <select
          aria-label="Filter expense status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700"
        >
          <option value="">Planned & Paid</option>
          <option value="planned">Planned Only</option>
          <option value="paid">Paid Only</option>
        </select>

        <select
          aria-label="Filter expense category"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700"
        >
          <option value="">All Categories</option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Expense Ledger List */}
      {expensesQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : expenses.length === 0 ? (
        <EmptyState
          icon={ReceiptIndianRupee}
          title="No expenses recorded yet"
          description="Add planned budgets or paid receipts to compute exact per-person estimates and settlements."
          action={
            <Button onClick={openCreateModal} disabled={!memberDataReady}>
              <Plus className="h-4 w-4" />
              Record First Expense
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {expenses.map((exp) => (
            <Card key={exp.id} className="p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={exp.status} />
                    <Badge variant="neutral" className="capitalize">
                      {exp.category}
                    </Badge>
                    <Badge variant="teal" className="capitalize">
                      {exp.shareMode} split
                    </Badge>
                    {exp.linkedBookingId ? (
                      <Badge variant="neutral">
                        Booking: {exp.linkedBookingId.title}
                      </Badge>
                    ) : null}
                    {exp.linkedActivityId ? (
                      <Badge variant="neutral">
                        Activity: {exp.linkedActivityId.title}
                      </Badge>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-base font-bold text-navy-900">{exp.title}</h3>
                    <span className="text-lg font-bold text-navy-900 tabular-nums">
                      {formatINR(exp.amountMinor)}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600">
                    {formatDate(exp.expenseDate, trip.timezone)}
                    {exp.status === 'paid' && exp.paidByUserId
                      ? ` • Paid by ${exp.paidByUserId.displayName || 'Member'}`
                      : ' • Planned estimate (not yet paid)'}
                  </p>

                  {exp.description ? (
                    <p className="text-xs text-slate-600">{exp.description}</p>
                  ) : null}

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(exp.participantShares || []).map((share) => {
                      const uid = String(
                        share.userId?._id || share.userId?.id || share.userId
                      );
                      const name =
                        share.userId?.displayName ||
                        memberNameById.get(uid) ||
                        'Member';
                      return (
                        <span
                          key={uid}
                          className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 tabular-nums"
                        >
                          {name}: {formatINR(share.shareMinor)}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 sm:pl-4">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => openEditModal(exp)}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Delete ${exp.title}`}
                    onClick={() => setDeleteTarget(exp)}
                    className="text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit Expense Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingExpense ? 'Edit Expense' : 'Record Trip Expense'}
        description="All amounts are stored in exact integer paise (INR)."
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleExpenseSubmit} noValidate className="space-y-4">
          {formError ? (
            <div
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800"
            >
              {formError}
            </div>
          ) : null}

          <FormField label="Title" htmlFor="exp-title" required>
            <input
              id="exp-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Silver Oak Homestay"
              className={inputClassName}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Amount (₹ INR)" htmlFor="exp-amount" required>
              <input
                id="exp-amount"
                type="text"
                inputMode="decimal"
                value={amountRupees}
                onChange={(e) => setAmountRupees(e.target.value)}
                placeholder="1250.75"
                className={inputClassName}
              />
            </FormField>

            <FormField label="Category" htmlFor="exp-category">
              <select
                id="exp-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={inputClassName}
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Date" htmlFor="exp-date">
              <input
                id="exp-date"
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className={inputClassName}
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Expense Status" htmlFor="exp-status">
              <select
                id="exp-status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className={inputClassName}
              >
                <option value="planned">Planned (Estimate Only)</option>
                <option value="paid">Paid (Affects Settlements)</option>
              </select>
            </FormField>

            {status === 'paid' ? (
              <FormField label="Paid By" htmlFor="exp-paidBy" required>
                <select
                  id="exp-paidBy"
                  value={paidByUserId}
                  onChange={(e) => setPaidByUserId(e.target.value)}
                  className={inputClassName}
                >
                  {liveMembers.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.displayName}
                    </option>
                  ))}
                </select>
              </FormField>
            ) : (
              <div className="flex items-end pb-2 text-xs text-slate-500">
                Planned expenses contribute to per-person estimates without creating debts.
              </div>
            )}
          </div>

          <FormField label="Notes (optional)" htmlFor="exp-desc">
            <input
              id="exp-desc"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Receipt details or split context"
              className={inputClassName}
            />
          </FormField>

          {/* Split Mode & Participant Shares */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-navy-900">
                Split Configuration
              </span>
              <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setShareMode('equal')}
                  className={`rounded-md px-3 py-1 font-medium ${
                    shareMode === 'equal'
                      ? 'bg-navy-900 text-white'
                      : 'text-slate-700'
                  }`}
                >
                  Equal Split
                </button>
                <button
                  type="button"
                  onClick={() => setShareMode('custom')}
                  className={`rounded-md px-3 py-1 font-medium ${
                    shareMode === 'custom'
                      ? 'bg-navy-900 text-white'
                      : 'text-slate-700'
                  }`}
                >
                  Custom Split
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {liveMembers.map((m) => {
                const isSelected = selectedParticipantIds.includes(m.userId);
                const eqShare = equalPreview.find((s) => s.userId === m.userId);

                return (
                  <div
                    key={m.userId}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
                  >
                    <label className="flex items-center gap-2 text-xs font-medium text-navy-900 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleParticipant(m.userId)}
                        className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-600"
                      />
                      {m.displayName}
                    </label>

                    {shareMode === 'equal' ? (
                      <span className="text-xs font-semibold tabular-nums text-slate-700">
                        {isSelected && eqShare
                          ? formatINR(eqShare.shareMinor)
                          : '₹0.00'}
                      </span>
                    ) : isSelected ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-500">₹</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          aria-label={`Custom share for ${m.displayName}`}
                          value={customSharesRupees[m.userId] ?? ''}
                          onChange={(e) =>
                            setCustomSharesRupees((prev) => ({
                              ...prev,
                              [m.userId]: e.target.value,
                            }))
                          }
                          placeholder="0.00"
                          className="w-24 rounded-md border border-slate-300 px-2 py-1 text-right text-xs tabular-nums"
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">Excluded</span>
                    )}
                  </div>
                );
              })}
            </div>

            {shareMode === 'custom' && parsedAmountMinor ? (
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-slate-600">Custom Shares Total:</span>
                <span
                  className={`font-bold tabular-nums ${
                    customSumMinor === parsedAmountMinor
                      ? 'text-emerald-700'
                      : 'text-rose-600'
                  }`}
                >
                  {customSumMinor !== null ? formatINR(customSumMinor) : 'Invalid'} /{' '}
                  {formatINR(parsedAmountMinor)}
                </span>
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Saving...'
                : editingExpense
                  ? 'Update Expense'
                  : 'Save Expense'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* What-If Budget Simulator Modal */}
      <Modal
        isOpen={simOpen}
        onClose={() => setSimOpen(false)}
        title="What-If Budget Simulator (Preview Only)"
        description="Simulate adding or modifying a planned expense without writing to the database."
        maxWidth="max-w-xl"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-950">
            Preview Mode: Simulations use the real backend split engine without saving
            any changes to MongoDB.
          </div>

          <form onSubmit={handleRunSimulation} className="space-y-4">
            <FormField label="Scenario Type" htmlFor="sim-target">
              <select
                id="sim-target"
                value={simTargetId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSimTargetId(id);
                  const found = expenses.find((ex) => ex.id === id);
                  if (found) {
                    setSimTitle(found.title);
                    setSimAmountRupees(paiseToRupeesInput(found.amountMinor));
                  }
                }}
                className={inputClassName}
              >
                <option value="">Simulate Adding a New Planned Expense</option>
                {expenses
                  .filter((ex) => ex.status === 'planned')
                  .map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      Modify Planned: {ex.title} ({formatINR(ex.amountMinor)})
                    </option>
                  ))}
              </select>
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Scenario Label" htmlFor="sim-title">
                <input
                  id="sim-title"
                  type="text"
                  value={simTitle}
                  onChange={(e) => setSimTitle(e.target.value)}
                  className={inputClassName}
                />
              </FormField>
              <FormField label="Simulated Amount (₹ INR)" htmlFor="sim-amount">
                <input
                  id="sim-amount"
                  type="text"
                  inputMode="decimal"
                  value={simAmountRupees}
                  onChange={(e) => setSimAmountRupees(e.target.value)}
                  className={inputClassName}
                />
              </FormField>
            </div>

            <div className="space-y-1.5">
              <span className="block text-xs font-semibold text-slate-700">
                Participants Included
              </span>
              <div className="flex flex-wrap gap-2">
                {liveMembers.map((m) => {
                  const checked = simParticipantIds.includes(m.userId);
                  return (
                    <button
                      key={m.userId}
                      type="button"
                      onClick={() =>
                        setSimParticipantIds((prev) =>
                          prev.includes(m.userId)
                            ? prev.filter((x) => x !== m.userId)
                            : [...prev, m.userId]
                        )
                      }
                      className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                        checked
                          ? 'border-teal-600 bg-teal-50 text-teal-900'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      {m.displayName}
                    </button>
                  );
                })}
              </div>
            </div>

            <Button type="submit" disabled={simMutation.isPending}>
              <Calculator className="h-4 w-4" />
              {simMutation.isPending ? 'Calculating Preview...' : 'Run Simulation Preview'}
            </Button>
          </form>

          {simResult ? (
            <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant="amber">SIMULATION PREVIEW (UNSAVED)</Badge>
                <span className="text-xs font-bold text-navy-900 tabular-nums">
                  Trip Delta:{' '}
                  {simResult.tripTotalDeltaMinor >= 0 ? '+' : ''}
                  {formatINR(simResult.tripTotalDeltaMinor)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg bg-white p-2.5 border border-slate-200">
                  <span className="text-slate-500 block">Current Trip Est.</span>
                  <span className="font-bold text-navy-900 tabular-nums">
                    {formatINR(simResult.before.tripTotalEstimatedMinor)}
                  </span>
                </div>
                <div className="rounded-lg bg-white p-2.5 border border-teal-300">
                  <span className="text-slate-500 block">Simulated Trip Est.</span>
                  <span className="font-bold text-teal-800 tabular-nums">
                    {formatINR(simResult.after.tripTotalEstimatedMinor)}
                  </span>
                </div>
              </div>

              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-teal-200 text-slate-600">
                    <th className="py-1.5 font-semibold">Member</th>
                    <th className="py-1.5 text-right font-semibold">Before</th>
                    <th className="py-1.5 text-right font-semibold">After</th>
                    <th className="py-1.5 text-right font-semibold">Delta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-teal-100">
                  {simResult.participantDeltas.map((row) => (
                    <tr key={row.userId}>
                      <td className="py-1.5 font-medium text-navy-900">
                        {row.displayName}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {formatINR(row.beforeEstimatedMinor)}
                      </td>
                      <td className="py-1.5 text-right tabular-nums font-semibold">
                        {formatINR(row.afterEstimatedMinor)}
                      </td>
                      <td className="py-1.5 text-right tabular-nums font-bold text-teal-800">
                        {row.deltaMinor >= 0 ? '+' : ''}
                        {formatINR(row.deltaMinor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        isPending={deleteMutation.isPending}
        title="Delete Expense"
        message={`Delete "${deleteTarget?.title}" (${formatINR(
          deleteTarget?.amountMinor || 0
        )})? Per-person estimates and settlements will recalculate immediately.`}
        confirmLabel="Delete Expense"
      />
    </div>
  );
}

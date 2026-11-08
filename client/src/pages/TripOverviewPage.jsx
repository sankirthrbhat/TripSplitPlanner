import { useQuery } from '@tanstack/react-query';
import {
  Activity as ActivityIcon,
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CheckSquare,
  Hotel,
  IndianRupee,
  Wallet,
} from 'lucide-react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge, StatusBadge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { EmptyState, Skeleton } from '../components/ui/EmptyState';
import { insightsApi } from '../services/api';
import { formatDate, formatINR, formatTime } from '../utils/format';

function PulseIndicatorRow({ label, detail, percent, score, maxScore, state }) {
  const barColors = {
    healthy: 'bg-emerald-600',
    attention: 'bg-teal-600',
    warning: 'bg-amber-500',
    neutral: 'bg-slate-400',
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <div>
          <span className="font-semibold text-navy-900">{label}</span>
          <span className="ml-2 text-slate-600">{detail}</span>
        </div>
        <span className="font-mono text-xs font-semibold text-slate-700 tabular-nums">
          {score}/{maxScore} pts
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${barColors[state] || barColors.neutral}`}
          style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
        />
      </div>
    </div>
  );
}

export function TripOverviewPage() {
  const { trip, tripId } = useOutletContext();

  const summaryQuery = useQuery({
    queryKey: ['trip', tripId, 'summary'],
    queryFn: () => insightsApi.summary(tripId),
  });

  if (summaryQuery.isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (summaryQuery.isError) {
    return (
      <Card className="p-6 border-rose-200 bg-rose-50 text-rose-900">
        <p className="text-sm font-semibold">Unable to load trip summary</p>
        <p className="mt-1 text-xs">{summaryQuery.error?.message}</p>
      </Card>
    );
  }

  const {
    pulse,
    financialSummary,
    conflictReport,
    upcomingActivities,
    outstandingTasks,
    bookingStats,
  } = summaryQuery.data;

  const { indicators } = pulse;
  const chartData = financialSummary.participantSummaries.map((p) => ({
    name: p.displayName.split(' ')[0],
    PaidShare: Number((p.paidShareMinor / 100).toFixed(2)),
    PlannedShare: Number((p.plannedShareMinor / 100).toFixed(2)),
  }));

  const pulseBadge =
    pulse.overallStatus === 'ready'
      ? { label: 'Trip Ready', variant: 'emerald' }
      : pulse.overallStatus === 'needs_attention'
        ? { label: 'Needs Attention', variant: 'amber' }
        : { label: 'Planning In Progress', variant: 'teal' };

  return (
    <div className="space-y-6">
      {/* Conflict Alert Banner */}
      {conflictReport.conflictCount > 0 ? (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-950">
                {conflictReport.conflictCount} Schedule Overlap
                {conflictReport.conflictCount > 1 ? 's' : ''} Detected
              </p>
              <p className="mt-0.5 text-xs text-amber-900">
                {conflictReport.conflicts[0]?.explanation}
              </p>
            </div>
          </div>
          <Link
            to={`/trips/${tripId}/itinerary`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-amber-700"
          >
            Review Itinerary Conflicts
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : null}

      {/* Top KPI Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Estimated Trip Total</span>
            <IndianRupee className="h-4 w-4 text-teal-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-navy-900 tabular-nums">
            {formatINR(financialSummary.tripTotalEstimatedMinor)}
          </p>
          <p className="mt-1 text-xs text-slate-600 tabular-nums">
            {financialSummary.hasBudget
              ? financialSummary.isOverBudget
                ? `Over budget by ${formatINR(Math.abs(financialSummary.budgetDifferenceMinor))}`
                : `${formatINR(financialSummary.budgetDifferenceMinor)} under ${formatINR(
                    financialSummary.budgetLimitMinor
                  )} cap`
              : `${financialSummary.expenseCount} ledger entries`}
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Paid vs Remaining Planned</span>
            <Wallet className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-700 tabular-nums">
            {formatINR(financialSummary.tripTotalPaidMinor)}
          </p>
          <p className="mt-1 text-xs text-slate-600 tabular-nums">
            +{formatINR(financialSummary.remainingEstimatedMinor)} planned remaining
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Schedule Health</span>
            <CalendarClock className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-navy-900 tabular-nums">
            {conflictReport.conflictCount === 0
              ? 'No Conflicts'
              : `${conflictReport.conflictCount} Conflict${
                  conflictReport.conflictCount > 1 ? 's' : ''
                }`}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {indicators.schedule.activeActivities} active itinerary items
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Bookings & Tasks</span>
            <Hotel className="h-4 w-4 text-navy-700" />
          </div>
          <p className="mt-2 text-2xl font-bold text-navy-900 tabular-nums">
            {bookingStats.confirmed}/{indicators.bookings.totalActive} Confirmed
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {indicators.tasks.completed}/{indicators.tasks.total} tasks completed
          </p>
        </Card>
      </div>

      {/* Trip Pulse + Per-Person Cost Chart */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Trip Pulse Readiness Widget */}
        <Card className="p-5 sm:p-6 lg:col-span-5 flex flex-col justify-between">
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <ActivityIcon className="h-4 w-4 text-teal-600" />
                  <h2 className="text-base font-bold text-navy-900">
                    Trip Pulse Readiness
                  </h2>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  Transparent rule-based readiness score (25 pts per pillar)
                </p>
              </div>
              <Badge variant={pulseBadge.variant}>{pulseBadge.label}</Badge>
            </div>

            <div className="flex items-baseline gap-2 rounded-xl bg-navy-900 px-4 py-3 text-white">
              <span className="text-3xl font-bold tabular-nums">
                {pulse.overallScore}
              </span>
              <span className="text-sm text-slate-300">/ 100 readiness index</span>
            </div>

            <div className="space-y-4">
              <PulseIndicatorRow
                label="Task Completion"
                detail={`${indicators.tasks.completed}/${indicators.tasks.total} done`}
                percent={indicators.tasks.percent}
                score={indicators.tasks.score}
                maxScore={indicators.tasks.maxScore}
                state={indicators.tasks.state}
              />
              <PulseIndicatorRow
                label="Booking Readiness"
                detail={`${indicators.bookings.confirmed}/${indicators.bookings.totalActive} confirmed`}
                percent={indicators.bookings.percent}
                score={indicators.bookings.score}
                maxScore={indicators.bookings.maxScore}
                state={indicators.bookings.state}
              />
              <PulseIndicatorRow
                label="Schedule Conflicts"
                detail={
                  indicators.schedule.conflictCount === 0
                    ? 'All active slots conflict-free'
                    : `${indicators.schedule.conflictCount} overlap(s) flagged`
                }
                percent={Math.round((indicators.schedule.score / 25) * 100)}
                score={indicators.schedule.score}
                maxScore={indicators.schedule.maxScore}
                state={indicators.schedule.state}
              />
              <PulseIndicatorRow
                label="Budget Condition"
                detail={indicators.budget.label}
                percent={Math.round((indicators.budget.score / 25) * 100)}
                score={indicators.budget.score}
                maxScore={indicators.budget.maxScore}
                state={indicators.budget.state}
              />
            </div>
          </div>
        </Card>

        {/* Per-Person Estimated Cost Breakdown + Chart */}
        <Card className="p-5 sm:p-6 lg:col-span-7 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-navy-900">
                Estimated Per-Person Cost Breakdown
              </h2>
              <p className="text-xs text-slate-500">
                Each member&apos;s exact share across paid and planned expenses
              </p>
            </div>
            <Link
              to={`/trips/${tripId}/expenses`}
              className="text-xs font-semibold text-teal-700 hover:underline inline-flex items-center gap-1"
            >
              Full Ledger & Splits
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {financialSummary.participantSummaries.length > 0 &&
          financialSummary.tripTotalEstimatedMinor > 0 ? (
            <div className="h-52 w-full" aria-label="Per-person cost breakdown chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#334155' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                  <Tooltip
                    formatter={(value) => `₹${Number(value).toLocaleString('en-IN')}`}
                  />
                  <Bar
                    dataKey="PaidShare"
                    name="Paid Share"
                    stackId="cost"
                    fill="#0f766e"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="PlannedShare"
                    name="Planned Share"
                    stackId="cost"
                    fill="#94a3b8"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
              Add planned or paid expenses to visualize per-person cost shares.
            </div>
          )}

          {/* Accessible Numeric Breakdown Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3 font-semibold">Member</th>
                  <th className="py-2 px-3 font-semibold text-right">Paid Share</th>
                  <th className="py-2 px-3 font-semibold text-right">Planned Share</th>
                  <th className="py-2 pl-3 font-semibold text-right">Estimated Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {financialSummary.participantSummaries.map((p) => (
                  <tr key={p.userId}>
                    <td className="py-2 pr-3 font-medium text-navy-900">
                      {p.displayName}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-emerald-700">
                      {formatINR(p.paidShareMinor)}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-slate-600">
                      {formatINR(p.plannedShareMinor)}
                    </td>
                    <td className="py-2 pl-3 text-right font-bold tabular-nums text-navy-900">
                      {formatINR(p.estimatedTotalMinor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Bottom Operational Trio: Upcoming Activities, Tasks, Settlements */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Upcoming Activities */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-navy-900">Itinerary Preview</h2>
            <Link
              to={`/trips/${tripId}/itinerary`}
              className="text-xs font-semibold text-teal-700 hover:underline"
            >
              View All
            </Link>
          </div>
          {upcomingActivities.length === 0 ? (
            <EmptyState
              title="No activities scheduled"
              description="Add your first trip activity to build the timeline."
            />
          ) : (
            <ul className="space-y-3">
              {upcomingActivities.map((act) => (
                <li
                  key={act.id}
                  className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-navy-900 truncate">
                      {act.title}
                    </span>
                    <StatusBadge status={act.status} />
                  </div>
                  <p className="mt-1 text-slate-600">
                    {formatDate(act.startAt, trip.timezone)} •{' '}
                    {formatTime(act.startAt, trip.timezone)} –{' '}
                    {formatTime(act.endAt, trip.timezone)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Outstanding Tasks */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-navy-900">Outstanding Tasks</h2>
            <Link
              to={`/trips/${tripId}/tasks`}
              className="text-xs font-semibold text-teal-700 hover:underline"
            >
              Manage Tasks
            </Link>
          </div>
          {outstandingTasks.length === 0 ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center text-xs text-emerald-900">
              <CheckCircle2 className="mx-auto mb-1.5 h-5 w-5 text-emerald-600" />
              All assigned tasks are completed!
            </div>
          ) : (
            <ul className="space-y-2.5">
              {outstandingTasks.map((task) => (
                <li
                  key={task.id}
                  className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 p-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-navy-900 truncate">{task.title}</p>
                    <p className="mt-0.5 text-slate-500">
                      Assigned to {task.assignedTo?.displayName || 'Member'}
                    </p>
                  </div>
                  <StatusBadge status={task.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Paid-Only Settlement Preview */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-navy-900">
              Paid Settlement Plan
            </h2>
            <Link
              to={`/trips/${tripId}/expenses`}
              className="text-xs font-semibold text-teal-700 hover:underline"
            >
              Details
            </Link>
          </div>
          <p className="text-xs text-slate-500">
            Calculated strictly from paid expenses. Planned estimates are excluded.
          </p>
          {financialSummary.settlements.transfers.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center text-xs text-slate-600">
              <CheckSquare className="mx-auto mb-1.5 h-5 w-5 text-teal-600" />
              All paid balances are currently settled (₹0.00 owed).
            </div>
          ) : (
            <ul className="space-y-2.5">
              {financialSummary.settlements.transfers.map((tx, idx) => (
                <li
                  key={`${tx.fromUserId}-${tx.toUserId}-${idx}`}
                  className="flex items-center justify-between rounded-lg border border-teal-200 bg-teal-50/50 p-3 text-xs"
                >
                  <div>
                    <span className="font-semibold text-navy-900">
                      {tx.fromDisplayName}
                    </span>{' '}
                    <span className="text-slate-600">pays</span>{' '}
                    <span className="font-semibold text-navy-900">
                      {tx.toDisplayName}
                    </span>
                  </div>
                  <span className="font-bold text-teal-800 tabular-nums">
                    {formatINR(tx.amountMinor)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}


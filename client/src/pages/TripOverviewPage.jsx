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
    attention: 'bg-[#0F766E]',
    warning: 'bg-amber-600',
    neutral: 'bg-slate-400',
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <div className="min-w-0 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-semibold text-ink">{label}</span>
          <span className="text-ink-body">{detail}</span>
        </div>
        <span className="shrink-0 whitespace-nowrap font-mono text-xs font-semibold text-ink tabular-nums">
          {score}/{maxScore} pts
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-canvas-subtle">
        <div
          className={`h-full rounded-full transition-all duration-150 ${barColors[state] || barColors.neutral}`}
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
      {/* Prominent Actionable Schedule Conflict Alert */}
      {conflictReport.conflictCount > 0 ? (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-2xl border border-amber-300 border-l-4 border-l-amber-600 bg-amber-50 p-4 shadow-card sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-950">
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
            className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1.5 rounded-xl bg-amber-700 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-amber-800"
          >
            Review Itinerary Conflicts
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : null}

      {/* Top KPI Comparison Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-ink-body">
            <span>Estimated Trip Total</span>
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#E9F5F3] text-[#0F766E]">
              <IndianRupee className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-ink tabular-nums">
            {formatINR(financialSummary.tripTotalEstimatedMinor)}
          </p>
          <p className="mt-1 text-xs text-ink-body tabular-nums">
            {financialSummary.hasBudget
              ? financialSummary.isOverBudget
                ? `Over budget by ${formatINR(Math.abs(financialSummary.budgetDifferenceMinor))}`
                : `${formatINR(financialSummary.budgetDifferenceMinor)} under ${formatINR(
                    financialSummary.budgetLimitMinor
                  )} cap`
              : `${financialSummary.expenseCount} ledger entries`}
          </p>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-ink-body">
            <span>Paid vs Remaining Planned</span>
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <Wallet className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-emerald-700 tabular-nums">
            {formatINR(financialSummary.tripTotalPaidMinor)}
          </p>
          <p className="mt-1 text-xs text-ink-body tabular-nums">
            +{formatINR(financialSummary.remainingEstimatedMinor)} planned remaining
          </p>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-ink-body">
            <span>Schedule Health</span>
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <CalendarClock className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-ink tabular-nums">
            {conflictReport.conflictCount === 0
              ? 'No Conflicts'
              : `${conflictReport.conflictCount} Conflict${
                  conflictReport.conflictCount > 1 ? 's' : ''
                }`}
          </p>
          <p className="mt-1 text-xs text-ink-body">
            {indicators.schedule.activeActivities} active itinerary items
          </p>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-ink-body">
            <span>Bookings &amp; Tasks</span>
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-sunshine-soft text-sunshine-ink">
              <Hotel className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-ink tabular-nums">
            {bookingStats.confirmed}/{indicators.bookings.totalActive} Confirmed
          </p>
          <p className="mt-1 text-xs text-ink-body tabular-nums">
            {indicators.tasks.completed}/{indicators.tasks.total} tasks completed
          </p>
        </Card>
      </div>

      {/* Trip Pulse + Per-Person Cost Chart */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Trip Pulse Readiness Widget */}
        <Card className="p-5 sm:p-6 lg:col-span-5 flex flex-col justify-between space-y-5">
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <ActivityIcon className="h-4 w-4 text-[#0F766E] shrink-0" />
                  <h2 className="text-base font-bold text-ink">
                    Trip Pulse Readiness
                  </h2>
                </div>
                <p className="mt-0.5 text-xs text-ink-body">
                  Transparent rule-based readiness score (25 pts per pillar)
                </p>
              </div>
              <Badge variant={pulseBadge.variant}>{pulseBadge.label}</Badge>
            </div>

            <div className="flex items-baseline justify-between gap-2 rounded-2xl border border-[#BEE3DD] bg-[#F3FAF8] px-4 py-3.5">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-[#0F766E] tabular-nums">
                  {pulse.overallScore}
                </span>
                <span className="text-sm font-medium text-ink-body">/ 100 readiness index</span>
              </div>
              <span className="text-[11px] font-semibold text-[#0C5E57]">
                4 equal rules
              </span>
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

          <p className="rounded-xl border border-canvas-border bg-[#FAF9F5] px-3 py-2 text-[11px] leading-relaxed text-ink-body">
            Rule breakdown: each pillar awards up to 25 points directly from your completed tasks, confirmed bookings, zero overlapping itinerary items, and budget headroom.
          </p>
        </Card>

        {/* Per-Person Estimated Cost Breakdown + Chart */}
        <Card className="p-5 sm:p-6 lg:col-span-7 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-ink">
                Estimated Per-Person Cost Breakdown
              </h2>
              <p className="text-xs text-ink-body">
                Each member&apos;s exact share across paid and planned expenses
              </p>
            </div>
            <Link
              to={`/trips/${tripId}/expenses`}
              className="text-xs font-semibold text-[#0F766E] hover:underline inline-flex items-center gap-1"
            >
              Full Ledger &amp; Splits
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {financialSummary.participantSummaries.length > 0 &&
          financialSummary.tripTotalEstimatedMinor > 0 ? (
            <div className="h-52 w-full" aria-label="Per-person cost breakdown chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E4E9E7" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#142C3A' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#485C66' }} />
                  <Tooltip
                    formatter={(value) => `₹${Number(value).toLocaleString('en-IN')}`}
                  />
                  <Bar
                    isAnimationActive={false}
                    dataKey="PaidShare"
                    name="Paid Share"
                    stackId="cost"
                    fill="#0F766E"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    isAnimationActive={false}
                    dataKey="PlannedShare"
                    name="Planned Share"
                    stackId="cost"
                    fill="#F4C95D"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-canvas-border bg-[#FAF9F5] p-6 text-center text-xs text-ink-body">
              Add planned or paid expenses to visualize per-person cost shares.
            </div>
          )}

          {/* Accessible Numeric Breakdown Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-canvas-border text-ink-body">
                  <th className="py-2 pr-3 font-semibold">Member</th>
                  <th className="py-2 px-3 font-semibold text-right">Paid Share</th>
                  <th className="py-2 px-3 font-semibold text-right">Planned Share</th>
                  <th className="py-2 pl-3 font-semibold text-right">Estimated Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-canvas-border/70">
                {financialSummary.participantSummaries.map((p) => (
                  <tr key={p.userId}>
                    <td className="py-2.5 pr-3 font-semibold text-ink">
                      {p.displayName}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-emerald-700 font-medium">
                      {formatINR(p.paidShareMinor)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-ink-body">
                      {formatINR(p.plannedShareMinor)}
                    </td>
                    <td className="py-2.5 pl-3 text-right font-bold tabular-nums text-ink">
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
            <h2 className="text-sm font-bold text-ink">Itinerary Preview</h2>
            <Link
              to={`/trips/${tripId}/itinerary`}
              className="text-xs font-semibold text-[#0F766E] hover:underline"
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
            <ul className="space-y-2.5">
              {upcomingActivities.map((act) => (
                <li
                  key={act.id}
                  className="rounded-xl border border-canvas-border bg-[#FAF9F5] p-3 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-ink truncate">
                      {act.title}
                    </span>
                    <StatusBadge status={act.status} />
                  </div>
                  <p className="mt-1 text-ink-body tabular-nums">
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
            <h2 className="text-sm font-bold text-ink">Outstanding Tasks</h2>
            <Link
              to={`/trips/${tripId}/tasks`}
              className="text-xs font-semibold text-[#0F766E] hover:underline"
            >
              Manage Tasks
            </Link>
          </div>
          {outstandingTasks.length === 0 ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center text-xs text-emerald-900">
              <CheckCircle2 className="mx-auto mb-1.5 h-5 w-5 text-emerald-700" />
              All assigned tasks are completed!
            </div>
          ) : (
            <ul className="space-y-2.5">
              {outstandingTasks.map((task) => (
                <li
                  key={task.id}
                  className="flex items-start justify-between gap-2 rounded-xl border border-canvas-border bg-[#FAF9F5] p-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-ink truncate">{task.title}</p>
                    <p className="mt-0.5 text-ink-body">
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
            <h2 className="text-sm font-bold text-ink">
              Paid Settlement Plan
            </h2>
            <Link
              to={`/trips/${tripId}/expenses`}
              className="text-xs font-semibold text-[#0F766E] hover:underline"
            >
              Details
            </Link>
          </div>
          <p className="text-xs text-ink-body">
            Calculated strictly from paid expenses. Planned estimates are excluded.
          </p>
          {financialSummary.settlements.transfers.length === 0 ? (
            <div className="rounded-xl border border-canvas-border bg-[#FAF9F5] p-5 text-center text-xs text-ink-body">
              <CheckSquare className="mx-auto mb-1.5 h-5 w-5 text-[#0F766E]" />
              All paid balances are currently settled (₹0.00 owed).
            </div>
          ) : (
            <ul className="space-y-2.5">
              {financialSummary.settlements.transfers.map((tx, idx) => (
                <li
                  key={`${tx.fromUserId}-${tx.toUserId}-${idx}`}
                  className="flex items-center justify-between gap-2 rounded-xl border border-[#BEE3DD] bg-[#F3FAF8] p-3 text-xs"
                >
                  <div className="min-w-0">
                    <span className="font-bold text-ink">
                      {tx.fromDisplayName}
                    </span>{' '}
                    <span className="text-ink-body">pays</span>{' '}
                    <span className="font-bold text-ink">
                      {tx.toDisplayName}
                    </span>
                  </div>
                  <span className="shrink-0 font-extrabold text-[#0C5E57] tabular-nums">
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

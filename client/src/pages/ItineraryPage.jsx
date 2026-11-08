import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CalendarDays,
  Clock,
  Edit2,
  MapPin,
  Plus,
  ReceiptIndianRupee,
  Trash2,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useOutletContext } from 'react-router-dom';
import { z } from 'zod';
import { Badge, StatusBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState, Skeleton } from '../components/ui/EmptyState';
import { FormField, inputClassName } from '../components/ui/FormField';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../hooks/useToast';
import { activitiesApi } from '../services/api';
import {
  formatDate,
  formatINR,
  formatTime,
  rupeesToPaise,
  utcIsoToZonedInput,
  zonedDateTimeToUtcIso,
} from '../utils/format';

const ACTIVITY_CATEGORIES = [
  'sightseeing',
  'dining',
  'transit',
  'leisure',
  'adventure',
  'other',
];

const ACTIVITY_STATUSES = ['planned', 'confirmed', 'cancelled'];

const activityFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(2, 'Activity title must be at least 2 characters.')
      .max(140),
    location: z.string().trim().max(200).optional().default(''),
    description: z.string().trim().max(1000).optional().default(''),
    category: z.enum(ACTIVITY_CATEGORIES),
    status: z.enum(ACTIVITY_STATUSES),
    startLocal: z.string().min(1, 'Start date & time is required.'),
    endLocal: z.string().min(1, 'End date & time is required.'),
    assignedParticipantIds: z.array(z.string()).optional().default([]),
    plannedCostRupees: z
      .string()
      .trim()
      .optional()
      .default('')
      .refine(
        (val) => !val || /^\d+(\.\d{1,2})?$/.test(val),
        'Enter a valid rupee amount.'
      ),
  })
  .refine(
    (data) => {
      if (!data.startLocal || !data.endLocal) return true;
      return data.endLocal > data.startLocal;
    },
    {
      message: 'End time must be strictly after start time.',
      path: ['endLocal'],
    }
  );

export function ItineraryPage() {
  const { trip, tripId } = useOutletContext();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const activitiesQuery = useQuery({
    queryKey: ['trip', tripId, 'activities', dateFilter, statusFilter],
    queryFn: () =>
      activitiesApi.list(tripId, {
        date: dateFilter || undefined,
        status: statusFilter || undefined,
      }),
  });

  const allActivitiesQuery = useQuery({
    queryKey: ['trip', tripId, 'activities', '', ''],
    queryFn: () => activitiesApi.list(tripId),
    enabled: Boolean(dateFilter || statusFilter),
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(activityFormSchema),
    defaultValues: {
      title: '',
      location: '',
      description: '',
      category: 'sightseeing',
      status: 'planned',
      startLocal: '',
      endLocal: '',
      assignedParticipantIds: [],
      plannedCostRupees: '',
    },
  });

  const selectedParticipants = watch('assignedParticipantIds') || [];

  const invalidateTripData = () => {
    queryClient.invalidateQueries({ queryKey: ['trip', tripId, 'activities'] });
    queryClient.invalidateQueries({ queryKey: ['trip', tripId, 'summary'] });
    queryClient.invalidateQueries({ queryKey: ['trip', tripId, 'expenses'] });
    queryClient.invalidateQueries({ queryKey: ['trips'] });
  };

  const createMutation = useMutation({
    mutationFn: (payload) => activitiesApi.create(tripId, payload),
    onSuccess: (data) => {
      invalidateTripData();
      setModalOpen(false);
      if (data.activity?.hasConflict) {
        toast.warning(
          'Activity saved with schedule overlap',
          data.activity.conflicts[0]?.explanation || 'Check highlighted conflicts.'
        );
      } else {
        toast.success('Activity added', `"${data.activity?.title}" scheduled.`);
      }
    },
    onError: (err) => {
      toast.error('Could not add activity', err.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => activitiesApi.update(tripId, id, payload),
    onSuccess: (data) => {
      invalidateTripData();
      setModalOpen(false);
      setEditingActivity(null);
      if (data.activity?.hasConflict) {
        toast.warning(
          'Activity updated — overlap still present',
          data.activity.conflicts[0]?.explanation
        );
      } else {
        toast.success('Activity updated', 'Itinerary schedule saved.');
      }
    },
    onError: (err) => {
      toast.error('Could not update activity', err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => activitiesApi.remove(tripId, id),
    onSuccess: () => {
      invalidateTripData();
      setDeleteTarget(null);
      toast.info('Activity removed', 'The itinerary timeline has been updated.');
    },
    onError: (err) => {
      toast.error('Could not delete activity', err.message);
    },
  });

  const openCreateModal = () => {
    setEditingActivity(null);
    const defaultStart = utcIsoToZonedInput(trip.startDate, trip.timezone);
    const startDatePart = defaultStart.split('T')[0] || '2026-12-11';
    reset({
      title: '',
      location: '',
      description: '',
      category: 'sightseeing',
      status: 'planned',
      startLocal: `${startDatePart}T09:00`,
      endLocal: `${startDatePart}T11:00`,
      assignedParticipantIds: trip.members.map((m) => m.userId),
      plannedCostRupees: '',
    });
    setModalOpen(true);
  };

  const openEditModal = (act) => {
    setEditingActivity(act);
    reset({
      title: act.title,
      location: act.location || '',
      description: act.description || '',
      category: act.category,
      status: act.status,
      startLocal: utcIsoToZonedInput(act.startAt, trip.timezone),
      endLocal: utcIsoToZonedInput(act.endAt, trip.timezone),
      assignedParticipantIds: (act.assignedParticipantIds || []).map(String),
      plannedCostRupees: '',
    });
    setModalOpen(true);
  };

  const toggleParticipant = (userId) => {
    const exists = selectedParticipants.includes(userId);
    const next = exists
      ? selectedParticipants.filter((id) => id !== userId)
      : [...selectedParticipants, userId];
    setValue('assignedParticipantIds', next, { shouldValidate: true });
  };

  const onSubmit = (values) => {
    const startAt = zonedDateTimeToUtcIso(values.startLocal, trip.timezone);
    const endAt = zonedDateTimeToUtcIso(values.endLocal, trip.timezone);

    if (!startAt || !endAt) {
      toast.error('Invalid date/time', 'Please check your start and end timestamps.');
      return;
    }

    const payload = {
      title: values.title,
      location: values.location,
      description: values.description,
      category: values.category,
      status: values.status,
      startAt,
      endAt,
      assignedParticipantIds: values.assignedParticipantIds,
    };

    if (!editingActivity && values.plannedCostRupees) {
      const paise = rupeesToPaise(values.plannedCostRupees);
      if (paise && paise > 0) {
        payload.plannedCostMinor = paise;
      }
    }

    if (editingActivity) {
      updateMutation.mutate({ id: editingActivity.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const activities = useMemo(
    () => activitiesQuery.data?.activities || [],
    [activitiesQuery.data]
  );
  const conflictReport = activitiesQuery.data?.conflictReport || {
    conflictCount: 0,
    conflicts: [],
  };

  // Distinct local dates from unfiltered activities for date filter pills
  const availableDates = useMemo(() => {
    const source =
      allActivitiesQuery.data?.activities || activitiesQuery.data?.activities || [];
    const dates = new Set();
    for (const act of source) {
      if (act.localStartDate) dates.add(act.localStartDate);
    }
    return [...dates].sort();
  }, [allActivitiesQuery.data, activitiesQuery.data]);

  const groupedByDate = useMemo(() => {
    const map = new Map();
    for (const act of activities) {
      const key = act.localStartDate || 'Unscheduled';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(act);
    }
    return [...map.entries()];
  }, [activities]);

  const memberNameById = useMemo(() => {
    const m = new Map();
    for (const member of trip.members || []) {
      m.set(String(member.userId), member.displayName);
    }
    return m;
  }, [trip.members]);

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-navy-900">
            Chronological Itinerary
          </h2>
          <p className="text-xs text-slate-600">
            All times displayed in <span className="font-semibold">{trip.timezone}</span>.
            Overlapping non-cancelled activities are flagged automatically.
          </p>
        </div>

        <Button onClick={openCreateModal}>
          <Plus className="h-4 w-4" />
          Add Activity
        </Button>
      </div>

      {/* Prominent Schedule Conflict Panel */}
      {conflictReport.conflictCount > 0 ? (
        <div
          role="alert"
          data-testid="conflict-alert-panel"
          className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-2.5"
        >
          <div className="flex items-center gap-2 text-amber-950">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <h3 className="text-sm font-bold">
              {conflictReport.conflictCount} Schedule Conflict
              {conflictReport.conflictCount > 1 ? 's' : ''} Detected
            </h3>
          </div>
          <ul className="space-y-1.5 pl-7 text-xs text-amber-950 list-disc">
            {conflictReport.conflicts.map((conflict) => (
              <li key={conflict.id}>
                <span className="font-medium">{conflict.explanation}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-canvas-border bg-white p-3">
        <span className="text-xs font-semibold text-slate-500 mr-1">Filter by day:</span>
        <button
          type="button"
          onClick={() => setDateFilter('')}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            dateFilter === ''
              ? 'bg-navy-900 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          All Days
        </button>
        {availableDates.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDateFilter(d)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              dateFilter === d
                ? 'bg-navy-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {formatDate(`${d}T12:00:00Z`, 'UTC')}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <label htmlFor="activity-status-filter" className="sr-only">
            Filter by status
          </label>
          <select
            id="activity-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700"
          >
            <option value="">All statuses</option>
            <option value="planned">Planned</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Timeline Content */}
      {activitiesQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : activities.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No activities scheduled yet"
          description="Add itinerary slots with start and end times. Overlapping events will be flagged automatically."
          action={
            <Button onClick={openCreateModal}>
              <Plus className="h-4 w-4" />
              Schedule First Activity
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {groupedByDate.map(([dateKey, dayActivities]) => (
            <section key={dateKey} className="space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <CalendarDays className="h-4 w-4 text-teal-700" />
                <h3 className="text-sm font-bold text-navy-900">
                  {formatDate(`${dateKey}T12:00:00Z`, 'UTC')}
                </h3>
                <span className="text-xs text-slate-500">
                  ({dayActivities.length}{' '}
                  {dayActivities.length === 1 ? 'activity' : 'activities'})
                </span>
              </div>

              <div className="space-y-3">
                {dayActivities.map((act) => {
                  const isOvernight = act.localStartDate !== act.localEndDate;
                  return (
                    <Card
                      key={act.id}
                      data-testid={`activity-card-${act.id}`}
                      className={`p-4 sm:p-5 transition-colors ${
                        act.hasConflict
                          ? 'border-amber-400 bg-amber-50/40 ring-1 ring-amber-300'
                          : ''
                      } ${act.status === 'cancelled' ? 'opacity-70' : ''}`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-2 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-md bg-navy-900 px-2.5 py-1 text-xs font-semibold text-white tabular-nums">
                              <Clock className="h-3.5 w-3.5 text-teal-300" />
                              {formatTime(act.startAt, trip.timezone)} –{' '}
                              {formatTime(act.endAt, trip.timezone)}
                              {isOvernight ? ' (+1d)' : ''}
                            </span>
                            <StatusBadge status={act.status} />
                            <Badge variant="neutral" className="capitalize">
                              {act.category}
                            </Badge>
                            {act.hasConflict ? (
                              <Badge variant="amber">
                                <AlertTriangle className="h-3 w-3" />
                                Time Conflict
                              </Badge>
                            ) : null}
                            {act.linkedExpenseId ? (
                              <Badge variant="teal">
                                <ReceiptIndianRupee className="h-3 w-3" />
                                {formatINR(act.linkedExpenseId.amountMinor)} (
                                {act.linkedExpenseId.status})
                              </Badge>
                            ) : null}
                          </div>

                          <h4
                            className={`text-base font-bold text-navy-900 ${
                              act.status === 'cancelled' ? 'line-through' : ''
                            }`}
                          >
                            {act.title}
                          </h4>

                          {act.location ? (
                            <p className="flex items-center gap-1.5 text-xs text-slate-600">
                              <MapPin className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                              {act.location}
                            </p>
                          ) : null}

                          {act.description ? (
                            <p className="text-xs text-slate-600 leading-relaxed">
                              {act.description}
                            </p>
                          ) : null}

                          {act.assignedParticipantIds?.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                              <span className="text-[11px] font-medium text-slate-500">
                                Participants:
                              </span>
                              {act.assignedParticipantIds.map((pid) => (
                                <span
                                  key={pid}
                                  className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700"
                                >
                                  {memberNameById.get(String(pid)) || 'Member'}
                                </span>
                              ))}
                            </div>
                          ) : null}

                          {act.hasConflict ? (
                            <div className="mt-2 rounded-lg border border-amber-300 bg-amber-100/70 px-3 py-2 text-xs text-amber-950">
                              {act.conflicts.map((c) => (
                                <p key={c.conflictingActivityId}>
                                  <span className="font-semibold">Conflict:</span>{' '}
                                  {c.explanation}
                                </p>
                              ))}
                            </div>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => openEditModal(act)}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                            {act.hasConflict ? 'Adjust Time' : 'Edit'}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Delete ${act.title}`}
                            onClick={() => setDeleteTarget(act)}
                            className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Add / Edit Activity Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingActivity ? 'Edit Activity' : 'Schedule New Activity'}
        description={`Times are interpreted in ${trip.timezone}.`}
      >
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <FormField
            label="Activity Title"
            htmlFor="act-title"
            required
            error={errors.title?.message}
          >
            <input
              id="act-title"
              type="text"
              placeholder="e.g. Mandalpatti Jeep Safari"
              className={inputClassName}
              {...register('title')}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Start Date & Time"
              htmlFor="act-startLocal"
              required
              error={errors.startLocal?.message}
            >
              <input
                id="act-startLocal"
                type="datetime-local"
                className={inputClassName}
                {...register('startLocal')}
              />
            </FormField>

            <FormField
              label="End Date & Time"
              htmlFor="act-endLocal"
              required
              error={errors.endLocal?.message}
            >
              <input
                id="act-endLocal"
                type="datetime-local"
                className={inputClassName}
                {...register('endLocal')}
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Category" htmlFor="act-category">
              <select
                id="act-category"
                className={inputClassName}
                {...register('category')}
              >
                {ACTIVITY_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Status" htmlFor="act-status">
              <select
                id="act-status"
                className={inputClassName}
                {...register('status')}
              >
                {ACTIVITY_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st.charAt(0).toUpperCase() + st.slice(1)}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <FormField label="Location" htmlFor="act-location">
            <input
              id="act-location"
              type="text"
              placeholder="e.g. Mandalpatti Peak, Coorg"
              className={inputClassName}
              {...register('location')}
            />
          </FormField>

          <FormField label="Description" htmlFor="act-description">
            <textarea
              id="act-description"
              rows={2}
              placeholder="Notes, meeting spot, or gear checklist..."
              className={inputClassName}
              {...register('description')}
            />
          </FormField>

          <div className="space-y-1.5">
            <span className="block text-sm font-medium text-slate-800">
              Assigned Participants
            </span>
            <div className="flex flex-wrap gap-2">
              {trip.members.map((m) => {
                const checked = selectedParticipants.includes(m.userId);
                return (
                  <button
                    key={m.userId}
                    type="button"
                    onClick={() => toggleParticipant(m.userId)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                      checked
                        ? 'border-teal-600 bg-teal-50 text-teal-900'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {m.displayName}
                  </button>
                );
              })}
            </div>
          </div>

          {!editingActivity ? (
            <FormField
              label="Optional Planned Cost (₹ INR)"
              htmlFor="act-cost"
              hint="Creates one linked planned expense in the ledger (no double-counting)."
              error={errors.plannedCostRupees?.message}
            >
              <input
                id="act-cost"
                type="text"
                inputMode="decimal"
                placeholder="e.g. 1600.00"
                className={inputClassName}
                {...register('plannedCostRupees')}
              />
            </FormField>
          ) : null}

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
                : editingActivity
                  ? 'Save Changes'
                  : 'Add Activity'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        isPending={deleteMutation.isPending}
        title="Delete Activity"
        message={`Remove "${deleteTarget?.title}" from the itinerary? Any linked expense will remain in your financial ledger unlinked.`}
        confirmLabel="Delete Activity"
      />
    </div>
  );
}

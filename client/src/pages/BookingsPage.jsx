import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Edit2,
  ExternalLink,
  Hotel,
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
import { bookingsApi } from '../services/api';
import {
  formatDateTime,
  formatINR,
  rupeesToPaise,
  utcIsoToZonedInput,
  zonedDateTimeToUtcIso,
} from '../utils/format';

const BOOKING_CATEGORIES = [
  'accommodation',
  'transportation',
  'activities',
  'other',
];
const BOOKING_STATUSES = ['tentative', 'confirmed', 'cancelled'];

const bookingFormSchema = z
  .object({
    title: z.string().trim().min(2, 'Booking title is required.').max(140),
    provider: z.string().trim().min(1, 'Provider or vendor is required.').max(140),
    category: z.enum(BOOKING_CATEGORIES),
    status: z.enum(BOOKING_STATUSES),
    startLocal: z.string().optional().default(''),
    endLocal: z.string().optional().default(''),
    referenceNumber: z.string().trim().max(100).optional().default(''),
    url: z
      .string()
      .trim()
      .max(500)
      .optional()
      .default('')
      .refine(
        (val) => {
          if (!val) return true;
          try {
            const u = new URL(val);
            return u.protocol === 'http:' || u.protocol === 'https:';
          } catch (_err) {
            return false;
          }
        },
        'URL must start with http:// or https://'
      ),
    notes: z.string().trim().max(1000).optional().default(''),
    costRupees: z
      .string()
      .trim()
      .optional()
      .default('')
      .refine(
        (val) => !val || /^\d+(\.\d{1,2})?$/.test(val),
        'Enter a valid rupee amount.'
      ),
    costStatus: z.enum(['planned', 'paid']).default('planned'),
    paidByUserId: z.string().optional().default(''),
  })
  .refine(
    (data) => {
      if (data.startLocal && data.endLocal) {
        return data.endLocal >= data.startLocal;
      }
      return true;
    },
    {
      message: 'End date/time cannot be before start date/time.',
      path: ['endLocal'],
    }
  )
  .refine(
    (data) => {
      if (data.costRupees && data.costStatus === 'paid' && !data.paidByUserId) {
        return false;
      }
      return true;
    },
    {
      message: 'Select who paid when recording a paid booking expense.',
      path: ['paidByUserId'],
    }
  );

export function BookingsPage() {
  const { trip, tripId } = useOutletContext();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const bookingsQuery = useQuery({
    queryKey: ['trip', tripId, 'bookings', categoryFilter, statusFilter],
    queryFn: () =>
      bookingsApi.list(tripId, {
        category: categoryFilter || undefined,
        status: statusFilter || undefined,
      }),
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      title: '',
      provider: '',
      category: 'accommodation',
      status: 'tentative',
      startLocal: '',
      endLocal: '',
      referenceNumber: '',
      url: '',
      notes: '',
      costRupees: '',
      costStatus: 'planned',
      paidByUserId: trip.members?.[0]?.userId || '',
    },
  });

  const watchedCost = watch('costRupees');
  const watchedCostStatus = watch('costStatus');

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['trip', tripId, 'bookings'] });
    queryClient.invalidateQueries({ queryKey: ['trip', tripId, 'summary'] });
    queryClient.invalidateQueries({ queryKey: ['trip', tripId, 'expenses'] });
  };

  const createMutation = useMutation({
    mutationFn: (payload) => bookingsApi.create(tripId, payload),
    onSuccess: (data) => {
      invalidateAll();
      setModalOpen(false);
      toast.success('Booking recorded', `"${data.booking.title}" saved.`);
    },
    onError: (err) => toast.error('Could not save booking', err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => bookingsApi.update(tripId, id, payload),
    onSuccess: () => {
      invalidateAll();
      setModalOpen(false);
      setEditingBooking(null);
      toast.success('Booking updated', 'Changes saved.');
    },
    onError: (err) => toast.error('Could not update booking', err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => bookingsApi.remove(tripId, id),
    onSuccess: () => {
      invalidateAll();
      setDeleteTarget(null);
      toast.info('Booking removed');
    },
    onError: (err) => toast.error('Could not delete booking', err.message),
  });

  const openCreateModal = () => {
    setEditingBooking(null);
    reset({
      title: '',
      provider: '',
      category: 'accommodation',
      status: 'tentative',
      startLocal: '',
      endLocal: '',
      referenceNumber: '',
      url: '',
      notes: '',
      costRupees: '',
      costStatus: 'planned',
      paidByUserId: trip.members?.[0]?.userId || '',
    });
    setModalOpen(true);
  };

  const openEditModal = (booking) => {
    setEditingBooking(booking);
    reset({
      title: booking.title,
      provider: booking.provider,
      category: booking.category,
      status: booking.status,
      startLocal: booking.startAt
        ? utcIsoToZonedInput(booking.startAt, trip.timezone)
        : '',
      endLocal: booking.endAt
        ? utcIsoToZonedInput(booking.endAt, trip.timezone)
        : '',
      referenceNumber: booking.referenceNumber || '',
      url: booking.url || '',
      notes: booking.notes || '',
      costRupees: '',
      costStatus: 'planned',
      paidByUserId: trip.members?.[0]?.userId || '',
    });
    setModalOpen(true);
  };

  const onSubmit = (values) => {
    const startAt = values.startLocal
      ? zonedDateTimeToUtcIso(values.startLocal, trip.timezone)
      : null;
    const endAt = values.endLocal
      ? zonedDateTimeToUtcIso(values.endLocal, trip.timezone)
      : null;

    const payload = {
      title: values.title,
      provider: values.provider,
      category: values.category,
      status: values.status,
      startAt,
      endAt,
      referenceNumber: values.referenceNumber,
      url: values.url,
      notes: values.notes,
    };

    if (!editingBooking && values.costRupees) {
      const paise = rupeesToPaise(values.costRupees);
      if (paise && paise > 0) {
        payload.costMinor = paise;
        payload.costStatus = values.costStatus;
        if (values.costStatus === 'paid') {
          payload.paidByUserId = values.paidByUserId;
        }
      }
    }

    if (editingBooking) {
      updateMutation.mutate({ id: editingBooking.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const bookings = bookingsQuery.data?.bookings || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-ink">
            Reservations &amp; Bookings Organizer
          </h2>
          <p className="text-xs text-ink-body">
            Track accommodation, transport, and activity reservations with reference numbers and single-ledger linked costs.
          </p>
        </div>

        <Button onClick={openCreateModal}>
          <Plus className="h-4 w-4" />
          Add Booking
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-canvas-border bg-white p-3.5 shadow-card">
        <span className="text-xs font-semibold text-ink-muted mr-1">Category:</span>
        <button
          type="button"
          onClick={() => setCategoryFilter('')}
          className={`min-h-[36px] rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors duration-150 ${
            categoryFilter === ''
              ? 'bg-[#0F766E] text-white shadow-sm'
              : 'bg-canvas-subtle text-ink-body hover:bg-[#E7ECEA] hover:text-ink'
          }`}
        >
          All
        </button>
        {BOOKING_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoryFilter(cat)}
            className={`min-h-[36px] rounded-xl px-3 py-1.5 text-xs font-semibold capitalize transition-colors duration-150 ${
              categoryFilter === cat
                ? 'bg-[#0F766E] text-white shadow-sm'
                : 'bg-canvas-subtle text-ink-body hover:bg-[#E7ECEA] hover:text-ink'
            }`}
          >
            {cat}
          </button>
        ))}

        <div className="ml-auto">
          <select
            aria-label="Filter booking status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="min-h-[36px] rounded-xl border border-[#D4DDD9] bg-white px-3 py-1.5 text-xs font-medium text-ink focus:border-[#0F766E] focus:outline-none"
          >
            <option value="">All statuses</option>
            <option value="tentative">Tentative</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* List */}
      {bookingsQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
        </div>
      ) : bookings.length === 0 ? (
        <EmptyState
          icon={Hotel}
          title="No bookings recorded yet"
          description="Keep confirmation numbers, vendor details, and check-in windows organized for your whole group."
          action={
            <Button onClick={openCreateModal}>
              <Plus className="h-4 w-4" />
              Add First Booking
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {bookings.map((booking) => (
            <Card key={booking.id} className="p-5 flex flex-col justify-between gap-4 hover:border-[#0F766E]/45">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={booking.status} />
                    <Badge variant="neutral" className="capitalize">
                      {booking.category}
                    </Badge>
                  </div>
                  {booking.referenceNumber ? (
                    <span className="rounded-lg border border-canvas-border bg-[#FAF9F5] px-2.5 py-0.5 font-mono text-[11px] font-bold text-ink">
                      Ref: {booking.referenceNumber}
                    </span>
                  ) : null}
                </div>

                <div>
                  <h3 className="text-base font-bold text-ink">
                    {booking.title}
                  </h3>
                  <p className="text-xs font-semibold text-[#0F766E] mt-0.5">
                    {booking.provider}
                  </p>
                </div>

                {booking.startAt || booking.endAt ? (
                  <p className="rounded-lg border border-canvas-border bg-[#FAF9F5] px-3 py-1.5 text-xs text-ink-body tabular-nums">
                    {booking.startAt
                      ? formatDateTime(booking.startAt, trip.timezone)
                      : '—'}{' '}
                    →{' '}
                    {booking.endAt
                      ? formatDateTime(booking.endAt, trip.timezone)
                      : '—'}
                  </p>
                ) : null}

                {booking.notes ? (
                  <p className="text-xs text-ink-body leading-relaxed">
                    {booking.notes}
                  </p>
                ) : null}

                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  {booking.linkedExpenseId ? (
                    <Badge variant="teal">
                      <ReceiptIndianRupee className="h-3 w-3" />
                      Linked Ledger: {formatINR(booking.linkedExpenseId.amountMinor)} (
                      {booking.linkedExpenseId.status})
                    </Badge>
                  ) : null}
                  {booking.url ? (
                    <a
                      href={booking.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F766E] hover:underline"
                    >
                      Booking Link
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-canvas-border pt-3">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => openEditModal(booking)}
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Delete ${booking.title}`}
                  onClick={() => setDeleteTarget(booking)}
                  className="text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingBooking ? 'Edit Booking' : 'Record New Booking'}
        description="Store reservation references cleanly. Associated costs go into the single expense ledger."
      >
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <FormField
            label="Booking Title"
            htmlFor="book-title"
            required
            error={errors.title?.message}
          >
            <input
              id="book-title"
              type="text"
              placeholder="e.g. Silver Oak Estate Homestay"
              className={inputClassName}
              {...register('title')}
            />
          </FormField>

          <FormField
            label="Provider / Vendor"
            htmlFor="book-provider"
            required
            error={errors.provider?.message}
          >
            <input
              id="book-provider"
              type="text"
              placeholder="e.g. Silver Oak Estates"
              className={inputClassName}
              {...register('provider')}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Category" htmlFor="book-category">
              <select
                id="book-category"
                className={inputClassName}
                {...register('category')}
              >
                {BOOKING_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Status" htmlFor="book-status">
              <select
                id="book-status"
                className={inputClassName}
                {...register('status')}
              >
                {BOOKING_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Check-in / Departure"
              htmlFor="book-startLocal"
              error={errors.startLocal?.message}
            >
              <input
                id="book-startLocal"
                type="datetime-local"
                className={inputClassName}
                {...register('startLocal')}
              />
            </FormField>

            <FormField
              label="Check-out / Arrival"
              htmlFor="book-endLocal"
              error={errors.endLocal?.message}
            >
              <input
                id="book-endLocal"
                type="datetime-local"
                className={inputClassName}
                {...register('endLocal')}
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Reference Number" htmlFor="book-ref">
              <input
                id="book-ref"
                type="text"
                placeholder="e.g. PNR-88421"
                className={inputClassName}
                {...register('referenceNumber')}
              />
            </FormField>

            <FormField
              label="Reservation URL"
              htmlFor="book-url"
              error={errors.url?.message}
            >
              <input
                id="book-url"
                type="url"
                placeholder="https://..."
                className={inputClassName}
                {...register('url')}
              />
            </FormField>
          </div>

          <FormField label="Notes" htmlFor="book-notes">
            <textarea
              id="book-notes"
              rows={2}
              placeholder="Check-in instructions, cancellation window, etc."
              className={inputClassName}
              {...register('notes')}
            />
          </FormField>

          {!editingBooking ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-3">
              <p className="text-xs font-semibold text-navy-900">
                Optional Linked Ledger Cost (Avoids Double-Counting)
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  label="Amount (₹ INR)"
                  htmlFor="book-cost"
                  error={errors.costRupees?.message}
                >
                  <input
                    id="book-cost"
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 14000.00"
                    className={inputClassName}
                    {...register('costRupees')}
                  />
                </FormField>
                {watchedCost ? (
                  <FormField label="Expense Status" htmlFor="book-costStatus">
                    <select
                      id="book-costStatus"
                      className={inputClassName}
                      {...register('costStatus')}
                    >
                      <option value="planned">Planned (Estimate)</option>
                      <option value="paid">Paid</option>
                    </select>
                  </FormField>
                ) : null}
              </div>

              {watchedCost && watchedCostStatus === 'paid' ? (
                <FormField
                  label="Paid By"
                  htmlFor="book-paidBy"
                  required
                  error={errors.paidByUserId?.message}
                >
                  <select
                    id="book-paidBy"
                    className={inputClassName}
                    {...register('paidByUserId')}
                  >
                    {trip.members.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.displayName}
                      </option>
                    ))}
                  </select>
                </FormField>
              ) : null}
            </div>
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
                : editingBooking
                  ? 'Save Changes'
                  : 'Save Booking'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        isPending={deleteMutation.isPending}
        title="Delete Booking"
        message={`Remove "${deleteTarget?.title}"? Linked expense entries in your ledger remain intact unless deleted separately.`}
        confirmLabel="Delete Booking"
      />
    </div>
  );
}


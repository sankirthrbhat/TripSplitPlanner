import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, ShieldAlert, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { FormField, inputClassName } from '../components/ui/FormField';
import { useToast } from '../hooks/useToast';
import { tripsApi } from '../services/api';
import {
  paiseToRupeesInput,
  rupeesToPaise,
  SUPPORTED_TIMEZONES,
} from '../utils/format';

const settingsFormSchema = z
  .object({
    title: z.string().trim().min(2, 'Title is required.').max(120),
    destination: z.string().trim().min(2, 'Destination is required.').max(120),
    description: z.string().trim().max(1000).optional().default(''),
    startDate: z.string().min(1, 'Start date is required.'),
    endDate: z.string().min(1, 'End date is required.'),
    timezone: z.string().min(1, 'Timezone is required.'),
    budgetRupees: z
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
    (data) =>
      new Date(data.endDate).getTime() >= new Date(data.startDate).getTime(),
    {
      message: 'End date cannot be before start date.',
      path: ['endDate'],
    }
  );

export function TripSettingsPage() {
  const { trip, tripId } = useOutletContext();
  const isOwner = trip.viewerRole === 'owner';
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      title: trip.title,
      destination: trip.destination,
      description: trip.description || '',
      startDate: new Date(trip.startDate).toISOString().slice(0, 10),
      endDate: new Date(trip.endDate).toISOString().slice(0, 10),
      timezone: trip.timezone || 'Asia/Kolkata',
      budgetRupees:
        trip.budgetLimitMinor > 0
          ? paiseToRupeesInput(trip.budgetLimitMinor)
          : '',
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload) => tripsApi.update(tripId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
      queryClient.invalidateQueries({ queryKey: ['trip', tripId, 'summary'] });
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      toast.success('Trip settings updated');
    },
    onError: (err) => toast.error('Could not update trip', err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => tripsApi.remove(tripId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      toast.info('Trip deleted', `"${trip.title}" has been permanently removed.`);
      navigate('/trips', { replace: true });
    },
    onError: (err) => toast.error('Could not delete trip', err.message),
  });

  const onSubmit = (values) => {
    const budgetLimitMinor = values.budgetRupees
      ? rupeesToPaise(values.budgetRupees) ?? 0
      : 0;

    updateMutation.mutate({
      title: values.title,
      destination: values.destination,
      description: values.description,
      startDate: new Date(`${values.startDate}T00:00:00.000Z`).toISOString(),
      endDate: new Date(`${values.endDate}T23:59:59.000Z`).toISOString(),
      timezone: values.timezone,
      budgetLimitMinor,
    });
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-navy-900">Trip Workspace Settings</h2>
        <p className="text-xs text-slate-600">
          Update trip dates, timezone, budget cap, or manage workspace lifecycle.
        </p>
      </div>

      {!isOwner ? (
        <Card className="p-5 border-amber-200 bg-amber-50 text-xs text-amber-950 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0" />
          <div>
            <p className="font-bold">Read-Only View (Collaborator Role)</p>
            <p className="mt-0.5">
              Only the trip owner can modify workspace settings or delete this trip.
            </p>
          </div>
        </Card>
      ) : null}

      <Card className="p-6">
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <FormField
            label="Trip Title"
            htmlFor="settings-title"
            required
            error={errors.title?.message}
          >
            <input
              id="settings-title"
              type="text"
              disabled={!isOwner}
              className={inputClassName}
              {...register('title')}
            />
          </FormField>

          <FormField
            label="Destination"
            htmlFor="settings-destination"
            required
            error={errors.destination?.message}
          >
            <input
              id="settings-destination"
              type="text"
              disabled={!isOwner}
              className={inputClassName}
              {...register('destination')}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Start Date"
              htmlFor="settings-start"
              required
              error={errors.startDate?.message}
            >
              <input
                id="settings-start"
                type="date"
                disabled={!isOwner}
                className={inputClassName}
                {...register('startDate')}
              />
            </FormField>

            <FormField
              label="End Date"
              htmlFor="settings-end"
              required
              error={errors.endDate?.message}
            >
              <input
                id="settings-end"
                type="date"
                disabled={!isOwner}
                className={inputClassName}
                {...register('endDate')}
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Timezone (IANA)" htmlFor="settings-tz">
              <select
                id="settings-tz"
                disabled={!isOwner}
                className={inputClassName}
                {...register('timezone')}
              >
                {SUPPORTED_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField
              label="Group Budget Cap (₹ INR)"
              htmlFor="settings-budget"
              error={errors.budgetRupees?.message}
            >
              <input
                id="settings-budget"
                type="text"
                inputMode="decimal"
                disabled={!isOwner}
                placeholder="0.00"
                className={inputClassName}
                {...register('budgetRupees')}
              />
            </FormField>
          </div>

          <FormField label="Description" htmlFor="settings-desc">
            <textarea
              id="settings-desc"
              rows={3}
              disabled={!isOwner}
              className={inputClassName}
              {...register('description')}
            />
          </FormField>

          {isOwner ? (
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={updateMutation.isPending}>
                <Save className="h-4 w-4" />
                {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          ) : null}
        </form>
      </Card>

      {isOwner ? (
        <Card className="p-6 border-rose-200 bg-rose-50/40 space-y-3">
          <h3 className="text-base font-bold text-rose-950">Danger Zone</h3>
          <p className="text-xs text-rose-900 leading-relaxed">
            Deleting this trip permanently removes the trip workspace, all activities,
            bookings, tasks, invitations, and expense ledger records.
          </p>
          <Button
            variant="danger"
            onClick={() => setConfirmDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            Delete Trip Permanently
          </Button>
        </Card>
      ) : null}

      <ConfirmDialog
        isOpen={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        isPending={deleteMutation.isPending}
        title="Permanently Delete Trip?"
        message={`Are you sure you want to delete "${trip.title}" and all of its itineraries, bookings, tasks, and expenses? This action cannot be undone.`}
        confirmLabel="Yes, Delete Trip"
      />
    </div>
  );
}


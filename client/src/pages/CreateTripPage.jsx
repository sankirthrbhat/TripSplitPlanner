import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Compass } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { FormField, inputClassName } from '../components/ui/FormField';
import { useToast } from '../hooks/useToast';
import { tripsApi } from '../services/api';
import { rupeesToPaise, SUPPORTED_TIMEZONES } from '../utils/format';

const createTripFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(2, 'Trip title must be at least 2 characters.')
      .max(120, 'Trip title cannot exceed 120 characters.'),
    destination: z
      .string()
      .trim()
      .min(2, 'Destination must be at least 2 characters.')
      .max(120, 'Destination cannot exceed 120 characters.'),
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
        'Enter a valid rupee amount (up to 2 decimal places).'
      ),
  })
  .refine(
    (data) => {
      if (!data.startDate || !data.endDate) return true;
      return new Date(data.endDate).getTime() >= new Date(data.startDate).getTime();
    },
    {
      message: 'End date cannot be before start date.',
      path: ['endDate'],
    }
  );

export function CreateTripPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(createTripFormSchema),
    defaultValues: {
      title: '',
      destination: '',
      description: '',
      startDate: '2026-12-11',
      endDate: '2026-12-13',
      timezone: 'Asia/Kolkata',
      budgetRupees: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload) => tripsApi.create(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      toast.success('Trip created', `"${data.trip.title}" is ready.`);
      navigate(`/trips/${data.trip.id}`);
    },
    onError: (err) => {
      setServerError(err.message || 'Failed to create trip.');
    },
  });

  const onSubmit = (values) => {
    setServerError('');
    const budgetLimitMinor = values.budgetRupees
      ? rupeesToPaise(values.budgetRupees) ?? 0
      : 0;

    createMutation.mutate({
      title: values.title,
      destination: values.destination,
      description: values.description,
      startDate: new Date(`${values.startDate}T00:00:00.000Z`).toISOString(),
      endDate: new Date(`${values.endDate}T23:59:59.000Z`).toISOString(),
      timezone: values.timezone,
      currency: 'INR',
      budgetLimitMinor,
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          to="/trips"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F766E] hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to My Trips
        </Link>
        <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
          Create a New Trip Workspace
        </h1>
        <p className="mt-1 text-sm text-ink-body">
          Set up your destination, travel dates, timezone, and optional group budget cap.
        </p>
      </div>

      <Card className="overflow-hidden">
        <div
          aria-hidden="true"
          className="h-1.5 w-full bg-gradient-to-r from-[#0F766E] via-sunshine to-coral"
        />
        <div className="p-6 sm:p-8">
          {serverError ? (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800"
            >
              {serverError}
            </div>
          ) : null}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
            <FormField
              label="Trip Title"
              htmlFor="trip-title"
              required
              error={errors.title?.message}
            >
              <input
                id="trip-title"
                type="text"
                placeholder="e.g. Coorg Weekend Escape"
                className={inputClassName}
                {...register('title')}
              />
            </FormField>

            <FormField
              label="Destination"
              htmlFor="trip-destination"
              required
              error={errors.destination?.message}
            >
              <input
                id="trip-destination"
                type="text"
                placeholder="e.g. Madikeri, Karnataka"
                className={inputClassName}
                {...register('destination')}
              />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Start Date"
                htmlFor="trip-startDate"
                required
                error={errors.startDate?.message}
              >
                <input
                  id="trip-startDate"
                  type="date"
                  className={inputClassName}
                  {...register('startDate')}
                />
              </FormField>

              <FormField
                label="End Date"
                htmlFor="trip-endDate"
                required
                error={errors.endDate?.message}
              >
                <input
                  id="trip-endDate"
                  type="date"
                  className={inputClassName}
                  {...register('endDate')}
                />
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Trip Timezone (IANA)"
                htmlFor="trip-timezone"
                required
                hint="Activity times are displayed in this timezone."
                error={errors.timezone?.message}
              >
                <select
                  id="trip-timezone"
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
                label="Total Group Budget Cap (₹ INR)"
                htmlFor="trip-budget"
                hint="Optional. Stored as exact integer paise."
                error={errors.budgetRupees?.message}
              >
                <input
                  id="trip-budget"
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 32000.00"
                  className={inputClassName}
                  {...register('budgetRupees')}
                />
              </FormField>
            </div>

            <FormField
              label="Trip Description & Notes"
              htmlFor="trip-description"
              error={errors.description?.message}
            >
              <textarea
                id="trip-description"
                rows={3}
                placeholder="Brief overview of your group trip goals, meeting point, or notes..."
                className={inputClassName}
                {...register('description')}
              />
            </FormField>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-canvas-border">
              <Link
                to="/trips"
                className="inline-flex min-h-[42px] items-center rounded-xl border border-[#D4DDD9] bg-white px-4 py-2 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-canvas-subtle"
              >
                Cancel
              </Link>
              <Button type="submit" disabled={createMutation.isPending}>
                <Compass className="h-4 w-4" />
                {createMutation.isPending ? 'Creating Trip...' : 'Create Trip Workspace'}
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}


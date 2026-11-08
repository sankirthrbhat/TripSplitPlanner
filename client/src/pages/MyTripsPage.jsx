import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Compass,
  MapPin,
  Plus,
  Search,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { AvatarStack } from '../components/ui/AvatarStack';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { EmptyState, Skeleton } from '../components/ui/EmptyState';
import { inputClassName } from '../components/ui/FormField';
import { tripsApi } from '../services/api';
import { formatDateRange, formatINR } from '../utils/format';

export function MyTripsPage() {
  const [search, setSearch] = useState('');

  const tripsQuery = useQuery({
    queryKey: ['trips'],
    queryFn: async () => {
      const data = await tripsApi.list();
      return data.trips || [];
    },
  });

  const trips = tripsQuery.data || [];
  const filteredTrips = trips.filter((t) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      t.title.toLowerCase().includes(q) ||
      t.destination.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-navy-900">
            My Trip Workspaces
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage itineraries, shared expenses, bookings, and tasks across your trips.
          </p>
        </div>

        <Link
          to="/trips/new"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Create New Trip
        </Link>
      </div>

      {trips.length > 0 ? (
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter trips by title or destination..."
            aria-label="Filter trips"
            className={`${inputClassName} pl-9`}
          />
        </div>
      ) : null}

      {tripsQuery.isLoading ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      ) : tripsQuery.isError ? (
        <Card className="p-6 border-rose-200 bg-rose-50 text-rose-900">
          <p className="text-sm font-semibold">Failed to load trips</p>
          <p className="text-xs mt-1">{tripsQuery.error?.message}</p>
        </Card>
      ) : filteredTrips.length === 0 ? (
        <EmptyState
          icon={Compass}
          title={trips.length === 0 ? 'No trips created yet' : 'No matching trips found'}
          description={
            trips.length === 0
              ? 'Create your first group trip workspace to start planning activities, tracking bookings, and splitting expenses.'
              : 'Try adjusting your search filter.'
          }
          action={
            trips.length === 0 ? (
              <Link
                to="/trips/new"
                className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
              >
                <Plus className="h-4 w-4" />
                Plan Your First Trip
              </Link>
            ) : null
          }
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filteredTrips.map((trip) => {
            const stats = trip.quickStats || {};
            const hasConflict = (stats.conflictCount || 0) > 0;

            return (
              <Card
                key={trip.id}
                className="flex flex-col justify-between p-5 hover:border-teal-600/50 transition-all"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant={trip.viewerRole === 'owner' ? 'navy' : 'teal'}>
                      {trip.viewerRole === 'owner' ? 'Owner' : 'Member'}
                    </Badge>
                    {hasConflict ? (
                      <Badge variant="amber">
                        <AlertTriangle className="h-3 w-3" />
                        {stats.conflictCount} Conflict{stats.conflictCount > 1 ? 's' : ''}
                      </Badge>
                    ) : null}
                  </div>

                  <div>
                    <Link
                      to={`/trips/${trip.id}`}
                      className="text-lg font-bold text-navy-900 hover:text-teal-700 line-clamp-1"
                    >
                      {trip.title}
                    </Link>
                    <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-slate-600">
                      <MapPin className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                      <span className="truncate">{trip.destination}</span>
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                      <CalendarDays className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      {formatDateRange(trip.startDate, trip.endDate, trip.timezone)}
                    </p>
                  </div>

                  {trip.description ? (
                    <p className="text-xs text-slate-600 line-clamp-2">
                      {trip.description}
                    </p>
                  ) : null}
                </div>

                <div className="mt-5 space-y-4 border-t border-slate-100 pt-4">
                  <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-2.5 text-xs">
                    <div>
                      <span className="text-slate-500 block">Estimated Total</span>
                      <span className="font-semibold text-navy-900 tabular-nums">
                        {formatINR(stats.estimatedTotalMinor || 0)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Budget Cap</span>
                      <span className="font-semibold text-slate-700 tabular-nums">
                        {trip.budgetLimitMinor > 0
                          ? formatINR(trip.budgetLimitMinor)
                          : 'No limit'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <AvatarStack members={trip.members || []} max={4} />
                    <Link
                      to={`/trips/${trip.id}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800"
                    >
                      Open Workspace
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}


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
  Users,
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
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
            My Trip Workspaces
          </h1>
          <p className="mt-1 text-sm text-ink-body">
            Open a travel ticket below to coordinate itineraries, bookings, tasks, and shared costs.
          </p>
        </div>

        <Link
          to="/trips/new"
          className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-[#0F766E] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-[#0D625B]"
        >
          <Plus className="h-4 w-4" />
          Create New Trip
        </Link>
      </div>

      {trips.length > 0 ? (
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-ink-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter trips by title or destination..."
            aria-label="Filter trips"
            className={`${inputClassName} pl-10`}
          />
        </div>
      ) : null}

      {tripsQuery.isLoading ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
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
              ? 'Start your first shared trip ticket to map daily plans, organize reservations, and split costs fairly with friends.'
              : 'Try adjusting your search filter or clear the search box to see all trips.'
          }
          action={
            trips.length === 0 ? (
              <Link
                to="/trips/new"
                className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-[#0F766E] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-[#0D625B]"
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
            const memberCount = (trip.members || []).length;

            return (
              <Card
                key={trip.id}
                className="group relative flex flex-col justify-between overflow-hidden hover:border-[#0F766E]/55 hover:shadow-card-hover"
              >
                {/* Ticket top accent strip */}
                <div
                  aria-hidden="true"
                  className="h-1.5 w-full bg-gradient-to-r from-[#0F766E] via-[#0F766E] to-sunshine"
                />

                {/* Upper Ticket Section */}
                <div className="p-5 space-y-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant={trip.viewerRole === 'owner' ? 'navy' : 'teal'}>
                      {trip.viewerRole === 'owner' ? 'Owner' : 'Member'}
                    </Badge>
                    {hasConflict ? (
                      <Badge variant="amber">
                        <AlertTriangle className="h-3 w-3" />
                        {stats.conflictCount} Conflict{stats.conflictCount > 1 ? 's' : ''}
                      </Badge>
                    ) : (
                      <Badge variant="teal">Schedule Clear</Badge>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Link
                      to={`/trips/${trip.id}`}
                      className="block text-lg font-extrabold leading-snug text-ink transition-colors duration-150 group-hover:text-[#0F766E] line-clamp-2 break-words"
                    >
                      {trip.title}
                    </Link>
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-body">
                      <MapPin className="h-3.5 w-3.5 text-[#0F766E] shrink-0" />
                      <span className="truncate">{trip.destination}</span>
                    </p>
                    <p className="flex items-center gap-1.5 text-xs text-ink-muted tabular-nums">
                      <CalendarDays className="h-3.5 w-3.5 text-ink-muted shrink-0" />
                      <span>{formatDateRange(trip.startDate, trip.endDate, trip.timezone)}</span>
                    </p>
                  </div>

                  {trip.description ? (
                    <p className="text-xs text-ink-body leading-relaxed line-clamp-2">
                      {trip.description}
                    </p>
                  ) : null}
                </div>

                {/* Perforated Ticket Divider */}
                <div className="relative mx-0 border-t border-dashed border-[#D3DDD9] bg-[#FAF9F5]">
                  <span
                    aria-hidden="true"
                    className="absolute -left-2 -top-2 h-4 w-4 rounded-full border border-canvas-border bg-canvas"
                  />
                  <span
                    aria-hidden="true"
                    className="absolute -right-2 -top-2 h-4 w-4 rounded-full border border-canvas-border bg-canvas"
                  />

                  {/* Ticket Stub: Budget & Entry Action */}
                  <div className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3 rounded-xl border border-canvas-border bg-white p-3 text-xs">
                      <div>
                        <span className="text-ink-muted block">Estimated Total</span>
                        <span className="mt-0.5 block font-bold text-ink tabular-nums">
                          {formatINR(stats.estimatedTotalMinor || 0)}
                        </span>
                      </div>
                      <div>
                        <span className="text-ink-muted block">Budget Cap</span>
                        <span className="mt-0.5 block font-semibold text-ink-body tabular-nums">
                          {trip.budgetLimitMinor > 0
                            ? formatINR(trip.budgetLimitMinor)
                            : 'No limit'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <AvatarStack members={trip.members || []} max={4} />
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-muted tabular-nums truncate">
                          <Users className="h-3.5 w-3.5 shrink-0" />
                          {memberCount} {memberCount === 1 ? 'member' : 'members'}
                        </span>
                      </div>

                      <Link
                        to={`/trips/${trip.id}`}
                        className="inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-xl bg-[#E9F5F3] px-3 py-1.5 text-xs font-semibold text-[#0C5E57] transition-colors duration-150 group-hover:bg-[#0F766E] group-hover:text-white"
                      >
                        Open Workspace
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
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

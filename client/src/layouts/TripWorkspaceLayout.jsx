import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckSquare,
  Clock,
  Hotel,
  LayoutDashboard,
  MapPin,
  ReceiptIndianRupee,
  Settings,
  Users,
} from 'lucide-react';
import { Link, NavLink, Outlet, useParams } from 'react-router-dom';
import { AvatarStack } from '../components/ui/AvatarStack';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/EmptyState';
import { tripsApi } from '../services/api';
import { formatDateRange } from '../utils/format';

export function TripWorkspaceLayout() {
  const { tripId } = useParams();

  const tripQuery = useQuery({
    queryKey: ['trip', tripId],
    queryFn: async () => {
      const data = await tripsApi.get(tripId);
      return data.trip;
    },
    retry: false,
  });

  if (tripQuery.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-12 w-full" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  if (tripQuery.isError) {
    const err = tripQuery.error;
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-bold text-navy-900">
          {err.status === 403 ? 'Access Denied' : 'Trip Unavailable'}
        </h1>
        <p className="mt-2 text-sm text-slate-600">{err.message}</p>
        <div className="mt-6">
          <Link
            to="/trips"
            className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to My Trips
          </Link>
        </div>
      </div>
    );
  }

  const trip = tripQuery.data;

  const navItems = [
    { to: `/trips/${tripId}`, label: 'Overview', icon: LayoutDashboard, end: true },
    { to: `/trips/${tripId}/itinerary`, label: 'Itinerary', icon: CalendarDays },
    { to: `/trips/${tripId}/bookings`, label: 'Bookings', icon: Hotel },
    { to: `/trips/${tripId}/tasks`, label: 'Tasks', icon: CheckSquare },
    { to: `/trips/${tripId}/expenses`, label: 'Expenses', icon: ReceiptIndianRupee },
    { to: `/trips/${tripId}/members`, label: 'Members', icon: Users },
    { to: `/trips/${tripId}/settings`, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="space-y-6">
      {/* Workspace Header Card */}
      <div className="rounded-2xl border border-navy-800 bg-navy-900 text-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/trips"
                className="inline-flex items-center gap-1 text-xs font-medium text-teal-300 hover:text-teal-200"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                All Trips
              </Link>
              <span className="text-slate-600">•</span>
              <Badge variant="teal" className="bg-teal-900/60 text-teal-200 border-teal-700">
                {trip.viewerRole === 'owner' ? 'Trip Owner' : 'Collaborator'}
              </Badge>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {trip.title}
            </h1>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs sm:text-sm text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-teal-400" />
                {trip.destination}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 text-teal-400" />
                {formatDateRange(trip.startDate, trip.endDate, trip.timezone)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-teal-400" />
                {trip.timezone}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <AvatarStack members={trip.members} />
              <div className="text-xs text-slate-300">
                <span className="font-semibold text-white">{trip.members.length}</span>{' '}
                {trip.members.length === 1 ? 'member' : 'members'}
              </div>
            </div>
            <Link
              to={`/trips/${tripId}/members`}
              className="rounded-lg bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-500 transition-colors"
            >
              Invite Friends
            </Link>
          </div>
        </div>
      </div>

      {/* Responsive Workspace Navigation Tabs */}
      <nav
        aria-label="Trip workspace sections"
        className="flex items-center gap-1 overflow-x-auto rounded-xl border border-canvas-border bg-white p-1.5 shadow-sm"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-navy-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-navy-900'
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Active Tab View */}
      <Outlet context={{ trip, tripId }} />
    </div>
  );
}


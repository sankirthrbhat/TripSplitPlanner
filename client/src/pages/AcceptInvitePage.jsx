import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  MapPin,
  Users,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { StatusBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/EmptyState';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { invitationsApi } from '../services/api';
import { formatDateRange } from '../utils/format';

export function AcceptInvitePage() {
  const { token } = useParams();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const previewQuery = useQuery({
    queryKey: ['invitation', token],
    queryFn: () => invitationsApi.preview(token),
    enabled: Boolean(isAuthenticated && token),
    retry: false,
  });

  const acceptMutation = useMutation({
    mutationFn: () => invitationsApi.accept(token),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      toast.success('Joined trip!', `Welcome to "${data.trip.title}".`);
      navigate(`/trips/${data.tripId}`, { replace: true });
    },
    onError: (err) => {
      toast.error('Could not accept invitation', err.message);
    },
  });

  if (authLoading) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <Skeleton className="h-64" />
      </div>
    );
  }

  const redirectPath = `/invite/${token}`;

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <Card className="p-6 sm:p-8 text-center space-y-5">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 border border-teal-200">
            <Users className="h-6 w-6" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold text-navy-900">
              You&apos;ve Been Invited to a Trip
            </h1>
            <p className="text-sm text-slate-600">
              Sign in or create a free TripSplit Planner account to accept this
              trip invitation and collaborate with your group.
            </p>
          </div>

          <div className="flex flex-col gap-2.5 pt-2">
            <Link
              to={`/login?redirect=${encodeURIComponent(redirectPath)}`}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
            >
              Log In to Accept Invitation
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to={`/register?redirect=${encodeURIComponent(redirectPath)}`}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Create New Account
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (previewQuery.isLoading) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (previewQuery.isError) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <Card className="p-6 sm:p-8 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-navy-900">Invalid Invitation</h1>
          <p className="text-sm text-slate-600">
            {previewQuery.error?.message ||
              'This invitation token could not be found.'}
          </p>
          <Link
            to="/trips"
            className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Go to My Trips
          </Link>
        </Card>
      </div>
    );
  }

  const { invitation, trip } = previewQuery.data;

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Card className="p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-teal-700">
            Trip Workspace Invitation
          </span>
          <StatusBadge status={invitation.status} />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-navy-900">{trip.title}</h1>
          <p className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <MapPin className="h-4 w-4 text-teal-600" />
            {trip.destination}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <CalendarDays className="h-4 w-4 text-slate-400" />
            {formatDateRange(trip.startDate, trip.endDate)}
          </p>
        </div>

        <div className="rounded-xl bg-slate-50 p-3.5 text-xs text-slate-600 space-y-1">
          <p>
            Invited by{' '}
            <span className="font-semibold text-navy-900">
              {invitation.inviterName}
            </span>
          </p>
          <p>{trip.memberCount} current member(s) in workspace</p>
        </div>

        {trip.alreadyMember ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-900">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              You are already a member of this trip.
            </div>
            <Link
              to={`/trips/${trip.id}`}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-800"
            >
              Open Trip Workspace
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : invitation.status !== 'pending' ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-900">
            This invitation is <span className="font-bold">{invitation.status}</span> and
            can no longer be accepted. Ask the trip owner for a fresh link.
          </div>
        ) : (
          <Button
            onClick={() => acceptMutation.mutate()}
            disabled={acceptMutation.isPending}
            className="w-full py-2.5"
          >
            {acceptMutation.isPending
              ? 'Joining Trip...'
              : 'Accept Invitation & Join Trip'}
          </Button>
        )}
      </Card>
    </div>
  );
}


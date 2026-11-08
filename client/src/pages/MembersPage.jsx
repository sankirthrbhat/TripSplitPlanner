import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  Copy,
  Link2,
  Shield,
  Trash2,
  UserMinus,
  Users,
} from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { Badge, StatusBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { FormField, inputClassName } from '../components/ui/FormField';
import { useToast } from '../hooks/useToast';
import { invitationsApi, tripsApi } from '../services/api';
import { formatDate, getInitials } from '../utils/format';

export function MembersPage() {
  const { trip, tripId } = useOutletContext();
  const toast = useToast();
  const queryClient = useQueryClient();
  const isOwner = trip.viewerRole === 'owner';

  const [invitedEmail, setInvitedEmail] = useState('');
  const [label, setLabel] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);

  const invitationsQuery = useQuery({
    queryKey: ['trip', tripId, 'invitations'],
    queryFn: () => invitationsApi.listForTrip(tripId),
  });

  const createInviteMutation = useMutation({
    mutationFn: (payload) => invitationsApi.createForTrip(tripId, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['trip', tripId, 'invitations'] });
      const fullUrl = `${window.location.origin}${data.invitePath}`;
      setGeneratedLink(fullUrl);
      setInvitedEmail('');
      setLabel('');
      toast.success(
        'Invitation link generated',
        'Copy and share this link. It expires in 7 days.'
      );
    },
    onError: (err) => toast.error('Could not create invitation', err.message),
  });

  const revokeMutation = useMutation({
    mutationFn: (invitationId) => invitationsApi.revoke(tripId, invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trip', tripId, 'invitations'] });
      toast.info('Invitation revoked');
    },
    onError: (err) => toast.error('Could not revoke invitation', err.message),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberUserId) => tripsApi.removeMember(tripId, memberUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
      queryClient.invalidateQueries({ queryKey: ['trip', tripId, 'summary'] });
      setRemoveTarget(null);
      toast.info('Member removed from trip');
    },
    onError: (err) => {
      setRemoveTarget(null);
      toast.error('Cannot remove member', err.message);
    },
  });

  const handleCopy = async () => {
    if (!generatedLink) return;
    try {
      await navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2500);
    } catch (_err) {
      toast.info('Copy link manually', generatedLink);
    }
  };

  const handleGenerateInvite = (e) => {
    e.preventDefault();
    createInviteMutation.mutate({
      invitedEmail: invitedEmail.trim(),
      label: label.trim(),
    });
  };

  const invitations = invitationsQuery.data?.invitations || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-ink">
          Trip Members &amp; Invitations
        </h2>
        <p className="text-xs text-ink-body">
          Manage collaborators and generate 7-day invitation links. Only the trip owner can create invites or remove members.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Member Roster */}
        <Card className="p-5 sm:p-6 lg:col-span-7 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-bold text-ink flex items-center gap-2">
              <Users className="h-4 w-4 text-[#0F766E]" />
              Active Collaborators ({trip.members.length})
            </h3>
            <span className="text-xs text-ink-muted">
              Owner &amp; collaborator roles
            </span>
          </div>

          <ul className="divide-y divide-canvas-border/80">
            {trip.members.map((m) => (
              <li
                key={m.userId}
                className="flex items-center justify-between gap-3 py-3.5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm ${m.role === 'owner' ? 'bg-navy-900' : 'bg-[#0F766E]'
                      }`}
                  >
                    {getInitials(m.displayName)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-ink truncate">
                        {m.displayName}
                      </p>
                      <Badge variant={m.role === 'owner' ? 'navy' : 'teal'}>
                        {m.role === 'owner' ? 'Owner' : 'Member'}
                      </Badge>
                    </div>
                    <p className="text-xs text-ink-muted truncate">{m.email}</p>
                    <p className="text-[11px] text-ink-body mt-0.5">
                      {m.role === 'owner'
                        ? 'Full workspace settings, member invites & editing'
                        : 'Can collaborate on itinerary, bookings, tasks & expenses'}
                    </p>
                  </div>
                </div>

                {isOwner && m.role !== 'owner' ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setRemoveTarget(m)}
                    className="text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                  >
                    <UserMinus className="h-4 w-4" />
                    Remove
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>

        {/* Invite Generator Panel */}
        <Card className="p-5 sm:p-6 lg:col-span-5 space-y-4">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-ink flex items-center gap-2">
              <Link2 className="h-4 w-4 text-[#0F766E]" />
              Invite Friends to Trip
            </h3>
            <p className="text-xs text-ink-body">
              Single-use invitation links expire automatically after 7 days.
            </p>
          </div>

          {isOwner ? (
            <form onSubmit={handleGenerateInvite} className="space-y-3">
              <FormField
                label="Recipient Note / Name (optional)"
                htmlFor="invite-label"
              >
                <input
                  id="invite-label"
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Invite for Priya"
                  className={inputClassName}
                />
              </FormField>

              <FormField
                label="Recipient Email Hint (optional)"
                htmlFor="invite-email"
              >
                <input
                  id="invite-email"
                  type="email"
                  value={invitedEmail}
                  onChange={(e) => setInvitedEmail(e.target.value)}
                  placeholder="friend@example.com"
                  className={inputClassName}
                />
              </FormField>

              <Button
                type="submit"
                disabled={createInviteMutation.isPending}
                className="w-full"
              >
                <Link2 className="h-4 w-4" />
                {createInviteMutation.isPending
                  ? 'Generating Token...'
                  : 'Generate 7-Day Invite Link'}
              </Button>
            </form>
          ) : (
            <div className="rounded-xl border border-canvas-border bg-[#FAF9F5] p-4 text-xs text-ink-body flex items-start gap-2.5">
              <Shield className="h-4 w-4 text-[#0F766E] shrink-0 mt-0.5" />
              Only the trip owner can generate or revoke invitation links.
            </div>
          )}

          {generatedLink ? (
            <div
              data-testid="generated-invite-box"
              className="rounded-xl border border-[#BEE3DD] bg-[#E9F5F3] p-3.5 space-y-2"
            >
              <p className="text-xs font-bold text-[#0C5E57]">
                Shareable Invitation Link (Shown Once):
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  aria-label="Generated invitation link"
                  value={generatedLink}
                  className="w-full rounded-lg border border-[#BEE3DD] bg-white px-2.5 py-1.5 font-mono text-xs text-ink"
                />
                <Button size="sm" onClick={handleCopy}>
                  {copied ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>
          ) : null}
        </Card>
      </div>

      {/* Invitation History */}
      <Card className="p-5 sm:p-6 space-y-4">
        <h3 className="text-sm font-bold text-ink">
          Invitation Log ({invitations.length})
        </h3>
        {invitations.length === 0 ? (
          <p className="text-xs text-ink-muted">
            No invitation tokens have been generated for this trip yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-canvas-border text-ink-body">
                  <th className="py-2 pr-3 font-semibold">Label / Email Hint</th>
                  <th className="py-2 px-3 font-semibold">Created</th>
                  <th className="py-2 px-3 font-semibold">Expires</th>
                  <th className="py-2 px-3 font-semibold">Status</th>
                  {isOwner ? (
                    <th className="py-2 pl-3 font-semibold text-right">Action</th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-canvas-border/70">
                {invitations.map((inv) => (
                  <tr key={inv.id}>
                    <td className="py-2.5 pr-3 font-semibold text-ink">
                      {inv.label || inv.invitedEmail || 'General Trip Invite'}
                    </td>
                    <td className="py-2.5 px-3 text-ink-body tabular-nums">
                      {formatDate(inv.createdAt, trip.timezone)}
                    </td>
                    <td className="py-2.5 px-3 text-ink-body tabular-nums">
                      {formatDate(inv.expiresAt, trip.timezone)}
                    </td>
                    <td className="py-2.5 px-3">
                      <StatusBadge status={inv.effectiveStatus || inv.status} />
                    </td>
                    {isOwner ? (
                      <td className="py-2.5 pl-3 text-right">
                        {inv.effectiveStatus === 'pending' ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => revokeMutation.mutate(inv.id)}
                            className="text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Revoke
                          </Button>
                        ) : (
                          <span className="text-ink-muted">—</span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        isOpen={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() =>
          removeTarget && removeMemberMutation.mutate(removeTarget.userId)
        }
        isPending={removeMemberMutation.isPending}
        title="Remove Trip Member"
        message={`Remove ${removeTarget?.displayName} from this trip? Note: Members who are part of existing expenses cannot be removed without updating their expense shares first.`}
        confirmLabel="Remove Member"
      />
    </div>
  );
}


import { Invitation } from '../models/Invitation.model.js';
import { Trip } from '../models/Trip.model.js';
import { User } from '../models/User.model.js';
import { getHydratedTripMembers } from '../services/tripMember.service.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { assertObjectId } from '../utils/objectId.js';
import { generateInviteTokenPair, hashInviteToken } from '../utils/tokens.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const createInvitation = asyncHandler(async (req, res) => {
  const trip = req.trip;
  const { invitedEmail = '', label = '' } = req.body;

  const { rawToken, tokenHash } = generateInviteTokenPair();
  const expiresAt = new Date(Date.now() + SEVEN_DAYS_MS);

  const invitation = await Invitation.create({
    tripId: trip._id,
    tokenHash,
    invitedEmail,
    label,
    createdBy: req.user._id,
    expiresAt,
    status: 'pending',
  });

  return res.status(201).json({
    success: true,
    data: {
      invitation: invitation.toJSON(),
      inviteToken: rawToken,
      invitePath: `/invite/${rawToken}`,
    },
  });
});

export const listInvitations = asyncHandler(async (req, res) => {
  const invitations = await Invitation.find({ tripId: req.trip._id })
    .sort({ createdAt: -1 })
    .limit(50);

  const now = Date.now();
  const formatted = invitations.map((inv) => {
    const json = inv.toJSON();
    const isExpired =
      json.status === 'pending' && new Date(json.expiresAt).getTime() < now;
    return {
      ...json,
      effectiveStatus: isExpired ? 'expired' : json.status,
    };
  });

  return res.status(200).json({
    success: true,
    data: {
      invitations: formatted,
    },
  });
});

export const revokeInvitation = asyncHandler(async (req, res) => {
  const { invitationId } = req.params;
  assertObjectId(invitationId, 'Invitation ID');

  const invitation = await Invitation.findOne({
    _id: invitationId,
    tripId: req.trip._id,
  });

  if (!invitation) {
    throw new AppError('Invitation not found.', 404, 'INVITATION_NOT_FOUND');
  }

  if (invitation.status !== 'pending') {
    throw new AppError(
      'Only pending invitations can be revoked.',
      400,
      'INVITATION_NOT_PENDING'
    );
  }

  invitation.status = 'revoked';
  await invitation.save();

  return res.status(200).json({
    success: true,
    data: {
      invitation: invitation.toJSON(),
    },
  });
});

export const previewInvitation = asyncHandler(async (req, res) => {
  const { token } = req.params;
  if (!token || typeof token !== 'string' || token.length < 16) {
    throw new AppError('Invalid invitation token.', 400, 'INVALID_INVITATION_TOKEN');
  }

  const tokenHash = hashInviteToken(token.trim());
  const invitation = await Invitation.findOne({ tokenHash });

  if (!invitation) {
    throw new AppError(
      'Invitation link is invalid or does not exist.',
      404,
      'INVITATION_NOT_FOUND'
    );
  }

  const trip = await Trip.findById(invitation.tripId);
  if (!trip) {
    throw new AppError('Associated trip no longer exists.', 404, 'TRIP_NOT_FOUND');
  }

  const inviter = await User.findById(invitation.createdBy);
  const isExpired = new Date(invitation.expiresAt).getTime() < Date.now();
  const alreadyMember = trip.members.some(
    (m) => String(m.userId) === String(req.user._id)
  );

  return res.status(200).json({
    success: true,
    data: {
      invitation: {
        id: String(invitation._id),
        status: isExpired && invitation.status === 'pending' ? 'expired' : invitation.status,
        expiresAt: invitation.expiresAt,
        invitedEmail: invitation.invitedEmail,
        label: invitation.label,
        inviterName: inviter?.displayName || 'Trip Owner',
      },
      trip: {
        id: String(trip._id),
        title: trip.title,
        destination: trip.destination,
        startDate: trip.startDate,
        endDate: trip.endDate,
        memberCount: trip.members.length,
        alreadyMember,
      },
    },
  });
});

export const acceptInvitation = asyncHandler(async (req, res) => {
  const { token } = req.params;
  if (!token || typeof token !== 'string' || token.length < 16) {
    throw new AppError('Invalid invitation token.', 400, 'INVALID_INVITATION_TOKEN');
  }

  const tokenHash = hashInviteToken(token.trim());
  const invitation = await Invitation.findOne({ tokenHash });

  if (!invitation) {
    throw new AppError(
      'Invitation link is invalid or does not exist.',
      404,
      'INVITATION_NOT_FOUND'
    );
  }

  if (invitation.status === 'revoked') {
    throw new AppError(
      'This invitation has been revoked by the trip owner.',
      410,
      'INVITATION_REVOKED'
    );
  }

  if (invitation.status === 'accepted') {
    throw new AppError(
      'This invitation link has already been used.',
      409,
      'INVITATION_ALREADY_USED'
    );
  }

  if (new Date(invitation.expiresAt).getTime() < Date.now()) {
    throw new AppError(
      'This invitation link has expired (invitations are valid for 7 days).',
      410,
      'INVITATION_EXPIRED'
    );
  }

  const trip = await Trip.findById(invitation.tripId);
  if (!trip) {
    throw new AppError('Associated trip no longer exists.', 404, 'TRIP_NOT_FOUND');
  }

  const userIdStr = String(req.user._id);
  const alreadyMember = trip.members.some((m) => String(m.userId) === userIdStr);
  if (alreadyMember) {
    throw new AppError(
      'You are already a member of this trip.',
      409,
      'ALREADY_TRIP_MEMBER',
      { tripId: String(trip._id) }
    );
  }

  // Atomically claim the single-use invitation. A read-then-save check is racy: two
  // concurrent requests could both observe status === 'pending' and both join.
  const claimed = await Invitation.findOneAndUpdate(
    { _id: invitation._id, status: 'pending' },
    {
      $set: {
        status: 'accepted',
        acceptedBy: req.user._id,
        acceptedAt: new Date(),
      },
    },
    { new: true }
  );
  if (!claimed) {
    throw new AppError(
      'This invitation link has already been used.',
      409,
      'INVITATION_ALREADY_USED'
    );
  }

  // Guarded push so the same user can never be added twice.
  const added = await Trip.updateOne(
    { _id: trip._id, 'members.userId': { $ne: req.user._id } },
    {
      $push: {
        members: { userId: req.user._id, role: 'member', joinedAt: new Date() },
      },
    }
  );
  if (added.modifiedCount !== 1) {
    // Roll the claim back so the link is not burned by a user who is already a member.
    await Invitation.updateOne(
      { _id: invitation._id },
      { $set: { status: 'pending' }, $unset: { acceptedBy: '', acceptedAt: '' } }
    );
    throw new AppError(
      'You are already a member of this trip.',
      409,
      'ALREADY_TRIP_MEMBER',
      { tripId: String(trip._id) }
    );
  }

  const updatedTrip = await Trip.findById(trip._id);
  const members = await getHydratedTripMembers(updatedTrip);

  return res.status(200).json({
    success: true,
    data: {
      tripId: String(updatedTrip._id),
      trip: {
        ...updatedTrip.toJSON(),
        viewerRole: 'member',
        members,
      },
    },
  });
});


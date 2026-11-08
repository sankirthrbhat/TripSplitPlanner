import { Trip } from '../models/Trip.model.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { assertObjectId } from '../utils/objectId.js';

/**
 * Loads the trip for :tripId and verifies that req.user is an authorized member.
 * Attaches req.trip and req.tripRole ('owner' | 'member').
 */
export const requireTripMember = asyncHandler(async (req, _res, next) => {
  const { tripId } = req.params;
  assertObjectId(tripId, 'Trip ID');

  const trip = await Trip.findById(tripId);
  if (!trip) {
    throw new AppError('Trip not found.', 404, 'TRIP_NOT_FOUND');
  }

  const userIdStr = String(req.user._id);
  const memberRecord = trip.members.find((m) => String(m.userId) === userIdStr);

  if (!memberRecord && String(trip.ownerId) !== userIdStr) {
    throw new AppError(
      'You do not have permission to access this trip workspace.',
      403,
      'FORBIDDEN_TRIP_ACCESS'
    );
  }

  req.trip = trip;
  req.tripRole =
    String(trip.ownerId) === userIdStr ? 'owner' : memberRecord?.role || 'member';
  next();
});

export const requireTripOwner = (req, _res, next) => {
  if (!req.trip || String(req.trip.ownerId) !== String(req.user._id)) {
    return next(
      new AppError(
        'Only the trip owner can perform this action.',
        403,
        'OWNER_REQUIRED'
      )
    );
  }
  return next();
};


import { User } from '../models/User.model.js';
import { AppError } from '../utils/AppError.js';

/**
 * Hydrates trip.members with User displayName and email.
 */
export async function getHydratedTripMembers(trip) {
  const memberIds = (trip.members || []).map((m) => m.userId);
  const users = await User.find({ _id: { $in: memberIds } });
  const userById = new Map(users.map((u) => [String(u._id), u]));

  return (trip.members || []).map((m) => {
    const uid = String(m.userId);
    const userDoc = userById.get(uid);
    return {
      userId: uid,
      displayName: userDoc?.displayName || 'Unknown User',
      email: userDoc?.email || '',
      role: String(trip.ownerId) === uid ? 'owner' : m.role || 'member',
      joinedAt: m.joinedAt,
    };
  });
}

export function getTripMemberIdSet(trip) {
  return new Set((trip.members || []).map((m) => String(m.userId)));
}

export function assertTripMembers(trip, userIds, fieldLabel = 'Participant') {
  const memberSet = getTripMemberIdSet(trip);
  for (const id of userIds || []) {
    if (!memberSet.has(String(id))) {
      throw new AppError(
        `${fieldLabel} (${id}) does not belong to this trip.`,
        400,
        'USER_NOT_IN_TRIP'
      );
    }
  }
}


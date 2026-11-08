import { Activity } from '../models/Activity.model.js';
import { Booking } from '../models/Booking.model.js';
import { Expense } from '../models/Expense.model.js';
import { Invitation } from '../models/Invitation.model.js';
import { Task } from '../models/Task.model.js';
import { Trip } from '../models/Trip.model.js';
import { User } from '../models/User.model.js';
import {
  computeEqualShares,
  validateAndNormalizeCustomShares,
} from './expense.service.js';

export const DEMO_USERS = [
  {
    displayName: 'Aarav Sharma',
    email: 'aarav@tripsplit.demo',
    password: 'DemoPassword123',
  },
  {
    displayName: 'Diya Nair',
    email: 'diya@tripsplit.demo',
    password: 'DemoPassword123',
  },
  {
    displayName: 'Kabir Mehta',
    email: 'kabir@tripsplit.demo',
    password: 'DemoPassword123',
  },
  {
    displayName: 'Meera Iyer',
    email: 'meera@tripsplit.demo',
    password: 'DemoPassword123',
  },
];

/**
 * Seeds the "Coorg Weekend Escape" sample trip idempotently.
 * Safe for development and demonstration environments only.
 */
export async function seedDemoWorkspace() {
  const passwordHash = await User.hashPassword('DemoPassword123');
  const users = [];

  for (const spec of DEMO_USERS) {
    let user = await User.findOne({ email: spec.email });
    if (!user) {
      user = await User.create({
        displayName: spec.displayName,
        email: spec.email,
        passwordHash,
      });
    }
    users.push(user);
  }

  const [aarav, diya, kabir, meera] = users;
  const allUserIds = users.map((u) => String(u._id));

  // Remove any previous copy of "Coorg Weekend Escape" owned by Aarav so re-seeding stays clean
  const existingTrips = await Trip.find({
    title: 'Coorg Weekend Escape',
    ownerId: aarav._id,
  });

  for (const oldTrip of existingTrips) {
    await Promise.all([
      Invitation.deleteMany({ tripId: oldTrip._id }),
      Activity.deleteMany({ tripId: oldTrip._id }),
      Booking.deleteMany({ tripId: oldTrip._id }),
      Task.deleteMany({ tripId: oldTrip._id }),
      Expense.deleteMany({ tripId: oldTrip._id }),
      Trip.findByIdAndDelete(oldTrip._id),
    ]);
  }

  const trip = await Trip.create({
    title: 'Coorg Weekend Escape',
    destination: 'Madikeri, Coorg, Karnataka',
    description:
      'Three-day coffee estate retreat, misty waterfalls, Dubare river rafting, and Kodava cuisine tour.',
    startDate: new Date('2026-12-11T00:00:00.000Z'),
    endDate: new Date('2026-12-13T23:59:59.000Z'),
    timezone: 'Asia/Kolkata',
    currency: 'INR',
    budgetLimitMinor: 3200000, // ₹32,000.00
    ownerId: aarav._id,
    members: [
      { userId: aarav._id, role: 'owner', joinedAt: new Date('2026-11-01T10:00:00Z') },
      { userId: diya._id, role: 'member', joinedAt: new Date('2026-11-01T11:00:00Z') },
      { userId: kabir._id, role: 'member', joinedAt: new Date('2026-11-01T12:00:00Z') },
      { userId: meera._id, role: 'member', joinedAt: new Date('2026-11-01T13:00:00Z') },
    ],
  });

  // 1. Create Bookings & single-ledger expenses
  const homestayExpense = await Expense.create({
    tripId: trip._id,
    title: 'Silver Oak Coffee Estate Homestay (2 Nights)',
    description: 'Two luxury cottage rooms booked for all four members.',
    amountMinor: 1400000, // ₹14,000.00 paid by Aarav
    currency: 'INR',
    category: 'accommodation',
    status: 'paid',
    paidByUserId: aarav._id,
    expenseDate: new Date('2026-11-05T09:00:00.000Z'),
    shareMode: 'equal',
    participantShares: computeEqualShares(1400000, allUserIds, allUserIds),
    createdBy: aarav._id,
  });

  const innovaExpense = await Expense.create({
    tripId: trip._id,
    title: 'Bengaluru–Coorg Innova Crysta Rental',
    description: '3-day roundtrip SUV charter including driver allowance.',
    amountMinor: 900000, // ₹9,000.00 planned
    currency: 'INR',
    category: 'transport',
    status: 'planned',
    paidByUserId: null,
    expenseDate: new Date('2026-12-11T06:00:00.000+05:30'),
    shareMode: 'equal',
    participantShares: computeEqualShares(900000, allUserIds, allUserIds),
    createdBy: kabir._id,
  });

  const homestayBooking = await Booking.create({
    tripId: trip._id,
    title: 'Silver Oak Coffee Estate Homestay',
    provider: 'Silver Oak Estates Madikeri',
    category: 'accommodation',
    startAt: new Date('2026-12-11T13:00:00+05:30'),
    endAt: new Date('2026-12-13T11:00:00+05:30'),
    status: 'confirmed',
    referenceNumber: 'SOE-88421',
    url: 'https://example.com/bookings/silver-oak-coorg',
    notes: 'Check-in after 1:00 PM IST. Includes traditional Kodava breakfast.',
    linkedExpenseId: homestayExpense._id,
    createdBy: aarav._id,
  });

  const innovaBooking = await Booking.create({
    tripId: trip._id,
    title: 'Innova Crysta Outstation Charter',
    provider: 'Deccan Roadways Travels',
    category: 'transportation',
    startAt: new Date('2026-12-11T06:00:00+05:30'),
    endAt: new Date('2026-12-13T21:00:00+05:30'),
    status: 'tentative',
    referenceNumber: 'DRT-4490',
    notes: 'Confirm pickup point at Indiranagar Metro Station by Dec 8.',
    linkedExpenseId: innovaExpense._id,
    createdBy: kabir._id,
  });

  homestayExpense.linkedBookingId = homestayBooking._id;
  innovaExpense.linkedBookingId = innovaBooking._id;
  await Promise.all([homestayExpense.save(), innovaExpense.save()]);

  // 2. Additional PAID & PLANNED expenses (Equal + Custom + ₹100/3 paise split)
  const raftingExpense = await Expense.create({
    tripId: trip._id,
    title: 'Dubare Elephant Camp & River Rafting Permits',
    description: 'Advance rafting passes paid by Diya.',
    amountMinor: 320000, // ₹3,200.00 paid by Diya equally across 4 (₹800 each)
    currency: 'INR',
    category: 'activities',
    status: 'paid',
    paidByUserId: diya._id,
    expenseDate: new Date('2026-11-06T14:00:00.000Z'),
    shareMode: 'equal',
    participantShares: computeEqualShares(320000, allUserIds, allUserIds),
    createdBy: diya._id,
  });

  await Expense.create({
    tripId: trip._id,
    title: 'Highway Toll & Fastag Top-up',
    description: 'Paid by Kabir; split equally among Aarav, Diya, and Kabir (₹100.00 / 3).',
    amountMinor: 10000, // ₹100.00 -> 3334 + 3333 + 3333 paise!
    currency: 'INR',
    category: 'transport',
    status: 'paid',
    paidByUserId: kabir._id,
    expenseDate: new Date('2026-11-07T08:00:00.000Z'),
    shareMode: 'equal',
    participantShares: computeEqualShares(
      10000,
      [String(aarav._id), String(diya._id), String(kabir._id)],
      allUserIds
    ),
    createdBy: kabir._id,
  });

  await Expense.create({
    tripId: trip._id,
    title: 'Coorg Spice & Arabica Coffee Tasting Basket',
    description: 'Custom split based on coffee boxes selected per person.',
    amountMinor: 240000, // ₹2,400.00 paid by Kabir (custom split)
    currency: 'INR',
    category: 'shopping',
    status: 'paid',
    paidByUserId: kabir._id,
    expenseDate: new Date('2026-11-07T16:30:00.000Z'),
    shareMode: 'custom',
    participantShares: validateAndNormalizeCustomShares(
      240000,
      [
        { userId: String(aarav._id), shareMinor: 40000 }, // ₹400
        { userId: String(diya._id), shareMinor: 80000 }, // ₹800
        { userId: String(kabir._id), shareMinor: 60000 }, // ₹600
        { userId: String(meera._id), shareMinor: 60000 }, // ₹600
      ],
      allUserIds
    ),
    createdBy: kabir._id,
  });

  const dinnerExpense = await Expense.create({
    tripId: trip._id,
    title: 'Coorg Cuisine Dinner at East End Hotel',
    description: 'Estimated group dinner budget for Saturday night.',
    amountMinor: 360000, // ₹3,600.00 planned
    currency: 'INR',
    category: 'food',
    status: 'planned',
    paidByUserId: null,
    expenseDate: new Date('2026-12-12T20:00:00+05:30'),
    shareMode: 'equal',
    participantShares: computeEqualShares(360000, allUserIds, allUserIds),
    createdBy: meera._id,
  });

  // 3. Activities (including an INTENTIONAL OVERLAP on Day 2)
  const act1 = await Activity.create({
    tripId: trip._id,
    title: 'Road Trip Departure & Mysore Breakfast Stop',
    description: 'Meet at Indiranagar at 6:00 AM, breakfast at Mylari Mysore.',
    location: 'Bengaluru to Madikeri Highway',
    category: 'transit',
    startAt: new Date('2026-12-11T06:00:00+05:30'),
    endAt: new Date('2026-12-11T12:30:00+05:30'),
    status: 'confirmed',
    assignedParticipantIds: [aarav._id, diya._id, kabir._id, meera._id],
    createdBy: kabir._id,
  });

  // Touching endpoint (12:30 - 15:00) -> NOT a conflict!
  await Activity.create({
    tripId: trip._id,
    title: 'Estate Check-in & Coffee Plantation Walk',
    description: 'Guided walk through Arabica & pepper vines.',
    location: 'Silver Oak Estate, Madikeri',
    category: 'leisure',
    startAt: new Date('2026-12-11T12:30:00+05:30'),
    endAt: new Date('2026-12-11T15:00:00+05:30'),
    status: 'confirmed',
    assignedParticipantIds: [aarav._id, diya._id, kabir._id, meera._id],
    createdBy: aarav._id,
  });

  await Activity.create({
    tripId: trip._id,
    title: 'Dubare River Rafting & Elephant Camp',
    description: 'Morning water session on the Cauvery river.',
    location: 'Dubare, Kushalnagar',
    category: 'adventure',
    startAt: new Date('2026-12-12T08:30:00+05:30'),
    endAt: new Date('2026-12-12T12:30:00+05:30'),
    status: 'confirmed',
    assignedParticipantIds: [aarav._id, diya._id, kabir._id, meera._id],
    linkedExpenseId: raftingExpense._id,
    createdBy: diya._id,
  });

  // Intentional overlap #1: 15:30 - 17:30 vs 16:30 - 18:00
  await Activity.create({
    tripId: trip._id,
    title: 'Mandalpatti 4x4 Jeep Safari',
    description: 'Off-road ridge climb through misty shola grasslands.',
    location: 'Mandalpatti Peak',
    category: 'adventure',
    startAt: new Date('2026-12-12T15:30:00+05:30'),
    endAt: new Date('2026-12-12T17:30:00+05:30'),
    status: 'planned',
    assignedParticipantIds: [aarav._id, kabir._id],
    createdBy: aarav._id,
  });

  await Activity.create({
    tripId: trip._id,
    title: "Raja's Seat Sunset Point Walk",
    description: 'Golden hour viewpoint overlooking the western valleys.',
    location: "Raja's Seat, Madikeri",
    category: 'sightseeing',
    startAt: new Date('2026-12-12T16:30:00+05:30'),
    endAt: new Date('2026-12-12T18:00:00+05:30'),
    status: 'planned',
    assignedParticipantIds: [diya._id, meera._id],
    createdBy: meera._id,
  });

  const dinnerAct = await Activity.create({
    tripId: trip._id,
    title: 'Kodava Heritage Dinner at East End Hotel',
    description: 'Pandi curry, kadambuttu, and bamboo shoot specialties.',
    location: 'East End Hotel, Madikeri',
    category: 'dining',
    startAt: new Date('2026-12-12T20:00:00+05:30'),
    endAt: new Date('2026-12-12T22:00:00+05:30'),
    status: 'planned',
    assignedParticipantIds: [aarav._id, diya._id, kabir._id, meera._id],
    linkedExpenseId: dinnerExpense._id,
    createdBy: meera._id,
  });

  // Cancelled activity overlapping morning rafting -> must NOT trigger conflict!
  await Activity.create({
    tripId: trip._id,
    title: 'Abbey Falls Early Visit (Cancelled Backup)',
    description: 'Moved to Sunday morning instead.',
    location: 'Abbey Falls',
    category: 'sightseeing',
    startAt: new Date('2026-12-12T09:00:00+05:30'),
    endAt: new Date('2026-12-12T11:00:00+05:30'),
    status: 'cancelled',
    assignedParticipantIds: [aarav._id],
    createdBy: aarav._id,
  });

  await Activity.create({
    tripId: trip._id,
    title: 'Abbey Falls Morning Walk & Return Drive',
    description: 'Quick waterfall visit before driving back to Bengaluru.',
    location: 'Abbey Falls, Madikeri',
    category: 'sightseeing',
    startAt: new Date('2026-12-13T09:00:00+05:30'),
    endAt: new Date('2026-12-13T11:30:00+05:30'),
    status: 'confirmed',
    assignedParticipantIds: [aarav._id, diya._id, kabir._id, meera._id],
    createdBy: diya._id,
  });

  raftingExpense.linkedActivityId = act1._id;
  dinnerExpense.linkedActivityId = dinnerAct._id;
  await Promise.all([raftingExpense.save(), dinnerExpense.save()]);

  // 4. Tasks / Responsibilities
  await Task.insertMany([
    {
      tripId: trip._id,
      title: 'Confirm Innova pickup point with driver',
      description: 'Share live pin at Indiranagar Metro Gate 2.',
      assignedTo: kabir._id,
      dueDate: new Date('2026-12-08T18:00:00+05:30'),
      priority: 'high',
      status: 'in_progress',
      createdBy: aarav._id,
    },
    {
      tripId: trip._id,
      title: 'Download offline Coorg maps & forest passes',
      description: 'Mobile signal drops near Mandalpatti ridge.',
      assignedTo: diya._id,
      dueDate: new Date('2026-12-09T20:00:00+05:30'),
      priority: 'medium',
      status: 'done',
      createdBy: aarav._id,
    },
    {
      tripId: trip._id,
      title: 'Reserve table at East End Hotel for 8 PM',
      description: 'Confirm vegetarian + non-veg Kodava platters.',
      assignedTo: meera._id,
      dueDate: new Date('2026-12-10T18:00:00+05:30'),
      priority: 'medium',
      status: 'todo',
      createdBy: meera._id,
    },
    {
      tripId: trip._id,
      title: 'Pack first-aid kit, rain ponchos & power banks',
      description: 'Essential for rafting and jeep trails.',
      assignedTo: aarav._id,
      dueDate: new Date('2026-12-10T21:00:00+05:30'),
      priority: 'low',
      status: 'done',
      createdBy: aarav._id,
    },
  ]);

  return {
    trip,
    users,
  };
}


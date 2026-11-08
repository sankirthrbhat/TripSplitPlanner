import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { Invitation } from '../src/models/Invitation.model.js';

describe('TripSplit Planner REST API Integration Suite', () => {
  let app;
  let ownerAgent;
  let memberAgent;
  let outsiderAgent;

  let ownerUser;
  let memberUser;
  let tripId;
  let inviteToken;
  let activity1Id;
  let activity2Id;
  let bookingId;
  let taskId;
  let plannedExpenseId;
  let paidExpenseId;

  beforeAll(async () => {
    await connectDB();
    app = createApp();
    ownerAgent = request.agent(app);
    memberAgent = request.agent(app);
    outsiderAgent = request.agent(app);
  });

  afterAll(async () => {
    await disconnectDB();
  });

  it('GET /api/health returns connected status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.database.status).toBe('connected');
  });

  describe('Authentication & Session Security', () => {
    it('registers owner, member, and outsider users with httpOnly cookie', async () => {
      const resOwner = await ownerAgent.post('/api/auth/register').send({
        displayName: 'Rohan Kulkarni',
        email: 'ROHAN@Example.com',
        password: 'Password123',
      });
      expect(resOwner.status).toBe(201);
      expect(resOwner.body.data.user.email).toBe('rohan@example.com');
      expect(resOwner.body.data.user.passwordHash).toBeUndefined();
      expect(resOwner.headers['set-cookie'][0]).toContain('HttpOnly');
      ownerUser = resOwner.body.data.user;

      const resMember = await memberAgent.post('/api/auth/register').send({
        displayName: 'Ananya Rao',
        email: 'ananya@example.com',
        password: 'Password123',
      });
      expect(resMember.status).toBe(201);
      memberUser = resMember.body.data.user;

      const resOutsider = await outsiderAgent.post('/api/auth/register').send({
        displayName: 'Vikram Outsider',
        email: 'vikram@example.com',
        password: 'Password123',
      });
      expect(resOutsider.status).toBe(201);
    });

    it('rejects duplicate email registration with 409', async () => {
      const res = await request(app).post('/api/auth/register').send({
        displayName: 'Duplicate Rohan',
        email: 'rohan@example.com',
        password: 'Password123',
      });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
    });

    it('rejects invalid login credentials with 401', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'rohan@example.com',
        password: 'WrongPassword999',
      });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('blocks mutating requests from untrusted Origin headers with 403', async () => {
      const res = await ownerAgent
        .post('/api/trips')
        .set('Origin', 'https://malicious-attacker.example')
        .send({
          title: 'CSRF Attempt',
          destination: 'Nowhere',
          startDate: '2026-12-01',
          endDate: '2026-12-05',
        });
      expect(res.status).toBe(403);
    });

    it('preserves session on GET /api/auth/me and clears cookie on logout', async () => {
      const meRes = await ownerAgent.get('/api/auth/me');
      expect(meRes.status).toBe(200);
      expect(meRes.body.data.user.id).toBe(ownerUser.id);

      const tempAgent = request.agent(app);
      await tempAgent.post('/api/auth/login').send({
        email: 'rohan@example.com',
        password: 'Password123',
      });
      const logoutRes = await tempAgent.post('/api/auth/logout');
      expect(logoutRes.status).toBe(200);

      const afterLogout = await tempAgent.get('/api/auth/me');
      expect(afterLogout.status).toBe(401);
    });
  });

  describe('Trips, Authorization & Invitations', () => {
    it('rejects trip creation when endDate is before startDate', async () => {
      const res = await ownerAgent.post('/api/trips').send({
        title: 'Invalid Dates Trip',
        destination: 'Goa',
        startDate: '2026-12-15',
        endDate: '2026-12-10',
        timezone: 'Asia/Kolkata',
      });
      expect(res.status).toBe(400);
    });

    it('creates a valid trip and establishes server-side ownership', async () => {
      const res = await ownerAgent.post('/api/trips').send({
        title: 'Wayand Rainforest Trail',
        destination: 'Wayanad, Kerala',
        description: 'Monsoon forest trek and bamboo rafting.',
        startDate: '2026-12-18T00:00:00.000Z',
        endDate: '2026-12-20T23:59:59.000Z',
        timezone: 'Asia/Kolkata',
        currency: 'INR',
        budgetLimitMinor: 2000000,
      });

      expect(res.status).toBe(201);
      tripId = res.body.data.trip.id;
      expect(res.body.data.trip.ownerId).toBe(ownerUser.id);
      expect(res.body.data.trip.members).toHaveLength(1);
    });

    it('blocks unauthorized outsider from viewing or mutating the trip (403)', async () => {
      const getRes = await outsiderAgent.get(`/api/trips/${tripId}`);
      expect(getRes.status).toBe(403);

      const patchRes = await outsiderAgent
        .patch(`/api/trips/${tripId}`)
        .send({ title: 'Hacked Title' });
      expect(patchRes.status).toBe(403);
    });

    it('rejects malformed ObjectIds with 400', async () => {
      const res = await ownerAgent.get('/api/trips/not-a-valid-object-id');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_OBJECT_ID');
    });

    it('generates an invitation storing only tokenHash in MongoDB, and allows memberUser to join', async () => {
      const invRes = await ownerAgent
        .post(`/api/trips/${tripId}/invitations`)
        .send({ invitedEmail: 'ananya@example.com', label: 'Ananya Invite' });

      expect(invRes.status).toBe(201);
      inviteToken = invRes.body.data.inviteToken;
      expect(inviteToken).toBeTruthy();

      // Verify raw token is NOT stored in MongoDB
      const dbInvite = await Invitation.findById(invRes.body.data.invitation.id);
      expect(dbInvite.tokenHash).toBeTruthy();
      expect(dbInvite.tokenHash).not.toBe(inviteToken);

      // Member previews and accepts invitation
      const previewRes = await memberAgent.get(
        `/api/invitations/${inviteToken}/preview`
      );
      expect(previewRes.status).toBe(200);
      expect(previewRes.body.data.trip.title).toBe('Wayand Rainforest Trail');

      const acceptRes = await memberAgent.post(
        `/api/invitations/${inviteToken}/accept`
      );
      expect(acceptRes.status).toBe(200);
      expect(acceptRes.body.data.trip.members).toHaveLength(2);

      // Re-using the same token must fail with 409
      const reuseRes = await outsiderAgent.post(
        `/api/invitations/${inviteToken}/accept`
      );
      expect(reuseRes.status).toBe(409);
    });

    it('prevents non-owner member from deleting trip or editing trip settings', async () => {
      const patchRes = await memberAgent
        .patch(`/api/trips/${tripId}`)
        .send({ title: 'Unauthorized Member Edit' });
      expect(patchRes.status).toBe(403);

      const delRes = await memberAgent.delete(`/api/trips/${tripId}`);
      expect(delRes.status).toBe(403);
    });
  });

  describe('Activities, Conflicts, Bookings & Tasks', () => {
    it('creates activities and flags overlapping schedules', async () => {
      const res1 = await ownerAgent
        .post(`/api/trips/${tripId}/activities`)
        .send({
          title: 'Chembra Peak Guided Trek',
          location: 'Meppadi',
          category: 'adventure',
          startAt: '2026-12-19T03:00:00.000Z',
          endAt: '2026-12-19T07:00:00.000Z',
          status: 'confirmed',
          assignedParticipantIds: [ownerUser.id, memberUser.id],
        });
      expect(res1.status).toBe(201);
      activity1Id = res1.body.data.activity.id;
      expect(res1.body.data.conflictReport.conflictCount).toBe(0);

      // Overlapping activity (05:30Z - 08:00Z overlaps 03:00Z - 07:00Z)
      const res2 = await memberAgent
        .post(`/api/trips/${tripId}/activities`)
        .send({
          title: 'Banasura Sagar Dam Boating',
          location: 'Padinjarathara',
          category: 'leisure',
          startAt: '2026-12-19T05:30:00.000Z',
          endAt: '2026-12-19T08:00:00.000Z',
          status: 'planned',
          assignedParticipantIds: [memberUser.id],
        });
      expect(res2.status).toBe(201);
      activity2Id = res2.body.data.activity.id;
      expect(res2.body.data.activity.hasConflict).toBe(true);
      expect(res2.body.data.conflictReport.conflictCount).toBe(1);

      const conflictEndpoint = await ownerAgent.get(
        `/api/trips/${tripId}/conflicts`
      );
      expect(conflictEndpoint.status).toBe(200);
      expect(conflictEndpoint.body.data.conflictCount).toBe(1);
    });

    it('resolves conflict when overlapping activity is rescheduled', async () => {
      const res = await memberAgent
        .patch(`/api/trips/${tripId}/activities/${activity2Id}`)
        .send({
          startAt: '2026-12-19T07:00:00.000Z', // Touching endpoint with 07:00Z
          endAt: '2026-12-19T09:30:00.000Z',
        });
      expect(res.status).toBe(200);
      expect(res.body.data.activity.hasConflict).toBe(false);
      expect(res.body.data.conflictReport.conflictCount).toBe(0);
    });

    it('creates a booking with safe URL validation and rejects javascript: URLs', async () => {
      const badRes = await ownerAgent
        .post(`/api/trips/${tripId}/bookings`)
        .send({
          title: 'Bad URL Booking',
          provider: 'Vendor',
          category: 'accommodation',
          url: 'javascript:alert(1)',
        });
      expect(badRes.status).toBe(400);

      const goodRes = await ownerAgent
        .post(`/api/trips/${tripId}/bookings`)
        .send({
          title: 'Wayanad Treehouse Eco Resort',
          provider: 'GreenCanopy Stays',
          category: 'accommodation',
          startAt: '2026-12-18T08:00:00.000Z',
          endAt: '2026-12-20T06:00:00.000Z',
          status: 'confirmed',
          referenceNumber: 'GC-9910',
          url: 'https://example.com/greencanopy',
        });
      expect(goodRes.status).toBe(201);
      bookingId = goodRes.body.data.booking.id;
    });

    it('creates a task for a trip member and rejects outside assignees', async () => {
      const badTask = await ownerAgent.post(`/api/trips/${tripId}/tasks`).send({
        title: 'Invalid Assignee Task',
        assignedTo: '507f1f77bcf86cd799439011',
      });
      expect(badTask.status).toBe(400);

      const goodTask = await ownerAgent.post(`/api/trips/${tripId}/tasks`).send({
        title: 'Book forest entry permits',
        description: 'Carry ID proofs for all members',
        assignedTo: memberUser.id,
        priority: 'high',
        status: 'todo',
      });
      expect(goodTask.status).toBe(201);
      taskId = goodTask.body.data.task.id;

      const patchTask = await memberAgent
        .patch(`/api/trips/${tripId}/tasks/${taskId}`)
        .send({ status: 'done' });
      expect(patchTask.status).toBe(200);
      expect(patchTask.body.data.task.status).toBe('done');
    });
  });

  describe('Expenses, Splits, Settlements & Referential Integrity', () => {
    it('creates planned and paid expenses and computes accurate summary & settlements', async () => {
      // Paid expense: Owner pays ₹4,000 (400000 paise) split equally between Owner and Member (200000 each)
      const paidRes = await ownerAgent
        .post(`/api/trips/${tripId}/expenses`)
        .send({
          title: 'Treehouse Resort Advance',
          amountMinor: 400000,
          currency: 'INR',
          category: 'accommodation',
          status: 'paid',
          paidByUserId: ownerUser.id,
          shareMode: 'equal',
          participantIds: [ownerUser.id, memberUser.id],
          linkedBookingId: bookingId,
        });
      expect(paidRes.status).toBe(201);
      paidExpenseId = paidRes.body.data.expense.id;

      // Planned expense: ₹1,500 (150000 paise) custom split (Owner 50000, Member 100000)
      const plannedRes = await memberAgent
        .post(`/api/trips/${tripId}/expenses`)
        .send({
          title: 'Guided Trek & Bamboo Rafting Fees',
          amountMinor: 150000,
          currency: 'INR',
          category: 'activities',
          status: 'planned',
          shareMode: 'custom',
          customShares: [
            { userId: ownerUser.id, shareMinor: 50000 },
            { userId: memberUser.id, shareMinor: 100000 },
          ],
          linkedActivityId: activity1Id,
        });
      expect(plannedRes.status).toBe(201);
      plannedExpenseId = plannedRes.body.data.expense.id;

      // Summary check
      const summaryRes = await ownerAgent.get(`/api/trips/${tripId}/summary`);
      expect(summaryRes.status).toBe(200);
      const { financialSummary, pulse } = summaryRes.body.data;

      expect(financialSummary.tripTotalPaidMinor).toBe(400000);
      expect(financialSummary.tripTotalPlannedMinor).toBe(150000);
      expect(financialSummary.tripTotalEstimatedMinor).toBe(550000);
      expect(pulse.overallScore).toBeGreaterThan(0);

      // Settlement check: Member owes Owner ₹2,000 (200000 paise) from PAID expense only
      const settlementRes = await ownerAgent.get(
        `/api/trips/${tripId}/settlements`
      );
      expect(settlementRes.status).toBe(200);
      expect(settlementRes.body.data.settlements.transfers).toEqual([
        {
          fromUserId: memberUser.id,
          fromDisplayName: 'Ananya Rao',
          fromEmail: 'ananya@example.com',
          toUserId: ownerUser.id,
          toDisplayName: 'Rohan Kulkarni',
          toEmail: 'rohan@example.com',
          amountMinor: 200000,
        },
      ]);
    });

    it('blocks removing a member who has financial records (409)', async () => {
      const res = await ownerAgent.delete(
        `/api/trips/${tripId}/members/${memberUser.id}`
      );
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('MEMBER_HAS_FINANCIAL_RECORDS');
    });

    it('unlinks booking/activity references and recalculates summary when an expense is deleted', async () => {
      const delRes = await ownerAgent.delete(
        `/api/trips/${tripId}/expenses/${plannedExpenseId}`
      );
      expect(delRes.status).toBe(200);

      const summaryRes = await ownerAgent.get(`/api/trips/${tripId}/summary`);
      expect(summaryRes.body.data.financialSummary.tripTotalPlannedMinor).toBe(0);
      expect(summaryRes.body.data.financialSummary.tripTotalEstimatedMinor).toBe(
        400000
      );
      expect(paidExpenseId).toBeTruthy();
    });
  });
});


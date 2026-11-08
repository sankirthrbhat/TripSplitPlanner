import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { Invitation } from '../src/models/Invitation.model.js';
import { User } from '../src/models/User.model.js';
import { detectScheduleConflicts } from '../src/services/conflict.service.js';
import {
  computeEqualShares,
  computeTripFinancialSummary,
} from '../src/services/expense.service.js';

/**
 * Independent pre-submission audit suite.
 * Exercises behaviour end-to-end through HTTP rather than trusting documentation.
 */

const SUFFIX = Date.now();
const PASSWORD = 'AuditPass123';

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('AUDIT: API, auth, authorization, money and conflicts', () => {
  let app;

  async function register(name, tag) {
    const agent = request.agent(app);
    const email = `${tag}.${SUFFIX}@audit.example.com`;
    const res = await agent
      .post('/api/auth/register')
      .send({ displayName: name, email, password: PASSWORD });
    expect(res.status).toBe(201);
    return { agent, email, user: res.body.data.user, res };
  }

  async function createTrip(agent, overrides = {}) {
    const res = await agent.post('/api/trips').send({
      title: 'Audit Trip',
      destination: 'Goa',
      startDate: '2026-12-18T00:00:00.000Z',
      endDate: '2026-12-22T23:59:59.000Z',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      budgetLimitMinor: 5000000,
      ...overrides,
    });
    expect(res.status).toBe(201);
    return res.body.data.trip.id;
  }

  async function join(ownerAgent, tripId, memberAgent) {
    const inv = await ownerAgent.post(`/api/trips/${tripId}/invitations`).send({});
    expect(inv.status).toBe(201);
    const acc = await memberAgent.post(`/api/invitations/${inv.body.data.inviteToken}/accept`);
    expect(acc.status).toBe(200);
  }

  const act = (title, start, end, extra = {}) => ({
    title,
    startAt: start,
    endAt: end,
    ...extra,
  });

  beforeAll(async () => {
    await connectDB();
    app = createApp();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  // ---------------------------------------------------------------------------
  describe('error handling & routing', () => {
    it('unknown /api route returns a JSON 404, never SPA/HTML', async () => {
      const res = await request(app).get('/api/does-not-exist');
      expect(res.status).toBe(404);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
    });

    it('unknown nested /api route and wrong method also return JSON 404', async () => {
      const a = await request(app).post('/api/auth/nope').send({});
      expect(a.status).toBe(404);
      expect(a.headers['content-type']).toMatch(/application\/json/);
      const b = await request(app).delete('/api/health');
      expect(b.status).toBe(404);
      expect(b.headers['content-type']).toMatch(/application\/json/);
    });

    it('malformed JSON returns a clean JSON 400', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"email": ');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('MALFORMED_JSON');
    });

    it('oversized body (>100kb) is rejected as a client error, not a 500', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ email: 'a@b.co', password: 'x'.repeat(200 * 1024) }));
      expect(res.status).toBe(413);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body.success).toBe(false);
    });

    it('errors never leak stack traces or internals', async () => {
      const res = await request(app).get('/api/trips/zzz');
      expect(JSON.stringify(res.body)).not.toMatch(/at .*\.js|node_modules|stack/i);
    });
  });

  // ---------------------------------------------------------------------------
  describe('authentication', () => {
    it('stores a bcrypt hash (never plaintext) and never returns it', async () => {
      const { email, res } = await register('Hash Check', 'hash');
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
      const dbUser = await User.findOne({ email }).select('+passwordHash');
      expect(dbUser.passwordHash).toMatch(/^\$2[aby]\$10\$/);
      expect(dbUser.passwordHash).not.toContain(PASSWORD);
      expect(await bcrypt.compare(PASSWORD, dbUser.passwordHash)).toBe(true);
    });

    it('session cookie is httpOnly, SameSite=Lax, path=/ and the token is not in the body', async () => {
      const { res } = await register('Cookie Check', 'cookie');
      const cookie = res.headers['set-cookie'][0];
      expect(cookie).toMatch(/^tripsplit_token=/);
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Path=/');
      expect(JSON.stringify(res.body)).not.toMatch(/eyJ/);
    });

    it('login does not reveal whether an email exists', async () => {
      const { email } = await register('Enum Check', 'enum');
      const wrongPw = await request(app).post('/api/auth/login').send({ email, password: 'WrongPass999' });
      const noUser = await request(app)
        .post('/api/auth/login')
        .send({ email: `ghost.${SUFFIX}@audit.example.com`, password: 'WrongPass999' });
      expect(wrongPw.status).toBe(401);
      expect(noUser.status).toBe(401);
      expect(wrongPw.body.error.message).toBe(noUser.body.error.message);
      expect(wrongPw.body.error.code).toBe(noUser.body.error.code);
    });

    it('rejects duplicate email that differs only by case/whitespace', async () => {
      await register('Dup Case', 'dupcase');
      const res = await request(app)
        .post('/api/auth/register')
        .send({ displayName: 'Dup Two', email: `  DUPCASE.${SUFFIX}@AUDIT.example.com `, password: PASSWORD });
      expect(res.status).toBe(409);
    });

    it('enforces password policy and validates email/name on register', async () => {
      const bad = [
        { displayName: 'Weak', email: `w1.${SUFFIX}@a.co`, password: 'short1' },
        { displayName: 'Weak', email: `w2.${SUFFIX}@a.co`, password: 'allletters' },
        { displayName: 'Weak', email: `w3.${SUFFIX}@a.co`, password: '12345678' },
        { displayName: 'W', email: `w4.${SUFFIX}@a.co`, password: PASSWORD },
        { displayName: 'Weak', email: 'not-an-email', password: PASSWORD },
        { email: `w5.${SUFFIX}@a.co`, password: PASSWORD },
      ];
      for (const body of bad) {
        const res = await request(app).post('/api/auth/register').send(body);
        expect(res.status, JSON.stringify(body)).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('rejects tampered, wrong-secret, expired and deleted-user tokens with 401', async () => {
      const { user } = await register('Token Check', 'token');
      const wrongSecret = jwt.sign({ sub: user.id }, 'some-other-secret-that-is-long-enough-123');
      const expired = jwt.sign({ sub: user.id }, env.JWT_SECRET, { expiresIn: -10 });
      const noneAlg = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(
        JSON.stringify({ sub: user.id })
      ).toString('base64url')}.`;

      for (const token of [wrongSecret, noneAlg, 'garbage.token.value']) {
        const res = await request(app).get('/api/auth/me').set('Cookie', `tripsplit_token=${token}`);
        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('INVALID_TOKEN');
      }
      const exp = await request(app).get('/api/auth/me').set('Cookie', `tripsplit_token=${expired}`);
      expect(exp.status).toBe(401);
      expect(exp.body.error.code).toBe('SESSION_EXPIRED');

      const ghost = jwt.sign({ sub: user.id }, env.JWT_SECRET, { expiresIn: '1h' });
      await User.deleteOne({ _id: user.id });
      const del = await request(app).get('/api/auth/me').set('Cookie', `tripsplit_token=${ghost}`);
      expect(del.status).toBe(401);
      expect(del.body.error.code).toBe('USER_NOT_FOUND');
    });

    it('does not accept a bearer token header or query token (cookie-only sessions)', async () => {
      const { user } = await register('Bearer Check', 'bearer');
      const token = jwt.sign({ sub: user.id }, env.JWT_SECRET, { expiresIn: '1h' });
      const viaHeader = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
      expect(viaHeader.status).toBe(401);
      const viaQuery = await request(app).get(`/api/auth/me?token=${token}`);
      expect(viaQuery.status).toBe(401);
    });

    it('logout expires the cookie and the session is dead afterwards; login restores it', async () => {
      const { agent, email } = await register('Logout Check', 'logout');
      const out = await agent.post('/api/auth/logout');
      expect(out.status).toBe(200);
      expect(out.headers['set-cookie'][0]).toMatch(/tripsplit_token=;/);
      expect(out.headers['set-cookie'][0]).toMatch(/Expires=Thu, 01 Jan 1970/);
      expect((await agent.get('/api/auth/me')).status).toBe(401);
      expect((await agent.get('/api/trips')).status).toBe(401);
      const back = await agent.post('/api/auth/login').send({ email, password: PASSWORD });
      expect(back.status).toBe(200);
      expect((await agent.get('/api/auth/me')).status).toBe(200);
    });

    it('blocks cross-origin mutations but allows same-host and allow-listed origins', async () => {
      const evil = await request(app)
        .post('/api/auth/login')
        .set('Origin', 'https://evil.example.com')
        .send({ email: 'a@b.co', password: 'x' });
      expect(evil.status).toBe(403);
      const same = await request(app)
        .post('/api/auth/login')
        .set('Host', 'tripsplit.example.com')
        .set('Origin', 'https://tripsplit.example.com')
        .send({ email: 'a@b.co', password: 'x' });
      expect(same.status).toBe(401); // reached the controller (bad creds), i.e. not blocked
    });
  });

  // ---------------------------------------------------------------------------
  describe('authorization (cross-trip isolation)', () => {
    let A;
    let B;
    let tripA;
    let tripB;
    let ids;

    beforeAll(async () => {
      A = await register('Owner A', 'authzA');
      B = await register('Owner B', 'authzB');
      tripA = await createTrip(A.agent, { title: 'Trip A' });
      tripB = await createTrip(B.agent, { title: 'Trip B' });

      const a = await A.agent
        .post(`/api/trips/${tripA}/activities`)
        .send(act('A Activity', '2026-12-19T04:00:00.000Z', '2026-12-19T06:00:00.000Z'));
      const b = await A.agent
        .post(`/api/trips/${tripA}/bookings`)
        .send({ title: 'A Booking', provider: 'Prov', category: 'accommodation' });
      const t = await A.agent
        .post(`/api/trips/${tripA}/tasks`)
        .send({ title: 'A Task', assignedTo: A.user.id });
      const e = await A.agent.post(`/api/trips/${tripA}/expenses`).send({
        title: 'A Expense',
        amountMinor: 10000,
        status: 'planned',
        shareMode: 'equal',
        participantIds: [A.user.id],
      });
      for (const r of [a, b, t, e]) expect(r.status).toBe(201);
      ids = {
        activity: a.body.data.activity.id,
        booking: b.body.data.booking.id,
        task: t.body.data.task.id,
        expense: e.body.data.expense.id,
      };
    });

    it('unauthenticated callers get 401 on every trip route', async () => {
      const anon = request(app);
      const routes = [
        ['get', '/api/trips'],
        ['post', '/api/trips'],
        ['get', `/api/trips/${tripA}`],
        ['patch', `/api/trips/${tripA}`],
        ['delete', `/api/trips/${tripA}`],
        ['get', `/api/trips/${tripA}/members`],
        ['get', `/api/trips/${tripA}/invitations`],
        ['post', `/api/trips/${tripA}/invitations`],
        ['get', `/api/trips/${tripA}/activities`],
        ['post', `/api/trips/${tripA}/activities`],
        ['get', `/api/trips/${tripA}/bookings`],
        ['get', `/api/trips/${tripA}/tasks`],
        ['get', `/api/trips/${tripA}/expenses`],
        ['post', `/api/trips/${tripA}/expenses/simulate`],
        ['get', `/api/trips/${tripA}/summary`],
        ['get', `/api/trips/${tripA}/conflicts`],
        ['get', `/api/trips/${tripA}/settlements`],
        ['post', '/api/invitations/abcdefabcdefabcdefabcdef/accept'],
        ['get', '/api/invitations/abcdefabcdefabcdefabcdef/preview'],
      ];
      for (const [method, url] of routes) {
        const res = await anon[method](url).send({});
        expect(res.status, `${method} ${url}`).toBe(401);
      }
    });

    it('a non-member gets 403 on every trip-scoped route (read and write)', async () => {
      const outsider = B.agent;
      const routes = [
        ['get', `/api/trips/${tripA}`],
        ['patch', `/api/trips/${tripA}`],
        ['delete', `/api/trips/${tripA}`],
        ['get', `/api/trips/${tripA}/members`],
        ['delete', `/api/trips/${tripA}/members/${A.user.id}`],
        ['get', `/api/trips/${tripA}/invitations`],
        ['post', `/api/trips/${tripA}/invitations`],
        ['get', `/api/trips/${tripA}/activities`],
        ['post', `/api/trips/${tripA}/activities`],
        ['patch', `/api/trips/${tripA}/activities/${ids.activity}`],
        ['delete', `/api/trips/${tripA}/activities/${ids.activity}`],
        ['get', `/api/trips/${tripA}/bookings`],
        ['post', `/api/trips/${tripA}/bookings`],
        ['patch', `/api/trips/${tripA}/bookings/${ids.booking}`],
        ['delete', `/api/trips/${tripA}/bookings/${ids.booking}`],
        ['get', `/api/trips/${tripA}/tasks`],
        ['post', `/api/trips/${tripA}/tasks`],
        ['patch', `/api/trips/${tripA}/tasks/${ids.task}`],
        ['delete', `/api/trips/${tripA}/tasks/${ids.task}`],
        ['get', `/api/trips/${tripA}/expenses`],
        ['post', `/api/trips/${tripA}/expenses`],
        ['post', `/api/trips/${tripA}/expenses/simulate`],
        ['patch', `/api/trips/${tripA}/expenses/${ids.expense}`],
        ['delete', `/api/trips/${tripA}/expenses/${ids.expense}`],
        ['get', `/api/trips/${tripA}/summary`],
        ['get', `/api/trips/${tripA}/conflicts`],
        ['get', `/api/trips/${tripA}/settlements`],
      ];
      for (const [method, url] of routes) {
        const res = await outsider[method](url).send({});
        expect(res.status, `${method} ${url}`).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN_TRIP_ACCESS');
      }
      // and nothing changed
      const still = await A.agent.get(`/api/trips/${tripA}`);
      expect(still.status).toBe(200);
      expect(still.body.data.trip.title).toBe('Trip A');
    });

    it('child ids from trip A cannot be read, changed or deleted through trip B (404)', async () => {
      const attempts = [
        ['patch', `/api/trips/${tripB}/activities/${ids.activity}`, { title: 'pwned' }],
        ['delete', `/api/trips/${tripB}/activities/${ids.activity}`],
        ['patch', `/api/trips/${tripB}/bookings/${ids.booking}`, { title: 'pwned' }],
        ['delete', `/api/trips/${tripB}/bookings/${ids.booking}`],
        ['patch', `/api/trips/${tripB}/tasks/${ids.task}`, { title: 'pwned' }],
        ['delete', `/api/trips/${tripB}/tasks/${ids.task}`],
        ['patch', `/api/trips/${tripB}/expenses/${ids.expense}`, { title: 'pwned' }],
        ['delete', `/api/trips/${tripB}/expenses/${ids.expense}`],
      ];
      for (const [method, url, body] of attempts) {
        const res = await B.agent[method](url).send(body || {});
        expect(res.status, `${method} ${url}`).toBe(404);
      }
      const acts = await A.agent.get(`/api/trips/${tripA}/activities`);
      expect(acts.body.data.activities[0].title).toBe('A Activity');
      const exps = await A.agent.get(`/api/trips/${tripA}/expenses`);
      expect(exps.body.data.expenses).toHaveLength(1);
    });

    it('trip B resources cannot reference trip A users, activities, bookings or expenses', async () => {
      const foreignUser = await B.agent.post(`/api/trips/${tripB}/expenses`).send({
        title: 'Foreign share',
        amountMinor: 10000,
        status: 'planned',
        shareMode: 'equal',
        participantIds: [A.user.id],
      });
      expect(foreignUser.status).toBe(400);

      const foreignAct = await B.agent.post(`/api/trips/${tripB}/expenses`).send({
        title: 'Foreign link',
        amountMinor: 10000,
        status: 'planned',
        shareMode: 'equal',
        participantIds: [B.user.id],
        linkedActivityId: ids.activity,
      });
      expect(foreignAct.status).toBe(404);

      const foreignBooking = await B.agent.post(`/api/trips/${tripB}/expenses`).send({
        title: 'Foreign link',
        amountMinor: 10000,
        status: 'planned',
        shareMode: 'equal',
        participantIds: [B.user.id],
        linkedBookingId: ids.booking,
      });
      expect(foreignBooking.status).toBe(404);

      const foreignTask = await B.agent
        .post(`/api/trips/${tripB}/tasks`)
        .send({ title: 'Foreign assignee', assignedTo: A.user.id });
      expect(foreignTask.status).toBe(400);

      const foreignActAssignee = await B.agent
        .post(`/api/trips/${tripB}/activities`)
        .send(
          act('Foreign assignee', '2026-12-19T04:00:00.000Z', '2026-12-19T05:00:00.000Z', {
            assignedParticipantIds: [A.user.id],
          })
        );
      expect(foreignActAssignee.status).toBe(400);

      const foreignPayer = await B.agent.post(`/api/trips/${tripB}/expenses`).send({
        title: 'Foreign payer',
        amountMinor: 10000,
        status: 'paid',
        paidByUserId: A.user.id,
        shareMode: 'equal',
        participantIds: [B.user.id],
      });
      expect(foreignPayer.status).toBe(400);
    });

    it('activities in different trips never conflict with each other', async () => {
      await B.agent
        .post(`/api/trips/${tripB}/activities`)
        .send(act('B Same Time', '2026-12-19T04:00:00.000Z', '2026-12-19T06:00:00.000Z'));
      const a = await A.agent.get(`/api/trips/${tripA}/conflicts`);
      const b = await B.agent.get(`/api/trips/${tripB}/conflicts`);
      expect(a.body.data.conflictCount).toBe(0);
      expect(b.body.data.conflictCount).toBe(0);
    });

    it('members get member rights but not owner-only rights; deleting a trip cascades', async () => {
      const M = await register('Member M', 'authzM');
      await join(A.agent, tripA, M.agent);

      expect((await M.agent.get(`/api/trips/${tripA}/activities`)).status).toBe(200);
      expect((await M.agent.patch(`/api/trips/${tripA}`).send({ title: 'x' })).status).toBe(403);
      expect((await M.agent.delete(`/api/trips/${tripA}`)).status).toBe(403);
      expect((await M.agent.post(`/api/trips/${tripA}/invitations`).send({})).status).toBe(403);
      expect((await M.agent.delete(`/api/trips/${tripA}/members/${A.user.id}`)).status).toBe(403);
      expect((await M.agent.get(`/api/trips`)).body.data.trips.map((t) => t.id)).toContain(tripA);
      expect((await B.agent.get(`/api/trips`)).body.data.trips.map((t) => t.id)).not.toContain(tripA);

      const del = await A.agent.delete(`/api/trips/${tripA}`);
      expect(del.status).toBe(200);
      expect((await A.agent.get(`/api/trips/${tripA}`)).status).toBe(404);
      expect((await M.agent.get(`/api/trips/${tripA}/expenses`)).status).toBe(404);
    });
  });

  // ---------------------------------------------------------------------------
  describe('invitations', () => {
    it('expired and revoked invitations are rejected; preview never leaks other trips', async () => {
      const O = await register('Inv Owner', 'invO');
      const U = await register('Inv User', 'invU');
      const tripId = await createTrip(O.agent);

      const exp = await O.agent.post(`/api/trips/${tripId}/invitations`).send({});
      await Invitation.updateOne({ _id: exp.body.data.invitation.id }, { expiresAt: new Date(Date.now() - 1000) });
      const r1 = await U.agent.post(`/api/invitations/${exp.body.data.inviteToken}/accept`);
      expect(r1.status).toBe(410);
      expect(r1.body.error.code).toBe('INVITATION_EXPIRED');

      const rev = await O.agent.post(`/api/trips/${tripId}/invitations`).send({});
      await O.agent.delete(`/api/trips/${tripId}/invitations/${rev.body.data.invitation.id}`);
      const r2 = await U.agent.post(`/api/invitations/${rev.body.data.inviteToken}/accept`);
      expect(r2.status).toBe(410);
      expect(r2.body.error.code).toBe('INVITATION_REVOKED');

      const r3 = await U.agent.post(`/api/invitations/${'f'.repeat(64)}/accept`);
      expect(r3.status).toBe(404);
    });

    it('a single-use invitation can only be accepted once even under concurrent requests', async () => {
      const O = await register('Race Owner', 'raceO');
      const U1 = await register('Race One', 'race1');
      const U2 = await register('Race Two', 'race2');
      const tripId = await createTrip(O.agent);
      const inv = await O.agent.post(`/api/trips/${tripId}/invitations`).send({});
      const token = inv.body.data.inviteToken;

      const [r1, r2] = await Promise.all([
        U1.agent.post(`/api/invitations/${token}/accept`),
        U2.agent.post(`/api/invitations/${token}/accept`),
      ]);
      const statuses = [r1.status, r2.status].sort();
      const members = (await O.agent.get(`/api/trips/${tripId}/members`)).body.data.members;
      expect(statuses, `statuses=${statuses} members=${members.length}`).toEqual([200, 409]);
      expect(members).toHaveLength(2);
    });
  });

  // ---------------------------------------------------------------------------
  describe('itinerary conflict detection (HTTP)', () => {
    let O;
    let tripId;

    beforeAll(async () => {
      O = await register('Conflict Owner', 'conf');
      tripId = await createTrip(O.agent);
    });

    const post = (title, s, e, extra) =>
      O.agent.post(`/api/trips/${tripId}/activities`).send(act(title, s, e, extra));

    it('adjacent (touching) activities do not conflict; partial overlap does; cancel/restore toggles', async () => {
      const a = await post('A 10-12', '2026-12-19T10:00:00.000Z', '2026-12-19T12:00:00.000Z');
      const b = await post('B 12-13 adjacent', '2026-12-19T12:00:00.000Z', '2026-12-19T13:00:00.000Z');
      expect(b.body.data.conflictReport.conflictCount).toBe(0);

      const c = await post('C 11:30-12:30', '2026-12-19T11:30:00.000Z', '2026-12-19T12:30:00.000Z');
      expect(c.body.data.conflictReport.conflictCount).toBe(2);
      expect(c.body.data.activity.hasConflict).toBe(true);
      const mins = c.body.data.conflictReport.conflicts.map((x) => x.overlapMinutes).sort();
      expect(mins).toEqual([30, 30]);

      const cancelled = await O.agent
        .patch(`/api/trips/${tripId}/activities/${c.body.data.activity.id}`)
        .send({ status: 'cancelled' });
      expect(cancelled.status).toBe(200);
      expect(cancelled.body.data.conflictReport.conflictCount).toBe(0);
      expect(cancelled.body.data.activity.hasConflict).toBe(false);

      const restored = await O.agent
        .patch(`/api/trips/${tripId}/activities/${c.body.data.activity.id}`)
        .send({ status: 'confirmed' });
      expect(restored.body.data.conflictReport.conflictCount).toBe(2);

      // a cancelled activity created fresh never conflicts
      const dead = await post('D cancelled 10-12', '2026-12-19T10:00:00.000Z', '2026-12-19T12:00:00.000Z', {
        status: 'cancelled',
      });
      expect(dead.body.data.activity.hasConflict).toBe(false);
      expect(dead.body.data.conflictReport.conflictCount).toBe(2);

      // deleting one side resolves its conflicts
      const del = await O.agent.delete(`/api/trips/${tripId}/activities/${a.body.data.activity.id}`);
      expect(del.body.data.conflictReport.conflictCount).toBe(1);
    });

    it('fully contained and identical ranges conflict', async () => {
      const t2 = await createTrip(O.agent);
      const p = (title, s, e) => O.agent.post(`/api/trips/${t2}/activities`).send(act(title, s, e));
      await p('Outer', '2026-12-20T08:00:00.000Z', '2026-12-20T18:00:00.000Z');
      const inner = await p('Inner', '2026-12-20T10:00:00.000Z', '2026-12-20T11:00:00.000Z');
      expect(inner.body.data.conflictReport.conflictCount).toBe(1);
      expect(inner.body.data.conflictReport.conflicts[0].overlapMinutes).toBe(60);
      const same = await p('Twin', '2026-12-20T10:00:00.000Z', '2026-12-20T11:00:00.000Z');
      expect(same.body.data.conflictReport.conflictCount).toBe(3); // outer-inner, outer-twin, inner-twin
    });

    it('overnight schedules across midnight (trip timezone) overlap correctly', async () => {
      const t3 = await createTrip(O.agent, { timezone: 'Asia/Kolkata' });
      const p = (title, s, e) => O.agent.post(`/api/trips/${t3}/activities`).send(act(title, s, e));
      // 22:00 -> 02:00 IST and 01:00 -> 03:00 IST (next day)
      await p('Night Safari', '2026-12-19T16:30:00.000Z', '2026-12-19T20:30:00.000Z');
      const r = await p('Late Bonfire', '2026-12-19T19:30:00.000Z', '2026-12-19T21:30:00.000Z');
      expect(r.body.data.conflictReport.conflictCount).toBe(1);
      expect(r.body.data.conflictReport.conflicts[0].overlapMinutes).toBe(60);
      expect(r.body.data.conflictReport.conflicts[0].explanation).toContain('Asia/Kolkata');
      // listing by local date: the overnight activity appears on both local days
      const day1 = await O.agent.get(`/api/trips/${t3}/activities?date=2026-12-19`);
      const day2 = await O.agent.get(`/api/trips/${t3}/activities?date=2026-12-20`);
      expect(day1.body.data.activities.map((x) => x.title)).toContain('Night Safari');
      expect(day2.body.data.activities.map((x) => x.title)).toContain('Night Safari');
      // filters never hide conflicts from the report
      expect(day2.body.data.conflictReport.conflictCount).toBe(1);
    });

    it('conflict result is identical regardless of the trip timezone (UTC-based)', async () => {
      for (const timezone of ['UTC', 'America/New_York', 'Australia/Sydney', 'Asia/Kolkata']) {
        const t = await createTrip(O.agent, { timezone });
        const p = (title, s, e) => O.agent.post(`/api/trips/${t}/activities`).send(act(title, s, e));
        await p('One', '2026-12-19T10:00:00.000Z', '2026-12-19T12:00:00.000Z');
        const two = await p('Two', '2026-12-19T11:00:00.000Z', '2026-12-19T13:00:00.000Z');
        expect(two.body.data.conflictReport.conflictCount, timezone).toBe(1);
        expect(two.body.data.conflictReport.conflicts[0].explanation).toContain(timezone);
      }
    });

    it('rejects zero/negative duration, invalid timestamps and bad ids', async () => {
      const bad = [
        act('Zero', '2026-12-19T10:00:00.000Z', '2026-12-19T10:00:00.000Z'),
        act('Backwards', '2026-12-19T12:00:00.000Z', '2026-12-19T10:00:00.000Z'),
        act('BadDate', 'not-a-date', '2026-12-19T10:00:00.000Z'),
        act('A', '2026-12-19T10:00:00.000Z', '2026-12-19T11:00:00.000Z'), // title too short
        act('Bad Assignee', '2026-12-19T10:00:00.000Z', '2026-12-19T11:00:00.000Z', { assignedParticipantIds: ['nope'] }),
        act('Bad Cat', '2026-12-19T10:00:00.000Z', '2026-12-19T11:00:00.000Z', { category: 'teleport' }),
      ];
      for (const body of bad) {
        const res = await O.agent.post(`/api/trips/${tripId}/activities`).send(body);
        expect(res.status, JSON.stringify(body)).toBe(400);
      }
      const existing = (await O.agent.get(`/api/trips/${tripId}/activities`)).body.data.activities[0];
      const patchBad = await O.agent
        .patch(`/api/trips/${tripId}/activities/${existing.id}`)
        .send({ endAt: '2000-01-01T00:00:00.000Z' });
      expect(patchBad.status).toBe(400);
    });

    it('pure engine: back-to-back chain, 1-minute overlap and unsorted input', () => {
      const mk = (id, s, e, status = 'planned') => ({ id, title: id, startAt: s, endAt: e, status });
      const chain = detectScheduleConflicts([
        mk('c', '2026-12-19T12:00:00.000Z', '2026-12-19T13:00:00.000Z'),
        mk('a', '2026-12-19T10:00:00.000Z', '2026-12-19T11:00:00.000Z'),
        mk('b', '2026-12-19T11:00:00.000Z', '2026-12-19T12:00:00.000Z'),
      ]);
      expect(chain.conflictCount).toBe(0);
      const oneMin = detectScheduleConflicts([
        mk('a', '2026-12-19T10:00:00.000Z', '2026-12-19T11:01:00.000Z'),
        mk('b', '2026-12-19T11:00:00.000Z', '2026-12-19T12:00:00.000Z'),
      ]);
      expect(oneMin.conflictCount).toBe(1);
      expect(oneMin.conflicts[0].overlapMinutes).toBe(1);
      // one long activity overlapping three later ones (sweep must not break early)
      const fan = detectScheduleConflicts([
        mk('long', '2026-12-19T08:00:00.000Z', '2026-12-19T20:00:00.000Z'),
        mk('x', '2026-12-19T09:00:00.000Z', '2026-12-19T09:30:00.000Z'),
        mk('y', '2026-12-19T10:00:00.000Z', '2026-12-19T10:30:00.000Z'),
        mk('z', '2026-12-19T11:00:00.000Z', '2026-12-19T11:30:00.000Z'),
      ]);
      expect(fan.conflictCount).toBe(3);
    });
  });

  // ---------------------------------------------------------------------------
  describe('money: splitting, estimates, settlements (pure engine)', () => {
    const hex = (rng) => Array.from({ length: 24 }, () => '0123456789abcdef'[Math.floor(rng() * 16)]).join('');

    it('equal split: exact sum, max-min<=1, order independent (600 randomized cases)', () => {
      const rng = mulberry32(20260811);
      for (let i = 0; i < 600; i += 1) {
        const n = 1 + Math.floor(rng() * 8);
        const ids = Array.from({ length: n }, () => hex(rng));
        const amount = 1 + Math.floor(rng() * 5_000_000);
        const shares = computeEqualShares(amount, ids);
        const sum = shares.reduce((s, x) => s + x.shareMinor, 0);
        expect(sum).toBe(amount);
        const vals = shares.map((x) => x.shareMinor);
        expect(Math.max(...vals) - Math.min(...vals)).toBeLessThanOrEqual(1);
        const shuffled = [...ids].sort(() => rng() - 0.5);
        const again = computeEqualShares(amount, shuffled);
        expect(Object.fromEntries(again.map((x) => [x.userId, x.shareMinor]))).toEqual(
          Object.fromEntries(shares.map((x) => [x.userId, x.shareMinor]))
        );
      }
    });

    it('documented examples are exact', () => {
      const ids = ['a'.repeat(24), 'b'.repeat(24), 'c'.repeat(24)];
      expect(computeEqualShares(10000, ids).map((s) => s.shareMinor)).toEqual([3334, 3333, 3333]);
      expect(computeEqualShares(1, ids).map((s) => s.shareMinor)).toEqual([1, 0, 0]);
      expect(computeEqualShares(2, ids).map((s) => s.shareMinor)).toEqual([1, 1, 0]);
      expect(computeEqualShares(12345, ids.slice(0, 1)).map((s) => s.shareMinor)).toEqual([12345]);
    });

    it('duplicate participants are de-duplicated (not double charged)', () => {
      const id = 'a'.repeat(24);
      const shares = computeEqualShares(1000, [id, id, id]);
      expect(shares).toEqual([{ userId: id, shareMinor: 1000 }]);
    });

    it('settlements: net sums to zero and transfers clear every balance (400 randomized ledgers)', () => {
      const rng = mulberry32(777);
      for (let i = 0; i < 400; i += 1) {
        const n = 2 + Math.floor(rng() * 5);
        const members = Array.from({ length: n }, (_, k) => ({ userId: hex(rng), displayName: `M${k}`, email: '' }));
        const expenses = [];
        const count = 1 + Math.floor(rng() * 8);
        for (let k = 0; k < count; k += 1) {
          const amount = 1 + Math.floor(rng() * 900_000);
          const parts = members.filter(() => rng() > 0.35);
          const participants = parts.length ? parts : [members[0]];
          const status = rng() > 0.4 ? 'paid' : 'planned';
          expenses.push({
            amountMinor: amount,
            status,
            category: 'misc',
            paidByUserId: status === 'paid' ? members[Math.floor(rng() * n)].userId : null,
            participantShares: computeEqualShares(
              amount,
              participants.map((p) => p.userId)
            ),
          });
        }
        const summary = computeTripFinancialSummary({ trip: { budgetLimitMinor: 0 }, members, expenses });
        const net = summary.participantSummaries.reduce((s, p) => s + p.netBalanceMinor, 0);
        expect(net).toBe(0);
        const bal = Object.fromEntries(summary.participantSummaries.map((p) => [p.userId, p.netBalanceMinor]));
        for (const t of summary.settlements.transfers) {
          expect(t.amountMinor).toBeGreaterThan(0);
          bal[t.fromUserId] += t.amountMinor;
          bal[t.toUserId] -= t.amountMinor;
        }
        expect(Object.values(bal).every((v) => v === 0)).toBe(true);
        // estimate invariants: per-person estimates sum to the trip estimate; planned never in settlements
        const estSum = summary.participantSummaries.reduce((s, p) => s + p.estimatedTotalMinor, 0);
        expect(estSum).toBe(summary.tripTotalEstimatedMinor);
        expect(summary.tripTotalEstimatedMinor).toBe(expenses.reduce((s, e) => s + e.amountMinor, 0));
        const paidOnly = expenses.filter((e) => e.status === 'paid').reduce((s, e) => s + e.amountMinor, 0);
        expect(summary.tripTotalPaidMinor).toBe(paidOnly);
        expect(summary.settlements.totalTransferMinor).toBeLessThanOrEqual(paidOnly);
      }
    });
  });

  // ---------------------------------------------------------------------------
  describe('money: end-to-end ledger recalculation (HTTP)', () => {
    let O;
    let P;
    let Q;
    let tripId;
    let bookingId;
    let activityId;

    const ids3 = () => [O.user.id, P.user.id, Q.user.id];
    const summary = async () => (await O.agent.get(`/api/trips/${tripId}/summary`)).body.data.financialSummary;
    const expense = (body) => O.agent.post(`/api/trips/${tripId}/expenses`).send(body);

    function assertInvariants(s) {
      expect(s.participantSummaries.reduce((a, p) => a + p.netBalanceMinor, 0)).toBe(0);
      expect(s.participantSummaries.reduce((a, p) => a + p.estimatedTotalMinor, 0)).toBe(s.tripTotalEstimatedMinor);
      expect(s.tripTotalEstimatedMinor).toBe(s.tripTotalPlannedMinor + s.tripTotalPaidMinor);
      const bal = Object.fromEntries(s.participantSummaries.map((p) => [p.userId, p.netBalanceMinor]));
      for (const t of s.settlements.transfers) {
        bal[t.fromUserId] += t.amountMinor;
        bal[t.toUserId] -= t.amountMinor;
      }
      expect(Object.values(bal).every((v) => v === 0)).toBe(true);
    }

    beforeAll(async () => {
      O = await register('Ledger O', 'ledO');
      P = await register('Ledger P', 'ledP');
      Q = await register('Ledger Q', 'ledQ');
      tripId = await createTrip(O.agent, { budgetLimitMinor: 100000 });
      await join(O.agent, tripId, P.agent);
      await join(O.agent, tripId, Q.agent);
      const b = await O.agent
        .post(`/api/trips/${tripId}/bookings`)
        .send({ title: 'Villa', provider: 'Stays', category: 'accommodation' });
      bookingId = b.body.data.booking.id;
      const a = await O.agent
        .post(`/api/trips/${tripId}/activities`)
        .send(act('Rafting', '2026-12-19T04:00:00.000Z', '2026-12-19T06:00:00.000Z'));
      activityId = a.body.data.activity.id;
    });

    let paidId;
    let plannedId;

    it('₹100.00 paid equally by 3: 3334/3333/3333 and exact settlement', async () => {
      const res = await expense({
        title: 'Toll', amountMinor: 10000, status: 'paid', paidByUserId: O.user.id,
        shareMode: 'equal', participantIds: ids3(),
      });
      expect(res.status).toBe(201);
      paidId = res.body.data.expense.id;
      const shares = res.body.data.expense.participantShares.map((s) => s.shareMinor).sort((a, b) => b - a);
      expect(shares).toEqual([3334, 3333, 3333]);
      const s = await summary();
      assertInvariants(s);
      expect(s.tripTotalPaidMinor).toBe(10000);
      expect(s.settlements.totalTransferMinor).toBe(10000 - s.participantSummaries.find((p) => p.userId === O.user.id).paidShareMinor);
    });

    it('planned expense adds to estimates but not to settlements', async () => {
      const before = await summary();
      const res = await expense({
        title: 'Dinner', amountMinor: 30000, status: 'planned', shareMode: 'equal', participantIds: ids3(),
      });
      expect(res.status).toBe(201);
      plannedId = res.body.data.expense.id;
      const after = await summary();
      assertInvariants(after);
      expect(after.tripTotalPlannedMinor).toBe(30000);
      expect(after.tripTotalEstimatedMinor).toBe(40000);
      expect(after.settlements).toEqual(before.settlements);
      expect(after.isOverBudget).toBe(false);
      expect(after.budgetDifferenceMinor).toBe(100000 - 40000);
    });

    it('editing amount recalculates shares, totals and settlements', async () => {
      const res = await O.agent.patch(`/api/trips/${tripId}/expenses/${paidId}`).send({ amountMinor: 20001 });
      expect(res.status).toBe(200);
      const sum = res.body.data.expense.participantShares.reduce((a, s) => a + s.shareMinor, 0);
      expect(sum).toBe(20001);
      const s = await summary();
      assertInvariants(s);
      expect(s.tripTotalPaidMinor).toBe(20001);
      expect(s.tripTotalEstimatedMinor).toBe(50001);
    });

    it('switching participants (equal) and then custom splits recalculates; bad custom sum is rejected atomically', async () => {
      const two = await O.agent
        .patch(`/api/trips/${tripId}/expenses/${paidId}`)
        .send({ participantIds: [O.user.id, P.user.id] });
      expect(two.status).toBe(200);
      expect(two.body.data.expense.participantShares).toHaveLength(2);
      assertInvariants(await summary());

      const snapshot = await summary();
      const bad = await O.agent.patch(`/api/trips/${tripId}/expenses/${paidId}`).send({
        shareMode: 'custom',
        customShares: [
          { userId: O.user.id, shareMinor: 10000 },
          { userId: P.user.id, shareMinor: 10000 },
        ],
      });
      expect(bad.status).toBe(400);
      expect(bad.body.error.code).toBe('CUSTOM_SPLIT_MISMATCH');
      expect(bad.body.error.details.differenceMinor).toBe(1);
      expect(await summary()).toEqual(snapshot);

      const good = await O.agent.patch(`/api/trips/${tripId}/expenses/${paidId}`).send({
        shareMode: 'custom',
        customShares: [
          { userId: O.user.id, shareMinor: 1 },
          { userId: P.user.id, shareMinor: 20000 },
        ],
      });
      expect(good.status).toBe(200);
      const s = await summary();
      assertInvariants(s);
      const p = s.participantSummaries.find((x) => x.userId === P.user.id);
      expect(p.paidShareMinor).toBe(20000);
      expect(s.settlements.transfers).toHaveLength(1);
      expect(s.settlements.transfers[0].amountMinor).toBe(20000);
    });

    it('planned → paid moves the expense into settlements; paid → planned removes it', async () => {
      const paid = await O.agent
        .patch(`/api/trips/${tripId}/expenses/${plannedId}`)
        .send({ status: 'paid', paidByUserId: Q.user.id });
      expect(paid.status).toBe(200);
      let s = await summary();
      assertInvariants(s);
      expect(s.tripTotalPlannedMinor).toBe(0);
      expect(s.tripTotalPaidMinor).toBe(20001 + 30000);
      expect(s.tripTotalEstimatedMinor).toBe(50001);

      const missingPayer = await O.agent.patch(`/api/trips/${tripId}/expenses/${plannedId}`).send({ paidByUserId: null });
      expect(missingPayer.status).toBe(400);

      const back = await O.agent.patch(`/api/trips/${tripId}/expenses/${plannedId}`).send({ status: 'planned' });
      expect(back.status).toBe(200);
      expect(back.body.data.expense.paidByUserId).toBeNull();
      s = await summary();
      assertInvariants(s);
      expect(s.tripTotalPlannedMinor).toBe(30000);
      expect(s.tripTotalPaidMinor).toBe(20001);
    });

    it('over-budget flag and per-person budget guide behave', async () => {
      const big = await expense({
        title: 'Luxury', amountMinor: 90000, status: 'planned', shareMode: 'equal', participantIds: [O.user.id],
      });
      expect(big.status).toBe(201);
      const s = await summary();
      assertInvariants(s);
      expect(s.tripTotalEstimatedMinor).toBe(140001);
      expect(s.isOverBudget).toBe(true);
      expect(s.budgetDifferenceMinor).toBe(100000 - 140001);
      await O.agent.delete(`/api/trips/${tripId}/expenses/${big.body.data.expense.id}`);
    });

    it('a linked booking/activity never double counts: one expense = one amount', async () => {
      const before = await summary();
      const res = await expense({
        title: 'Villa advance', amountMinor: 50000, status: 'planned', shareMode: 'equal',
        participantIds: ids3(), linkedBookingId: bookingId, linkedActivityId: activityId,
      });
      expect(res.status).toBe(201);
      const s = await summary();
      assertInvariants(s);
      expect(s.tripTotalEstimatedMinor - before.tripTotalEstimatedMinor).toBe(50000);
      const bookings = await O.agent.get(`/api/trips/${tripId}/bookings`);
      const villa = bookings.body.data.bookings.find((b) => b.id === bookingId);
      // The booking carries no price of its own: its only amount is the populated single-ledger expense.
      expect(villa).not.toHaveProperty('costMinor');
      expect(villa.linkedExpenseId.amountMinor).toBe(50000);

      const del = await O.agent.delete(`/api/trips/${tripId}/expenses/${res.body.data.expense.id}`);
      expect(del.status).toBe(200);
      const after = await summary();
      expect(after.tripTotalEstimatedMinor).toBe(before.tripTotalEstimatedMinor);
    });

    it('activity plannedCostMinor creates exactly one linked planned expense', async () => {
      const before = await summary();
      const res = await O.agent.post(`/api/trips/${tripId}/activities`).send(
        act('Zipline', '2026-12-21T04:00:00.000Z', '2026-12-21T05:00:00.000Z', { plannedCostMinor: 30001 })
      );
      expect(res.status).toBe(201);
      const s = await summary();
      assertInvariants(s);
      expect(s.tripTotalEstimatedMinor - before.tripTotalEstimatedMinor).toBe(30001);
      expect(s.expenseCount - before.expenseCount).toBe(1);
    });

    it('deleting an expense recalculates; deleting the payer-linked ledger entry keeps balances at zero', async () => {
      const del = await O.agent.delete(`/api/trips/${tripId}/expenses/${paidId}`);
      expect(del.status).toBe(200);
      const s = await summary();
      assertInvariants(s);
      expect(s.tripTotalPaidMinor).toBe(0);
      expect(s.settlements.isSettled).toBe(true);
    });

    it('simulate never mutates data', async () => {
      const before = await summary();
      const sim = await O.agent
        .post(`/api/trips/${tripId}/expenses/simulate`)
        .send({ amountMinor: 123457, shareMode: 'equal', participantIds: ids3() });
      expect(sim.status).toBe(200);
      expect(sim.body.data.simulation.tripTotalDeltaMinor).toBe(123457);
      expect(await summary()).toEqual(before);
    });

    it('validation: rejects fractional/zero/negative/string/huge amounts, bad ids, unknown fields are ignored', async () => {
      const base = { title: 'Bad', status: 'planned', shareMode: 'equal', participantIds: ids3() };
      for (const amountMinor of [100.5, 0, -100, '5000', null, 10000000001, 1e21]) {
        const res = await expense({ ...base, amountMinor });
        expect(res.status, String(amountMinor)).toBe(400);
      }
      for (const patch of [
        { ...base, amountMinor: 1000, participantIds: [] },
        { ...base, amountMinor: 1000, participantIds: ['nope'] },
        { ...base, amountMinor: 1000, status: 'paid' },
        { ...base, amountMinor: 1000, currency: 'USD' },
        { ...base, amountMinor: 1000, category: 'yachts' },
        { ...base, amountMinor: 1000, title: 'x' },
        { ...base, amountMinor: 1000, shareMode: 'custom', customShares: [{ userId: O.user.id, shareMinor: 1.5 }] },
        { ...base, amountMinor: 1000, shareMode: 'custom', customShares: [{ userId: O.user.id, shareMinor: -1 }] },
        { ...base, amountMinor: 1000, shareMode: 'custom', customShares: [
          { userId: O.user.id, shareMinor: 500 }, { userId: O.user.id, shareMinor: 500 }] },
        { ...base, amountMinor: 1000, shareMode: 'custom' },
      ]) {
        const res = await expense(patch);
        expect(res.status, JSON.stringify(patch)).toBe(400);
      }
      const ok = await expense({ ...base, amountMinor: 1000, sneaky: 'field', createdBy: P.user.id });
      expect(ok.status).toBe(201);
      expect(ok.body.data.expense.createdBy).toBe(O.user.id);
    });

    it('removing a member with ledger entries is blocked; removing a clean member works', async () => {
      const R = await register('Clean Member', 'ledR');
      await join(O.agent, tripId, R.agent);
      const blocked = await O.agent.delete(`/api/trips/${tripId}/members/${P.user.id}`);
      expect(blocked.status).toBe(409);
      const ok = await O.agent.delete(`/api/trips/${tripId}/members/${R.user.id}`);
      expect(ok.status).toBe(200);
      expect((await R.agent.get(`/api/trips/${tripId}`)).status).toBe(403);
    });
  });
});

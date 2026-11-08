export class ApiError extends Error {
  constructor(message, status, code = 'API_ERROR', details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request(path, options = {}) {
  const { method = 'GET', body, headers = {} } = options;

  const config = {
    method,
    credentials: 'include',
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };

  const response = await fetch(`/api${path}`, config);
  let payload = null;

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    payload = await response.json().catch(() => null);
  }

  if (!response.ok || payload?.success === false) {
    const message =
      payload?.error?.message ||
      `Request failed with status ${response.status}`;
    const code = payload?.error?.code || 'REQUEST_FAILED';
    const details = payload?.error?.details || null;
    throw new ApiError(message, response.status, code, details);
  }

  return payload?.data;
}

export const authApi = {
  register: (body) => request('/auth/register', { method: 'POST', body }),
  login: (body) => request('/auth/login', { method: 'POST', body }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
};

export const tripsApi = {
  list: () => request('/trips'),
  create: (body) => request('/trips', { method: 'POST', body }),
  get: (tripId) => request(`/trips/${tripId}`),
  update: (tripId, body) => request(`/trips/${tripId}`, { method: 'PATCH', body }),
  remove: (tripId) => request(`/trips/${tripId}`, { method: 'DELETE' }),
  listMembers: (tripId) => request(`/trips/${tripId}/members`),
  removeMember: (tripId, memberUserId) =>
    request(`/trips/${tripId}/members/${memberUserId}`, { method: 'DELETE' }),
};

export const invitationsApi = {
  listForTrip: (tripId) => request(`/trips/${tripId}/invitations`),
  createForTrip: (tripId, body) =>
    request(`/trips/${tripId}/invitations`, { method: 'POST', body }),
  revoke: (tripId, invitationId) =>
    request(`/trips/${tripId}/invitations/${invitationId}`, { method: 'DELETE' }),
  preview: (token) => request(`/invitations/${token}/preview`),
  accept: (token) => request(`/invitations/${token}/accept`, { method: 'POST' }),
};

export const activitiesApi = {
  list: (tripId, params = {}) => {
    const qs = new URLSearchParams();
    if (params.date) qs.set('date', params.date);
    if (params.status) qs.set('status', params.status);
    if (params.category) qs.set('category', params.category);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request(`/trips/${tripId}/activities${suffix}`);
  },
  create: (tripId, body) =>
    request(`/trips/${tripId}/activities`, { method: 'POST', body }),
  update: (tripId, activityId, body) =>
    request(`/trips/${tripId}/activities/${activityId}`, { method: 'PATCH', body }),
  remove: (tripId, activityId) =>
    request(`/trips/${tripId}/activities/${activityId}`, { method: 'DELETE' }),
};

export const bookingsApi = {
  list: (tripId, params = {}) => {
    const qs = new URLSearchParams();
    if (params.category) qs.set('category', params.category);
    if (params.status) qs.set('status', params.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request(`/trips/${tripId}/bookings${suffix}`);
  },
  create: (tripId, body) =>
    request(`/trips/${tripId}/bookings`, { method: 'POST', body }),
  update: (tripId, bookingId, body) =>
    request(`/trips/${tripId}/bookings/${bookingId}`, { method: 'PATCH', body }),
  remove: (tripId, bookingId) =>
    request(`/trips/${tripId}/bookings/${bookingId}`, { method: 'DELETE' }),
};

export const tasksApi = {
  list: (tripId, params = {}) => {
    const qs = new URLSearchParams();
    if (params.assignedTo) qs.set('assignedTo', params.assignedTo);
    if (params.status) qs.set('status', params.status);
    if (params.priority) qs.set('priority', params.priority);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request(`/trips/${tripId}/tasks${suffix}`);
  },
  create: (tripId, body) =>
    request(`/trips/${tripId}/tasks`, { method: 'POST', body }),
  update: (tripId, taskId, body) =>
    request(`/trips/${tripId}/tasks/${taskId}`, { method: 'PATCH', body }),
  remove: (tripId, taskId) =>
    request(`/trips/${tripId}/tasks/${taskId}`, { method: 'DELETE' }),
};

export const expensesApi = {
  list: (tripId, params = {}) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.category) qs.set('category', params.category);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request(`/trips/${tripId}/expenses${suffix}`);
  },
  create: (tripId, body) =>
    request(`/trips/${tripId}/expenses`, { method: 'POST', body }),
  update: (tripId, expenseId, body) =>
    request(`/trips/${tripId}/expenses/${expenseId}`, { method: 'PATCH', body }),
  remove: (tripId, expenseId) =>
    request(`/trips/${tripId}/expenses/${expenseId}`, { method: 'DELETE' }),
  simulate: (tripId, body) =>
    request(`/trips/${tripId}/expenses/simulate`, { method: 'POST', body }),
};

export const insightsApi = {
  summary: (tripId) => request(`/trips/${tripId}/summary`),
  conflicts: (tripId) => request(`/trips/${tripId}/conflicts`),
  settlements: (tripId) => request(`/trips/${tripId}/settlements`),
};


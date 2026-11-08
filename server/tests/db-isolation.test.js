import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  connect: vi.fn().mockResolvedValue({}),
  create: vi.fn().mockResolvedValue({
    getUri: () => 'mongodb://127.0.0.1:27099/isolated-test',
    stop: vi.fn(),
  }),
}));

vi.mock('../src/config/env.js', () => ({
  env: {
    NODE_ENV: 'test',
    MONGODB_URI: 'mongodb+srv://cluster.example.invalid/shared',
    ALLOW_EMBEDDED_MONGO: true,
  },
}));
vi.mock('mongoose', () => ({ default: { connection: { readyState: 0 }, connect: mocks.connect } }));
vi.mock('mongodb-memory-server', () => ({ MongoMemoryServer: { create: mocks.create } }));

import { connectDB, disconnectDB } from '../src/config/db.js';

afterEach(async () => {
  await disconnectDB();
  vi.clearAllMocks();
});

describe('Automated tests cannot use a shared Atlas database', () => {
  it('ignores an ambient Atlas URI and creates an isolated test database', async () => {
    await connectDB();
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.connect).toHaveBeenCalledWith('mongodb://127.0.0.1:27099/isolated-test', { autoIndex: true });
  });

  it('refuses an explicitly supplied remote test URI before connecting', async () => {
    await expect(connectDB('mongodb+srv://cluster.example.invalid/shared'))
      .rejects.toThrow('Test mode refuses a non-local MongoDB connection');
    expect(mocks.connect).not.toHaveBeenCalled();
  });
});

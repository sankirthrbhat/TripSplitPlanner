import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { env } from './env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let memoryServer = null;
let activeMode = 'disconnected';

/**
 * Connects Mongoose to MongoDB.
 * Priority:
 * 1. Explicit uri parameter (used by isolated tests or scripts)
 * 2. env.MONGODB_URI (MongoDB Atlas or local mongod)
 * 3. Embedded MongoDB binary via mongodb-memory-server (dev/test only when allowed)
 */
export async function connectDB(customUri) {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const targetUri = customUri || env.MONGODB_URI;

  if (targetUri) {
    await mongoose.connect(targetUri, {
      autoIndex: true,
    });
    activeMode = 'uri';
    return mongoose.connection;
  }

  if (env.NODE_ENV === 'production' || !env.ALLOW_EMBEDDED_MONGO) {
    throw new Error(
      'MONGODB_URI is not configured and embedded MongoDB fallback is disabled.'
    );
  }

  const { MongoMemoryServer } = await import('mongodb-memory-server');

  if (env.NODE_ENV === 'test') {
    memoryServer = await MongoMemoryServer.create();
    activeMode = 'memory-test';
  } else {
    const dbPath = path.resolve(__dirname, '../../../.data/mongodb');
    fs.mkdirSync(dbPath, { recursive: true });
    try {
      memoryServer = await MongoMemoryServer.create({
        instance: {
          dbPath,
          storageEngine: 'wiredTiger',
        },
      });
      activeMode = 'embedded-persistent';
    } catch (_err) {
      // Fallback if another local process already holds the wiredTiger lock on .data/mongodb
      memoryServer = await MongoMemoryServer.create();
      activeMode = 'embedded-ephemeral';
      console.warn(
        '[DB] WARNING: .data/mongodb is locked by another process. Using a TEMPORARY in-memory ' +
          'database - data created in this session will be LOST on exit.'
      );
    }
  }

  const embeddedUri = memoryServer.getUri('tripsplit');
  await mongoose.connect(embeddedUri, {
    autoIndex: true,
  });

  if (env.NODE_ENV !== 'test') {
    console.log(`[DB] Connected to MongoDB (${activeMode})`);
  }

  return mongoose.connection;
}

export async function disconnectDB() {
  if (mongoose.connection.readyState === 1 && activeMode === 'embedded-persistent') {
    // Embedded mongod is terminated by mongodb-memory-server on stop(). Force a checkpoint
    // first so writes made just before shutdown are durable on disk (restart persistence).
    try {
      await mongoose.connection.db.admin().command({ fsync: 1 });
    } catch (err) {
      console.warn('[DB] fsync before shutdown failed:', err.message);
    }
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
  activeMode = 'disconnected';
}

export function getDbStatus() {
  return {
    readyState: mongoose.connection.readyState,
    status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    mode: activeMode,
  };
}


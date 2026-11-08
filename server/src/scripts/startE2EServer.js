import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../app.js';
import { connectDB, disconnectDB } from '../config/db.js';
import { env } from '../config/env.js';

let mongod;
let server;

async function start() {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri('tripsplit_e2e');
  await connectDB(uri);

  const app = createApp();
  server = app.listen(env.PORT, () => {
    console.log(`[E2E Server] Listening on http://localhost:${env.PORT}`);
  });
}

async function stop() {
  if (server) await new Promise((r) => server.close(r));
  await disconnectDB();
  if (mongod) await mongod.stop();
  process.exit(0);
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);

start().catch((err) => {
  console.error('[E2E Server] Startup error:', err);
  process.exit(1);
});


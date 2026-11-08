import { connectDB, disconnectDB } from './config/db.js';
import { env } from './config/env.js';
import { createApp } from './app.js';

let server;

async function startServer() {
  await connectDB();
  const app = createApp();

  server = app.listen(env.PORT, () => {
    console.log(
      `[Server] TripSplit Planner listening on http://localhost:${env.PORT} (${env.NODE_ENV})`
    );
  });
}

async function shutdown(signal) {
  console.log(`[Server] Received ${signal}. Shutting down gracefully...`);
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await disconnectDB();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

startServer().catch((err) => {
  console.error('[Server] Fatal startup failure:', err.message);
  process.exit(1);
});


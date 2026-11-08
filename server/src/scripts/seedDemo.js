import { connectDB, disconnectDB, getDbStatus } from '../config/db.js';
import { env } from '../config/env.js';
import { DEMO_USERS, seedDemoWorkspace } from '../services/seed.service.js';
import { assertSafeSeedTarget } from '../utils/seedGuard.js';

async function runSeed() {
  if (env.NODE_ENV === 'production') {
    console.error('Refusing to run development demo seed in production mode.');
    process.exit(1);
  }

  assertSafeSeedTarget(env.MONGODB_URI, {
    allowRemote: process.env.ALLOW_REMOTE_SEED === 'true',
  });

  await connectDB();

  const { mode } = getDbStatus();
  if (mode === 'embedded-ephemeral') {
    // The persistent .data/mongodb is locked by another process (usually `npm run dev`).
    // Seeding the throwaway in-memory fallback would "succeed" and then lose everything.
    throw new Error(
      'The persistent database (.data/mongodb) is in use by another process, so the seed would only ' +
        'write to a temporary in-memory database and be lost. Stop `npm run dev` (or any other server ' +
        'using this project) and run the seed again.'
    );
  }

  console.log(`[Seed] Target database mode: ${mode}`);
  const { trip } = await seedDemoWorkspace();

  console.log('[Seed] Successfully seeded demo trip:');
  console.log(`  Trip: ${trip.title} (ID: ${trip._id})`);
  console.log('  Demo Accounts (password: DemoPassword123):');
  for (const user of DEMO_USERS) {
    console.log(`    - ${user.displayName}: ${user.email}`);
  }

  await disconnectDB();
  process.exit(0);
}

runSeed().catch(async (err) => {
  console.error('[Seed] Failed:', err.message);
  await disconnectDB().catch(() => {});
  process.exit(1);
});

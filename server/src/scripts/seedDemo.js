import { connectDB, disconnectDB } from '../config/db.js';
import { env } from '../config/env.js';
import { DEMO_USERS, seedDemoWorkspace } from '../services/seed.service.js';

async function runSeed() {
  if (env.NODE_ENV === 'production') {
    console.error('Refusing to run development demo seed in production mode.');
    process.exit(1);
  }

  await connectDB();
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


import { Router } from 'express';
import { getDbStatus } from '../config/db.js';
import authRoutes from './auth.routes.js';
import invitationRoutes from './invitation.routes.js';
import tripRoutes from './trip.routes.js';

const router = Router();

router.get('/health', (_req, res) => {
  const db = getDbStatus();
  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      service: 'tripsplit-planner-api',
      timestamp: new Date().toISOString(),
      database: db,
    },
  });
});

router.use('/auth', authRoutes);
router.use('/trips', tripRoutes);
router.use('/invitations', invitationRoutes);

export default router;


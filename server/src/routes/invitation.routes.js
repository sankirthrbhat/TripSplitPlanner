import { Router } from 'express';
import {
  acceptInvitation,
  previewInvitation,
} from '../controllers/invitation.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.use(requireAuth);

router.get('/:token/preview', previewInvitation);
router.post('/:token/accept', acceptInvitation);

export default router;


import { Router } from 'express';
import { getMyToken, rotateToken, revokeToken } from '../controllers/token.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/async-handler';
import { UserRole } from '../types';

const router = Router();

router.use(authenticate);
router.use(requireRole(UserRole.OWNER));

router.get('/', asyncHandler(getMyToken));
router.post('/rotate', asyncHandler(rotateToken));
router.post('/revoke', asyncHandler(revokeToken));

export default router;


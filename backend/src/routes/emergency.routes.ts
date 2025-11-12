import { Router } from 'express';
import { getEmergencyView } from '../controllers/emergency.controller';
import { asyncHandler } from '../middleware/async-handler';

const router = Router();

// Public route - no authentication required
router.get('/:token', asyncHandler(getEmergencyView));

export default router;

import { Router } from 'express';
import { getAllPatients } from '../controllers/doctor.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/async-handler';
import { UserRole } from '../types';

const router = Router();

router.use(authenticate);
router.use(requireRole(UserRole.DOCTOR, UserRole.ADMIN));

router.get('/patients', asyncHandler(getAllPatients));

export default router;


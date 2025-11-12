import { Router } from 'express';
import {
  getMyProfile,
  getPublicView,
  createPendingChange,
  initializeProfile,
} from '../controllers/patient.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/async-handler';
import { UserRole } from '../types';
import { body } from 'express-validator';
import { handleValidationErrors } from '../middleware/validation.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get('/me', asyncHandler(getMyProfile));
router.get('/me/public-view', asyncHandler(getPublicView));
router.post(
  '/me/initialize',
  [
    body('blood_type').notEmpty(),
    body('emergency_contact.name').notEmpty(),
    body('emergency_contact.phone').notEmpty(),
    body('short_instructions').notEmpty(),
    handleValidationErrors,
  ],
  asyncHandler(initializeProfile)
);

router.post(
  '/pending-changes',
  [
    body('patientId').isUUID(),
    body('changeType').isIn(['public_view', 'private_profile']),
    body('fieldPath').notEmpty(),
    body('newValue').exists(),
    handleValidationErrors,
  ],
  asyncHandler(createPendingChange)
);

export default router;

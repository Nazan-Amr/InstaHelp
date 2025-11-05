import { Router } from 'express';
import { getPendingChanges, approveChange, rejectChange } from '../controllers/pending-change.controller';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/async-handler';
import { body } from 'express-validator';
import { handleValidationErrors } from '../middleware/validation.middleware';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(getPendingChanges));

router.post(
  '/:changeId/approve',
  [body('comment').optional().isString(), handleValidationErrors],
  asyncHandler(approveChange)
);

router.post(
  '/:changeId/reject',
  [body('reason').optional().isString(), handleValidationErrors],
  asyncHandler(rejectChange)
);

export default router;


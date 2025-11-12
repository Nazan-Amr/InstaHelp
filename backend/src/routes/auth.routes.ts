import { Router } from 'express';
import {
  requestOTP,
  verifyOTP,
  register,
  login,
  verifyEmail,
  refreshToken,
  getMe,
  resetPassword,
} from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/async-handler';
import { body } from 'express-validator';
import { handleValidationErrors } from '../middleware/validation.middleware';

const router = Router();

router.post(
  '/request-otp',
  [body('email').isEmail().normalizeEmail(), handleValidationErrors],
  asyncHandler(requestOTP)
);

router.post(
  '/verify-otp',
  [
    body('email').isEmail().normalizeEmail(),
    body('otp').isLength({ min: 6, max: 6 }),
    handleValidationErrors,
  ],
  asyncHandler(verifyOTP)
);

router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('role').isIn(['owner', 'doctor']),
    handleValidationErrors,
  ],
  asyncHandler(register)
);

router.post(
  '/login',
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty(), handleValidationErrors],
  asyncHandler(login)
);

router.post(
  '/verify-email',
  [body('email').isEmail().normalizeEmail(), handleValidationErrors],
  asyncHandler(verifyEmail)
);

router.post('/refresh-token', asyncHandler(refreshToken));
router.post('/reset-password', asyncHandler(resetPassword));
router.get('/me', authenticate, asyncHandler(getMe));

export default router;

import { Router } from 'express';
import { ingestVitals } from '../controllers/device.controller';
import { asyncHandler } from '../middleware/async-handler';
import rateLimit from 'express-rate-limit';
import { config } from '../config/env';

const router = Router();

// Rate limit device endpoints (1 request per minute)
const deviceRateLimiter = rateLimit({
  windowMs: config.rateLimit.deviceWindowMs,
  max: config.rateLimit.deviceMaxRequests,
  message: 'Too many requests from this device',
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/:deviceId/vitals', deviceRateLimiter, asyncHandler(ingestVitals));

export default router;


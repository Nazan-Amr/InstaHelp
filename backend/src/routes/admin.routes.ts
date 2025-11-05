import { Router } from 'express';
import {
  verifyDoctor,
  getUnverifiedDoctors,
  getVerifiedDoctors,
  getAuditLogs,
  getAllPatients,
  getAllUsers,
  getAllTokens,
  revokeToken,
  getAllPendingChanges,
  deleteUser,
  deletePatient,
} from '../controllers/admin.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/async-handler';
import { UserRole } from '../types';

const router = Router();

router.use(authenticate);
router.use(requireRole(UserRole.ADMIN));

router.get('/doctors/unverified', asyncHandler(getUnverifiedDoctors));
router.get('/doctors/verified', asyncHandler(getVerifiedDoctors));
router.post('/doctors/:doctorId/verify', asyncHandler(verifyDoctor));
router.get('/patients', asyncHandler(getAllPatients));
router.delete('/patients/:patientId', asyncHandler(deletePatient));
router.get('/users', asyncHandler(getAllUsers));
router.delete('/users/:userId', asyncHandler(deleteUser));
router.get('/tokens', asyncHandler(getAllTokens));
router.post('/tokens/:tokenId/revoke', asyncHandler(revokeToken));
router.get('/pending-changes', asyncHandler(getAllPendingChanges));
router.get('/audit-logs', asyncHandler(getAuditLogs));

export default router;


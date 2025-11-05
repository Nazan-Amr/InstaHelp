import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { tokenService } from '../services/token.service';
import { patientService } from '../services/patient.service';
import { auditService } from '../services/audit.service';
import { getClientIp } from '../middleware/auth.middleware';
import { AppError } from '../middleware/error.middleware';
import { UserRole } from '../types';
import { config } from '../config/env';

export const getMyToken = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError(401, 'Unauthorized');
  }

  if (req.user.role !== UserRole.OWNER) {
    throw new AppError(403, 'Only owners can view their tokens');
  }

  const patient = await patientService.getPatientByUserId(req.user.userId);

  if (!patient) {
    throw new AppError(404, 'Patient record not found');
  }

  let token = await tokenService.getTokenByPatientId(patient.id);

  // Generate token if doesn't exist
  if (!token) {
    token = await tokenService.createToken(patient.id);

    // Log token creation
    await auditService.log(
      req.user.userId,
      req.user.role,
      getClientIp(req),
      'token_created',
      'token',
      token.id,
      {}
    );
  }

  const emergencyUrl = `${config.frontendUrl}/r/${token.token}`;

  res.json({
    token: token.token,
    emergency_url: emergencyUrl,
    created_at: token.created_at,
    last_accessed_at: token.last_accessed_at,
  });
};

export const rotateToken = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError(401, 'Unauthorized');
  }

  if (req.user.role !== UserRole.OWNER) {
    throw new AppError(403, 'Only owners can rotate tokens');
  }

  const patient = await patientService.getPatientByUserId(req.user.userId);

  if (!patient) {
    throw new AppError(404, 'Patient record not found');
  }

  const oldToken = await tokenService.getTokenByPatientId(patient.id);
  const newToken = await tokenService.rotateToken(patient.id);

  // Log token rotation
  await auditService.log(
    req.user.userId,
    req.user.role,
    getClientIp(req),
    'token_rotated',
    'token',
    newToken.id,
    { oldTokenId: oldToken?.id }
  );

  const emergencyUrl = `${config.frontendUrl}/r/${newToken.token}`;

  res.json({
    message: 'Token rotated successfully',
    token: newToken.token,
    emergency_url: emergencyUrl,
    created_at: newToken.created_at,
  });
};

export const revokeToken = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError(401, 'Unauthorized');
  }

  if (req.user.role !== UserRole.OWNER) {
    throw new AppError(403, 'Only owners can revoke tokens');
  }

  const patient = await patientService.getPatientByUserId(req.user.userId);

  if (!patient) {
    throw new AppError(404, 'Patient record not found');
  }

  const token = await tokenService.getTokenByPatientId(patient.id);

  if (!token) {
    throw new AppError(404, 'Token not found');
  }

  await tokenService.revokeToken(token.id);

  // Log token revocation
  await auditService.log(
    req.user.userId,
    req.user.role,
    getClientIp(req),
    'token_revoked',
    'token',
    token.id,
    {}
  );

  res.json({
    message: 'Token revoked successfully',
  });
};


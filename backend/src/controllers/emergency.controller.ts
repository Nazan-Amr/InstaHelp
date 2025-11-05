import { Response } from 'express';
import { Request } from 'express';
import { tokenService } from '../services/token.service';
import { patientService } from '../services/patient.service';
import { auditService } from '../services/audit.service';
import { getClientIp } from '../middleware/auth.middleware';
import { AppError } from '../middleware/error.middleware';

/**
 * Public emergency view endpoint (no authentication required)
 * Accessible via QR code: /r/:token
 */
export const getEmergencyView = async (req: Request, res: Response): Promise<void> => {
  const { token } = req.params;

  if (!token) {
    throw new AppError(400, 'Token is required');
  }

  // Find token
  const tokenRecord = await tokenService.getTokenByToken(token);

  if (!tokenRecord) {
    throw new AppError(404, 'Invalid or revoked token');
  }

  // Update last accessed timestamp
  await tokenService.updateLastAccessed(tokenRecord.id);

  // Get public view
  const publicView = await patientService.getPublicView(tokenRecord.patient_id);

  if (!publicView) {
    throw new AppError(404, 'Patient not found');
  }

  // Log access
  await auditService.log(
    null, // Anonymous rescuer
    undefined,
    getClientIp(req),
    'emergency_view_accessed',
    'patient',
    tokenRecord.patient_id,
    { token: tokenRecord.id }
  );

  res.json({
    public_view: publicView,
  });
};


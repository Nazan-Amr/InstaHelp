import { Response } from 'express';
import { Request } from 'express';
import { deviceService } from '../services/device.service';
import { auditService } from '../services/audit.service';
import { getClientIp } from '../middleware/auth.middleware';
import { AppError } from '../middleware/error.middleware';
import { DeviceVitalsPayload } from '../types';

/**
 * Device vitals ingestion endpoint
 * POST /api/v1/devices/:deviceId/vitals
 */
export const ingestVitals = async (req: Request, res: Response): Promise<void> => {
  const { deviceId } = req.params;
  const payload = req.body as DeviceVitalsPayload;

  // Verify device exists and get patient ID
  const patientId = await deviceService.getPatientIdByDeviceId(deviceId);

  if (!patientId) {
    throw new AppError(404, 'Device not registered');
  }

  // Verify payload signature
  if (!deviceService.verifyDeviceSignature(payload)) {
    throw new AppError(401, 'Invalid device signature');
  }

  // Store vitals
  const vitals = await deviceService.storeVitals(patientId, payload);

  // Log vitals ingestion
  await auditService.log(
    null, // Device/system
    undefined,
    getClientIp(req),
    'vitals_ingested',
    'vitals',
    vitals.id,
    { deviceId, patientId }
  );

  res.json({
    message: 'Vitals stored successfully',
    vitals: {
      id: vitals.id,
      timestamp: vitals.timestamp,
    },
  });
};

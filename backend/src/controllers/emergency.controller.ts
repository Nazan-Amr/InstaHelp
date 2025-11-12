import { Response } from 'express';
import { Request } from 'express';
import { tokenService } from '../services/token.service';
import { patientService } from '../services/patient.service';
import { auditService } from '../services/audit.service';
import { getClientIp } from '../middleware/auth.middleware';
import { AppError } from '../middleware/error.middleware';
import { UserRole } from '../types';
import { supabase } from '../config/database';

/**
 * Public emergency view endpoint (no authentication required)
 * Accessible via QR code: /r/:token
 * 
 * Query params:
 * - full=true&auth_token=<jwt> : For doctors/owners to access full medical records
 */
export const getEmergencyView = async (req: Request, res: Response): Promise<void> => {
  const { token } = req.params;
  const { full } = req.query;
  const authToken = req.headers.authorization?.split(' ')[1];

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

  let fullData = null;

  // Check if requesting full data with authentication
  if (full === 'true' && authToken) {
    try {
      // Verify JWT and get user info
      const { data, error } = await supabase.auth.getUser(authToken);
      
      if (!error && data.user) {
        // Get user role from database
        const { data: userData } = await supabase
          .from('users')
          .select('role, id')
          .eq('id', data.user.id)
          .single();

        if (userData) {
          const userRole = userData.role as UserRole;
          const userId = userData.id;

          // Get patient data to check if owner
          const { data: patientData } = await supabase
            .from('patients')
            .select('user_id')
            .eq('id', tokenRecord.patient_id)
            .single();

          const isOwner = patientData?.user_id === userId;
          const isDoctor = userRole === UserRole.DOCTOR;
          const isAdmin = userRole === UserRole.ADMIN;

          // Allow full data access for: patient owner, verified doctors, or admins
          if (isOwner || isDoctor || isAdmin) {
            // Decrypt private profile
            const patient = await patientService.getPatientWithDecryption(
              tokenRecord.patient_id,
              authToken
            );

            if (patient) {
              fullData = {
                patient_id: patient.id,
                private_profile: patient.privateProfile,
                chronic_conditions: patient.chronicConditions,
                surgeries: patient.surgeries,
                medications: patient.medications,
                immunizations: patient.immunizations,
              };

              // Log access to full data
              await auditService.log(
                userId,
                userRole,
                getClientIp(req),
                'full_medical_view_accessed',
                'patient',
                tokenRecord.patient_id,
                { token: tokenRecord.id, user_role: userRole }
              );
            }
          }
        }
      }
    } catch (error) {
      // If auth verification fails, just return public view
      console.error('Auth verification failed:', error);
    }
  }

  // Log public access
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
    full_data: fullData, // null if not authenticated or not authorized
    is_authenticated: fullData !== null,
  });
};


import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { supabase } from '../config/database';
import { patientService } from '../services/patient.service';
import { AppError } from '../middleware/error.middleware';
import { UserRole } from '../types';

/**
 * Get all patients (for doctors)
 */
export const getAllPatients = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError(401, 'Unauthorized');
  }

  if (req.user.role !== UserRole.DOCTOR && req.user.role !== UserRole.ADMIN) {
    throw new AppError(403, 'Only doctors can view all patients');
  }

  // Get all patients
  const { data: patients, error } = await supabase
    .from('patients')
    .select('id, user_id, public_view, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (error) {
    throw new AppError(500, 'Failed to fetch patients');
  }

  // Get user emails for each patient
  const formattedPatients = await Promise.all(
    (patients || []).map(async (patient: any) => {
      const { data: userData } = await supabase
        .from('users')
        .select('email')
        .eq('id', patient.user_id)
        .single();

      return {
        id: patient.id,
        user_id: patient.user_id,
        email: userData?.email || 'Unknown',
        public_view: patient.public_view,
        created_at: patient.created_at,
        updated_at: patient.updated_at,
      };
    })
  );

  res.json({
    patients: formattedPatients,
  });
};

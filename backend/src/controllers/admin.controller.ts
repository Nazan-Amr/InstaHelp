import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { supabase } from '../config/database';
import { authService } from '../services/auth.service';
import { auditService } from '../services/audit.service';
import { getClientIp } from '../middleware/auth.middleware';
import { AppError } from '../middleware/error.middleware';
import { UserRole } from '../types';

export const verifyDoctor = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError(401, 'Unauthorized');
  }

  if (req.user.role !== UserRole.ADMIN) {
    throw new AppError(403, 'Only admins can verify doctors');
  }

  const { doctorId } = req.params;

  // Verify doctor
  const { data: doctor, error } = await supabase
    .from('users')
    .update({
      is_doctor_verified: true,
      verified_by: req.user.userId,
      verified_at: new Date().toISOString(),
    })
    .eq('id', doctorId)
    .eq('role', UserRole.DOCTOR)
    .select()
    .single();

  if (error || !doctor) {
    throw new AppError(404, 'Doctor not found');
  }

  // Log verification
  await auditService.log(
    req.user.userId,
    req.user.role,
    getClientIp(req),
    'doctor_verified',
    'user',
    doctorId,
    {}
  );

  res.json({
    message: 'Doctor verified successfully',
    doctor: {
      id: doctor.id,
      email: doctor.email,
      is_doctor_verified: doctor.is_doctor_verified,
    },
  });
};

export const getUnverifiedDoctors = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError(401, 'Unauthorized');
  }

  if (req.user.role !== UserRole.ADMIN) {
    throw new AppError(403, 'Only admins can view unverified doctors');
  }

  const { data: doctors, error } = await supabase
    .from('users')
    .select('id, email, license_number, license_file_path, created_at')
    .eq('role', UserRole.DOCTOR)
    .eq('is_doctor_verified', false)
    .order('created_at', { ascending: false });

  if (error) {
    throw new AppError(500, 'Failed to fetch unverified doctors');
  }

  res.json({
    doctors: doctors || [],
  });
};

export const getAuditLogs = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError(401, 'Unauthorized');
  }

  if (req.user.role !== UserRole.ADMIN) {
    throw new AppError(403, 'Only admins can view audit logs');
  }

  const { actorId, resourceType, resourceId, action, limit, offset } = req.query;

  const logs = await auditService.getAuditLogs({
    actorId: actorId as string | undefined,
    resourceType: resourceType as string | undefined,
    resourceId: resourceId as string | undefined,
    action: action as string | undefined,
    limit: limit ? parseInt(limit as string, 10) : undefined,
    offset: offset ? parseInt(offset as string, 10) : undefined,
  });

  res.json({
    logs,
  });
};

export const getVerifiedDoctors = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError(401, 'Unauthorized');
  }

  if (req.user.role !== UserRole.ADMIN) {
    throw new AppError(403, 'Only admins can view verified doctors');
  }

  const { data: doctors, error } = await supabase
    .from('users')
    .select('id, email, license_number, license_file_path, created_at, verified_at')
    .eq('role', UserRole.DOCTOR)
    .eq('is_doctor_verified', true)
    .order('verified_at', { ascending: false });

  if (error) {
    throw new AppError(500, 'Failed to fetch verified doctors');
  }

  res.json({
    doctors: doctors || [],
  });
};

export const getAllPatients = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError(401, 'Unauthorized');
  }

  if (req.user.role !== UserRole.ADMIN) {
    throw new AppError(403, 'Only admins can view all patients');
  }

  const { data: patients, error } = await supabase
    .from('patients')
    .select('id, user_id, public_view, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    throw new AppError(500, 'Failed to fetch patients');
  }

  res.json({
    patients: patients || [],
  });
};

export const getAllUsers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError(401, 'Unauthorized');
  }

  if (req.user.role !== UserRole.ADMIN) {
    throw new AppError(403, 'Only admins can view all users');
  }

  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, role, is_verified, is_doctor_verified, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    throw new AppError(500, 'Failed to fetch users');
  }

  res.json({
    users: users || [],
  });
};

export const getAllTokens = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError(401, 'Unauthorized');
  }

  if (req.user.role !== UserRole.ADMIN) {
    throw new AppError(403, 'Only admins can view all tokens');
  }

  const { data: tokens, error } = await supabase
    .from('tokens')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new AppError(500, 'Failed to fetch tokens');
  }

  res.json({
    tokens: tokens || [],
  });
};

export const revokeToken = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError(401, 'Unauthorized');
  }

  if (req.user.role !== UserRole.ADMIN) {
    throw new AppError(403, 'Only admins can revoke tokens');
  }

  const { tokenId } = req.params;

  const { error } = await supabase
    .from('tokens')
    .update({
      revoked_at: new Date().toISOString(),
    })
    .eq('id', tokenId);

  if (error) {
    throw new AppError(500, 'Failed to revoke token');
  }

  await auditService.log(
    req.user.userId,
    req.user.role,
    getClientIp(req),
    'token_revoked_by_admin',
    'token',
    tokenId,
    {}
  );

  res.json({
    message: 'Token revoked successfully',
  });
};

export const getAllPendingChanges = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError(401, 'Unauthorized');
  }

  if (req.user.role !== UserRole.ADMIN) {
    throw new AppError(403, 'Only admins can view all pending changes');
  }

  const { data: changes, error } = await supabase
    .from('pending_changes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new AppError(500, 'Failed to fetch pending changes');
  }

  // Enhance with approval status (same logic as pending-change controller)
  const enhancedChanges = (changes || []).map((change: any) => {
    const approvals = change.approvals || [];
    const ownerApprovals = approvals.filter((a: any) => a.user_role === 'owner').length;
    const doctorApprovals = approvals.filter((a: any) => a.user_role === 'doctor').length;
    
    let requiredOwners = 0;
    let requiredDoctors = 0;
    let approvalStatus = '';
    
    if (change.initiated_by_role === 'owner') {
      requiredOwners = 0;
      requiredDoctors = 2;
      approvalStatus = `Waiting for ${requiredDoctors - doctorApprovals} more doctor approval${requiredDoctors - doctorApprovals !== 1 ? 's' : ''}`;
    } else if (change.initiated_by_role === 'doctor') {
      requiredOwners = 1;
      requiredDoctors = 1;
      const needsOwner = ownerApprovals < requiredOwners;
      const needsDoctor = doctorApprovals < requiredDoctors;
      if (needsOwner && needsDoctor) {
        approvalStatus = 'Waiting for owner approval and 1 doctor approval';
      } else if (needsOwner) {
        approvalStatus = 'Waiting for owner approval';
      } else if (needsDoctor) {
        approvalStatus = 'Waiting for 1 doctor approval';
      }
    }
    
    if (change.status === 'finalized') {
      approvalStatus = 'Finalized';
    } else if (change.status === 'rejected') {
      approvalStatus = 'Rejected';
    } else if (ownerApprovals >= requiredOwners && doctorApprovals >= requiredDoctors) {
      approvalStatus = 'Ready to finalize (all approvals received)';
    }

    return {
      ...change,
      approvalStatus,
      requiredOwners,
      requiredDoctors,
      currentOwnerApprovals: ownerApprovals,
      currentDoctorApprovals: doctorApprovals,
    };
  });

  res.json({
    changes: enhancedChanges,
  });
};

export const deleteUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError(401, 'Unauthorized');
  }

  if (req.user.role !== UserRole.ADMIN) {
    throw new AppError(403, 'Only admins can delete users');
  }

  const { userId } = req.params;

  if (userId === req.user.userId) {
    throw new AppError(400, 'Cannot delete your own account');
  }

  const { error } = await supabase.from('users').delete().eq('id', userId);

  if (error) {
    throw new AppError(500, 'Failed to delete user');
  }

  await auditService.log(
    req.user.userId,
    req.user.role,
    getClientIp(req),
    'user_deleted_by_admin',
    'user',
    userId,
    {}
  );

  res.json({
    message: 'User deleted successfully',
  });
};

export const deletePatient = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError(401, 'Unauthorized');
  }

  if (req.user.role !== UserRole.ADMIN) {
    throw new AppError(403, 'Only admins can delete patients');
  }

  const { patientId } = req.params;

  const { error } = await supabase.from('patients').delete().eq('id', patientId);

  if (error) {
    throw new AppError(500, 'Failed to delete patient');
  }

  await auditService.log(
    req.user.userId,
    req.user.role,
    getClientIp(req),
    'patient_deleted_by_admin',
    'patient',
    patientId,
    {}
  );

  res.json({
    message: 'Patient deleted successfully',
  });
};


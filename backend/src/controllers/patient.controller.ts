import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { patientService } from '../services/patient.service';
import { approvalService } from '../services/approval.service';
import { auditService } from '../services/audit.service';
import { getClientIp } from '../middleware/auth.middleware';
import { AppError } from '../middleware/error.middleware';
import { UserRole } from '../types';

export const getMyProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError(401, 'Unauthorized');
  }

  const patient = await patientService.getPatientByUserId(req.user.userId);

  if (!patient) {
    // Return a message indicating patient profile needs to be created
    res.json({
      message: 'Patient profile not found. Please initialize your profile.',
      needsInitialization: true,
      patient: null,
    });
    return;
  }

  const publicView = patient.public_view;
  const privateProfile = await patientService.getPrivateProfile(patient.id);

  res.json({
    patient: {
      id: patient.id,
      public_view: publicView,
      private_profile: privateProfile,
    },
  });
};

export const initializeProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError(401, 'Unauthorized');
  }

  if (req.user.role !== UserRole.OWNER) {
    throw new AppError(403, 'Only owners can initialize patient profiles');
  }

  // Check if patient already exists
  const existingPatient = await patientService.getPatientByUserId(req.user.userId);
  if (existingPatient) {
    throw new AppError(400, 'Patient profile already exists');
  }

  const {
    blood_type,
    allergies,
    emergency_contact,
    short_instructions,
    national_id,
    full_medical_history,
    medications,
    doctor_notes,
  } = req.body;

  // Validate required fields
  if (!blood_type || !emergency_contact || !short_instructions) {
    throw new AppError(400, 'blood_type, emergency_contact, and short_instructions are required');
  }

  // Create public view
  const publicView = {
    blood_type,
    allergies: allergies || [],
    emergency_contact: {
      name: emergency_contact.name,
      phone: emergency_contact.phone,
      relationship: emergency_contact.relationship || 'Emergency Contact',
    },
    short_instructions,
  };

  // Create private profile
  const privateProfile = {
    national_id: national_id || '',
    full_medical_history: full_medical_history || '',
    medications: medications || [],
    doctor_notes: doctor_notes || '',
    scanned_files: [],
  };

  // Create patient record
  const patient = await patientService.createPatient(req.user.userId, publicView, privateProfile);

  // Log profile initialization
  await auditService.log(
    req.user.userId,
    req.user.role,
    getClientIp(req),
    'patient_profile_initialized',
    'patient',
    patient.id,
    {}
  );

  res.status(201).json({
    message: 'Patient profile created successfully',
    patient: {
      id: patient.id,
      public_view: publicView,
    },
  });
};

export const getPublicView = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError(401, 'Unauthorized');
  }

  const patient = await patientService.getPatientByUserId(req.user.userId);

  if (!patient) {
    throw new AppError(404, 'Patient record not found');
  }

  res.json({
    public_view: patient.public_view,
  });
};

export const getEmergencyView = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { token } = req.params;

  if (!token) {
    throw new AppError(400, 'Token is required');
  }

  // Token lookup will be handled by middleware
  // This endpoint should be accessible without authentication
  res.json({
    error: 'Token lookup middleware needed',
  });
};

export const createPendingChange = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError(401, 'Unauthorized');
  }

  const { patientId, changeType, fieldPath, newValue } = req.body;

  if (!patientId || !changeType || !fieldPath || newValue === undefined) {
    throw new AppError(400, 'patientId, changeType, fieldPath, and newValue are required');
  }

  // Verify patient ownership or doctor access
  const patient = await patientService.getPatientById(patientId);
  if (!patient) {
    throw new AppError(404, 'Patient not found');
  }

  if (req.user.role !== UserRole.OWNER && req.user.role !== UserRole.DOCTOR && req.user.role !== UserRole.ADMIN) {
    throw new AppError(403, 'Only owners and doctors can create pending changes');
  }

  if (req.user.role === UserRole.OWNER && patient.user_id !== req.user.userId) {
    throw new AppError(403, 'You can only edit your own patient record');
  }

  // Get old value
  let oldValue: any;
  if (changeType === 'public_view') {
    const publicView = patient.public_view;
    oldValue = getNestedValue(publicView, fieldPath.replace('public_view.', ''));
  } else {
    const privateProfile = await patientService.getPrivateProfile(patientId);
    if (!privateProfile) {
      throw new AppError(404, 'Private profile not found');
    }
    oldValue = getNestedValue(privateProfile, fieldPath.replace('private_profile.', ''));
  }

  const change = await approvalService.createPendingChange(
    patientId,
    req.user.userId,
    req.user.role,
    changeType,
    fieldPath,
    oldValue,
    newValue
  );

  // Log change creation
  await auditService.log(
    req.user.userId,
    req.user.role,
    getClientIp(req),
    'pending_change_created',
    'pending_change',
    change.id,
    { changeType, fieldPath }
  );

  res.status(201).json({
    message: 'Pending change created',
    change,
  });
};

function getNestedValue(obj: any, path: string): any {
  const keys = path.split('.');
  let current = obj;
  for (const key of keys) {
    if (current === undefined || current === null) {
      return undefined;
    }
    current = current[key];
  }
  return current;
}


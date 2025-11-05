export enum UserRole {
  OWNER = 'owner',
  DOCTOR = 'doctor',
  ADMIN = 'admin',
  RESCUER = 'rescuer', // Anonymous public access
}

export enum ChangeStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  FINALIZED = 'finalized',
}

export interface User {
  id: string;
  email: string;
  password_hash: string;
  role: UserRole;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
  // Doctor-specific fields
  license_number?: string;
  license_file_path?: string;
  is_doctor_verified?: boolean;
  verified_by?: string; // Admin user ID
  verified_at?: string;
}

export interface Patient {
  id: string;
  user_id: string; // Owner user ID
  // Public view fields (unencrypted)
  public_view: {
    blood_type: string;
    allergies: string[];
    emergency_contact: {
      name: string;
      phone: string;
      relationship: string;
    };
    short_instructions: string;
    last_vitals?: {
      timestamp: string;
      heart_rate?: number;
      temperature?: number;
    };
  };
  // Private profile (encrypted)
  private_profile_encrypted: string; // AES-256-GCM encrypted JSON
  encryption_key_wrapped: string; // RSA-wrapped AES key
  created_at: string;
  updated_at: string;
}

export interface PrivateProfile {
  national_id: string;
  full_medical_history: string;
  medications: string[];
  doctor_notes: string;
  scanned_files: Array<{
    file_path: string;
    file_name: string;
    uploaded_at: string;
    uploaded_by: string;
  }>;
}

export interface PendingChange {
  id: string;
  patient_id: string;
  initiated_by: string; // User ID
  initiated_by_role: UserRole;
  change_type: 'public_view' | 'private_profile';
  field_path: string; // e.g., "public_view.blood_type" or "private_profile.medications"
  old_value: any;
  new_value: any;
  status: ChangeStatus;
  approvals: Array<{
    user_id: string;
    user_role: UserRole;
    approved_at: string;
    comment?: string;
  }>;
  rejections: Array<{
    user_id: string;
    user_role: UserRole;
    rejected_at: string;
    reason?: string;
  }>;
  created_at: string;
  updated_at: string;
  finalized_at?: string;
}

export interface Token {
  id: string;
  patient_id: string;
  token: string; // Base62 encoded 128-bit token
  version: number;
  created_at: string;
  revoked_at?: string;
  last_accessed_at?: string;
}

export interface Vitals {
  id: string;
  patient_id: string;
  device_id: string;
  timestamp: string;
  heart_rate?: number;
  temperature?: number;
  additional_data?: Record<string, any>;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id?: string; // User ID or null for anonymous
  actor_role?: UserRole;
  actor_ip?: string;
  action: string;
  resource_type: string; // 'patient', 'token', 'pending_change', etc.
  resource_id: string;
  details: Record<string, any>;
  timestamp: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface DeviceVitalsPayload {
  device_id: string;
  timestamp: string;
  hr?: number;
  temp?: number;
  signature: string;
  [key: string]: any;
}


import { approvalService } from './approval.service';
import { UserRole, ChangeStatus } from '../types';

// Mock Supabase
jest.mock('../config/database', () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: {}, error: null })),
        })),
      })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
        in: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: {}, error: null })),
      })),
    })),
  },
}));

// Mock patient service
jest.mock('./patient.service', () => ({
  patientService: {
    getPatientById: jest.fn(),
    getPrivateProfile: jest.fn(),
    updatePublicView: jest.fn(),
    updatePrivateProfile: jest.fn(),
  },
}));

// Mock email service
jest.mock('./email.service', () => ({
  emailService: {
    sendApprovalRequest: jest.fn(),
  },
}));

describe('ApprovalService', () => {
  describe('getRequiredApprovals', () => {
    it('should require 2 doctors for owner-initiated changes', () => {
      const change = {
        id: '1',
        patient_id: 'patient-1',
        initiated_by: 'owner-1',
        initiated_by_role: UserRole.OWNER,
        change_type: 'public_view' as const,
        field_path: 'blood_type',
        old_value: 'O+',
        new_value: 'A+',
        status: ChangeStatus.PENDING,
        approvals: [],
        rejections: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Access private method via type assertion (for testing)
      const required = (approvalService as any).getRequiredApprovals(change);
      expect(required).toEqual({ owners: 0, doctors: 2 });
    });

    it('should require owner + 1 doctor for doctor-initiated changes', () => {
      const change = {
        id: '1',
        patient_id: 'patient-1',
        initiated_by: 'doctor-1',
        initiated_by_role: UserRole.DOCTOR,
        change_type: 'private_profile' as const,
        field_path: 'medications',
        old_value: [],
        new_value: ['New medication'],
        status: ChangeStatus.PENDING,
        approvals: [],
        rejections: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const required = (approvalService as any).getRequiredApprovals(change);
      expect(required).toEqual({ owners: 1, doctors: 1 });
    });
  });
});


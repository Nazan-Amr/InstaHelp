import { supabase } from '../config/database';
import { PendingChange, ChangeStatus, UserRole, User } from '../types';
import { patientService } from './patient.service';
import { emailService } from './email.service';
import { authService } from './auth.service';
import logger from '../utils/logger';

class ApprovalService {
  /**
   * Create a pending change
   */
  async createPendingChange(
    patientId: string,
    initiatedBy: string,
    initiatedByRole: UserRole,
    changeType: 'public_view' | 'private_profile',
    fieldPath: string,
    oldValue: any,
    newValue: any
  ): Promise<PendingChange> {
    const { data, error } = await supabase
      .from('pending_changes')
      .insert({
        patient_id: patientId,
        initiated_by: initiatedBy,
        initiated_by_role: initiatedByRole,
        change_type: changeType,
        field_path: fieldPath,
        old_value: oldValue,
        new_value: newValue,
        status: ChangeStatus.PENDING,
        approvals: [],
        rejections: [],
      })
      .select()
      .single();

    if (error || !data) {
      logger.error({ error, patientId, initiatedBy }, 'Failed to create pending change');
      throw new Error('Failed to create pending change');
    }

    const change = this.mapPendingChangeFromDB(data);

    // Notify required approvers
    await this.notifyApprovers(change);

    logger.info({ changeId: change.id, patientId }, 'Pending change created');

    return change;
  }

  /**
   * Get pending change by ID
   */
  async getPendingChangeById(changeId: string): Promise<PendingChange | null> {
    const { data, error } = await supabase
      .from('pending_changes')
      .select('*')
      .eq('id', changeId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapPendingChangeFromDB(data);
  }

  /**
   * Get pending changes for a patient
   */
  async getPendingChangesByPatientId(patientId: string): Promise<PendingChange[]> {
    const { data, error } = await supabase
      .from('pending_changes')
      .select('*')
      .eq('patient_id', patientId)
      .in('status', [ChangeStatus.PENDING, ChangeStatus.APPROVED])
      .order('created_at', { ascending: false });

    if (error) {
      logger.error({ error, patientId }, 'Failed to get pending changes');
      return [];
    }

    return (data || []).map((change) => this.mapPendingChangeFromDB(change));
  }

  /**
   * Get pending changes requiring approval by a user
   */
  async getPendingChangesForApproval(userId: string, userRole: UserRole): Promise<PendingChange[]> {
    // Get patient ID if user is owner
    let patientId: string | null = null;
    if (userRole === UserRole.OWNER) {
      const patient = await patientService.getPatientByUserId(userId);
      patientId = patient?.id || null;
    }

    // Get all pending changes
    const { data, error } = await supabase
      .from('pending_changes')
      .select('*')
      .in('status', [ChangeStatus.PENDING, ChangeStatus.APPROVED])
      .order('created_at', { ascending: false });

    if (error) {
      logger.error({ error, userId }, 'Failed to get pending changes for approval');
      return [];
    }

    // Filter changes that require approval from this user
    const changes = (data || []).map((change) => this.mapPendingChangeFromDB(change));
    return changes.filter((change) => this.requiresApprovalFrom(change, userId, userRole, patientId));
  }

  /**
   * Approve a pending change
   */
  async approveChange(changeId: string, userId: string, userRole: UserRole, comment?: string): Promise<void> {
    const change = await this.getPendingChangeById(changeId);
    if (!change) {
      throw new Error('Pending change not found');
    }

    // Check if already finalized or rejected
    if (change.status === ChangeStatus.FINALIZED || change.status === ChangeStatus.REJECTED) {
      throw new Error('Change is already finalized or rejected');
    }

    // Check if user already approved
    const alreadyApproved = change.approvals.some((approval) => approval.user_id === userId);
    if (alreadyApproved) {
      throw new Error('You have already approved this change');
    }

    // Check if user already rejected
    const alreadyRejected = change.rejections.some((rejection) => rejection.user_id === userId);
    if (alreadyRejected) {
      throw new Error('You have already rejected this change');
    }

    // Add approval
    const newApproval = {
      user_id: userId,
      user_role: userRole,
      approved_at: new Date().toISOString(),
      comment: comment || null,
    };

    const updatedApprovals = [...change.approvals, newApproval];

    // Check if we have enough approvals to finalize
    const requiredApprovals = this.getRequiredApprovals(change);
    const hasEnoughApprovals = this.checkApprovalRequirements(change, updatedApprovals);

    let newStatus = change.status;
    if (hasEnoughApprovals) {
      newStatus = ChangeStatus.APPROVED; // Ready to finalize
    }

    // Update change
    const { error } = await supabase
      .from('pending_changes')
      .update({
        approvals: updatedApprovals,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', changeId);

    if (error) {
      logger.error({ error, changeId, userId }, 'Failed to approve change');
      throw new Error('Failed to approve change');
    }

    logger.info({ changeId, userId, userRole, hasEnoughApprovals }, 'Change approved');

    // If we have enough approvals, finalize the change
    if (hasEnoughApprovals) {
      await this.finalizeChange(changeId);
    }
  }

  /**
   * Reject a pending change
   */
  async rejectChange(changeId: string, userId: string, userRole: UserRole, reason?: string): Promise<void> {
    const change = await this.getPendingChangeById(changeId);
    if (!change) {
      throw new Error('Pending change not found');
    }

    // Check if already finalized
    if (change.status === ChangeStatus.FINALIZED) {
      throw new Error('Change is already finalized');
    }

    // Add rejection
    const newRejection = {
      user_id: userId,
      user_role: userRole,
      rejected_at: new Date().toISOString(),
      reason: reason || null,
    };

    const updatedRejections = [...change.rejections, newRejection];

    // Update change status to rejected
    const { error } = await supabase
      .from('pending_changes')
      .update({
        rejections: updatedRejections,
        status: ChangeStatus.REJECTED,
        updated_at: new Date().toISOString(),
      })
      .eq('id', changeId);

    if (error) {
      logger.error({ error, changeId, userId }, 'Failed to reject change');
      throw new Error('Failed to reject change');
    }

    logger.info({ changeId, userId, userRole }, 'Change rejected');
  }

  /**
   * Finalize a change (apply it to the patient record)
   */
  async finalizeChange(changeId: string): Promise<void> {
    const change = await this.getPendingChangeById(changeId);
    if (!change) {
      throw new Error('Pending change not found');
    }

    if (change.status === ChangeStatus.FINALIZED) {
      return; // Already finalized
    }

    const patient = await patientService.getPatientById(change.patient_id);
    if (!patient) {
      throw new Error('Patient not found');
    }

    // Apply the change based on change_type
    if (change.change_type === 'public_view') {
      const publicView = { ...patient.public_view };
      this.setNestedValue(publicView, change.field_path.replace('public_view.', ''), change.new_value);
      await patientService.updatePublicView(change.patient_id, publicView);
    } else if (change.change_type === 'private_profile') {
      const privateProfile = await patientService.getPrivateProfile(change.patient_id);
      if (!privateProfile) {
        throw new Error('Private profile not found');
      }
      this.setNestedValue(privateProfile, change.field_path.replace('private_profile.', ''), change.new_value);
      await patientService.updatePrivateProfile(change.patient_id, privateProfile);
    }

    // Mark as finalized
    const { error } = await supabase
      .from('pending_changes')
      .update({
        status: ChangeStatus.FINALIZED,
        finalized_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', changeId);

    if (error) {
      logger.error({ error, changeId }, 'Failed to finalize change');
      throw new Error('Failed to finalize change');
    }

    logger.info({ changeId, patientId: change.patient_id }, 'Change finalized');
  }

  /**
   * Get required approvals based on change initiator
   * All changes require dual approval:
   * - Owner-initiated: requires 2 doctors
   * - Doctor-initiated: requires owner + 1 doctor
   */
  private getRequiredApprovals(change: PendingChange): { owners: number; doctors: number } {
    if (change.initiated_by_role === UserRole.OWNER) {
      return { owners: 0, doctors: 2 };
    } else if (change.initiated_by_role === UserRole.DOCTOR) {
      return { owners: 1, doctors: 1 };
    }
    return { owners: 0, doctors: 0 };
  }

  /**
   * Check if change has enough approvals
   */
  private checkApprovalRequirements(change: PendingChange, approvals: PendingChange['approvals']): boolean {
    const required = this.getRequiredApprovals(change);
    const ownerApprovals = approvals.filter((a) => a.user_role === UserRole.OWNER).length;
    const doctorApprovals = approvals.filter((a) => a.user_role === UserRole.DOCTOR).length;

    return ownerApprovals >= required.owners && doctorApprovals >= required.doctors;
  }

  /**
   * Check if a change requires approval from a specific user
   */
  private requiresApprovalFrom(
    change: PendingChange,
    userId: string,
    userRole: UserRole,
    patientId: string | null
  ): boolean {
    // Check if already approved by this user
    const alreadyApproved = change.approvals.some((a) => a.user_id === userId);
    if (alreadyApproved) {
      return false;
    }

    // Check if already rejected by this user
    const alreadyRejected = change.rejections.some((r) => r.user_id === userId);
    if (alreadyRejected) {
      return false;
    }

    const required = this.getRequiredApprovals(change);

    // Owner can approve doctor-initiated changes
    if (userRole === UserRole.OWNER && required.owners > 0) {
      // Check if this owner owns the patient
      return change.patient_id === patientId;
    }

    // Doctor can approve any change (owner or doctor-initiated)
    if (userRole === UserRole.DOCTOR && required.doctors > 0) {
      return true;
    }

    return false;
  }

  /**
   * Notify approvers about a new pending change
   */
  private async notifyApprovers(change: PendingChange): Promise<void> {
    const required = this.getRequiredApprovals(change);
    const patient = await patientService.getPatientById(change.patient_id);
    if (!patient) {
      return;
    }

    // Get owner email
    if (required.owners > 0) {
      const { data: owner } = await supabase
        .from('users')
        .select('email')
        .eq('id', patient.user_id)
        .single();

      if (owner) {
        await emailService.sendApprovalRequest(
          owner.email,
          `Change to ${change.field_path}: ${JSON.stringify(change.new_value)}`
        );
      }
    }

    // Get verified doctors
    if (required.doctors > 0) {
      const { data: doctors } = await supabase
        .from('users')
        .select('email')
        .eq('role', UserRole.DOCTOR)
        .eq('is_doctor_verified', true)
        .eq('is_verified', true);

      if (doctors) {
        for (const doctor of doctors) {
          await emailService.sendApprovalRequest(
            doctor.email,
            `Change to ${change.field_path}: ${JSON.stringify(change.new_value)}`
          );
        }
      }
    }
  }

  /**
   * Set nested value in object using dot notation path
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
  }

  /**
   * Map database pending change to PendingChange type
   */
  private mapPendingChangeFromDB(dbChange: any): PendingChange {
    return {
      id: dbChange.id,
      patient_id: dbChange.patient_id,
      initiated_by: dbChange.initiated_by,
      initiated_by_role: dbChange.initiated_by_role as UserRole,
      change_type: dbChange.change_type,
      field_path: dbChange.field_path,
      old_value: dbChange.old_value,
      new_value: dbChange.new_value,
      status: dbChange.status as ChangeStatus,
      approvals: dbChange.approvals || [],
      rejections: dbChange.rejections || [],
      created_at: dbChange.created_at,
      updated_at: dbChange.updated_at,
      finalized_at: dbChange.finalized_at,
    };
  }
}

export const approvalService = new ApprovalService();


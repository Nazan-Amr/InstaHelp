import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { approvalService } from '../services/approval.service';
import { auditService } from '../services/audit.service';
import { getClientIp } from '../middleware/auth.middleware';
import { AppError } from '../middleware/error.middleware';
import { supabase } from '../config/database';

export const getPendingChanges = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  if (!req.user) {
    throw new AppError(401, 'Unauthorized');
  }

  // Get changes requiring approval from this user
  const changesForApproval = await approvalService.getPendingChangesForApproval(
    req.user.userId,
    req.user.role
  );

  // Also get changes initiated by this user (for owners to see their own pending changes)
  let myChanges: any[] = [];
  if (req.user.role === 'owner') {
    const { data: patient } = await supabase
      .from('patients')
      .select('id')
      .eq('user_id', req.user.userId)
      .single();

    if (patient) {
      const { data: myPendingChanges } = await supabase
        .from('pending_changes')
        .select('*')
        .eq('patient_id', patient.id)
        .eq('initiated_by', req.user.userId)
        .in('status', ['pending', 'approved'])
        .order('created_at', { ascending: false });

      myChanges = (myPendingChanges || []).map((change: any) => ({
        id: change.id,
        patient_id: change.patient_id,
        initiated_by: change.initiated_by,
        initiated_by_role: change.initiated_by_role,
        change_type: change.change_type,
        field_path: change.field_path,
        old_value: change.old_value,
        new_value: change.new_value,
        status: change.status,
        approvals: change.approvals || [],
        rejections: change.rejections || [],
        created_at: change.created_at,
        updated_at: change.updated_at,
        finalized_at: change.finalized_at,
      }));
    }
  }

  // Combine and deduplicate
  const allChanges = [...changesForApproval, ...myChanges];
  const uniqueChanges = Array.from(new Map(allChanges.map(change => [change.id, change])).values());

  // Enhance changes with approval status details
  const enhancedChanges = uniqueChanges.map((change: any) => {
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

export const approveChange = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError(401, 'Unauthorized');
  }

  const { changeId } = req.params;
  const { comment } = req.body;

  try {
    await approvalService.approveChange(changeId, req.user.userId, req.user.role, comment);

    // Log approval
    await auditService.log(
      req.user.userId,
      req.user.role,
      getClientIp(req),
      'pending_change_approved',
      'pending_change',
      changeId,
      { comment }
    );

    res.json({
      message: 'Change approved successfully',
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new AppError(400, error.message);
    }
    throw error;
  }
};

export const rejectChange = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError(401, 'Unauthorized');
  }

  const { changeId } = req.params;
  const { reason } = req.body;

  try {
    await approvalService.rejectChange(changeId, req.user.userId, req.user.role, reason);

    // Log rejection
    await auditService.log(
      req.user.userId,
      req.user.role,
      getClientIp(req),
      'pending_change_rejected',
      'pending_change',
      changeId,
      { reason }
    );

    res.json({
      message: 'Change rejected successfully',
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new AppError(400, error.message);
    }
    throw error;
  }
};

import { supabase } from '../config/database';
import { AuditLog, UserRole } from '../types';
import logger from '../utils/logger';

class AuditService {
  /**
   * Log an action to audit log (append-only, immutable)
   */
  async log(
    actorId: string | null,
    actorRole: UserRole | null,
    actorIp: string | null,
    action: string,
    resourceType: string,
    resourceId: string,
    details: Record<string, any> = {}
  ): Promise<void> {
    try {
      const { error } = await supabase.from('audit_logs').insert({
        actor_id: actorId,
        actor_role: actorRole,
        actor_ip: actorIp,
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        details,
        timestamp: new Date().toISOString(),
      });

      if (error) {
        logger.error({ error, action, resourceType, resourceId }, 'Failed to write audit log');
        // Don't throw - audit logging failure shouldn't break the application
      } else {
        logger.debug({ action, resourceType, resourceId }, 'Audit log written');
      }
    } catch (error) {
      logger.error({ error }, 'Exception in audit logging');
      // Don't throw - audit logging failure shouldn't break the application
    }
  }

  /**
   * Get audit logs with filters
   */
  async getAuditLogs(
    filters: {
      actorId?: string;
      resourceType?: string;
      resourceId?: string;
      action?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<AuditLog[]> {
    let query = supabase.from('audit_logs').select('*');

    if (filters.actorId) {
      query = query.eq('actor_id', filters.actorId);
    }

    if (filters.resourceType) {
      query = query.eq('resource_type', filters.resourceType);
    }

    if (filters.resourceId) {
      query = query.eq('resource_id', filters.resourceId);
    }

    if (filters.action) {
      query = query.eq('action', filters.action);
    }

    query = query.order('timestamp', { ascending: false });

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 100) - 1);
    }

    const { data, error } = await query;

    if (error) {
      logger.error({ error, filters }, 'Failed to get audit logs');
      return [];
    }

    return (data || []).map((log) => this.mapAuditLogFromDB(log));
  }

  /**
   * Map database audit log to AuditLog type
   */
  private mapAuditLogFromDB(dbLog: any): AuditLog {
    return {
      id: dbLog.id,
      actor_id: dbLog.actor_id,
      actor_role: dbLog.actor_role as UserRole | undefined,
      actor_ip: dbLog.actor_ip,
      action: dbLog.action,
      resource_type: dbLog.resource_type,
      resource_id: dbLog.resource_id,
      details: dbLog.details || {},
      timestamp: dbLog.timestamp,
    };
  }
}

export const auditService = new AuditService();


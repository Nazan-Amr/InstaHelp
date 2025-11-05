import { supabase } from '../config/database';
import { Token } from '../types';
import { generateToken } from '../utils/token-generator';
import logger from '../utils/logger';

class TokenService {
  /**
   * Generate and create a new token for a patient
   */
  async createToken(patientId: string): Promise<Token> {
    const token = generateToken();

    const { data, error } = await supabase
      .from('tokens')
      .insert({
        patient_id: patientId,
        token,
        version: 1,
      })
      .select()
      .single();

    if (error || !data) {
      logger.error({ error, patientId }, 'Failed to create token');
      throw new Error('Failed to create token');
    }

    logger.info({ tokenId: data.id, patientId }, 'Token created');

    return this.mapTokenFromDB(data);
  }

  /**
   * Get token by token string
   */
  async getTokenByToken(tokenString: string): Promise<Token | null> {
    const { data, error } = await supabase
      .from('tokens')
      .select('*')
      .eq('token', tokenString)
      .is('revoked_at', null)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapTokenFromDB(data);
  }

  /**
   * Get token by patient ID
   */
  async getTokenByPatientId(patientId: string): Promise<Token | null> {
    const { data, error } = await supabase
      .from('tokens')
      .select('*')
      .eq('patient_id', patientId)
      .is('revoked_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapTokenFromDB(data);
  }

  /**
   * Revoke a token
   */
  async revokeToken(tokenId: string): Promise<void> {
    const { error } = await supabase
      .from('tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', tokenId);

    if (error) {
      logger.error({ error, tokenId }, 'Failed to revoke token');
      throw new Error('Failed to revoke token');
    }

    logger.info({ tokenId }, 'Token revoked');
  }

  /**
   * Rotate token (revoke old, create new)
   */
  async rotateToken(patientId: string): Promise<Token> {
    // Get current token
    const currentToken = await this.getTokenByPatientId(patientId);

    // Revoke current token if exists
    if (currentToken) {
      await this.revokeToken(currentToken.id);
    }

    // Create new token
    const newToken = await this.createToken(patientId);

    logger.info({ patientId, oldTokenId: currentToken?.id, newTokenId: newToken.id }, 'Token rotated');

    return newToken;
  }

  /**
   * Update last accessed timestamp
   */
  async updateLastAccessed(tokenId: string): Promise<void> {
    const { error } = await supabase
      .from('tokens')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('id', tokenId);

    if (error) {
      logger.warn({ error, tokenId }, 'Failed to update last accessed timestamp');
      // Don't throw - this is not critical
    }
  }

  /**
   * Map database token to Token type
   */
  private mapTokenFromDB(dbToken: any): Token {
    return {
      id: dbToken.id,
      patient_id: dbToken.patient_id,
      token: dbToken.token,
      version: dbToken.version,
      created_at: dbToken.created_at,
      revoked_at: dbToken.revoked_at,
      last_accessed_at: dbToken.last_accessed_at,
    };
  }
}

export const tokenService = new TokenService();


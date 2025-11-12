import { supabase } from '../config/database';
import { Patient, PrivateProfile, UserRole } from '../types';
import { encryptionService } from './encryption.service';
import logger from '../utils/logger';

class PatientService {
  /**
   * Create a new patient record
   */
  async createPatient(
    userId: string,
    publicView: Patient['public_view'],
    privateProfile: PrivateProfile
  ): Promise<Patient> {
    // Encrypt private profile
    const privateProfileJson = JSON.stringify(privateProfile);
    const { encryptedData, wrappedKey } = encryptionService.encryptPatientData(privateProfileJson);

    const { data: patient, error } = await supabase
      .from('patients')
      .insert({
        user_id: userId,
        public_view: publicView,
        private_profile_encrypted: encryptedData,
        encryption_key_wrapped: wrappedKey,
      })
      .select()
      .single();

    if (error || !patient) {
      logger.error({ error, userId }, 'Failed to create patient');
      throw new Error('Failed to create patient record');
    }

    logger.info({ patientId: patient.id, userId }, 'Patient created');

    return this.mapPatientFromDB(patient);
  }

  /**
   * Get patient by user ID
   */
  async getPatientByUserId(userId: string): Promise<Patient | null> {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapPatientFromDB(data);
  }

  /**
   * Get patient by ID
   */
  async getPatientById(patientId: string): Promise<Patient | null> {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('id', patientId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapPatientFromDB(data);
  }

  /**
   * Get public view (unencrypted)
   */
  async getPublicView(patientId: string): Promise<Patient['public_view'] | null> {
    const { data, error } = await supabase
      .from('patients')
      .select('public_view')
      .eq('id', patientId)
      .single();

    if (error || !data) {
      return null;
    }

    return data.public_view as Patient['public_view'];
  }

  /**
   * Get private profile (decrypted)
   */
  async getPrivateProfile(patientId: string): Promise<PrivateProfile | null> {
    const { data, error } = await supabase
      .from('patients')
      .select('private_profile_encrypted, encryption_key_wrapped')
      .eq('id', patientId)
      .single();

    if (error || !data) {
      return null;
    }

    try {
      const decrypted = encryptionService.decryptPatientData(
        data.private_profile_encrypted,
        data.encryption_key_wrapped
      );
      return JSON.parse(decrypted) as PrivateProfile;
    } catch (error) {
      logger.error({ error, patientId }, 'Failed to decrypt private profile');
      throw new Error('Failed to decrypt patient data');
    }
  }

  /**
   * Update public view (after approval)
   */
  async updatePublicView(patientId: string, publicView: Patient['public_view']): Promise<void> {
    const { error } = await supabase
      .from('patients')
      .update({ public_view: publicView })
      .eq('id', patientId);

    if (error) {
      logger.error({ error, patientId }, 'Failed to update public view');
      throw new Error('Failed to update public view');
    }
  }

  /**
   * Update private profile (after approval)
   */
  async updatePrivateProfile(patientId: string, privateProfile: PrivateProfile): Promise<void> {
    // Re-encrypt with new data
    const privateProfileJson = JSON.stringify(privateProfile);
    const { encryptedData, wrappedKey } = encryptionService.encryptPatientData(privateProfileJson);

    const { error } = await supabase
      .from('patients')
      .update({
        private_profile_encrypted: encryptedData,
        encryption_key_wrapped: wrappedKey,
      })
      .eq('id', patientId);

    if (error) {
      logger.error({ error, patientId }, 'Failed to update private profile');
      throw new Error('Failed to update private profile');
    }
  }

  /**
   * Update last vitals timestamp in public view
   */
  async updateLastVitals(
    patientId: string,
    vitals: { timestamp: string; heart_rate?: number; temperature?: number }
  ): Promise<void> {
    const patient = await this.getPatientById(patientId);
    if (!patient) {
      throw new Error('Patient not found');
    }

    const updatedPublicView = {
      ...patient.public_view,
      last_vitals: vitals,
    };

    await this.updatePublicView(patientId, updatedPublicView);
  }

  /**
   * Map database patient to Patient type
   */
  private mapPatientFromDB(dbPatient: any): Patient {
    return {
      id: dbPatient.id,
      user_id: dbPatient.user_id,
      public_view: dbPatient.public_view,
      private_profile_encrypted: dbPatient.private_profile_encrypted,
      encryption_key_wrapped: dbPatient.encryption_key_wrapped,
      created_at: dbPatient.created_at,
      updated_at: dbPatient.updated_at,
    };
  }
}

export const patientService = new PatientService();

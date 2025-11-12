import { supabase } from '../config/database';
import { Vitals, DeviceVitalsPayload } from '../types';
import { config } from '../config/env';
import { encryptionService } from './encryption.service';
import { patientService } from './patient.service';
import logger from '../utils/logger';

class DeviceService {
  /**
   * Register a device for a patient
   */
  async registerDevice(patientId: string, deviceId: string, deviceSecret: string): Promise<void> {
    // Hash the device secret (in production, use proper key derivation)
    const deviceSecretHash = encryptionService.generateHMAC(deviceSecret, config.device.hmacSecret);

    const { error } = await supabase.from('device_registrations').insert({
      patient_id: patientId,
      device_id: deviceId,
      device_secret_hash: deviceSecretHash,
      last_seen_at: new Date().toISOString(),
    });

    if (error) {
      logger.error({ error, patientId, deviceId }, 'Failed to register device');
      throw new Error('Failed to register device');
    }

    logger.info({ patientId, deviceId }, 'Device registered');
  }

  /**
   * Get patient ID by device ID
   */
  async getPatientIdByDeviceId(deviceId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('device_registrations')
      .select('patient_id')
      .eq('device_id', deviceId)
      .single();

    if (error || !data) {
      return null;
    }

    return data.patient_id;
  }

  /**
   * Verify device HMAC signature
   */
  verifyDeviceSignature(payload: DeviceVitalsPayload): boolean {
    // Extract signature from payload
    const { signature, ...payloadWithoutSig } = payload;

    // Create payload string for signing (excluding signature)
    const payloadString = JSON.stringify(payloadWithoutSig, Object.keys(payloadWithoutSig).sort());

    // Verify HMAC
    return encryptionService.verifyHMAC(payloadString, signature, config.device.hmacSecret);
  }

  /**
   * Store vitals from device
   */
  async storeVitals(patientId: string, payload: DeviceVitalsPayload): Promise<Vitals> {
    // Verify signature
    if (!this.verifyDeviceSignature(payload)) {
      throw new Error('Invalid device signature');
    }

    // Store vitals
    const { data, error } = await supabase
      .from('vitals')
      .insert({
        patient_id: patientId,
        device_id: payload.device_id,
        timestamp: payload.timestamp,
        heart_rate: payload.hr,
        temperature: payload.temp,
        additional_data: Object.keys(payload)
          .filter(key => !['device_id', 'timestamp', 'hr', 'temp', 'signature'].includes(key))
          .reduce(
            (acc, key) => {
              acc[key] = payload[key];
              return acc;
            },
            {} as Record<string, any>
          ),
      })
      .select()
      .single();

    if (error || !data) {
      logger.error({ error, patientId, deviceId: payload.device_id }, 'Failed to store vitals');
      throw new Error('Failed to store vitals');
    }

    // Update last vitals in patient's public view
    try {
      await patientService.updateLastVitals(patientId, {
        timestamp: payload.timestamp,
        heart_rate: payload.hr,
        temperature: payload.temp,
      });
    } catch (error) {
      logger.warn({ error, patientId }, 'Failed to update last vitals in public view');
      // Don't throw - vitals are stored, just public view update failed
    }

    logger.info({ vitalsId: data.id, patientId, deviceId: payload.device_id }, 'Vitals stored');

    return this.mapVitalsFromDB(data);
  }

  /**
   * Get vitals for a patient
   */
  async getVitalsByPatientId(patientId: string, limit: number = 100): Promise<Vitals[]> {
    const { data, error } = await supabase
      .from('vitals')
      .select('*')
      .eq('patient_id', patientId)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error({ error, patientId }, 'Failed to get vitals');
      return [];
    }

    return (data || []).map(vitals => this.mapVitalsFromDB(vitals));
  }

  /**
   * Map database vitals to Vitals type
   */
  private mapVitalsFromDB(dbVitals: any): Vitals {
    return {
      id: dbVitals.id,
      patient_id: dbVitals.patient_id,
      device_id: dbVitals.device_id,
      timestamp: dbVitals.timestamp,
      heart_rate: dbVitals.heart_rate,
      temperature: dbVitals.temperature ? parseFloat(dbVitals.temperature) : undefined,
      additional_data: dbVitals.additional_data || {},
      created_at: dbVitals.created_at,
    };
  }
}

export const deviceService = new DeviceService();

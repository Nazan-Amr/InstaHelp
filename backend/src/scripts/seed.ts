/**
 * Seed script to populate database with sample data
 * Run with: npm run seed
 */
import { supabase } from '../config/database';
import { authService } from '../services/auth.service';
import { patientService } from '../services/patient.service';
import { tokenService } from '../services/token.service';
import { deviceService } from '../services/device.service';
import { UserRole } from '../types';
import logger from '../utils/logger';

async function seed() {
  logger.info('Starting database seed...');

  try {
    // Create admin user
    logger.info('Creating admin user...');
    const adminEmail = 'admin@instahelp.example.com';
    const adminPassword = 'Admin123!';

    let adminUser;
    try {
      adminUser = await authService.register(adminEmail, adminPassword, UserRole.ADMIN);
      // Manually verify admin
      await supabase.from('users').update({ is_verified: true }).eq('id', adminUser.id);
      logger.info('Admin user created');
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        const existingAdmin = await authService.getUserByEmail(adminEmail);
        if (existingAdmin) {
          adminUser = existingAdmin;
          logger.info('Admin user already exists');
        }
      } else {
        throw error;
      }
    }

    // Create owner user
    logger.info('Creating owner user...');
    const ownerEmail = 'owner@instahelp.example.com';
    const ownerPassword = 'Owner123!';

    let ownerUser;
    try {
      ownerUser = await authService.register(ownerEmail, ownerPassword, UserRole.OWNER);
      await authService.verifyEmail(ownerEmail);
      logger.info('Owner user created');
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        const existingOwner = await authService.getUserByEmail(ownerEmail);
        if (existingOwner) {
          ownerUser = existingOwner;
          logger.info('Owner user already exists');
        }
      } else {
        throw error;
      }
    }

    // Create doctor user
    logger.info('Creating doctor user...');
    const doctorEmail = 'doctor@instahelp.example.com';
    const doctorPassword = 'Doctor123!';

    let doctorUser;
    try {
      doctorUser = await authService.register(
        doctorEmail,
        doctorPassword,
        UserRole.DOCTOR,
        'DOC123456',
        'licenses/doctor-license.pdf'
      );
      await authService.verifyEmail(doctorEmail);
      // Verify doctor (simulate admin verification)
      if (adminUser) {
        await supabase
          .from('users')
          .update({
            is_doctor_verified: true,
            verified_by: adminUser.id,
            verified_at: new Date().toISOString(),
          })
          .eq('id', doctorUser.id);
      }
      logger.info('Doctor user created and verified');
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        const existingDoctor = await authService.getUserByEmail(doctorEmail);
        if (existingDoctor) {
          doctorUser = existingDoctor;
          logger.info('Doctor user already exists');
        }
      } else {
        throw error;
      }
    }

    // Create patient record for owner
    if (ownerUser) {
      logger.info('Creating patient record...');
      let patient = await patientService.getPatientByUserId(ownerUser.id);

      if (!patient) {
        patient = await patientService.createPatient(
          ownerUser.id,
          {
            blood_type: 'O+',
            allergies: ['Peanuts', 'Penicillin'],
            emergency_contact: {
              name: 'Jane Doe',
              phone: '+1234567890',
              relationship: 'Spouse',
            },
            short_instructions:
              'Patient has severe peanut allergy. Use epinephrine if anaphylaxis occurs.',
          },
          {
            national_id: '123456789',
            full_medical_history:
              'Previous heart surgery in 2020. Diabetes type 2 diagnosed in 2018.',
            medications: ['Metformin 500mg twice daily', 'Aspirin 81mg daily'],
            doctor_notes: 'Patient stable. Continue current medication regimen.',
            scanned_files: [],
          }
        );
        logger.info('Patient record created');
      } else {
        logger.info('Patient record already exists');
      }

      // Create token for patient
      if (patient) {
        logger.info('Creating QR token...');
        let token = await tokenService.getTokenByPatientId(patient.id);
        if (!token) {
          token = await tokenService.createToken(patient.id);
          logger.info(`Token created: ${token.token}`);
          logger.info(`Emergency URL: http://localhost:3000/r/${token.token}`);
        } else {
          logger.info(`Token already exists: ${token.token}`);
        }

        // Register device
        if (patient) {
          logger.info('Registering device...');
          const deviceId = 'ESP32-DEVICE-001';
          const deviceSecret = 'device-secret-key-123';

          try {
            await deviceService.registerDevice(patient.id, deviceId, deviceSecret);
            logger.info(`Device registered: ${deviceId}`);
            logger.info(`Device secret: ${deviceSecret}`);
          } catch (error: any) {
            if (error.message.includes('duplicate')) {
              logger.info('Device already registered');
            } else {
              throw error;
            }
          }
        }
      }
    }

    logger.info('Seed completed successfully!');
    logger.info('\n=== Sample Credentials ===');
    logger.info(`Admin: ${adminEmail} / ${adminPassword}`);
    logger.info(`Owner: ${ownerEmail} / ${ownerPassword}`);
    logger.info(`Doctor: ${doctorEmail} / ${doctorPassword}`);
  } catch (error) {
    logger.error({ error }, 'Seed failed');
    process.exit(1);
  }
}

seed();

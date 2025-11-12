/**
 * ESP32 Device Simulation Script
 * Simulates device sending vitals data to the API
 * Run with: npm run simulate-device
 */
import crypto from 'crypto';
import { config } from '../config/env';
import { encryptionService } from '../services/encryption.service';
import { DeviceVitalsPayload } from '../types';

const API_URL = process.env.API_URL || 'http://localhost:3000';
const DEVICE_ID = process.env.DEVICE_ID || 'ESP32-DEVICE-001';
const DEVICE_SECRET = process.env.DEVICE_SECRET || 'device-secret-key-123';

/**
 * Generate HMAC signature for device payload
 */
function generateSignature(payload: Omit<DeviceVitalsPayload, 'signature'>): string {
  const payloadString = JSON.stringify(payload, Object.keys(payload).sort());
  return encryptionService.generateHMAC(payloadString, config.device.hmacSecret);
}

/**
 * Simulate sending vitals data
 */
async function sendVitals() {
  const timestamp = new Date().toISOString();
  const heartRate = Math.floor(Math.random() * 40) + 60; // 60-100 bpm
  const temperature = (Math.random() * 2 + 36.5).toFixed(2); // 36.5-38.5°C

  const payload: Omit<DeviceVitalsPayload, 'signature'> = {
    device_id: DEVICE_ID,
    timestamp,
    hr: heartRate,
    temp: parseFloat(temperature),
  };

  // Generate signature
  const signature = generateSignature(payload);

  const fullPayload: DeviceVitalsPayload = {
    ...payload,
    signature,
  };

  try {
    const response = await fetch(`${API_URL}/api/v1/devices/${DEVICE_ID}/vitals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fullPayload),
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Vitals sent successfully:`, {
        heartRate: `${heartRate} bpm`,
        temperature: `${temperature}°C`,
        timestamp,
      });
      return data;
    } else {
      const error = await response.text();
      console.error(`❌ Failed to send vitals: ${response.status}`, error);
      return null;
    }
  } catch (error) {
    console.error('❌ Error sending vitals:', error);
    return null;
  }
}

/**
 * Run simulation
 */
async function runSimulation() {
  console.log('🚀 Starting ESP32 device simulation...');
  console.log(`API URL: ${API_URL}`);
  console.log(`Device ID: ${DEVICE_ID}`);
  console.log('');

  // Send initial vitals
  await sendVitals();

  // Send vitals every 60 seconds
  const interval = setInterval(async () => {
    await sendVitals();
  }, 60000);

  console.log('📡 Simulating device uploads every 60 seconds...');
  console.log('Press Ctrl+C to stop');

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping simulation...');
    clearInterval(interval);
    process.exit(0);
  });
}

runSimulation();

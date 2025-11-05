import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { config } from '../config/env';
import logger from '../utils/logger';

/**
 * Encryption Service
 * Implements AES-256-GCM for data-at-rest encryption
 * Uses RSA-2048 for key wrapping (Key Encryption Key - KEK pattern)
 */

class EncryptionService {
  private rsaPrivateKey: string | null = null;
  private rsaPublicKey: string | null = null;
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits

  /**
   * Initialize RSA keys for key wrapping
   */
  async initialize(): Promise<void> {
    try {
      // Load RSA keys from files
      const privateKeyPath = path.resolve(config.encryption.rsaPrivateKeyPath);
      const publicKeyPath = path.resolve(config.encryption.rsaPublicKeyPath);

      if (fs.existsSync(privateKeyPath)) {
        this.rsaPrivateKey = fs.readFileSync(privateKeyPath, 'utf-8');
      } else {
        logger.warn(`RSA private key not found at ${privateKeyPath}. Key wrapping will fail.`);
      }

      if (fs.existsSync(publicKeyPath)) {
        this.rsaPublicKey = fs.readFileSync(publicKeyPath, 'utf-8');
      } else {
        logger.warn(`RSA public key not found at ${publicKeyPath}. Key wrapping will fail.`);
      }

      logger.info('Encryption service initialized');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize encryption service');
      throw error;
    }
  }

  /**
   * Generate a new AES-256 key for encrypting patient data
   * Each patient gets a unique AES key
   */
  generateAESKey(): Buffer {
    return crypto.randomBytes(this.keyLength);
  }

  /**
   * Encrypt data using AES-256-GCM
   * @param data - Plaintext data to encrypt
   * @param key - AES key (32 bytes)
   * @returns Encrypted data with IV and auth tag
   */
  encryptAES(data: string, key: Buffer): string {
    // Generate random IV (Initialization Vector) - 96 bits recommended for GCM
    const iv = crypto.randomBytes(12);

    // Create cipher
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);

    // Encrypt data
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get authentication tag (prevents tampering)
    const authTag = cipher.getAuthTag();

    // Return IV + authTag + encrypted data (all hex encoded)
    // Format: iv:authTag:encryptedData
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt data using AES-256-GCM
   * @param encryptedData - Encrypted data in format "iv:authTag:encryptedData"
   * @param key - AES key (32 bytes)
   * @returns Decrypted plaintext
   */
  decryptAES(encryptedData: string, key: Buffer): string {
    const [ivHex, authTagHex, encrypted] = encryptedData.split(':');

    if (!ivHex || !authTagHex || !encrypted) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    // Create decipher
    const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt data
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Wrap (encrypt) an AES key using RSA-2048 public key
   * This allows us to store the patient's AES key securely
   * @param aesKey - The AES key to wrap
   * @returns Wrapped key (base64 encoded)
   */
  wrapKey(aesKey: Buffer): string {
    if (!this.rsaPublicKey) {
      throw new Error('RSA public key not available for key wrapping');
    }

    // RSA-OAEP is recommended for key wrapping (Optimal Asymmetric Encryption Padding)
    const wrapped = crypto.publicEncrypt(
      {
        key: this.rsaPublicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      aesKey
    );

    return wrapped.toString('base64');
  }

  /**
   * Unwrap (decrypt) an AES key using RSA-2048 private key
   * @param wrappedKey - The wrapped key (base64 encoded)
   * @returns Unwrapped AES key
   */
  unwrapKey(wrappedKey: string): Buffer {
    if (!this.rsaPrivateKey) {
      throw new Error('RSA private key not available for key unwrapping');
    }

    const wrappedBuffer = Buffer.from(wrappedKey, 'base64');

    const unwrapped = crypto.privateDecrypt(
      {
        key: this.rsaPrivateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      wrappedBuffer
    );

    return unwrapped;
  }

  /**
   * Encrypt patient data and wrap the key
   * This is the main method to use for encrypting patient private profiles
   * @param data - Plaintext data (JSON string)
   * @returns Object containing encrypted data and wrapped key
   */
  encryptPatientData(data: string): { encryptedData: string; wrappedKey: string } {
    // Generate unique AES key for this encryption
    const aesKey = this.generateAESKey();

    // Encrypt the data
    const encryptedData = this.encryptAES(data, aesKey);

    // Wrap the key for storage
    const wrappedKey = this.wrapKey(aesKey);

    return { encryptedData, wrappedKey };
  }

  /**
   * Decrypt patient data using unwrapped key
   * @param encryptedData - Encrypted data
   * @param wrappedKey - Wrapped AES key
   * @returns Decrypted plaintext
   */
  decryptPatientData(encryptedData: string, wrappedKey: string): string {
    // Unwrap the key
    const aesKey = this.unwrapKey(wrappedKey);

    // Decrypt the data
    return this.decryptAES(encryptedData, aesKey);
  }

  /**
   * Generate HMAC signature for device payloads
   * @param payload - The payload to sign
   * @param secret - HMAC secret key
   * @returns HMAC signature (hex)
   */
  generateHMAC(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  /**
   * Verify HMAC signature for device payloads
   * @param payload - The payload that was signed
   * @param signature - The provided signature
   * @param secret - HMAC secret key
   * @returns True if signature is valid
   */
  verifyHMAC(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = this.generateHMAC(payload, secret);
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  }
}

export const encryptionService = new EncryptionService();


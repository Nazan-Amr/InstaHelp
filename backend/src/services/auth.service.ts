import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/database';
import { config } from '../config/env';
import { User, UserRole, JWTPayload } from '../types';
import logger from '../utils/logger';
import { emailService } from './email.service';
import crypto from 'crypto';

class AuthService {
  /**
   * Generate OTP code
   */
  generateOTP(): string {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < config.otp.length; i++) {
      otp += digits[Math.floor(Math.random() * 10)];
    }
    return otp;
  }

  /**
   * Store OTP in database
   */
  async storeOTP(email: string, otp: string): Promise<void> {
    const expiresAt = new Date(Date.now() + config.otp.expiresIn * 1000);

    const { error } = await supabase.from('otp_storage').insert({
      email,
      otp,
      expires_at: expiresAt.toISOString(),
      used: false,
    });

    if (error) {
      logger.error({ error, email }, 'Failed to store OTP');
      throw new Error('Failed to store OTP');
    }
  }

  /**
   * Request OTP for email verification
   */
  async requestOTP(email: string): Promise<void> {
    // Check rate limiting (basic check - in production use Redis)
    const recentOTPs = await supabase
      .from('otp_storage')
      .select('created_at')
      .eq('email', email)
      .eq('used', false)
      .gte('created_at', new Date(Date.now() - 60000).toISOString()) // Last minute
      .limit(1);

    if (recentOTPs.data && recentOTPs.data.length > 0) {
      throw new Error('Please wait before requesting another OTP');
    }

    const otp = this.generateOTP();
    await this.storeOTP(email, otp);

    // Send OTP email
    await emailService.sendOTP(email, otp);
  }

  /**
   * Verify OTP
   */
  async verifyOTP(email: string, otp: string): Promise<boolean> {
    try {
      // Query for matching OTP without .single() to avoid errors when not found
      const { data, error } = await supabase
        .from('otp_storage')
        .select('*')
        .eq('email', email)
        .eq('otp', otp)
        .eq('used', false)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1);

      // Check for errors (but PGRST116 "not found" is expected for wrong OTP)
      if (error) {
        // PGRST116 is "not found" - this is normal for wrong OTP
        if (error.code === 'PGRST116') {
          return false;
        }
        logger.error({ error, email }, 'Error verifying OTP');
        return false;
      }

      // No matching OTP found
      if (!data || data.length === 0) {
        return false;
      }

      const otpRecord = data[0];

      // Mark OTP as used
      await supabase.from('otp_storage').update({ used: true }).eq('id', otpRecord.id);

      return true;
    } catch (error) {
      logger.error({ error, email }, 'Exception in verifyOTP');
      return false;
    }
  }

  /**
   * Hash password
   */
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Verify password
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate JWT access token
   */
  generateAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });
  }

  /**
   * Generate JWT refresh token
   */
  generateRefreshToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiresIn,
    });
  }

  /**
   * Verify JWT access token
   */
  verifyAccessToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired access token');
    }
  }

  /**
   * Verify JWT refresh token
   */
  verifyRefreshToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, config.jwt.refreshSecret) as JWTPayload;
      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  /**
   * Register a new user
   */
  async register(
    email: string,
    password: string,
    role: UserRole,
    licenseNumber?: string,
    licenseFilePath?: string,
    doctorName?: string
  ): Promise<User> {
    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const passwordHash = await this.hashPassword(password);

    // Create user
    const userData: any = {
      email,
      password_hash: passwordHash,
      role,
      is_verified: false,
    };

    if (role === UserRole.DOCTOR) {
      userData.license_number = licenseNumber;
      userData.license_file_path = licenseFilePath;
      userData.is_doctor_verified = false;
      // Store doctor name in a metadata field (we'll add full_name column via migration)
      if (doctorName) {
        userData.full_name = doctorName;
      }
    }

    const { data: user, error } = await supabase.from('users').insert(userData).select().single();

    if (error || !user) {
      logger.error({ error, email }, 'Failed to register user');
      throw new Error('Failed to register user');
    }

    logger.info({ userId: user.id, email, role }, 'User registered');

    return this.mapUserFromDB(user);
  }

  /**
   * Login user (after OTP verification)
   */
  async login(email: string, password: string): Promise<{ user: User; accessToken: string; refreshToken: string }> {
    // Find user
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      throw new Error('Invalid email or password');
    }

    // Verify password
    const isValid = await this.verifyPassword(password, user.password_hash);
    if (!isValid) {
      throw new Error('Invalid email or password');
    }

    // Check if verified (for owners and doctors)
    if ((user.role === UserRole.OWNER || user.role === UserRole.DOCTOR) && !user.is_verified) {
      throw new Error('Email not verified. Please verify your email first.');
    }

    // Generate tokens
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId: user.id,
      email: user.email,
      role: user.role as UserRole,
    };

    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(payload);

    logger.info({ userId: user.id, email, role: user.role }, 'User logged in');

    return {
      user: this.mapUserFromDB(user),
      accessToken,
      refreshToken,
    };
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<string> {
    const payload = this.verifyRefreshToken(refreshToken);

    // Verify user still exists and is active
    const { data: user } = await supabase
      .from('users')
      .select('id, email, role, is_verified')
      .eq('id', payload.userId)
      .single();

    if (!user) {
      throw new Error('User not found');
    }

    // Generate new access token
    return this.generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role as UserRole,
    });
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    const { data, error } = await supabase.from('users').select('*').eq('id', userId).single();

    if (error || !data) {
      return null;
    }

    return this.mapUserFromDB(data);
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    const { data, error } = await supabase.from('users').select('*').eq('email', email).single();

    if (error || !data) {
      return null;
    }

    return this.mapUserFromDB(data);
  }

  /**
   * Verify user email (after OTP verification)
   */
  async verifyEmail(email: string): Promise<void> {
    const { error } = await supabase.from('users').update({ is_verified: true }).eq('email', email);

    if (error) {
      logger.error({ error, email }, 'Failed to verify email');
      throw new Error('Failed to verify email');
    }
  }

  /**
   * Map database user to User type
   */
  private mapUserFromDB(dbUser: any): User {
    return {
      id: dbUser.id,
      email: dbUser.email,
      password_hash: dbUser.password_hash,
      role: dbUser.role as UserRole,
      is_verified: dbUser.is_verified,
      created_at: dbUser.created_at,
      updated_at: dbUser.updated_at,
      license_number: dbUser.license_number,
      license_file_path: dbUser.license_file_path,
      is_doctor_verified: dbUser.is_doctor_verified,
      verified_by: dbUser.verified_by,
      verified_at: dbUser.verified_at,
    };
  }
}

export const authService = new AuthService();


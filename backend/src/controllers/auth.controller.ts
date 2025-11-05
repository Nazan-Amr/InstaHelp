import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { authService } from '../services/auth.service';
import { auditService } from '../services/audit.service';
import { getClientIp } from '../middleware/auth.middleware';
import { UserRole } from '../types';
import { AppError } from '../middleware/error.middleware';

export const requestOTP = async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;

  if (!email) {
    throw new AppError(400, 'Email is required');
  }

  await authService.requestOTP(email);

  res.json({ message: 'OTP sent to email' });
};

export const verifyOTP = async (req: Request, res: Response): Promise<void> => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    throw new AppError(400, 'Email and OTP are required');
  }

  const isValid = await authService.verifyOTP(email, otp);

  if (!isValid) {
    throw new AppError(400, 'Invalid or expired OTP');
  }

  res.json({ message: 'OTP verified successfully' });
};

export const register = async (req: Request, res: Response): Promise<void> => {
  const { email, password, role, licenseNumber, licenseFilePath, doctorName } = req.body;

  if (!email || !password || !role) {
    throw new AppError(400, 'Email, password, and role are required');
  }

  if (![UserRole.OWNER, UserRole.DOCTOR].includes(role)) {
    throw new AppError(400, 'Invalid role. Must be owner or doctor');
  }

  if (role === UserRole.DOCTOR) {
    if (!licenseNumber) {
      throw new AppError(400, 'License number is required for doctors');
    }
    if (!doctorName) {
      throw new AppError(400, 'Doctor name is required for doctors');
    }
  }

  const user = await authService.register(email, password, role, licenseNumber, licenseFilePath, doctorName);

  // Log registration
  await auditService.log(
    user.id,
    user.role,
    getClientIp(req),
    'user_registered',
    'user',
    user.id,
    { role: user.role }
  );

  res.status(201).json({
    message: 'User registered successfully. Please verify your email.',
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  });
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError(400, 'Email and password are required');
  }

  const { user, accessToken, refreshToken } = await authService.login(email, password);

  // Set refresh token in HTTP-only cookie
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  // Log login
  await auditService.log(
    user.id,
    user.role,
    getClientIp(req),
    'user_logged_in',
    'user',
    user.id,
    {}
  );

  res.json({
    message: 'Login successful',
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    accessToken,
  });
};

export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;

  if (!email) {
    throw new AppError(400, 'Email is required');
  }

  await authService.verifyEmail(email);

  res.json({ message: 'Email verified successfully' });
};

export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

  if (!refreshToken) {
    throw new AppError(401, 'Refresh token is required');
  }

  const accessToken = await authService.refreshAccessToken(refreshToken);

  res.json({ accessToken });
};

export const getMe = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError(401, 'Unauthorized');
  }

  const user = await authService.getUserById(req.user.userId);

  if (!user) {
    throw new AppError(404, 'User not found');
  }

  res.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      is_verified: user.is_verified,
      is_doctor_verified: user.is_doctor_verified,
    },
  });
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    throw new AppError(400, 'Email, OTP, and new password are required');
  }

  if (newPassword.length < 8) {
    throw new AppError(400, 'Password must be at least 8 characters');
  }

  // Verify OTP first
  const isValid = await authService.verifyOTP(email, otp);
  if (!isValid) {
    throw new AppError(400, 'Invalid or expired OTP');
  }

  // Get user and reset password
  const user = await authService.getUserByEmail(email);
  if (!user) {
    throw new AppError(404, 'User not found');
  }

  // Update password
  const passwordHash = await authService.hashPassword(newPassword);
  const { supabase } = await import('../config/database');
  const { error } = await supabase
    .from('users')
    .update({ password_hash: passwordHash })
    .eq('id', user.id);

  if (error) {
    throw new AppError(500, 'Failed to reset password');
  }

  // Log password reset
  await auditService.log(
    user.id,
    user.role,
    getClientIp(req),
    'password_reset',
    'user',
    user.id,
    {}
  );

  res.json({ message: 'Password reset successfully' });
};

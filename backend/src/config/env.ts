import dotenv from 'dotenv';

dotenv.config();

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiUrl: process.env.API_URL || 'http://localhost:3000',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    storageBucket: process.env.SUPABASE_STORAGE_BUCKET || 'medical-files',
  },

  jwt: {
    secret: process.env.JWT_SECRET || '',
    refreshSecret: process.env.JWT_REFRESH_SECRET || '',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  encryption: {
    rsaPrivateKeyPath: process.env.RSA_PRIVATE_KEY_PATH || './keys/private_key.pem',
    rsaPublicKeyPath: process.env.RSA_PUBLIC_KEY_PATH || './keys/public_key.pem',
    aesMasterKey: process.env.AES_MASTER_KEY || '',
  },

  email: {
    host: process.env.EMAIL_HOST || 'smtp.mailtrap.io',
    port: parseInt(process.env.EMAIL_PORT || '2525', 10),
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || '',
    from: process.env.EMAIL_FROM || 'noreply@instahelp.example.com',
  },

  otp: {
    expiresIn: parseInt(process.env.OTP_EXPIRES_IN || '600', 10), // 10 minutes
    length: parseInt(process.env.OTP_LENGTH || '6', 10),
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    otpWindowMs: parseInt(process.env.OTP_RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 minute
    otpMaxRequests: parseInt(process.env.OTP_RATE_LIMIT_MAX_REQUESTS || '3', 10),
    deviceWindowMs: parseInt(process.env.DEVICE_RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 minute
    deviceMaxRequests: parseInt(process.env.DEVICE_RATE_LIMIT_MAX_REQUESTS || '1', 10),
  },

  device: {
    hmacSecret: process.env.DEVICE_HMAC_SECRET || '',
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

// Validate required configuration
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'DEVICE_HMAC_SECRET',
];

if (config.nodeEnv === 'production') {
  requiredEnvVars.forEach((varName) => {
    if (!process.env[varName]) {
      throw new Error(`Missing required environment variable: ${varName}`);
    }
  });
}


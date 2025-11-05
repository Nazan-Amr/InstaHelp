import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config } from './config/env';
import logger from './utils/logger';
import { errorHandler } from './middleware/error.middleware';
import { encryptionService } from './services/encryption.service';
import { emailService } from './services/email.service';

// Routes
import authRoutes from './routes/auth.routes';
import patientRoutes from './routes/patient.routes';
import tokenRoutes from './routes/token.routes';
import doctorRoutes from './routes/doctor.routes';
import emergencyRoutes from './routes/emergency.routes';
import pendingChangeRoutes from './routes/pending-change.routes';
import deviceRoutes from './routes/device.routes';
import adminRoutes from './routes/admin.routes';

const app = express();

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true,
  })
);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Rate limiting
const generalRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(generalRateLimiter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'InstaHelp API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      api: '/api',
      emergency: '/r/:token',
    },
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/tokens', tokenRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/r', emergencyRoutes); // Public emergency view
app.use('/api/pending-changes', pendingChangeRoutes);
app.use('/api/v1/devices', deviceRoutes);
app.use('/api/admin', adminRoutes);

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason: Error, promise: Promise<any>) => {
  logger.error({ error: reason, promise }, 'Unhandled Promise Rejection');
  // Don't exit in development, but log the error
  if (config.nodeEnv === 'production') {
    // In production, you might want to exit gracefully
    // process.exit(1);
  }
});

process.on('uncaughtException', (error: Error) => {
  logger.error({ error, stack: error.stack }, 'Uncaught Exception');
  // In production, exit the process
  if (config.nodeEnv === 'production') {
    process.exit(1);
  }
});

// Error handling
app.use(errorHandler);

// Initialize services and start server
async function startServer() {
  try {
    // Initialize encryption service
    await encryptionService.initialize();

    // Initialize email service
    await emailService.initialize();

    // Start server
    app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
      logger.info(`API URL: ${config.apiUrl}`);
      logger.info(`Frontend URL: ${config.frontendUrl}`);
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

startServer();


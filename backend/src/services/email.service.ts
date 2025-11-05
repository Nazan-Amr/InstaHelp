import nodemailer from 'nodemailer';
import { config } from '../config/env';
import logger from '../utils/logger';

class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  /**
   * Initialize email transporter
   */
  async initialize(): Promise<void> {
    try {
      this.transporter = nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.port === 465, // true for 465, false for other ports
        auth: {
          user: config.email.user,
          pass: config.email.pass,
        },
      });

      // Verify connection
      await this.transporter.verify();
      logger.info('Email service initialized and verified');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize email service');
      // In development, continue without email (use Mailtrap or mock)
      if (config.nodeEnv === 'production') {
        throw error;
      }
      logger.warn('Email service not available - continuing in development mode');
    }
  }

  /**
   * Send OTP email
   */
  async sendOTP(email: string, otp: string): Promise<void> {
    if (!this.transporter) {
      logger.warn('Email transporter not initialized - skipping OTP email');
      return;
    }

    const mailOptions = {
      from: config.email.from,
      to: email,
      subject: 'InstaHelp - Your Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0B5FFF;">InstaHelp Verification Code</h2>
          <p>Your verification code is:</p>
          <div style="background-color: #f0f0f0; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0; color: #0B5FFF;">
            ${otp}
          </div>
          <p>This code will expire in ${config.otp.expiresIn / 60} minutes.</p>
          <p style="color: #6B7280; font-size: 12px;">If you did not request this code, please ignore this email.</p>
        </div>
      `,
      text: `Your InstaHelp verification code is: ${otp}. This code expires in ${config.otp.expiresIn / 60} minutes.`,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      logger.info({ email }, 'OTP email sent successfully');
    } catch (error) {
      logger.error({ error, email }, 'Failed to send OTP email');
      throw new Error('Failed to send OTP email');
    }
  }

  /**
   * Send notification email for pending change approval
   */
  async sendApprovalRequest(email: string, changeDetails: string): Promise<void> {
    if (!this.transporter) {
      logger.warn('Email transporter not initialized - skipping approval email');
      return;
    }

    const mailOptions = {
      from: config.email.from,
      to: email,
      subject: 'InstaHelp - Action Required: Pending Change Approval',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0B5FFF;">Action Required: Pending Change Approval</h2>
          <p>A medical record change is pending your approval:</p>
          <div style="background-color: #f0f0f0; padding: 15px; margin: 20px 0; border-left: 4px solid #0B5FFF;">
            ${changeDetails}
          </div>
          <p>Please log in to your InstaHelp account to review and approve or reject this change.</p>
          <p style="color: #6B7280; font-size: 12px;">This is an automated notification from InstaHelp.</p>
        </div>
      `,
      text: `A medical record change is pending your approval. Please log in to review: ${changeDetails}`,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      logger.info({ email }, 'Approval request email sent');
    } catch (error) {
      logger.error({ error, email }, 'Failed to send approval request email');
      // Don't throw - email failure shouldn't block the workflow
      logger.warn('Continuing despite email failure');
    }
  }
}

export const emailService = new EmailService();


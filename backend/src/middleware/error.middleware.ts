import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Check if response was already sent
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof AppError) {
    logger.warn(
      { error: err.message, statusCode: err.statusCode, path: req.path },
      'Operational error'
    );
    res.status(err.statusCode).json({
      error: err.message,
    });
    return;
  }

  // Unexpected errors
  logger.error({ error: err, stack: err.stack, path: req.path }, 'Unexpected error');
  res.status(500).json({
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { details: err.message }),
  });
};

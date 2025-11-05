import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

/**
 * Wrapper for async route handlers to catch errors
 * Prevents unhandled promise rejections from crashing the server
 */
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      // Ensure error is properly passed to error handler
      logger.debug({ error, path: req.path }, 'Async handler caught error');
      next(error);
    });
  };
};


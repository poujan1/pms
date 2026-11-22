import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/appError';
import { env } from '../config/env';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors,
      stack: env.NODE_ENV === 'development' ? err.stack : undefined,
    });
    return;
  }

  // Handle unexpected errors
  console.error('💥 Unhandled Exception:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    stack: env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};

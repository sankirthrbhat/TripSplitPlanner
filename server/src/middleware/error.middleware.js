import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export function notFoundHandler(req, _res, next) {
  if (req.path.startsWith('/api')) {
    return next(
      new AppError(`API route not found: ${req.method} ${req.originalUrl}`, 404, 'ROUTE_NOT_FOUND')
    );
  }
  return next();
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
  }

  if (err instanceof ZodError) {
    const firstIssue = err.issues[0]?.message || 'Validation failed.';
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: firstIssue,
        details: {
          fields: err.flatten().fieldErrors,
        },
      },
    });
  }

  // Mongoose duplicate key error
  if (err?.code === 11000) {
    const duplicateField = Object.keys(err.keyPattern || {})[0] || 'field';
    return res.status(409).json({
      success: false,
      error: {
        code: 'DUPLICATE_RECORD',
        message: `A record with this ${duplicateField} already exists.`,
      },
    });
  }

  // Mongoose CastError (invalid ObjectId)
  if (err?.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_OBJECT_ID',
        message: `Invalid identifier format for ${err.path || 'resource'}.`,
      },
    });
  }

  // Mongoose ValidationError
  if (err?.name === 'ValidationError') {
    const firstMsg =
      Object.values(err.errors || {})[0]?.message || 'Database validation failed.';
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: firstMsg,
      },
    });
  }

  // Body-parser malformed JSON
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MALFORMED_JSON',
        message: 'Malformed JSON payload.',
      },
    });
  }

  if (env.NODE_ENV !== 'test') {
    console.error('[ServerError]', err.message);
  }

  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected server error occurred.',
    },
  });
}


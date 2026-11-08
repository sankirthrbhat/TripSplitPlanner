import { AppError } from '../utils/AppError.js';

export function validateBody(schema) {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const firstIssue = parsed.error.issues[0]?.message || 'Invalid request input.';
      return next(
        new AppError(firstIssue, 400, 'VALIDATION_ERROR', {
          fields: fieldErrors,
          issues: parsed.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        })
      );
    }
    req.body = parsed.data;
    return next();
  };
}

export function validateQuery(schema) {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.query ?? {});
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || 'Invalid query parameters.';
      return next(
        new AppError(firstIssue, 400, 'INVALID_QUERY', {
          fields: parsed.error.flatten().fieldErrors,
        })
      );
    }
    req.validatedQuery = parsed.data;
    return next();
  };
}


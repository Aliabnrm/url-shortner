import type { ErrorRequestHandler } from 'express';
import { AppError } from '../errors/app-error.js';

function getRequestError(error: unknown): AppError | undefined {
  if (error instanceof AppError) return error;

  if (error instanceof Error && 'type' in error) {
    switch (error.type) {
      case 'entity.parse.failed':
        return new AppError(
          400,
          'INVALID_JSON',
          'Request body must be valid JSON.',
        );
      case 'entity.too.large':
        return new AppError(
          413,
          'PAYLOAD_TOO_LARGE',
          'Request body must not exceed 8 KiB.',
        );
      case 'encoding.unsupported':
      case 'charset.unsupported':
        return new AppError(
          415,
          'UNSUPPORTED_MEDIA_TYPE',
          'Use uncompressed UTF-8 JSON.',
        );
      case 'request.aborted':
      case 'request.size.invalid':
        return new AppError(
          400,
          'INVALID_REQUEST',
          'The request body was incomplete.',
        );
    }
  }

  if (error instanceof URIError && 'status' in error && error.status === 400) {
    return new AppError(
      400,
      'INVALID_REQUEST',
      'The request path is not valid URL encoding.',
    );
  }
  return undefined;
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const requestError = getRequestError(error as unknown);
  if (requestError) {
    res.status(requestError.statusCode).json({
      error: { code: requestError.code, message: requestError.message },
    });
    return;
  }

  console.error('Unhandled request error:', error);

  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
    },
  });
};

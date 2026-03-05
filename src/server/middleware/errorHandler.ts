import { randomUUID } from 'crypto';
import logger from '../../utils/logger';
import { ValidationError, DatabaseError, ConfigError } from '../../utils/errors';
import type { MiddlewareFn } from '../types';

interface ErrorResponse {
  error: {
    type: string;
    message: string;
    error_id?: string;
  };
}

export const errorHandlerMiddleware: MiddlewareFn = async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    const errorId = randomUUID();

    if (error instanceof ValidationError) {
      logger.warn('Validation error', {
        error_id: errorId,
        message: error.message,
        field: error.field,
      });
      ctx.parsedBody = {
        error: {
          type: 'invalid_request_error',
          message: error.message,
          error_id: errorId,
        },
      } as ErrorResponse;
      return;
    }

    if (error instanceof DatabaseError) {
      logger.error('Database error', {
        error_id: errorId,
        message: error.message,
      });
      ctx.parsedBody = {
        error: {
          type: 'internal_server_error',
          message: 'Database error',
          error_id: errorId,
        },
      } as ErrorResponse;
      return;
    }

    if (error instanceof ConfigError) {
      logger.error('Configuration error', {
        error_id: errorId,
        message: error.message,
      });
      ctx.parsedBody = {
        error: {
          type: 'internal_server_error',
          message: 'Configuration error',
          error_id: errorId,
        },
      } as ErrorResponse;
      return;
    }

    // Generic error
    logger.error('Unexpected error', {
      error_id: errorId,
      message: error instanceof Error ? error.message : String(error),
    });
    ctx.parsedBody = {
      error: {
        type: 'internal_server_error',
        message: 'Internal server error',
        error_id: errorId,
      },
    } as ErrorResponse;
  }
};

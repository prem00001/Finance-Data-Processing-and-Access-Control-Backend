import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * Keeps error payloads readable: validation messages become a single string list.
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const res = exception.getResponse();

    if (status === HttpStatus.BAD_REQUEST && res && typeof res === 'object' && 'message' in res) {
      const body = res as { message: string | string[]; error?: string };
      const messages = Array.isArray(body.message) ? body.message : [String(body.message)];
      return response.status(status).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'The request could not be validated.',
          details: messages,
        },
      });
    }

    if (typeof res === 'object' && res !== null && 'error' in res) {
      return response.status(status).json(res);
    }

    const message =
      typeof res === 'string' ? res : (res as { message?: string }).message ?? exception.message;
    return response.status(status).json({
      error: {
        code: 'HTTP_ERROR',
        message,
      },
    });
  }
}

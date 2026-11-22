import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

type ErrorWithCode = Error & { code?: string; name: string };

function isErrorWithCode(value: unknown): value is ErrorWithCode {
  return value instanceof Error;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null && 'message' in body) {
        const candidate = (body as { message: unknown }).message;
        message =
          typeof candidate === 'string' || Array.isArray(candidate)
            ? (candidate as string | string[])
            : exception.message;
      } else {
        message = exception.message;
      }
    } else if (isErrorWithCode(exception)) {
      if (exception.code === '11000') {
        status = HttpStatus.CONFLICT;
        message = 'A record with this value already exists';
      } else if (exception.name === 'CastError') {
        status = HttpStatus.BAD_REQUEST;
        message = 'Invalid identifier';
      } else {
        this.logger.error(
          `Unhandled error on ${request.method} ${request.path}: ${exception.message}`,
          exception.stack,
        );
      }
    }

    response.status(status).json({
      statusCode: status,
      message,
      error: HttpStatus[status] ?? 'Error',
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
    });
  }
}

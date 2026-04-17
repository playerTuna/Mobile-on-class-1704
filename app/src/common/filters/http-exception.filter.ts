import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorResponse {
  statusCode: number;
  message: string;
  errors: string[];
  timestamp: string;
  path: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, message, errors } = this.extract(exception);

    const body: ErrorResponse = {
      statusCode,
      message,
      errors,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} → ${statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(statusCode).json(body);
  }

  private extract(exception: unknown): {
    statusCode: number;
    message: string;
    errors: string[];
  } {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const raw = exception.getResponse();

      // ValidationPipe throws an HttpException whose response body is
      // { message: string[], error: string, statusCode: number }
      if (typeof raw === 'object' && raw !== null) {
        const obj = raw as Record<string, unknown>;
        const errors = Array.isArray(obj['message'])
          ? (obj['message'] as string[])
          : [];
        const message =
          errors.length > 0
            ? ((obj['error'] as string | undefined) ?? exception.message)
            : typeof obj['message'] === 'string'
              ? obj['message']
              : exception.message;
        return { statusCode, message, errors };
      }

      return {
        statusCode,
        message: typeof raw === 'string' ? raw : exception.message,
        errors: [],
      };
    }

    // Unexpected / unhandled errors
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      errors: [],
    };
  }
}

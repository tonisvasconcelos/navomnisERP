import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Erro interno do servidor' };

    const body =
      typeof message === 'string'
        ? { success: false, errors: [{ message }] }
        : {
            success: false,
            errors: Array.isArray((message as { message?: unknown }).message)
              ? ((message as { message: string[] }).message ?? []).map((m) => ({ message: m }))
              : [{ message: (message as { message?: string }).message ?? 'Erro' }],
            metadata: (message as { metadata?: unknown }).metadata,
          };

    if (status >= 500) {
      this.logger.error(exception);
    }

    response.status(status).json(body);
  }
}

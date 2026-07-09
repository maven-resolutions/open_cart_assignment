import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import * as winston from 'winston';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { method, originalUrl, headers } = request;
    const userAgent = headers['user-agent'] || '';
    const startTime = Date.now();

    // Extract IP address (considering proxies)
    const clientIp =
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (request.headers['x-real-ip'] as string) ||
      request.ip ||
      request.socket.remoteAddress ||
      'unknown';

    // Log request start
    const requestLog = {
      method,
      url: originalUrl,
      ip: clientIp,
      userAgent,
      timestamp: new Date().toISOString(),
      status: 'started',
    };

    this.logger.log(`→ ${method} ${originalUrl} - ${clientIp} - ${userAgent}`);

    // Log to file via winston if available
    const winstonLogger = (global as { winstonLogger?: winston.Logger })
      .winstonLogger;
    if (winstonLogger) {
      winstonLogger.info('Incoming Request', {
        context: 'HTTP',
        ...requestLog,
      });
    }

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode;

          const responseLog = {
            method,
            url: originalUrl,
            ip: clientIp,
            userAgent,
            statusCode,
            duration: `${duration}ms`,
            timestamp: new Date().toISOString(),
            status: 'completed',
          };

          // Log response
          this.logger.log(
            `← ${method} ${originalUrl} ${statusCode} - ${duration}ms - ${clientIp}`,
          );

          // Log to file via winston if available
          if (winstonLogger) {
            winstonLogger.info('Request Completed', {
              context: 'HTTP',
              ...responseLog,
            });
          }
        },
        error: (error: unknown) => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode || 500;
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          const errorStack = error instanceof Error ? error.stack : undefined;

          const errorLog = {
            method,
            url: originalUrl,
            ip: clientIp,
            userAgent,
            statusCode,
            duration: `${duration}ms`,
            error: errorMessage,
            stack: errorStack,
            timestamp: new Date().toISOString(),
            status: 'error',
          };

          // Log error
          this.logger.error(
            `✗ ${method} ${originalUrl} ${statusCode} - ${duration}ms - ${clientIp} - ${errorMessage}`,
          );

          // Log to file via winston if available
          if (winstonLogger) {
            winstonLogger.error('Request Failed', {
              context: 'HTTP',
              ...errorLog,
            });
          }
        },
      }),
    );
  }
}

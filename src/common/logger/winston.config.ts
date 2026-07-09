import { WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';

export const createWinstonConfig = (
  configService: ConfigService,
): WinstonModuleOptions => {
  const logDir = configService.get<string>('log.dir') || 'logs';
  const logLevel = configService.get<string>('log.level') || 'info';

  const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json(),
  );

  const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf((info) => {
      const { timestamp, level, message, context, ...meta } = info;
      const contextStr =
        typeof context === 'string' && context.length > 0 ? `[${context}]` : '';
      const msg =
        typeof message === 'string' ? message : JSON.stringify(message);
      const metaStr = Object.keys(meta).length
        ? ` ${JSON.stringify(meta)}`
        : '';
      return `${String(timestamp)} ${String(level)} ${contextStr} ${msg}${metaStr}`;
    }),
  );

  return {
    level: logLevel,
    format: logFormat,
    defaultMeta: { service: 'api' },
    transports: [
      // Console transport
      new winston.transports.Console({
        format: consoleFormat,
      }),
      // Combined log file (all logs)
      new winston.transports.File({
        filename: join(logDir, 'combined.log'),
        format: logFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),
      // Error log file
      new winston.transports.File({
        filename: join(logDir, 'error.log'),
        level: 'error',
        format: logFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),
      // Request log file (for API requests)
      new winston.transports.File({
        filename: join(logDir, 'requests.log'),
        format: logFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 10,
      }),
    ],
    exceptionHandlers: [
      new winston.transports.File({
        filename: join(logDir, 'exceptions.log'),
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),
    ],
    rejectionHandlers: [
      new winston.transports.File({
        filename: join(logDir, 'rejections.log'),
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),
    ],
  };
};

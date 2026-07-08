import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AuthModule } from './modules/auth/auth.module';
import { AllExceptionFilter } from './filters/all-exception.filter';
import { NormalExceptionFilter } from './filters/normal-exception.filter';
import { ValidationExceptionFilter } from './filters/validator-exception.filter';
import { ValidationError } from 'class-validator';
import { CustomValidationException } from './exception/validation.exception';
import { ResponseInterceptor } from './interceptor/response.interceptor';
import { LoggingInterceptor } from './interceptor/logging.interceptor';
import { WinstonModule } from 'nest-winston';
import { createWinstonConfig } from './common/logger/winston.config';
import * as winston from 'winston';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './common/health/health.module';
import { OpenCartModule } from './integrations/opencart/opencart.module';

const getValidationConstraints = (
  err: ValidationError,
): Record<string, string> | null => {
  if (err && typeof err === 'object' && 'constraints' in err) {
    const constraints = (err as { constraints?: Record<string, string> })
      .constraints;
    if (constraints && typeof constraints === 'object') {
      return constraints;
    }
  }
  return null;
};

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [configuration],
      validate: validateEnv,
    }),
    WinstonModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const winstonConfig = createWinstonConfig(configService);
        // Make winston logger available globally
        const logger = winston.createLogger(winstonConfig);
        (global as { winstonLogger?: winston.Logger }).winstonLogger = logger;
        return winstonConfig;
      },
    }),
    DatabaseModule,
    AuthModule,
    HealthModule,
    OpenCartModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: AllExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: NormalExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: ValidationExceptionFilter,
    },
    {
      // Allowing to do validation through DTO
      // Since class-validator library default throw BadRequestException, here we use exceptionFactory to throw
      // their internal exception so that filter can recognize it
      provide: APP_PIPE,
      useFactory: () =>
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
          transformOptions: {
            enableImplicitConversion: true,
          },
          exceptionFactory: (errors: ValidationError[]) => {
            const messages = errors
              .map((err: ValidationError) => {
                const constraints = getValidationConstraints(err);
                if (constraints) {
                  return Object.values(constraints).join(', ');
                }
                return '';
              })
              .filter(Boolean);
            return new CustomValidationException(messages.join(', '), errors);
          },
        }),
    },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}

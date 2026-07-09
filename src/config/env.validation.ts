import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  ValidateIf,
  validateSync,
  ValidationError,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsOptional()
  @IsInt()
  @Min(1)
  PORT?: number;

  @IsOptional()
  @IsEnum(Environment)
  NODE_ENV?: Environment;

  @IsOptional()
  @IsString()
  DATABASE_URL?: string;

  @IsOptional()
  @IsString()
  DATABASE_HOST?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  DATABASE_PORT?: number;

  @IsOptional()
  @IsString()
  DATABASE_USER?: string;

  @IsOptional()
  @IsString()
  DATABASE_PASSWORD?: string;

  @IsOptional()
  @IsString()
  DATABASE_NAME?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  DATABASE_POOL_MIN?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  DATABASE_POOL_MAX?: number;

  @IsOptional()
  @IsString()
  DATABASE_SSL?: string;

  @ValidateIf(
    (o: EnvironmentVariables) => o.NODE_ENV === Environment.Production,
  )
  @IsNotEmpty()
  @IsUrl({ require_tld: false })
  OPENCART_BASE_URL?: string;

  @ValidateIf(
    (o: EnvironmentVariables) => o.NODE_ENV === Environment.Production,
  )
  @IsNotEmpty()
  @IsString()
  OPENCART_API_USERNAME?: string;

  @ValidateIf(
    (o: EnvironmentVariables) => o.NODE_ENV === Environment.Production,
  )
  @IsNotEmpty()
  @IsString()
  OPENCART_API_KEY?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  OPENCART_TIMEOUT_MS?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  OPENCART_MAX_RETRIES?: number;

  @IsOptional()
  @IsString()
  REDIS_HOST?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  REDIS_PORT?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  LOW_STOCK_THRESHOLD?: number;

  @ValidateIf(
    (o: EnvironmentVariables) => o.NODE_ENV === Environment.Production,
  )
  @IsNotEmpty()
  @IsString()
  JWT_SECRET?: string;

  @IsOptional()
  @IsString()
  JWT_EXPIRES_IN?: string;

  @ValidateIf(
    (o: EnvironmentVariables) => o.NODE_ENV === Environment.Production,
  )
  @IsNotEmpty()
  @IsString()
  API_USER?: string;

  @ValidateIf(
    (o: EnvironmentVariables) => o.NODE_ENV === Environment.Production,
  )
  @IsNotEmpty()
  @IsString()
  API_PASSWORD_HASH?: string;

  @IsOptional()
  @IsString()
  BULLMQ_PREFIX?: string;

  @IsOptional()
  @IsString()
  API_PREFIX?: string;

  @IsOptional()
  @IsString()
  API_VERSION?: string;

  @IsOptional()
  @IsString()
  CORS_ORIGIN?: string;

  @IsOptional()
  @IsString()
  CORS_CREDENTIALS?: string;

  @IsOptional()
  @IsString()
  LOG_DIR?: string;

  @IsOptional()
  @IsString()
  LOG_LEVEL?: string;
}

function formatValidationErrors(errors: ValidationError[]): string {
  return errors
    .flatMap((error) => {
      if (error.constraints) {
        return Object.values(error.constraints);
      }
      if (error.children?.length) {
        return formatValidationErrors(error.children);
      }
      return [];
    })
    .join('\n');
}

export function validateEnv(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(formatValidationErrors(errors));
  }

  return validatedConfig;
}

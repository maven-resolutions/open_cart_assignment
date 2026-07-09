const parseIntEnv = (value: string | undefined, defaultValue: string): number =>
  parseInt(value ?? defaultValue, 10);

const isProduction = process.env.NODE_ENV === 'production';

/** Dev-only defaults for local auth; production requires explicit env vars. */
const DEV_JWT_SECRET = 'dev-jwt-secret-change-in-production-min-32-chars';
const DEV_API_USER = 'admin';
/** bcrypt hash of "admin123" — dev default only */
const DEV_API_PASSWORD_HASH =
  '$2b$10$s96y7L6Znwu7cCTB8B2iqu0T./Sg/atJ8z0mohZIbptFKyoySnGry';

export default () => ({
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  database: {
    url: process.env.DATABASE_URL,
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseIntEnv(process.env.DATABASE_PORT, '5432'),
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || '',
    name: process.env.DATABASE_NAME || 'open_cart_assignment',
    pool: {
      min: parseIntEnv(process.env.DATABASE_POOL_MIN, '2'),
      max: parseIntEnv(process.env.DATABASE_POOL_MAX, '10'),
    },
    ssl: process.env.DATABASE_SSL || 'false',
  },
  opencart: {
    baseUrl: process.env.OPENCART_BASE_URL,
    apiUsername: process.env.OPENCART_API_USERNAME,
    apiKey: process.env.OPENCART_API_KEY,
    timeoutMs: parseIntEnv(process.env.OPENCART_TIMEOUT_MS, '15000'),
    maxRetries: parseIntEnv(process.env.OPENCART_MAX_RETRIES, '3'),
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'redis',
    port: parseIntEnv(process.env.REDIS_PORT, '6379'),
  },
  bullmq: {
    prefix: process.env.BULLMQ_PREFIX ?? 'unisouk',
  },
  inventory: {
    lowStockThreshold: parseIntEnv(process.env.LOW_STOCK_THRESHOLD, '10'),
  },
  auth: {
    apiUser: process.env.API_USER ?? (isProduction ? undefined : DEV_API_USER),
    apiPasswordHash:
      process.env.API_PASSWORD_HASH ??
      (isProduction ? undefined : DEV_API_PASSWORD_HASH),
  },
  jwt: {
    secret:
      process.env.JWT_SECRET ?? (isProduction ? undefined : DEV_JWT_SECRET),
    expiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
  },
  api: {
    prefix: process.env.API_PREFIX || 'api',
    version: process.env.API_VERSION || 'v1',
  },
  cors: {
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',')
      : ['http://localhost:3000'],
    credentials: process.env.CORS_CREDENTIALS !== 'false',
  },
  helmet: {
    contentSecurityPolicy: process.env.NODE_ENV === 'production',
    crossOriginEmbedderPolicy: process.env.NODE_ENV === 'production',
  },
  log: {
    dir: process.env.LOG_DIR || 'logs',
    level: process.env.LOG_LEVEL || 'info',
  },
});

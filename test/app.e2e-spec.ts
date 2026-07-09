import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ApiResponse } from '../src/types';

interface HealthCheckPayload {
  status: 'ok' | 'error';
  checks: {
    postgres: { status: 'up' | 'down'; error?: string };
    redis: { status: 'up' | 'down'; error?: string };
  };
}

interface LoginPayload {
  accessToken: string;
}

describe('Platform endpoints (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/health', () => {
    it('returns 200 with dependency checks in the ApiResponse envelope', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      const body = response.body as ApiResponse<HealthCheckPayload>;
      expect(body.statusCode).toBe(200);
      expect(body.status).toBe(true);
      expect(body.message).toBe('Request successful');
      expect(body.data).toEqual({
        status: 'ok',
        checks: {
          postgres: { status: 'up' },
          redis: { status: 'up' },
        },
      });
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('returns accessToken in the ApiResponse envelope for valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ username: 'admin', password: 'admin123' })
        .expect(200);

      const body = response.body as ApiResponse<LoginPayload>;
      expect(body.statusCode).toBe(200);
      expect(body.status).toBe(true);
      expect(body.message).toBe('Request successful');
      expect(typeof body.data?.accessToken).toBe('string');
      expect(body.data?.accessToken.length).toBeGreaterThan(0);
    });

    it('returns 401 envelope for invalid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ username: 'admin', password: 'wrong-password' })
        .expect(401);

      const body = response.body as ApiResponse<null>;
      expect(body).toEqual({
        statusCode: 401,
        status: false,
        data: null,
        message: 'Invalid credentials',
      });
    });
  });
});

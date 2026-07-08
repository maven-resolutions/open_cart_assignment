import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { KNEX_CONNECTION } from '@willsoto/nestjs-objection';
import Redis from 'ioredis';
import { Knex } from 'knex';
import { REDIS_CLIENT } from './health.constants';

export type ComponentHealthStatus = 'up' | 'down';

export interface ComponentHealth {
  status: ComponentHealthStatus;
  error?: string;
}

export interface HealthCheckResult {
  status: 'ok' | 'error';
  checks: {
    postgres: ComponentHealth;
    redis: ComponentHealth;
  };
}

@Injectable()
export class HealthService implements OnModuleDestroy {
  constructor(
    @Inject(KNEX_CONNECTION) private readonly knex: Knex,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async check(): Promise<HealthCheckResult> {
    const [postgres, redis] = await Promise.all([
      this.checkPostgres(),
      this.checkRedis(),
    ]);

    const checks = { postgres, redis };
    const allUp = postgres.status === 'up' && redis.status === 'up';

    return {
      status: allUp ? 'ok' : 'error',
      checks,
    };
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis.status !== 'end') {
      await this.redis.quit();
    }
  }

  private async checkPostgres(): Promise<ComponentHealth> {
    try {
      await this.knex.raw('SELECT 1');
      return { status: 'up' };
    } catch (error) {
      return {
        status: 'down',
        error: error instanceof Error ? error.message : 'Postgres check failed',
      };
    }
  }

  private async checkRedis(): Promise<ComponentHealth> {
    try {
      const pong = await this.redis.ping();
      if (pong !== 'PONG') {
        return { status: 'down', error: `Unexpected Redis response: ${pong}` };
      }
      return { status: 'up' };
    } catch (error) {
      return {
        status: 'down',
        error: error instanceof Error ? error.message : 'Redis check failed',
      };
    }
  }
}

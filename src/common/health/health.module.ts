import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { DatabaseModule } from '../../database/database.module';
import { REDIS_CLIENT } from './health.constants';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [ConfigModule, DatabaseModule],
  controllers: [HealthController],
  providers: [
    HealthService,
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return new Redis({
          host: configService.get<string>('redis.host') ?? 'redis',
          port: configService.get<number>('redis.port') ?? 6379,
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          connectTimeout: 3000,
        });
      },
    },
  ],
})
export class HealthModule {}

import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OpenCartAuthService } from './opencart-auth.service';
import { OpenCartClient } from './opencart.client';
import { OpenCartMapper } from './opencart.mapper';

@Module({
  imports: [
    HttpModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        timeout: configService.get<number>('opencart.timeoutMs') ?? 15000,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }),
    }),
  ],
  providers: [OpenCartMapper, OpenCartAuthService, OpenCartClient],
  exports: [OpenCartClient],
})
export class OpenCartModule {}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { OpenCartMapper } from './opencart.mapper';
import {
  OPENCART_ROUTES,
  OcLoginResponse,
  OpenCartApiError,
} from './opencart.types';

@Injectable()
export class OpenCartAuthService {
  private readonly logger = new Logger(OpenCartAuthService.name);
  private apiToken: string | null = null;
  private loginPromise: Promise<string> | null = null;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly mapper: OpenCartMapper,
  ) {}

  async getToken(): Promise<string> {
    if (this.apiToken) {
      return this.apiToken;
    }
    return this.login();
  }

  async refreshToken(): Promise<string> {
    this.clearToken();
    return this.login();
  }

  clearToken(): void {
    this.apiToken = null;
  }

  private async login(): Promise<string> {
    if (this.loginPromise) {
      return this.loginPromise;
    }

    this.loginPromise = this.performLogin();

    try {
      return await this.loginPromise;
    } finally {
      this.loginPromise = null;
    }
  }

  private async performLogin(): Promise<string> {
    const baseUrl = this.getBaseUrl();
    const username = this.configService.get<string>('opencart.apiUsername');
    const apiKey = this.configService.get<string>('opencart.apiKey');

    if (!username || !apiKey) {
      throw new OpenCartApiError(
        'OpenCart API credentials are not configured',
        'CONFIG_ERROR',
      );
    }

    const url = `${baseUrl}/index.php?route=${OPENCART_ROUTES.LOGIN}`;
    const body = new URLSearchParams({
      username,
      key: apiKey,
    });

    this.logger.log('Authenticating with OpenCart API', {
      route: OPENCART_ROUTES.LOGIN,
    });

    try {
      const response = await firstValueFrom(
        this.httpService.post<OcLoginResponse>(url, body.toString()),
      );

      const token = this.mapper.extractLoginToken(response.data);
      this.apiToken = token;

      this.logger.log('OpenCart API session established');
      return token;
    } catch (error) {
      const message = this.extractErrorMessage(error);
      this.logger.error('OpenCart API authentication failed', { message });
      throw new OpenCartApiError(message, 'AUTH_FAILED');
    }
  }

  private getBaseUrl(): string {
    const baseUrl = this.configService.get<string>('opencart.baseUrl');
    if (!baseUrl) {
      throw new OpenCartApiError(
        'OPENCART_BASE_URL is not configured',
        'CONFIG_ERROR',
      );
    }
    return baseUrl.replace(/\/$/, '');
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof OpenCartApiError) {
      return error.message;
    }

    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as {
        response?: { data?: OcLoginResponse; status?: number };
        message?: string;
      };
      const data = axiosError.response?.data;
      if (data?.error) {
        return Object.values(data.error).join('; ');
      }
      if (axiosError.message) {
        return axiosError.message;
      }
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'OpenCart authentication failed';
  }
}

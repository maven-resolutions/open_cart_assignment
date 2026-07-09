import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { of, throwError } from 'rxjs';
import { OpenCartAuthService } from './opencart-auth.service';
import { OpenCartClient } from './opencart.client';
import { OpenCartMapper } from './opencart.mapper';
import { OcErrorBody, OpenCartApiError } from './opencart.types';

function createAxiosError(
  status: number,
  data: OcErrorBody = {},
): AxiosError<OcErrorBody> {
  const error = new Error(`HTTP ${status}`) as AxiosError<OcErrorBody>;
  error.isAxiosError = true;
  error.response = {
    status,
    data,
    statusText: String(status),
    headers: {},
    config: { headers: {} } as NonNullable<AxiosError['config']>,
  };
  return error;
}

function createSuccessProductListBody() {
  return {
    data: {
      products: [
        {
          product_id: '42',
          name: 'Widget',
          model: 'WDG-1',
          price: '9.99',
          quantity: '10',
          status: '1',
        },
      ],
      total: '1',
    },
  };
}

describe('OpenCartClient — retry and re-auth', () => {
  let client: OpenCartClient;
  let httpPostSpy: jest.Mock;
  let getTokenSpy: jest.Mock;
  let refreshTokenSpy: jest.Mock;
  let configGetSpy: jest.Mock;

  beforeEach(() => {
    httpPostSpy = jest.fn();
    getTokenSpy = jest.fn().mockResolvedValue('session-token');
    refreshTokenSpy = jest.fn().mockResolvedValue('refreshed-token');

    configGetSpy = jest.fn((key: string) => {
      switch (key) {
        case 'opencart.baseUrl':
          return 'http://opencart.test';
        case 'opencart.maxRetries':
          return 3;
        default:
          return undefined;
      }
    });

    const httpService = { post: httpPostSpy } as unknown as HttpService;
    const configService = { get: configGetSpy } as unknown as ConfigService;
    const authService = {
      getToken: getTokenSpy,
      refreshToken: refreshTokenSpy,
    } as unknown as OpenCartAuthService;
    const mapper = new OpenCartMapper();

    client = new OpenCartClient(
      httpService,
      configService,
      authService,
      mapper,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('5xx retry with exponential backoff', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    it('retries up to maxRetries times on persistent 503 then throws', async () => {
      httpPostSpy.mockReturnValue(throwError(() => createAxiosError(503)));

      const promise = client.listProducts();
      const expectation = expect(promise).rejects.toThrow(OpenCartApiError);

      await jest.runAllTimersAsync();
      await expectation;

      // maxRetries=3 → attempts 0..3 inclusive = 4 HTTP calls
      expect(httpPostSpy).toHaveBeenCalledTimes(4);
      expect(refreshTokenSpy).not.toHaveBeenCalled();
    });

    it('succeeds after transient 503 without calling refreshToken', async () => {
      httpPostSpy
        .mockReturnValueOnce(throwError(() => createAxiosError(503)))
        .mockReturnValueOnce(throwError(() => createAxiosError(503)))
        .mockReturnValueOnce(of(createSuccessProductListBody()));

      const promise = client.listProducts();
      await jest.runAllTimersAsync();
      const result = await promise;

      expect(httpPostSpy).toHaveBeenCalledTimes(3);
      expect(refreshTokenSpy).not.toHaveBeenCalled();
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe(42);
    });

    it('does not retry non-retryable 400 errors', async () => {
      httpPostSpy.mockReturnValue(throwError(() => createAxiosError(400)));

      await expect(client.listProducts()).rejects.toThrow(OpenCartApiError);

      expect(httpPostSpy).toHaveBeenCalledTimes(1);
      expect(refreshTokenSpy).not.toHaveBeenCalled();
    });
  });

  describe('401 / permission re-auth', () => {
    it('calls refreshToken once on HTTP 401 and retries the request', async () => {
      httpPostSpy
        .mockReturnValueOnce(throwError(() => createAxiosError(401)))
        .mockReturnValueOnce(of(createSuccessProductListBody()));

      const result = await client.listProducts();

      expect(refreshTokenSpy).toHaveBeenCalledTimes(1);
      expect(httpPostSpy).toHaveBeenCalledTimes(2);
      expect(getTokenSpy).toHaveBeenCalled();
      expect(result.total).toBe(1);
    });

    it('calls refreshToken on PERMISSION_DENIED body and retries once', async () => {
      httpPostSpy
        .mockReturnValueOnce(
          of({
            data: {
              error: { permission: 'Invalid session token' },
            },
          }),
        )
        .mockReturnValueOnce(of(createSuccessProductListBody()));

      const result = await client.listProducts();

      expect(refreshTokenSpy).toHaveBeenCalledTimes(1);
      expect(httpPostSpy).toHaveBeenCalledTimes(2);
      expect(result.items[0].name).toBe('Widget');
    });

    it('does not re-auth twice when retry after refresh still fails', async () => {
      httpPostSpy.mockReturnValue(throwError(() => createAxiosError(401)));

      await expect(client.listProducts()).rejects.toThrow(OpenCartApiError);

      expect(refreshTokenSpy).toHaveBeenCalledTimes(1);
      expect(httpPostSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('createProduct validation', () => {
    it('rejects OpenCart responses with missing or zero product_id', async () => {
      httpPostSpy.mockReturnValue(
        of({
          data: {
            success: true,
            data: {
              product_id: '0',
              name: '',
              model: '',
              price: '0',
              quantity: '0',
              status: '0',
            },
          },
        }),
      );

      await expect(
        client.createProduct({
          name: 'Widget',
          model: 'WDG-1',
          price: 9.99,
          quantity: 10,
        }),
      ).rejects.toThrow('invalid product_id');
    });

    it('serializes options as JSON in the OpenCart add request body', async () => {
      httpPostSpy.mockReturnValue(
        of({
          data: {
            success: true,
            data: {
              product_id: '99',
              name: 'Variant Tee',
              model: 'VTT-1',
              price: '24.99',
              quantity: '50',
              status: '1',
            },
          },
        }),
      );

      await client.createProduct({
        name: 'Variant Tee',
        model: 'VTT-1',
        price: 24.99,
        quantity: 50,
        options: [
          {
            name: 'Size',
            type: 'select',
            values: [
              { name: 'Small', priceModifier: 0, quantity: 10 },
              { name: 'Large', priceModifier: 5, quantity: 15 },
            ],
          },
        ],
      });

      const postCalls = httpPostSpy.mock.calls as Array<[string, unknown?]>;
      const addCall = postCalls.find((call) =>
        call[0].includes('api/unisouk/products/add'),
      );
      expect(addCall).toBeDefined();

      const body = new URLSearchParams(String(addCall![1]));
      const optionsField = body.get('options');
      expect(optionsField).toBeTruthy();

      const parsed = JSON.parse(optionsField!) as Array<{
        name: string;
        type: string;
        values: Array<{
          name: string;
          priceModifier: number;
          quantity: number;
        }>;
      }>;
      expect(parsed).toHaveLength(1);
      expect(parsed[0]).toEqual({
        name: 'Size',
        type: 'select',
        values: [
          { name: 'Small', priceModifier: 0, quantity: 10 },
          { name: 'Large', priceModifier: 5, quantity: 15 },
        ],
      });
    });
  });
});

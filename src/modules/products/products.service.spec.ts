import { Test, TestingModule } from '@nestjs/testing';
import { OpenCartClient } from '../../integrations/opencart/opencart.client';
import {
  ProductDto,
  ProductVariantDto,
} from '../../integrations/opencart/opencart.types';
import { ProductOptionTypeE } from '../../common/enums/product-option-type.enum';
import { ProductsService } from './products.service';

describe('ProductsService — variants', () => {
  let service: ProductsService;
  let openCartClient: {
    getProduct: jest.Mock;
    listProductVariants: jest.Mock;
    createProduct: jest.Mock;
  };

  const baseProduct: ProductDto = {
    id: 42,
    name: 'Apple Cinema 30"',
    model: 'Product 15',
    price: 100,
    quantity: 990,
    status: true,
  };

  const variants: ProductVariantDto[] = [
    {
      productId: 42,
      optionId: 1,
      optionName: 'Size',
      optionValueId: 5,
      valueName: 'Small',
      priceModifier: 10,
      quantity: 96,
    },
  ];

  beforeEach(async () => {
    openCartClient = {
      getProduct: jest.fn(),
      listProductVariants: jest.fn(),
      createProduct: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: OpenCartClient, useValue: openCartClient },
      ],
    }).compile();

    service = module.get(ProductsService);
  });

  it('findOne attaches variants to product detail', async () => {
    openCartClient.getProduct.mockResolvedValue(baseProduct);
    openCartClient.listProductVariants.mockResolvedValue(variants);

    const result = await service.findOne(42);

    expect(openCartClient.getProduct).toHaveBeenCalledWith(42);
    expect(openCartClient.listProductVariants).toHaveBeenCalledWith(42);
    expect(result).toEqual({ ...baseProduct, variants });
  });

  it('create forwards options and returns product with variants', async () => {
    const created: ProductDto = { ...baseProduct, id: 99, name: 'Variant Tee' };
    openCartClient.createProduct.mockResolvedValue(created);
    openCartClient.listProductVariants.mockResolvedValue(variants);

    const result = await service.create({
      name: 'Variant Tee',
      model: 'VTT-1',
      price: 24.99,
      quantity: 50,
      options: [
        {
          name: 'Size',
          type: ProductOptionTypeE.SELECT,
          values: [{ name: 'Small', priceModifier: 0, quantity: 10 }],
        },
      ],
    });

    expect(openCartClient.createProduct).toHaveBeenCalledWith({
      name: 'Variant Tee',
      model: 'VTT-1',
      price: 24.99,
      quantity: 50,
      status: true,
      description: undefined,
      options: [
        {
          name: 'Size',
          type: 'select',
          values: [{ name: 'Small', priceModifier: 0, quantity: 10 }],
        },
      ],
    });
    expect(openCartClient.listProductVariants).toHaveBeenCalledWith(99);
    expect(result).toEqual({ ...created, variants });
  });
});

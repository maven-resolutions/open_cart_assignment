import { BadRequestException } from '@nestjs/common';

export class InsufficientStockException extends BadRequestException {
  constructor(message = 'Insufficient stock') {
    super(message);
  }
}

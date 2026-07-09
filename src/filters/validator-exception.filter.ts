import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ValidationError } from 'class-validator';

// Re-format error response of class-validator to fit Google JSON style
@Catch(ValidationError)
export class ValidationExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ValidationExceptionFilter.name);

  catch(exception: ValidationError | ValidationError[], host: ArgumentsHost) {
    this.logger.error(exception);

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let message = 'Validation Error';
    let data: unknown = null;

    if (Array.isArray(exception)) {
      // Collect all messages and put the array in data
      const messages: string[] = [];
      data = exception.map((err) => {
        const constraints = err.constraints
          ? Object.values(err.constraints)
          : [];
        if (constraints.length) messages.push(...constraints);
        return {
          property: err.property,
          constraints: err.constraints,
          children: err.children,
        };
      });
      message = messages.join(', ');
    } else {
      // Single error
      const constraints = exception.constraints
        ? Object.values(exception.constraints)
        : [];
      message = constraints.join(', ') || message;
      data = {
        property: exception.property,
        constraints: exception.constraints,
        children: exception.children,
      };
    }

    response.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      status: false,
      data,
      message,
    });
  }
}

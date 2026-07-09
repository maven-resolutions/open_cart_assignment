import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import {
  CheckViolationError,
  ConstraintViolationError,
  DataError,
  DBError,
  ForeignKeyViolationError,
  NotFoundError,
  NotNullViolationError,
  UniqueViolationError,
  ValidationError,
} from 'objection';
import { CustomValidationException } from '../exception/validation.exception';

@Catch()
export class AllExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionFilter.name);

  private sendError(
    response: Response,
    statusCode: number,
    message: string,
    data: unknown = null,
  ) {
    return response.status(statusCode).json({
      statusCode,
      status: false,
      data,
      message,
    });
  }

  catch(exception: unknown, host: ArgumentsHost) {
    if (exception instanceof Error) {
      this.logger.error(exception.stack);
    } else {
      this.logger.error(String(exception));
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const isProduction = process.env.NODE_ENV === 'production';
    let statusCode = HttpStatus.BAD_REQUEST;
    let message = 'An error occurred';
    let data: unknown = null;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null && 'message' in res) {
        const responseBody = res as { message?: string | string[] };
        message = Array.isArray(responseBody.message)
          ? responseBody.message.join(', ')
          : String(responseBody.message ?? message);
      }
    } else if (exception instanceof Error) {
      message = String(exception.message);
    }

    if (exception instanceof CustomValidationException) {
      statusCode = exception.getStatus();
      message = exception.message;
      data = exception.validationErrors;
      return this.sendError(response, statusCode, message, data);
    }

    if (exception instanceof ValidationError) {
      switch (exception.type) {
        case 'ModelValidation': {
          const errorMsg = isProduction
            ? 'Model validation error'
            : exception.message;
          return this.sendError(response, HttpStatus.BAD_REQUEST, errorMsg);
        }
        case 'RelationExpression': {
          const errorMsg = isProduction
            ? 'Relation expression error'
            : exception.message;
          return this.sendError(response, HttpStatus.BAD_REQUEST, errorMsg);
        }
        case 'UnallowedRelation': {
          const errorMsg = isProduction
            ? 'Unallowed relation error'
            : exception.message;
          return this.sendError(response, HttpStatus.BAD_REQUEST, errorMsg);
        }
        case 'InvalidGraph': {
          const errorMsg = isProduction
            ? 'Invalid graph error'
            : exception.message;
          return this.sendError(response, HttpStatus.BAD_REQUEST, errorMsg);
        }
        default: {
          const errorMsg = isProduction
            ? 'Unknown validation error'
            : exception.message;
          return this.sendError(response, HttpStatus.BAD_REQUEST, errorMsg);
        }
      }
    } else if (exception instanceof NotNullViolationError) {
      const errorMsg = isProduction
        ? 'Not null violation error'
        : exception.message;
      return this.sendError(response, HttpStatus.BAD_REQUEST, errorMsg);
    } else if (exception instanceof UniqueViolationError) {
      const errorMsg = isProduction
        ? 'Unique violation error'
        : exception.message;
      return this.sendError(response, HttpStatus.CONFLICT, errorMsg);
    } else if (exception instanceof ConstraintViolationError) {
      const errorMsg = isProduction
        ? 'Constraint violation error'
        : exception.message;
      return this.sendError(response, HttpStatus.BAD_REQUEST, errorMsg);
    } else if (exception instanceof DBError) {
      const errorMsg = isProduction
        ? 'Some errors occurred with database'
        : exception.message;
      return this.sendError(
        response,
        HttpStatus.INTERNAL_SERVER_ERROR,
        errorMsg,
      );
    } else if (exception instanceof DataError) {
      const errorMsg = isProduction ? 'Bad data provided' : exception.message;
      return this.sendError(response, HttpStatus.BAD_REQUEST, errorMsg);
    } else if (exception instanceof CheckViolationError) {
      const errorMsg = isProduction
        ? 'Check violation error'
        : exception.message;
      return this.sendError(response, HttpStatus.BAD_REQUEST, errorMsg);
    } else if (exception instanceof ForeignKeyViolationError) {
      const errorMsg = isProduction
        ? 'Foreign key violation error'
        : exception.message;
      return this.sendError(response, HttpStatus.BAD_REQUEST, errorMsg);
    } else if (exception instanceof NotFoundError) {
      const errorMsg = isProduction ? 'Not found error' : exception.message;
      return this.sendError(response, HttpStatus.NOT_FOUND, errorMsg);
    }

    return this.sendError(response, statusCode, message);
  }
}

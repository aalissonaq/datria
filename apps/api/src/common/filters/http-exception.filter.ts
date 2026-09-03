import { randomUUID } from "node:crypto";
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import { DomainException } from "../exceptions/domain.exception";

export interface ErrorResponseBody {
  status: number;
  code: string;
  message: string;
  correlationId: string;
  timestamp: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const correlationId = request?.correlationId || randomUUID();
    const timestamp = new Date().toISOString();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = "INTERNAL_SERVER_ERROR";
    let message = "An unexpected error occurred";

    if (exception instanceof DomainException) {
      status = exception.getStatus();
      code = exception.code;
      message = exception.message;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === "string") {
        message = res;
      } else if (typeof res === "object" && res !== null) {
        const resObj = res as Record<string, unknown>;
        if (Array.isArray(resObj.message)) {
          message = resObj.message.join("; ");
          code = "VALIDATION_ERROR";
        } else if (typeof resObj.message === "string") {
          message = resObj.message;
        }

        if (typeof resObj.code === "string") {
          code = resObj.code;
        } else if (code === "INTERNAL_SERVER_ERROR") {
          code = HttpStatus[status] || "HTTP_ERROR";
        }
      }
    } else {
      // Log unexpected error internally with correlationId, but do not expose details to client
      this.logger.error(
        `[${correlationId}] Unexpected unhandled exception: ${
          exception instanceof Error ? exception.message : String(exception)
        }`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const body: ErrorResponseBody = {
      status,
      code,
      message,
      correlationId,
      timestamp,
    };

    response.status(status).json(body);
  }
}

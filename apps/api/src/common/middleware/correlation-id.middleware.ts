import { randomUUID } from "node:crypto";
import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const rawHeader = req.headers["x-correlation-id"];
    const incomingId = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

    const correlationId =
      incomingId && UUID_REGEX.test(incomingId) ? incomingId : randomUUID();

    req.correlationId = correlationId;
    res.setHeader("X-Correlation-Id", correlationId);

    next();
  }
}

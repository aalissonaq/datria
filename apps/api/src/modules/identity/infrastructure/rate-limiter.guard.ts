import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import { RateLimitedException } from "../../../common/exceptions/domain.exception";

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

export const RATE_LIMIT_KEY = "rateLimit";
export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);

interface RateBucket {
  count: number;
  resetAt: number;
}

@Injectable()
export class RateLimiterGuard implements CanActivate {
  private readonly hits = new Map<string, RateBucket>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // In test environment, skip rate limiting unless specifically testing rate limits
    if (
      (process.env.NODE_ENV === "test" ||
        process.env.PLAYWRIGHT === "true" ||
        process.env.DISABLE_RATE_LIMIT === "true") &&
      !process.env.TEST_RATE_LIMIT
    ) {
      return true;
    }

    const options = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const ip =
      (request.headers["x-forwarded-for"] as string) ||
      request.socket.remoteAddress ||
      "127.0.0.1";

    const key = `${ip}:${request.path}`;
    const now = Date.now();

    const bucket = this.hits.get(key);

    if (!bucket || bucket.resetAt < now) {
      this.hits.set(key, { count: 1, resetAt: now + options.windowMs });
      return true;
    }

    if (bucket.count >= options.limit) {
      throw new RateLimitedException();
    }

    bucket.count += 1;
    return true;
  }
}

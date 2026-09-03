import { timingSafeEqual } from "node:crypto";
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import { ForbiddenException } from "../exceptions/domain.exception";
import { EnvironmentVariables } from "../../config/env.validation";

export const SKIP_CSRF_KEY = "skipCsrf";
export const SkipCsrf = () => SetMetadata(SKIP_CSRF_KEY, true);

export const CSRF_COOKIE_NAME = "datria_csrf";
export const CSRF_HEADER_NAME = "x-csrf-token";

@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly webOrigin: string;

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {
    this.webOrigin =
      this.configService.get("WEB_ORIGIN", { infer: true }) ||
      "http://localhost:5173";
  }

  canActivate(context: ExecutionContext): boolean {
    const isSkipped = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isSkipped) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method.toUpperCase();

    // Safe idempotent methods do not mutate state
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
      return true;
    }

    // Origin/Referer verification against allowed Web Origin
    const origin = request.headers["origin"] || request.headers["referer"];
    if (origin) {
      const originUrl = Array.isArray(origin) ? origin[0] : origin;
      if (!originUrl.startsWith(this.webOrigin)) {
        throw new ForbiddenException("Cross-site request origin rejected");
      }
    }

    // Double-submit token validation
    const cookieToken = request.cookies?.[CSRF_COOKIE_NAME];
    const rawHeader = request.headers[CSRF_HEADER_NAME];
    const headerToken = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

    if (!cookieToken || !headerToken) {
      throw new ForbiddenException("Missing CSRF token in cookie or header");
    }

    const cookieBuf = Buffer.from(cookieToken, "utf8");
    const headerBuf = Buffer.from(headerToken, "utf8");

    if (
      cookieBuf.length !== headerBuf.length ||
      !timingSafeEqual(cookieBuf, headerBuf)
    ) {
      throw new ForbiddenException("Invalid CSRF token mismatch");
    }

    return true;
  }
}

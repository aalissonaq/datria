import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";
import { PrismaService } from "../../prisma/prisma.service";
import { UnauthorizedException } from "../../common/exceptions/domain.exception";
import { EnvironmentVariables } from "../../config/env.validation";
import { AuthenticatedUser } from "./tenant-context.interface";

export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ACCESS_COOKIE_NAME = "datria_access";

export interface JwtAccessPayload {
  sub: string;
  sid: string;
  jti?: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class AuthenticationGuard implements CanActivate {
  private readonly jwtSecret: string;
  private readonly sessionIdleMs: number;

  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {
    this.jwtSecret = this.configService.get("JWT_ACCESS_SECRET", {
      infer: true,
    });
    this.sessionIdleMs = 30 * 60 * 1000; // 30 minutes default idle timeout
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException("Authentication required");
    }

    let payload: JwtAccessPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtAccessPayload>(token, {
        secret: this.jwtSecret,
      });
    } catch {
      throw new UnauthorizedException("Invalid or expired access token");
    }

    if (!payload.sub || !payload.sid) {
      throw new UnauthorizedException("Invalid access token payload");
    }

    const now = new Date();

    // Verify session state in database
    const session = await this.prisma.session.findUnique({
      where: { id: payload.sid },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            status: true,
          },
        },
      },
    });

    if (!session || session.userId !== payload.sub) {
      throw new UnauthorizedException("Session not found or invalid");
    }

    if (session.revokedAt) {
      throw new UnauthorizedException("Session has been revoked");
    }

    if (session.absoluteExpiresAt < now) {
      throw new UnauthorizedException("Session has reached maximum lifetime");
    }

    if (session.idleExpiresAt < now) {
      throw new UnauthorizedException("Session expired due to inactivity");
    }

    if (session.user.status !== "ACTIVE") {
      throw new UnauthorizedException("User account is not active");
    }

    // Update sliding idle expiration asynchronously
    const nextIdleExpiresAt = new Date(now.getTime() + this.sessionIdleMs);
    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        lastUsedAt: now,
        idleExpiresAt: nextIdleExpiresAt,
      },
    });

    const user: AuthenticatedUser = {
      id: session.user.id,
      email: session.user.email,
      displayName: session.user.displayName,
      sessionId: session.id,
    };

    request.user = user;
    return true;
  }

  private extractToken(request: Request): string | null {
    // 1. Check HttpOnly cookie first
    if (request.cookies?.[ACCESS_COOKIE_NAME]) {
      return request.cookies[ACCESS_COOKIE_NAME];
    }

    // 2. Fallback to Authorization: Bearer <token>
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      return authHeader.substring(7).trim();
    }

    return null;
  }
}

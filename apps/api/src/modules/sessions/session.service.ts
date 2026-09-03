import { createHash, randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { AuditOutcome, UserStatus } from "@prisma/client";
import { UnauthorizedException } from "../../common/exceptions/domain.exception";
import { EnvironmentVariables } from "../../config/env.validation";
import { AuditService } from "../audit/audit.service";
import { TokenService } from "../identity/infrastructure/token.service";
import { SessionRepository } from "./session.repository";

export interface SessionResult {
  sessionId: string;
  accessToken: string;
  refreshToken: string;
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class SessionService {
  private readonly jwtSecret: string;

  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly tokenService: TokenService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {
    this.jwtSecret = this.configService.get("JWT_ACCESS_SECRET", {
      infer: true,
    });
  }

  private hashIdentifier(value?: string): string | null {
    if (!value) {
      return null;
    }
    return createHash("sha256").update(value.trim()).digest("hex");
  }

  async createSession(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<SessionResult> {
    const now = new Date();
    const idleExpiresAt = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes
    const absoluteExpiresAt = new Date(now.getTime() + 8 * 60 * 60 * 1000); // 8 hours

    const { rawToken: refreshToken, tokenHash: refreshTokenHash } =
      this.tokenService.generateSecureToken();

    const tokenFamilyId = randomUUID();
    const currentJti = randomUUID();

    const session = await this.sessionRepository.createSession({
      userId,
      refreshTokenHash,
      tokenFamilyId,
      currentJti,
      idleExpiresAt,
      absoluteExpiresAt,
      ipHash: this.hashIdentifier(ipAddress),
      userAgentHash: this.hashIdentifier(userAgent),
    });

    const accessToken = await this.jwtService.signAsync(
      {
        sub: userId,
        sid: session.id,
        jti: currentJti,
      },
      {
        secret: this.jwtSecret,
        expiresIn: "15m",
      },
    );

    return {
      sessionId: session.id,
      accessToken,
      refreshToken,
    };
  }

  async rotateRefreshToken(
    rawRefreshToken: string,
    correlationId: string,
  ): Promise<RefreshResult> {
    if (!rawRefreshToken || typeof rawRefreshToken !== "string") {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const tokenHash = this.tokenService.hashToken(rawRefreshToken.trim());
    const session =
      await this.sessionRepository.findByRefreshTokenHash(tokenHash);

    const now = new Date();

    if (!session) {
      throw new UnauthorizedException("Invalid or unrecognized refresh token");
    }

    // Replay attack detection: token was already revoked or rotated! (FR-011)
    if (session.revokedAt !== null) {
      await this.sessionRepository.revokeFamily(
        session.tokenFamilyId,
        "FAMILY_REVOKED_REUSE_DETECTED",
      );
      await this.sessionRepository.revokeAllUserSessions(
        session.userId,
        "FAMILY_REVOKED_REUSE_DETECTED",
      );

      await this.auditService.logEvent({
        actorUserId: session.userId,
        action: "REFRESH_TOKEN_REPLAY_DETECTED",
        targetType: "Session",
        targetId: session.id,
        outcome: AuditOutcome.DENIED,
        correlationId,
        metadata: {
          reason:
            "Revoked refresh token reuse attempt detected. All user sessions invalidated.",
        },
      });

      throw new UnauthorizedException(
        "Security alert: refresh token reuse detected. All sessions have been terminated.",
      );
    }

    if (session.absoluteExpiresAt < now) {
      await this.sessionRepository.revokeSession(
        session.id,
        "ABSOLUTE_TIMEOUT",
      );
      throw new UnauthorizedException(
        "Session reached maximum absolute lifetime",
      );
    }

    if (session.idleExpiresAt < now) {
      await this.sessionRepository.revokeSession(session.id, "IDLE_TIMEOUT");
      throw new UnauthorizedException("Session expired due to inactivity");
    }

    if (session.user.status !== UserStatus.ACTIVE) {
      await this.sessionRepository.revokeSession(session.id, "USER_INACTIVE");
      throw new UnauthorizedException("User account is not active");
    }

    // Single-use token rotation: generate new refresh token
    const { rawToken: newRefreshToken, tokenHash: newRefreshTokenHash } =
      this.tokenService.generateSecureToken();

    const newJti = randomUUID();
    const previousJti = session.currentJti;
    const newIdleExpiresAt = new Date(now.getTime() + 30 * 60 * 1000);

    // 1. Mark previous session as rotated
    await this.sessionRepository.revokeSession(session.id, "ROTATED");

    // 2. Create successor session in the same token family
    const nextSession = await this.sessionRepository.createSession({
      userId: session.userId,
      refreshTokenHash: newRefreshTokenHash,
      tokenFamilyId: session.tokenFamilyId,
      currentJti: newJti,
      previousJti,
      idleExpiresAt: newIdleExpiresAt,
      absoluteExpiresAt: session.absoluteExpiresAt, // preserve absolute lifetime
      ipHash: session.ipHash,
      userAgentHash: session.userAgentHash,
    });

    const accessToken = await this.jwtService.signAsync(
      {
        sub: session.userId,
        sid: nextSession.id,
        jti: newJti,
      },
      {
        secret: this.jwtSecret,
        expiresIn: "15m",
      },
    );

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  async revokeSession(
    sessionId: string,
    reason = "USER_LOGOUT",
  ): Promise<void> {
    await this.sessionRepository.revokeSession(sessionId, reason);
  }

  async revokeAllUserSessions(
    userId: string,
    reason = "SECURITY_RESET",
  ): Promise<void> {
    await this.sessionRepository.revokeAllUserSessions(userId, reason);
  }
}

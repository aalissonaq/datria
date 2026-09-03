import { Injectable } from "@nestjs/common";
import { AuditOutcome, UserStatus } from "@prisma/client";
import { InvalidCredentialsException } from "../../../common/exceptions/domain.exception";
import { AuditService } from "../../audit/audit.service";
import { SessionService } from "../../sessions/session.service";
import { Argon2PasswordHasher } from "../infrastructure/argon2-password-hasher";
import { UserRepository } from "../infrastructure/user.repository";

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthenticatedUserDto {
  id: string;
  email: string;
  displayName: string;
}

export interface LoginResult {
  user: AuthenticatedUserDto;
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class LoginService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly sessionService: SessionService,
    private readonly passwordHasher: Argon2PasswordHasher,
    private readonly auditService: AuditService,
  ) {}

  async login(
    dto: LoginDto,
    correlationId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<LoginResult> {
    if (!dto.email || !dto.password) {
      throw new InvalidCredentialsException();
    }

    const normalizedEmail = dto.email.trim().toLowerCase();
    const user =
      await this.userRepository.findByNormalizedEmailWithCredentials(
        normalizedEmail,
      );

    // Anti-enumeration: neutral response if user doesn't exist or is not ACTIVE (FR-007)
    if (
      !user ||
      !user.passwordCredential ||
      user.status !== UserStatus.ACTIVE
    ) {
      await this.auditService.logEvent({
        action: "LOGIN_FAILED",
        targetType: "User",
        targetId: user?.id ?? null,
        outcome: AuditOutcome.FAILURE,
        correlationId,
        metadata: {
          reason: "Invalid email, inactive status, or password mismatch",
          targetEmail: normalizedEmail,
        },
      });

      throw new InvalidCredentialsException();
    }

    const isPasswordValid = await this.passwordHasher.verify(
      dto.password,
      user.passwordCredential.passwordHash,
    );

    if (!isPasswordValid) {
      await this.auditService.logEvent({
        actorUserId: user.id,
        action: "LOGIN_FAILED",
        targetType: "User",
        targetId: user.id,
        outcome: AuditOutcome.FAILURE,
        correlationId,
        metadata: {
          reason: "Password mismatch",
          targetEmail: normalizedEmail,
        },
      });

      throw new InvalidCredentialsException();
    }

    // Rehash if Argon2 parameters have evolved
    if (this.passwordHasher.needsRehash(user.passwordCredential.passwordHash)) {
      const newHash = await this.passwordHasher.hash(dto.password);
      await this.userRepository.updatePasswordHash(user.id, newHash);
    }

    const session = await this.sessionService.createSession(
      user.id,
      ipAddress,
      userAgent,
    );

    await this.auditService.logEvent({
      actorUserId: user.id,
      action: "LOGIN_SUCCEEDED",
      targetType: "User",
      targetId: user.id,
      outcome: AuditOutcome.SUCCESS,
      correlationId,
      metadata: {
        targetEmail: normalizedEmail,
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    };
  }
}

@Injectable()
export class LogoutService {
  constructor(
    private readonly sessionService: SessionService,
    private readonly auditService: AuditService,
  ) {}

  async logout(
    sessionId: string,
    userId: string,
    correlationId: string,
  ): Promise<void> {
    await this.sessionService.revokeSession(sessionId, "USER_LOGOUT");

    await this.auditService.logEvent({
      actorUserId: userId,
      action: "LOGOUT",
      targetType: "Session",
      targetId: sessionId,
      outcome: AuditOutcome.SUCCESS,
      correlationId,
    });
  }
}

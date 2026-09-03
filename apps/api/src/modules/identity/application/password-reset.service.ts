import { Inject, Injectable } from "@nestjs/common";
import { AuditOutcome, UserStatus } from "@prisma/client";
import { InvalidTokenException } from "../../../common/exceptions/domain.exception";
import { AuditService } from "../../audit/audit.service";
import { MAIL_PORT, MailPort } from "../../mail/mail-port.interface";
import { buildPasswordResetEmail } from "../../mail/templates/password-reset.template";
import { SessionRepository } from "../../sessions/session.repository";
import { Argon2PasswordHasher } from "../infrastructure/argon2-password-hasher";
import { PasswordResetTokenRepository } from "../infrastructure/password-reset-token.repository";
import { TokenService } from "../infrastructure/token.service";
import { UserRepository } from "../infrastructure/user.repository";

export interface RequestResetDto {
  email: string;
}

export interface ResetPasswordDto {
  token?: string;
  tokenHash?: string;
  newPassword: string;
}

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly tokenRepository: PasswordResetTokenRepository,
    private readonly userRepository: UserRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly passwordHasher: Argon2PasswordHasher,
    private readonly tokenService: TokenService,
    @Inject(MAIL_PORT) private readonly mailPort: MailPort,
    private readonly auditService: AuditService,
  ) {}

  async requestPasswordReset(
    email: string,
    correlationId: string,
    webOrigin: string,
  ): Promise<{ message: string }> {
    const neutralMessage =
      "Se o e-mail estiver cadastrado, as instruções para redefinição de senha foram enviadas.";

    if (!email || typeof email !== "string") {
      return { message: neutralMessage };
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user =
      await this.userRepository.findByNormalizedEmail(normalizedEmail);

    if (!user || user.status !== UserStatus.ACTIVE) {
      await this.auditService.logEvent({
        action: "PASSWORD_RESET_REQUESTED",
        targetType: "User",
        targetId: user?.id ?? null,
        outcome: AuditOutcome.SUCCESS,
        correlationId,
        metadata: {
          note: "Neutral anti-enumeration response issued",
          targetEmail: normalizedEmail,
        },
      });

      return { message: neutralMessage };
    }

    // Revoke any previous active reset tokens for this user
    await this.tokenRepository.revokeActiveTokensForUser(user.id);

    const { rawToken, tokenHash } = this.tokenService.generateSecureToken();
    const expiresAt = this.tokenService.calculateExpiresAt("30m"); // 30 minutes

    await this.tokenRepository.createToken({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    const resetUrl = `${webOrigin}/reset-password?token=${rawToken}`;
    const emailContent = buildPasswordResetEmail({
      displayName: user.displayName,
      resetUrl,
      expiresInMinutes: 30,
    });

    await this.mailPort.sendMail({
      to: user.email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    await this.auditService.logEvent({
      actorUserId: user.id,
      action: "PASSWORD_RESET_REQUESTED",
      targetType: "User",
      targetId: user.id,
      outcome: AuditOutcome.SUCCESS,
      correlationId,
      metadata: {
        targetEmail: normalizedEmail,
      },
    });

    return { message: neutralMessage };
  }

  async resetPassword(
    dto: ResetPasswordDto,
    correlationId: string,
  ): Promise<{ message: string }> {
    const rawToken = dto.token?.trim();
    const tokenHash =
      dto.tokenHash?.trim() ||
      (rawToken ? this.tokenService.hashToken(rawToken) : null);

    if (!tokenHash) {
      throw new InvalidTokenException(
        "Token de redefinição inválido, expirado ou já utilizado",
      );
    }

    const tokenRecord = await this.tokenRepository.findValidToken(tokenHash);

    if (!tokenRecord) {
      throw new InvalidTokenException(
        "Token de redefinição inválido, expirado ou já utilizado",
      );
    }

    // Validate password policy
    this.passwordHasher.validatePasswordPolicy(dto.newPassword);

    // Hash new password
    const newPasswordHash = await this.passwordHasher.hash(dto.newPassword);

    // Update password
    await this.userRepository.updatePasswordHash(
      tokenRecord.userId,
      newPasswordHash,
    );

    // Mark token as consumed
    await this.tokenRepository.markAsConsumed(tokenRecord.id);

    // Invalidate all active sessions for this user
    await this.sessionRepository.revokeAllUserSessions(
      tokenRecord.userId,
      "PASSWORD_RESET",
    );

    await this.auditService.logEvent({
      actorUserId: tokenRecord.userId,
      action: "PASSWORD_RESET_COMPLETED",
      targetType: "User",
      targetId: tokenRecord.userId,
      outcome: AuditOutcome.SUCCESS,
      correlationId,
    });

    return {
      message: "Senha redefinida com sucesso. Faça login com sua nova senha.",
    };
  }
}

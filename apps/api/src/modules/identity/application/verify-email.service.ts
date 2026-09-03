import { Inject, Injectable } from "@nestjs/common";
import { AuditOutcome, UserStatus } from "@prisma/client";
import { InvalidTokenException } from "../../../common/exceptions/domain.exception";
import { AuditService } from "../../audit/audit.service";
import { MAIL_PORT, MailPort } from "../../mail/mail-port.interface";
import { renderVerifyEmailTemplate } from "../../mail/templates/verify-email.template";
import { TokenService } from "../infrastructure/token.service";
import { UserRepository } from "../infrastructure/user.repository";

export interface VerifyEmailDto {
  token: string;
}

export interface ResendVerificationDto {
  email: string;
}

export const NEUTRAL_RESEND_RESPONSE = {
  message: "If the email is eligible, a new verification link has been sent.",
};

@Injectable()
export class VerifyEmailService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly tokenService: TokenService,
    private readonly auditService: AuditService,
  ) {}

  async verifyEmail(dto: VerifyEmailDto, correlationId: string): Promise<void> {
    if (
      !dto.token ||
      typeof dto.token !== "string" ||
      dto.token.trim().length === 0
    ) {
      throw new InvalidTokenException(
        "The verification token is invalid, expired, or already used",
      );
    }

    const rawToken = dto.token.trim();
    const tokenHash = this.tokenService.hashToken(rawToken);

    const record =
      await this.userRepository.findVerificationTokenByHash(tokenHash);

    const now = new Date();
    if (!record || record.consumedAt !== null || record.expiresAt < now) {
      throw new InvalidTokenException(
        "The verification token is invalid, expired, or already used",
      );
    }

    await this.userRepository.consumeVerificationTokenAndActivateUser(
      record.id,
      record.userId,
    );

    await this.auditService.logEvent({
      actorUserId: record.userId,
      action: "EMAIL_VERIFIED",
      targetType: "User",
      targetId: record.userId,
      outcome: AuditOutcome.SUCCESS,
      correlationId,
      metadata: {
        targetEmail: record.user.normalizedEmail,
      },
    });
  }
}

@Injectable()
export class ResendVerificationService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly tokenService: TokenService,
    @Inject(MAIL_PORT) private readonly mailPort: MailPort,
    private readonly auditService: AuditService,
  ) {}

  async resendVerification(
    dto: ResendVerificationDto,
    correlationId: string,
    webOrigin = "http://localhost:5173",
  ): Promise<{ message: string }> {
    if (!dto.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dto.email.trim())) {
      return NEUTRAL_RESEND_RESPONSE;
    }

    const normalizedEmail = dto.email.trim().toLowerCase();
    const user =
      await this.userRepository.findByNormalizedEmail(normalizedEmail);

    // Only resend if user exists and is strictly PENDING_VERIFICATION
    if (!user || user.status !== UserStatus.PENDING_VERIFICATION) {
      return NEUTRAL_RESEND_RESPONSE;
    }

    // Invalidate previous unconsumed verification tokens
    await this.userRepository.invalidatePendingVerificationTokens(user.id);

    // Create new token (24h)
    const { rawToken, tokenHash } = this.tokenService.generateSecureToken();
    const expiresAt = this.tokenService.calculateExpiresAt("24h");

    await this.userRepository.createVerificationToken({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    // Send email
    const verificationUrl = `${webOrigin}/verify-email?token=${rawToken}`;
    const emailContent = renderVerifyEmailTemplate({
      displayName: user.displayName,
      verificationUrl,
      expiresInHours: 24,
    });

    await this.mailPort.sendMail({
      to: user.email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    await this.auditService.logEvent({
      actorUserId: user.id,
      action: "VERIFICATION_EMAIL_RESENT",
      targetType: "User",
      targetId: user.id,
      outcome: AuditOutcome.SUCCESS,
      correlationId,
      metadata: {
        targetEmail: normalizedEmail,
      },
    });

    return NEUTRAL_RESEND_RESPONSE;
  }
}

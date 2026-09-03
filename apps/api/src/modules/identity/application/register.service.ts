import { Inject, Injectable } from "@nestjs/common";
import { AuditOutcome } from "@prisma/client";
import { ValidationErrorException } from "../../../common/exceptions/domain.exception";
import { AuditService } from "../../audit/audit.service";
import { MAIL_PORT, MailPort } from "../../mail/mail-port.interface";
import { renderVerifyEmailTemplate } from "../../mail/templates/verify-email.template";
import { Argon2PasswordHasher } from "../infrastructure/argon2-password-hasher";
import { TokenService } from "../infrastructure/token.service";
import { UserRepository } from "../infrastructure/user.repository";

export interface RegisterDto {
  displayName: string;
  email: string;
  password: string;
  termsVersion: string;
}

export interface RegisterResponseDto {
  message: string;
}

export const NEUTRAL_REGISTER_RESPONSE: RegisterResponseDto = {
  message: "If the email is valid, a verification link has been sent.",
};

@Injectable()
export class RegisterService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: Argon2PasswordHasher,
    private readonly tokenService: TokenService,
    @Inject(MAIL_PORT) private readonly mailPort: MailPort,
    private readonly auditService: AuditService,
  ) {}

  normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  async register(
    dto: RegisterDto,
    correlationId: string,
    webOrigin = "http://localhost:5173",
  ): Promise<RegisterResponseDto> {
    if (
      !dto.displayName ||
      dto.displayName.trim().length < 2 ||
      dto.displayName.trim().length > 120
    ) {
      throw new ValidationErrorException(
        "Display name must be between 2 and 120 characters in length",
      );
    }

    if (!dto.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dto.email.trim())) {
      throw new ValidationErrorException("A valid email address is required");
    }

    if (
      !dto.termsVersion ||
      dto.termsVersion.trim().length === 0 ||
      dto.termsVersion.trim().length > 40
    ) {
      throw new ValidationErrorException(
        "Acceptance of the terms of service version is required",
      );
    }

    // Validate password policy (Argon2id SEC-EXC-001)
    this.passwordHasher.validatePasswordPolicy(dto.password);

    const normalizedEmail = this.normalizeEmail(dto.email);
    const existingUser =
      await this.userRepository.findByNormalizedEmail(normalizedEmail);

    if (existingUser) {
      // Neutral response to avoid user enumeration (FR-005)
      await this.auditService.logEvent({
        action: "USER_REGISTERED_DUPLICATE_IGNORED",
        targetType: "User",
        targetId: existingUser.id,
        outcome: AuditOutcome.SUCCESS,
        correlationId,
        metadata: {
          targetEmail: normalizedEmail,
        },
      });

      return NEUTRAL_REGISTER_RESPONSE;
    }

    const passwordHash = await this.passwordHasher.hash(dto.password);

    const user = await this.userRepository.createUserWithCredentials({
      displayName: dto.displayName.trim(),
      email: dto.email.trim(),
      normalizedEmail,
      passwordHash,
      termsVersion: dto.termsVersion.trim(),
    });

    // Generate single-use verification token (24-hour expiration)
    const { rawToken, tokenHash } = this.tokenService.generateSecureToken();
    const expiresAt = this.tokenService.calculateExpiresAt("24h");

    await this.userRepository.createVerificationToken({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    // Send verification email
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
      action: "USER_REGISTERED",
      targetType: "User",
      targetId: user.id,
      outcome: AuditOutcome.SUCCESS,
      correlationId,
      metadata: {
        targetEmail: normalizedEmail,
        termsVersion: dto.termsVersion.trim(),
      },
    });

    return NEUTRAL_REGISTER_RESPONSE;
  }
}

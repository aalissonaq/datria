import { PasswordResetService } from "../../../src/modules/identity/application/password-reset.service";
import { PasswordResetTokenRepository } from "../../../src/modules/identity/infrastructure/password-reset-token.repository";
import { UserRepository } from "../../../src/modules/identity/infrastructure/user.repository";
import { SessionRepository } from "../../../src/modules/sessions/session.repository";
import { Argon2PasswordHasher } from "../../../src/modules/identity/infrastructure/argon2-password-hasher";
import { TokenService } from "../../../src/modules/identity/infrastructure/token.service";
import { MailPort } from "../../../src/modules/mail/mail-port.interface";
import { AuditService } from "../../../src/modules/audit/audit.service";
import { InvalidTokenException } from "../../../src/common/exceptions/domain.exception";
import { UserStatus } from "@prisma/client";

describe("PasswordResetService (Unit)", () => {
  let service: PasswordResetService;

  let mockTokenRepo: {
    createToken: jest.Mock;
    findValidToken: jest.Mock;
    markAsConsumed: jest.Mock;
    revokeActiveTokensForUser: jest.Mock;
  };
  let mockUserRepo: {
    findByNormalizedEmail: jest.Mock;
    findById: jest.Mock;
    updatePasswordHash: jest.Mock;
  };
  let mockSessionRepo: {
    revokeAllUserSessions: jest.Mock;
  };
  let mockHasher: {
    hash: jest.Mock;
    validatePasswordPolicy: jest.Mock;
  };
  let mockTokenService: {
    generateSecureToken: jest.Mock;
    hashToken: jest.Mock;
    calculateExpiresAt: jest.Mock;
  };
  let mockMailPort: {
    sendMail: jest.Mock;
  };
  let mockAuditService: {
    logEvent: jest.Mock;
  };

  beforeEach(() => {
    mockTokenRepo = {
      createToken: jest.fn(),
      findValidToken: jest.fn(),
      markAsConsumed: jest.fn(),
      revokeActiveTokensForUser: jest.fn(),
    };
    mockUserRepo = {
      findByNormalizedEmail: jest.fn(),
      findById: jest.fn(),
      updatePasswordHash: jest.fn(),
    };
    mockSessionRepo = {
      revokeAllUserSessions: jest.fn().mockResolvedValue(undefined),
    };
    mockHasher = {
      hash: jest.fn().mockResolvedValue("$argon2id$newhash"),
      validatePasswordPolicy: jest.fn(),
    };
    mockTokenService = {
      generateSecureToken: jest.fn().mockReturnValue({
        rawToken: "raw-reset-token-64chars",
        tokenHash: "hashed-reset-token-64chars",
      }),
      hashToken: jest.fn().mockReturnValue("hashed-reset-token-64chars"),
      calculateExpiresAt: jest
        .fn()
        .mockReturnValue(new Date(Date.now() + 30 * 60 * 1000)),
    };
    mockMailPort = {
      sendMail: jest.fn().mockResolvedValue(undefined),
    };
    mockAuditService = {
      logEvent: jest.fn().mockResolvedValue(null),
    };

    service = new PasswordResetService(
      mockTokenRepo as unknown as PasswordResetTokenRepository,
      mockUserRepo as unknown as UserRepository,
      mockSessionRepo as unknown as SessionRepository,
      mockHasher as unknown as Argon2PasswordHasher,
      mockTokenService as unknown as TokenService,
      mockMailPort as unknown as MailPort,
      mockAuditService as unknown as AuditService,
    );
  });

  describe("requestPasswordReset", () => {
    it("generates 30m reset token, revokes previous tokens, and sends email for active user", async () => {
      mockUserRepo.findByNormalizedEmail.mockResolvedValue({
        id: "user-1",
        email: "user@example.com",
        displayName: "Test User",
        status: UserStatus.ACTIVE,
      });

      const result = await service.requestPasswordReset(
        "USER@example.com",
        "corr-1",
        "http://localhost:5173",
      );

      expect(result.message).toContain("instruções");
      expect(mockTokenRepo.revokeActiveTokensForUser).toHaveBeenCalledWith(
        "user-1",
      );
      expect(mockTokenRepo.createToken).toHaveBeenCalled();
      expect(mockMailPort.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "user@example.com",
          subject: expect.stringContaining("Recuperação"),
        }),
      );
      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: "PASSWORD_RESET_REQUESTED" }),
      );
    });

    it("returns neutral success message without sending email if account does not exist (FR-012)", async () => {
      mockUserRepo.findByNormalizedEmail.mockResolvedValue(null);

      const result = await service.requestPasswordReset(
        "ghost@example.com",
        "corr-2",
        "http://localhost:5173",
      );

      expect(result.message).toContain("instruções");
      expect(mockTokenRepo.createToken).not.toHaveBeenCalled();
      expect(mockMailPort.sendMail).not.toHaveBeenCalled();
    });
  });

  describe("resetPassword", () => {
    it("updates password hash, marks token consumed, and revokes all active sessions", async () => {
      mockTokenRepo.findValidToken.mockResolvedValue({
        id: "token-row-1",
        userId: "user-1",
        expiresAt: new Date(Date.now() + 100000),
        consumedAt: null,
        revokedAt: null,
      });

      await service.resetPassword(
        {
          token: "raw-reset-token-64chars",
          newPassword: "BrandNewPassword!2026",
        },
        "corr-3",
      );

      expect(mockHasher.validatePasswordPolicy).toHaveBeenCalledWith(
        "BrandNewPassword!2026",
      );
      expect(mockUserRepo.updatePasswordHash).toHaveBeenCalledWith(
        "user-1",
        "$argon2id$newhash",
      );
      expect(mockTokenRepo.markAsConsumed).toHaveBeenCalledWith("token-row-1");
      expect(mockSessionRepo.revokeAllUserSessions).toHaveBeenCalledWith(
        "user-1",
        "PASSWORD_RESET",
      );
      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: "PASSWORD_RESET_COMPLETED" }),
      );
    });

    it("rejects expired, consumed, or invalid reset token", async () => {
      mockTokenRepo.findValidToken.mockResolvedValue(null);

      await expect(
        service.resetPassword(
          {
            token: "expired-or-invalid-token",
            newPassword: "BrandNewPassword!2026",
          },
          "corr-4",
        ),
      ).rejects.toThrow(InvalidTokenException);
    });
  });
});

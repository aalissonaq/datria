import {
  VerifyEmailService,
  ResendVerificationService,
} from "../../../src/modules/identity/application/verify-email.service";
import { UserRepository } from "../../../src/modules/identity/infrastructure/user.repository";
import { TokenService } from "../../../src/modules/identity/infrastructure/token.service";
import { AuditService } from "../../../src/modules/audit/audit.service";
import { MailPort } from "../../../src/modules/mail/mail-port.interface";
import { InvalidTokenException } from "../../../src/common/exceptions/domain.exception";
import { UserStatus } from "@prisma/client";

describe("VerifyEmailService & ResendVerificationService (Unit)", () => {
  let verifyService: VerifyEmailService;
  let resendService: ResendVerificationService;
  let mockUserRepo: {
    findVerificationTokenByHash: jest.Mock;
    consumeVerificationTokenAndActivateUser: jest.Mock;
    findByNormalizedEmail: jest.Mock;
    invalidatePendingVerificationTokens: jest.Mock;
    createVerificationToken: jest.Mock;
  };
  let mockTokenService: {
    hashToken: jest.Mock;
    generateSecureToken: jest.Mock;
    calculateExpiresAt: jest.Mock;
  };
  let mockAuditService: {
    logEvent: jest.Mock;
  };
  let mockMailPort: {
    sendMail: jest.Mock;
  };

  beforeEach(() => {
    mockUserRepo = {
      findVerificationTokenByHash: jest.fn(),
      consumeVerificationTokenAndActivateUser: jest.fn(),
      findByNormalizedEmail: jest.fn(),
      invalidatePendingVerificationTokens: jest.fn(),
      createVerificationToken: jest.fn(),
    };
    mockTokenService = {
      hashToken: jest.fn().mockReturnValue("hashed-token-123"),
      generateSecureToken: jest.fn().mockReturnValue({
        rawToken: "raw-token-abc",
        tokenHash: "hashed-token-abc",
      }),
      calculateExpiresAt: jest
        .fn()
        .mockReturnValue(new Date(Date.now() + 24 * 60 * 60 * 1000)),
    };
    mockAuditService = {
      logEvent: jest.fn().mockResolvedValue(null),
    };
    mockMailPort = {
      sendMail: jest.fn().mockResolvedValue(undefined),
    };

    verifyService = new VerifyEmailService(
      mockUserRepo as unknown as UserRepository,
      mockTokenService as unknown as TokenService,
      mockAuditService as unknown as AuditService,
    );

    resendService = new ResendVerificationService(
      mockUserRepo as unknown as UserRepository,
      mockTokenService as unknown as TokenService,
      mockMailPort as unknown as MailPort,
      mockAuditService as unknown as AuditService,
    );
  });

  describe("VerifyEmailService", () => {
    it("consumes token and activates user when valid token provided", async () => {
      mockUserRepo.findVerificationTokenByHash.mockResolvedValue({
        id: "token-1",
        userId: "user-1",
        consumedAt: null,
        expiresAt: new Date(Date.now() + 100000),
        user: { id: "user-1", normalizedEmail: "test@example.com" },
      });

      await expect(
        verifyService.verifyEmail({ token: "raw-token" }, "corr-1"),
      ).resolves.toBeUndefined();

      expect(
        mockUserRepo.consumeVerificationTokenAndActivateUser,
      ).toHaveBeenCalledWith("token-1", "user-1");
      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "EMAIL_VERIFIED",
          actorUserId: "user-1",
        }),
      );
    });

    it("throws InvalidTokenException if token is already consumed", async () => {
      mockUserRepo.findVerificationTokenByHash.mockResolvedValue({
        id: "token-1",
        userId: "user-1",
        consumedAt: new Date(),
        expiresAt: new Date(Date.now() + 100000),
        user: { id: "user-1", normalizedEmail: "test@example.com" },
      });

      await expect(
        verifyService.verifyEmail({ token: "already-consumed" }, "corr-1"),
      ).rejects.toThrow(InvalidTokenException);
    });

    it("throws InvalidTokenException if token is expired", async () => {
      mockUserRepo.findVerificationTokenByHash.mockResolvedValue({
        id: "token-1",
        userId: "user-1",
        consumedAt: null,
        expiresAt: new Date(Date.now() - 10000), // in the past
        user: { id: "user-1", normalizedEmail: "test@example.com" },
      });

      await expect(
        verifyService.verifyEmail({ token: "expired-token" }, "corr-1"),
      ).rejects.toThrow(InvalidTokenException);
    });
  });

  describe("ResendVerificationService", () => {
    it("resends verification for pending user, invalidating prior tokens", async () => {
      mockUserRepo.findByNormalizedEmail.mockResolvedValue({
        id: "user-1",
        email: "pending@example.com",
        displayName: "Pending User",
        status: UserStatus.PENDING_VERIFICATION,
      });

      const res = await resendService.resendVerification(
        { email: "pending@example.com" },
        "corr-1",
      );

      expect(res.message).toContain("a new verification link has been sent");
      expect(
        mockUserRepo.invalidatePendingVerificationTokens,
      ).toHaveBeenCalledWith("user-1");
      expect(mockUserRepo.createVerificationToken).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "user-1" }),
      );
      expect(mockMailPort.sendMail).toHaveBeenCalled();
    });

    it("returns neutral message without sending email when user is already ACTIVE", async () => {
      mockUserRepo.findByNormalizedEmail.mockResolvedValue({
        id: "user-active",
        email: "active@example.com",
        status: UserStatus.ACTIVE,
      });

      const res = await resendService.resendVerification(
        { email: "active@example.com" },
        "corr-1",
      );

      expect(res.message).toContain("a new verification link has been sent");
      expect(mockMailPort.sendMail).not.toHaveBeenCalled();
    });
  });
});

import { RegisterService } from "../../../src/modules/identity/application/register.service";
import { UserRepository } from "../../../src/modules/identity/infrastructure/user.repository";
import { Argon2PasswordHasher } from "../../../src/modules/identity/infrastructure/argon2-password-hasher";
import { TokenService } from "../../../src/modules/identity/infrastructure/token.service";
import { MailPort } from "../../../src/modules/mail/mail-port.interface";
import { AuditService } from "../../../src/modules/audit/audit.service";
import { ValidationErrorException } from "../../../src/common/exceptions/domain.exception";

describe("RegisterService (Unit)", () => {
  let service: RegisterService;
  let mockUserRepo: {
    findByNormalizedEmail: jest.Mock;
    createUserWithCredentials: jest.Mock;
    createVerificationToken: jest.Mock;
  };
  let mockHasher: {
    validatePasswordPolicy: jest.Mock;
    hash: jest.Mock;
  };
  let mockTokenService: {
    generateSecureToken: jest.Mock;
    calculateExpiresAt: jest.Mock;
  };
  let mockMailPort: {
    sendMail: jest.Mock;
  };
  let mockAuditService: {
    logEvent: jest.Mock;
  };

  beforeEach(() => {
    mockUserRepo = {
      findByNormalizedEmail: jest.fn(),
      createUserWithCredentials: jest.fn(),
      createVerificationToken: jest.fn(),
    };
    mockHasher = {
      validatePasswordPolicy: jest.fn(),
      hash: jest
        .fn()
        .mockResolvedValue("$argon2id$v=19$m=19456,p=1,t=2$mockHash"),
    };
    mockTokenService = {
      generateSecureToken: jest.fn().mockReturnValue({
        rawToken: "mock-raw-token-1234567890abcdef1234567890abcdef",
        tokenHash: "mock-hash-1234567890abcdef1234567890abcdef",
      }),
      calculateExpiresAt: jest
        .fn()
        .mockReturnValue(new Date(Date.now() + 24 * 60 * 60 * 1000)),
    };
    mockMailPort = {
      sendMail: jest.fn().mockResolvedValue(undefined),
    };
    mockAuditService = {
      logEvent: jest.fn().mockResolvedValue(null),
    };

    service = new RegisterService(
      mockUserRepo as unknown as UserRepository,
      mockHasher as unknown as Argon2PasswordHasher,
      mockTokenService as unknown as TokenService,
      mockMailPort as unknown as MailPort,
      mockAuditService as unknown as AuditService,
    );
  });

  it("normalizes email by trimming whitespace and converting to lowercase", async () => {
    mockUserRepo.findByNormalizedEmail!.mockResolvedValue(null);
    mockUserRepo.createUserWithCredentials!.mockResolvedValue({
      id: "user-1",
      email: "User.NAME@Example.COM",
      normalizedEmail: "user.name@example.com",
      displayName: "User Name",
      status: "PENDING_VERIFICATION",
    } as never);

    await service.register(
      {
        displayName: "User Name",
        email: "  User.NAME@Example.COM  ",
        password: "ValidPassword123!",
        termsVersion: "v1.0",
      },
      "corr-id-1",
    );

    expect(mockUserRepo.findByNormalizedEmail).toHaveBeenCalledWith(
      "user.name@example.com",
    );
  });

  it("creates pending user, records consent, generates verification token and sends email", async () => {
    mockUserRepo.findByNormalizedEmail!.mockResolvedValue(null);
    mockUserRepo.createUserWithCredentials!.mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      normalizedEmail: "test@example.com",
      displayName: "Test User",
      status: "PENDING_VERIFICATION",
    } as never);

    const result = await service.register(
      {
        displayName: "Test User",
        email: "test@example.com",
        password: "ValidPassword123!",
        termsVersion: "v1.0",
      },
      "corr-id-1",
    );

    expect(result.message).toBe(
      "If the email is valid, a verification link has been sent.",
    );
    expect(mockHasher.hash).toHaveBeenCalledWith("ValidPassword123!");
    expect(mockUserRepo.createUserWithCredentials).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "test@example.com",
        normalizedEmail: "test@example.com",
        displayName: "Test User",
        termsVersion: "v1.0",
      }),
    );
    expect(mockUserRepo.createVerificationToken).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        tokenHash: "mock-hash-1234567890abcdef1234567890abcdef",
      }),
    );
    expect(mockMailPort.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "test@example.com",
        subject: expect.stringContaining("Confirmação"),
      }),
    );
    expect(mockAuditService.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "USER_REGISTERED",
        targetId: "user-1",
      }),
    );
  });

  it("returns neutral message without error or duplication when email already exists (FR-005)", async () => {
    mockUserRepo.findByNormalizedEmail!.mockResolvedValue({
      id: "existing-user-id",
      email: "existing@example.com",
      normalizedEmail: "existing@example.com",
      status: "ACTIVE",
    } as never);

    const result = await service.register(
      {
        displayName: "Another Person",
        email: "existing@example.com",
        password: "ValidPassword123!",
        termsVersion: "v1.0",
      },
      "corr-id-2",
    );

    expect(result.message).toBe(
      "If the email is valid, a verification link has been sent.",
    );
    expect(mockUserRepo.createUserWithCredentials).not.toHaveBeenCalled();
    expect(mockUserRepo.createVerificationToken).not.toHaveBeenCalled();
    expect(mockMailPort.sendMail).not.toHaveBeenCalled();
  });

  it("rejects invalid display name or missing terms", async () => {
    await expect(
      service.register(
        {
          displayName: "a", // too short (min 2)
          email: "test@example.com",
          password: "ValidPassword123!",
          termsVersion: "v1.0",
        },
        "corr-id-3",
      ),
    ).rejects.toThrow(ValidationErrorException);

    await expect(
      service.register(
        {
          displayName: "Valid Name",
          email: "test@example.com",
          password: "ValidPassword123!",
          termsVersion: "", // empty terms
        },
        "corr-id-3",
      ),
    ).rejects.toThrow(ValidationErrorException);
  });
});

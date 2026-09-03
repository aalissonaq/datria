import { ConfigService } from "@nestjs/config";
import { AuditOutcome } from "@prisma/client";
import { AuditService } from "./audit.service";
import { AuditRepository } from "./audit.repository";

describe("AuditService", () => {
  let service: AuditService;
  let mockRepository: Partial<AuditRepository>;
  let mockConfigService: Partial<ConfigService>;

  beforeEach(() => {
    mockRepository = {
      append: jest
        .fn()
        .mockImplementation((data) =>
          Promise.resolve({ id: "audit-1", ...data }),
        ),
    };
    mockConfigService = {
      get: jest.fn().mockReturnValue(180),
    };

    service = new AuditService(
      mockRepository as AuditRepository,
      mockConfigService as ConfigService<never, true>,
    );
  });

  describe("sanitizeMetadata", () => {
    it("strips forbidden keys containing password, token, or secret", () => {
      const input = {
        password: "plainTextPassword123!",
        userToken: "secret-token-xyz",
        jwt: "bearer-token",
        reason: "Valid audit reason",
        status: "ACTIVE",
      };

      const sanitized = service.sanitizeMetadata(input);

      expect(sanitized).toEqual({
        reason: "Valid audit reason",
        status: "ACTIVE",
      });
      expect(sanitized).not.toHaveProperty("password");
      expect(sanitized).not.toHaveProperty("userToken");
      expect(sanitized).not.toHaveProperty("jwt");
    });

    it("returns null if all keys are filtered out", () => {
      const input = {
        rawPassword: "secret",
        clientToken: "xyz",
      };

      expect(service.sanitizeMetadata(input)).toBeNull();
    });
  });

  describe("logEvent", () => {
    it("calculates 180-day default expiration and invokes append on repository", async () => {
      const result = await service.logEvent({
        actorUserId: "user-uuid",
        organizationId: "org-uuid",
        action: "ORGANIZATION_CREATED",
        targetType: "Organization",
        targetId: "org-uuid",
        outcome: AuditOutcome.SUCCESS,
        correlationId: "corr-1234",
        metadata: {
          slug: "test-org",
          passwordAttempt: "do-not-store",
        },
      });

      expect(result).toBeDefined();
      expect(mockRepository.append).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: "user-uuid",
          organizationId: "org-uuid",
          action: "ORGANIZATION_CREATED",
          outcome: AuditOutcome.SUCCESS,
          correlationId: "corr-1234",
          metadata: { slug: "test-org" },
          expiresAt: expect.any(Date),
        }),
      );
    });
  });
});

import { SessionService } from "../../../src/modules/sessions/session.service";
import { SessionRepository } from "../../../src/modules/sessions/session.repository";
import { TokenService } from "../../../src/modules/identity/infrastructure/token.service";
import { JwtService } from "@nestjs/jwt";
import { AuditService } from "../../../src/modules/audit/audit.service";
import { UnauthorizedException } from "../../../src/common/exceptions/domain.exception";
import { UserStatus } from "@prisma/client";

describe("SessionService (Unit)", () => {
  let service: SessionService;
  let mockSessionRepo: {
    createSession: jest.Mock;
    findByRefreshTokenHash: jest.Mock;
    rotateRefreshToken: jest.Mock;
    revokeSession: jest.Mock;
    revokeFamily: jest.Mock;
    revokeAllUserSessions: jest.Mock;
    touchSession: jest.Mock;
  };
  let mockTokenService: {
    generateSecureToken: jest.Mock;
    hashToken: jest.Mock;
    calculateExpiresAt: jest.Mock;
  };
  let mockJwtService: {
    signAsync: jest.Mock;
  };
  let mockAuditService: {
    logEvent: jest.Mock;
  };

  beforeEach(() => {
    mockSessionRepo = {
      createSession: jest.fn(),
      findByRefreshTokenHash: jest.fn(),
      rotateRefreshToken: jest.fn(),
      revokeSession: jest.fn(),
      revokeFamily: jest.fn(),
      revokeAllUserSessions: jest.fn(),
      touchSession: jest.fn(),
    };
    mockTokenService = {
      generateSecureToken: jest.fn().mockReturnValue({
        rawToken: "raw-refresh-token-12345",
        tokenHash: "hashed-refresh-token-12345",
      }),
      hashToken: jest.fn().mockReturnValue("hashed-token-12345"),
      calculateExpiresAt: jest
        .fn()
        .mockReturnValue(new Date(Date.now() + 8 * 60 * 60 * 1000)),
    };
    mockJwtService = {
      signAsync: jest.fn().mockResolvedValue("signed-jwt-token"),
    };
    mockAuditService = {
      logEvent: jest.fn().mockResolvedValue(null),
    };

    const mockConfigService = {
      get: jest
        .fn()
        .mockReturnValue(
          "a-very-long-secret-key-that-satisfies-thirty-two-chars",
        ),
    };

    service = new SessionService(
      mockSessionRepo as unknown as SessionRepository,
      mockTokenService as unknown as TokenService,
      mockJwtService as unknown as JwtService,
      mockAuditService as unknown as AuditService,
      mockConfigService as never,
    );
  });

  describe("createSession", () => {
    it("creates session with 30m idle and 8h absolute expiration", async () => {
      mockSessionRepo.createSession.mockResolvedValue({
        id: "session-1",
        userId: "user-1",
      });

      const session = await service.createSession(
        "user-1",
        "127.0.0.1",
        "Mozilla",
      );

      expect(session.sessionId).toBe("session-1");
      expect(session.accessToken).toBe("signed-jwt-token");
      expect(session.refreshToken).toBe("raw-refresh-token-12345");
      expect(mockSessionRepo.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          refreshTokenHash: "hashed-refresh-token-12345",
        }),
      );
    });
  });

  describe("rotateRefreshToken", () => {
    it("rotates refresh token and returns new tokens", async () => {
      const now = new Date();
      mockSessionRepo.findByRefreshTokenHash.mockResolvedValue({
        id: "session-1",
        userId: "user-1",
        revokedAt: null,
        idleExpiresAt: new Date(now.getTime() + 100000),
        absoluteExpiresAt: new Date(now.getTime() + 1000000),
        user: { id: "user-1", status: UserStatus.ACTIVE },
      });
      mockSessionRepo.createSession.mockResolvedValue({
        id: "session-2",
        userId: "user-1",
      });

      const result = await service.rotateRefreshToken("raw-token", "corr-1");

      expect(result.accessToken).toBe("signed-jwt-token");
      expect(result.refreshToken).toBe("raw-refresh-token-12345");
      expect(mockSessionRepo.revokeSession).toHaveBeenCalledWith("session-1", "ROTATED");
      expect(mockSessionRepo.createSession).toHaveBeenCalled();
    });

    it("revokes all sessions on replay of already-revoked refresh token (FR-011)", async () => {
      mockSessionRepo.findByRefreshTokenHash.mockResolvedValue({
        id: "session-replayed",
        userId: "user-victim",
        revokedAt: new Date(),
        user: { id: "user-victim", status: UserStatus.ACTIVE },
      });

      await expect(
        service.rotateRefreshToken("raw-replayed-token", "corr-replay"),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockSessionRepo.revokeAllUserSessions).toHaveBeenCalledWith(
        "user-victim",
        "FAMILY_REVOKED_REUSE_DETECTED",
      );
      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "REFRESH_TOKEN_REPLAY_DETECTED",
          outcome: "DENIED",
        }),
      );
    });
  });
});

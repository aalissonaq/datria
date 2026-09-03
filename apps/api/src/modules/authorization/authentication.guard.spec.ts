import { ExecutionContext } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";
import {
  AuthenticationGuard,
  ACCESS_COOKIE_NAME,
} from "./authentication.guard";
import { PrismaService } from "../../prisma/prisma.service";
import { UnauthorizedException } from "../../common/exceptions/domain.exception";

describe("AuthenticationGuard", () => {
  let guard: AuthenticationGuard;
  let reflector: Reflector;
  let jwtService: JwtService;
  let prisma: Partial<PrismaService>;
  let configService: ConfigService;

  beforeEach(() => {
    reflector = new Reflector();
    jwtService = new JwtService();
    prisma = {
      session: {
        findUnique: jest.fn(),
        update: jest.fn(),
      } as never,
    };
    configService = {
      get: jest
        .fn()
        .mockReturnValue(
          "a-very-long-secret-key-that-satisfies-thirty-two-chars",
        ),
    } as unknown as ConfigService;

    guard = new AuthenticationGuard(
      reflector,
      jwtService,
      prisma as PrismaService,
      configService as never,
    );
  });

  function createMockContext(
    cookies: Record<string, string> = {},
    headers: Record<string, string> = {},
  ): { context: ExecutionContext; request: Partial<Request> } {
    const request: Partial<Request> = {
      cookies,
      headers,
      user: undefined,
    };

    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => request as Request,
      }),
    } as unknown as ExecutionContext;

    return { context, request };
  }

  it("allows public routes marked with @Public()", async () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(true);
    const { context } = createMockContext();

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("throws UnauthorizedException when no access cookie or bearer header exists", async () => {
    const { context } = createMockContext();

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("authenticates valid token, sliding expires session, and attaches user to request", async () => {
    const secret = "a-very-long-secret-key-that-satisfies-thirty-two-chars";
    const token = await jwtService.signAsync(
      { sub: "user-123", sid: "session-123" },
      { secret },
    );

    const now = new Date();
    const future = new Date(now.getTime() + 1000 * 60 * 60);

    const mockSession = {
      id: "session-123",
      userId: "user-123",
      revokedAt: null,
      idleExpiresAt: future,
      absoluteExpiresAt: future,
      user: {
        id: "user-123",
        email: "user@example.com",
        displayName: "User Example",
        status: "ACTIVE",
      },
    };

    (prisma.session!.findUnique as jest.Mock).mockResolvedValue(mockSession);
    (prisma.session!.update as jest.Mock).mockResolvedValue(mockSession);

    const { context, request } = createMockContext({
      [ACCESS_COOKIE_NAME]: token,
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.user).toEqual({
      id: "user-123",
      email: "user@example.com",
      displayName: "User Example",
      sessionId: "session-123",
    });
    expect(prisma.session!.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "session-123" },
        data: expect.objectContaining({
          lastUsedAt: expect.any(Date),
          idleExpiresAt: expect.any(Date),
        }),
      }),
    );
  });

  it("rejects revoked session", async () => {
    const secret = "a-very-long-secret-key-that-satisfies-thirty-two-chars";
    const token = await jwtService.signAsync(
      { sub: "user-123", sid: "session-revoked" },
      { secret },
    );

    const mockSession = {
      id: "session-revoked",
      userId: "user-123",
      revokedAt: new Date(),
      idleExpiresAt: new Date(Date.now() + 10000),
      absoluteExpiresAt: new Date(Date.now() + 10000),
      user: { id: "user-123", status: "ACTIVE" },
    };

    (prisma.session!.findUnique as jest.Mock).mockResolvedValue(mockSession);

    const { context } = createMockContext({
      [ACCESS_COOKIE_NAME]: token,
    });

    await expect(guard.canActivate(context)).rejects.toThrow(/revoked/);
  });
});

import { ExecutionContext } from "@nestjs/common";
import { PlatformRoleGuard } from "../../../src/modules/authorization/platform-role.guard";
import { PrismaService } from "../../../src/prisma/prisma.service";
import {
  ForbiddenException,
  UnauthorizedException,
} from "../../../src/common/exceptions/domain.exception";

describe("PlatformRoleGuard (Unit)", () => {
  let guard: PlatformRoleGuard;
  let mockPrisma: {
    platformRoleAssignment: {
      findFirst: jest.Mock;
    };
  };

  beforeEach(() => {
    mockPrisma = {
      platformRoleAssignment: {
        findFirst: jest.fn(),
      },
    };

    guard = new PlatformRoleGuard(mockPrisma as unknown as PrismaService);
  });

  it("throws UnauthorizedException when no user is attached to request", async () => {
    const mockCtx = {
      switchToHttp: () => ({
        getRequest: () => ({ user: null }),
      }),
    } as ExecutionContext;

    await expect(guard.canActivate(mockCtx)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("throws ForbiddenException when user does not have active SAAS_ADMIN platform role", async () => {
    mockPrisma.platformRoleAssignment.findFirst.mockResolvedValue(null);

    const mockCtx = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { id: "user-regular" } }),
      }),
    } as ExecutionContext;

    await expect(guard.canActivate(mockCtx)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("allows access when user has active SAAS_ADMIN platform role", async () => {
    mockPrisma.platformRoleAssignment.findFirst.mockResolvedValue({
      id: "pra-1",
      userId: "user-admin",
      role: { code: "SAAS_ADMIN" },
      revokedAt: null,
    });

    const mockCtx = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { id: "user-admin" } }),
      }),
    } as ExecutionContext;

    const result = await guard.canActivate(mockCtx);
    expect(result).toBe(true);
  });
});

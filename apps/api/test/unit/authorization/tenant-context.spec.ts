import { ContextService } from "../../../src/modules/identity/application/context.service";
import { TenantContextResolver } from "../../../src/modules/authorization/tenant-context.resolver";
import { PrismaService } from "../../../src/prisma/prisma.service";
import { ResourceNotFoundException } from "../../../src/common/exceptions/domain.exception";
import { ExecutionContext, CallHandler } from "@nestjs/common";
import { of } from "rxjs";

describe("Tenant Context & Resolution (Unit)", () => {
  let contextService: ContextService;
  let tenantResolver: TenantContextResolver;
  let mockPrisma: {
    membership: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
    };
  };
  const mockNext: CallHandler = {
    handle: () => of(true),
  };

  beforeEach(() => {
    mockPrisma = {
      membership: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const mockSessionRepo = {
      findUserMemberships: jest.fn().mockResolvedValue([
        {
          id: "m-1",
          userId: "user-1",
          organizationId: "org-1",
          organization: {
            id: "org-1",
            name: "Universidade Teste",
            slug: "universidade-teste",
            status: "ACTIVE",
          },
          roles: [{ role: { code: "INSTITUTION_ADMIN" } }],
        },
      ]),
    };

    contextService = new ContextService(mockSessionRepo as any);
    tenantResolver = new TenantContextResolver(
      mockPrisma as unknown as PrismaService,
    );
  });

  describe("ContextService", () => {
    it("returns personal context and available organization memberships", async () => {
      const result = await contextService.getContext("user-1");

      expect(result.activeContext.type).toBe("PERSONAL");
      expect(result.activeContext.userId).toBe("user-1");
      expect(result.availableOrganizations).toHaveLength(1);
      expect(result.availableOrganizations[0].slug).toBe("universidade-teste");
      expect(result.availableOrganizations[0].roles).toContain(
        "INSTITUTION_ADMIN",
      );
    });
  });

  describe("TenantContextResolver", () => {
    it("resolves personal context when no organization is requested", async () => {
      const mockReq: any = {
        user: { id: "user-1" },
        headers: {},
        params: {},
      };
      const mockCtx = {
        switchToHttp: () => ({ getRequest: () => mockReq }),
      } as ExecutionContext;

      await tenantResolver.intercept(mockCtx, mockNext);
      expect(mockReq.tenantContext.type).toBe("PERSONAL");
    });

    it("denies access with neutral 404 when user is not member of requested organization (FR-016)", async () => {
      mockPrisma.membership.findFirst.mockResolvedValue(null);

      const mockReq: any = {
        user: { id: "user-1" },
        headers: { "x-organization-id": "org-foreign" },
        params: {},
      };
      const mockCtx = {
        switchToHttp: () => ({ getRequest: () => mockReq }),
      } as ExecutionContext;

      await expect(tenantResolver.intercept(mockCtx, mockNext)).rejects.toThrow(
        ResourceNotFoundException,
      );
    });
  });
});

import { CallHandler, ExecutionContext } from "@nestjs/common";
import { of } from "rxjs";
import { TenantContextResolver } from "./tenant-context.resolver";
import { PrismaService } from "../../prisma/prisma.service";
import { ResourceNotFoundException } from "../../common/exceptions/domain.exception";

describe("TenantContextResolver", () => {
  let resolver: TenantContextResolver;
  let mockPrisma: Partial<PrismaService>;
  let mockNext: CallHandler;

  beforeEach(() => {
    mockPrisma = {
      membership: {
        findFirst: jest.fn(),
      } as never,
    };
    mockNext = {
      handle: jest.fn().mockReturnValue(of("handled")),
    };
    resolver = new TenantContextResolver(mockPrisma as PrismaService);
  });

  function createMockContext(
    user?: { id: string; email: string },
    headers: Record<string, string> = {},
    params: Record<string, string> = {},
  ): { context: ExecutionContext; request: Record<string, unknown> } {
    const request = {
      user,
      headers,
      params,
      tenantContext: undefined,
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;

    return { context, request };
  }

  it("sets personal context when no organization is requested", async () => {
    const { context, request } = createMockContext({
      id: "user-1",
      email: "user@example.com",
    });

    await resolver.intercept(context, mockNext);

    expect(request.tenantContext).toEqual({
      type: "PERSONAL",
      userId: "user-1",
    });
    expect(mockNext.handle).toHaveBeenCalled();
  });

  it("resolves organization context when user has active membership", async () => {
    const mockMembership = {
      id: "mem-1",
      organizationId: "org-1",
      organization: {
        id: "org-1",
        name: "Test Organization",
        slug: "test-org",
        status: "ACTIVE",
      },
      roles: [
        { role: { code: "INSTITUTION_ADMIN" } },
        { role: { code: "TEACHER" } },
      ],
    };

    (mockPrisma.membership!.findFirst as jest.Mock).mockResolvedValue(
      mockMembership,
    );

    const { context, request } = createMockContext(
      { id: "user-1", email: "user@example.com" },
      { "x-organization-id": "org-1" },
    );

    await resolver.intercept(context, mockNext);

    expect(request.tenantContext).toEqual({
      type: "ORGANIZATION",
      userId: "user-1",
      organizationId: "org-1",
      organizationName: "Test Organization",
      organizationSlug: "test-org",
      membershipId: "mem-1",
      roles: ["INSTITUTION_ADMIN", "TEACHER"],
    });
  });

  it("throws ResourceNotFoundException (404) when requested org membership is inactive or absent", async () => {
    (mockPrisma.membership!.findFirst as jest.Mock).mockResolvedValue(null);

    const { context } = createMockContext(
      { id: "user-1", email: "user@example.com" },
      { "x-organization-id": "org-another-tenant" },
    );

    await expect(resolver.intercept(context, mockNext)).rejects.toThrow(
      ResourceNotFoundException,
    );
  });
});

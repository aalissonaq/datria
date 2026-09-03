import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Request } from "express";
import { Observable } from "rxjs";
import { PrismaService } from "../../prisma/prisma.service";
import { ResourceNotFoundException } from "../../common/exceptions/domain.exception";
import {
  AuthenticatedUser,
  OrganizationContext,
  PersonalContext,
} from "./tenant-context.interface";

@Injectable()
export class TenantContextResolver implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AuthenticatedUser | undefined;

    if (!user) {
      // If unauthenticated, personal context is not established
      return next.handle();
    }

    const requestedOrgId = this.extractRequestedOrganizationId(request);

    if (requestedOrgId) {
      const orgContext = await this.resolveOrganizationContext(
        user.id,
        requestedOrgId,
      );
      request.tenantContext = orgContext;
    } else {
      const personalContext: PersonalContext = {
        type: "PERSONAL",
        userId: user.id,
      };
      request.tenantContext = personalContext;
    }

    return next.handle();
  }

  async resolveOrganizationContext(
    userId: string,
    organizationId: string,
  ): Promise<OrganizationContext> {
    const membership = await this.prisma.membership.findFirst({
      where: {
        userId,
        organizationId,
        status: "ACTIVE",
        organization: {
          status: "ACTIVE",
        },
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
          },
        },
        roles: {
          include: {
            role: {
              select: {
                code: true,
              },
            },
          },
        },
      },
    });

    if (!membership || !membership.organization) {
      // Return 404 to avoid leaking existence of cross-tenant resources
      throw new ResourceNotFoundException("Resource not found or inaccessible");
    }

    return {
      type: "ORGANIZATION",
      userId,
      organizationId: membership.organization.id,
      organizationName: membership.organization.name,
      organizationSlug: membership.organization.slug,
      membershipId: membership.id,
      roles: membership.roles.map((r) => r.role.code),
    };
  }

  private extractRequestedOrganizationId(request: Request): string | null {
    // Platform administrative routes operate at the platform level, not tenant membership
    const path = request.originalUrl || request.url || "";
    if (path.includes("/platform/")) {
      return null;
    }

    // 1. Check header
    const headerOrg = request.headers["x-organization-id"];
    if (headerOrg) {
      return Array.isArray(headerOrg) ? headerOrg[0] : headerOrg;
    }

    // 2. Check route params :organizationId
    const paramOrg = request.params?.organizationId;
    if (paramOrg) {
      return Array.isArray(paramOrg) ? paramOrg[0] : paramOrg;
    }

    return null;
  }
}

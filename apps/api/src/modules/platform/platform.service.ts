import { Injectable } from "@nestjs/common";
import { AuditOutcome, OrganizationStatus } from "@prisma/client";
import {
  ResourceNotFoundException,
  ValidationErrorException,
} from "../../common/exceptions/domain.exception";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listOrganizations() {
    const orgs = await this.prisma.organization.findMany({
      include: {
        _count: {
          select: { memberships: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return orgs.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      status: org.status,
      timezone: org.timezone,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
      membersCount: org._count.memberships,
    }));
  }

  async updateOrganizationStatus(
    organizationId: string,
    status: "ACTIVE" | "SUSPENDED",
    reason: string,
    actorUserId: string,
    correlationId: string,
  ) {
    if (!reason || reason.trim().length < 5) {
      throw new ValidationErrorException(
        "A valid audited reason is required to change organization status",
      );
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) {
      throw new ResourceNotFoundException("Organization not found");
    }

    const previousStatus = org.status;

    const updated = await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        status: status as OrganizationStatus,
      },
    });

    await this.auditService.logEvent({
      actorUserId,
      organizationId,
      action: "PLATFORM_ORGANIZATION_STATUS_UPDATED",
      targetType: "Organization",
      targetId: organizationId,
      outcome: AuditOutcome.SUCCESS,
      correlationId,
      metadata: {
        previousStatus,
        newStatus: status,
        reason: reason.trim(),
      },
    });

    return updated;
  }
}

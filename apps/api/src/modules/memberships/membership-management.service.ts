import { Injectable } from "@nestjs/common";
import { AuditOutcome, MembershipStatus } from "@prisma/client";
import {
  LastAdminException,
  ResourceNotFoundException,
  ValidationErrorException,
} from "../../common/exceptions/domain.exception";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { ALLOWED_INSTITUTIONAL_ROLES } from "../invitations/invitation.service";
import { MembershipRepository } from "./membership.repository";

@Injectable()
export class MembershipManagementService {
  constructor(
    private readonly membershipRepository: MembershipRepository,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listMembers(organizationId: string) {
    return this.membershipRepository.findOrganizationMembers(organizationId);
  }

  async updateMemberStatus(
    organizationId: string,
    membershipId: string,
    status: "ACTIVE" | "SUSPENDED" | "REMOVED",
    actorUserId: string,
    correlationId: string,
  ) {
    const membership = await this.prisma.membership.findFirst({
      where: {
        id: membershipId,
        organizationId,
      },
      include: {
        roles: {
          include: { role: true },
        },
      },
    });

    if (!membership) {
      throw new ResourceNotFoundException("Membership not found");
    }

    const isAdmin = membership.roles.some(
      (r) => r.role.code === "INSTITUTION_ADMIN",
    );

    // If suspending or removing an active admin, verify last-admin protection
    if (isAdmin && membership.status === "ACTIVE" && status !== "ACTIVE") {
      const activeAdmins =
        await this.membershipRepository.countActiveAdmins(organizationId);
      if (activeAdmins <= 1) {
        throw new LastAdminException(
          "Cannot remove, demote, or suspend the last active administrator of the organization",
        );
      }
    }

    const updated = await this.prisma.membership.update({
      where: { id: membershipId },
      data: {
        status: status as MembershipStatus,
        suspendedAt: status === "SUSPENDED" ? new Date() : null,
        removedAt: status === "REMOVED" ? new Date() : null,
      },
      include: {
        roles: {
          include: { role: true },
        },
      },
    });

    await this.auditService.logEvent({
      actorUserId,
      organizationId,
      action: "MEMBER_STATUS_UPDATED",
      targetType: "Membership",
      targetId: membershipId,
      outcome: AuditOutcome.SUCCESS,
      correlationId,
      metadata: {
        targetUserId: membership.userId,
        previousStatus: membership.status,
        newStatus: status,
      },
    });

    return updated;
  }

  async updateMemberRoles(
    organizationId: string,
    membershipId: string,
    roleCodes: string[],
    actorUserId: string,
    correlationId: string,
  ) {
    for (const code of roleCodes) {
      if (!ALLOWED_INSTITUTIONAL_ROLES.includes(code)) {
        throw new ValidationErrorException(
          `Role ${code} is not a valid institutional role`,
        );
      }
    }

    const membership = await this.prisma.membership.findFirst({
      where: {
        id: membershipId,
        organizationId,
      },
      include: {
        roles: {
          include: { role: true },
        },
      },
    });

    if (!membership) {
      throw new ResourceNotFoundException("Membership not found");
    }

    const isCurrentlyAdmin = membership.roles.some(
      (r) => r.role.code === "INSTITUTION_ADMIN",
    );
    const willBeAdmin = roleCodes.includes("INSTITUTION_ADMIN");

    if (isCurrentlyAdmin && !willBeAdmin && membership.status === "ACTIVE") {
      const activeAdmins =
        await this.membershipRepository.countActiveAdmins(organizationId);
      if (activeAdmins <= 1) {
        throw new LastAdminException(
          "Cannot remove the last active administrator role from this member",
        );
      }
    }

    const dbRoles = await this.prisma.role.findMany({
      where: { code: { in: roleCodes } },
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.membershipRole.deleteMany({
        where: { membershipId },
      });

      await tx.membershipRole.createMany({
        data: dbRoles.map((r) => ({
          membershipId,
          roleId: r.id,
          assignedByUserId: actorUserId,
        })),
      });

      return tx.membership.findUniqueOrThrow({
        where: { id: membershipId },
        include: {
          roles: {
            include: { role: true },
          },
        },
      });
    });

    await this.auditService.logEvent({
      actorUserId,
      organizationId,
      action: "MEMBER_ROLES_UPDATED",
      targetType: "Membership",
      targetId: membershipId,
      outcome: AuditOutcome.SUCCESS,
      correlationId,
      metadata: {
        targetUserId: membership.userId,
        newRoles: roleCodes,
      },
    });

    return updated;
  }
}

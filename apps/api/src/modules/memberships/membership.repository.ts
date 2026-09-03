import { Injectable } from "@nestjs/common";
import { Membership, MembershipStatus, Role } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

export type MembershipDetails = Membership & {
  roles: Array<{ role: Role }>;
};

@Injectable()
export class MembershipRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMembership(
    organizationId: string,
    userId: string,
  ): Promise<MembershipDetails | null> {
    return this.prisma.membership.findFirst({
      where: {
        organizationId,
        userId,
      },
      include: {
        roles: {
          include: { role: true },
        },
      },
    });
  }

  async findOrganizationMembers(
    organizationId: string,
  ): Promise<MembershipDetails[]> {
    return this.prisma.membership.findMany({
      where: {
        organizationId,
      },
      include: {
        roles: {
          include: { role: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async countActiveAdmins(organizationId: string): Promise<number> {
    return this.prisma.membership.count({
      where: {
        organizationId,
        status: MembershipStatus.ACTIVE,
        roles: {
          some: {
            role: {
              code: "INSTITUTION_ADMIN",
            },
          },
        },
      },
    });
  }
}

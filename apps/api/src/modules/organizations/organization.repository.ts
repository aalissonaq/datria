import { Injectable } from "@nestjs/common";
import { Organization, Membership, Role } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

export type CreatedOrganizationResult = {
  organization: Organization;
  membership: Membership & {
    roles: Array<{ role: Role }>;
  };
};

@Injectable()
export class OrganizationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findBySlug(slug: string): Promise<Organization | null> {
    return this.prisma.organization.findUnique({
      where: { slug },
    });
  }

  async findById(id: string): Promise<Organization | null> {
    return this.prisma.organization.findUnique({
      where: { id },
    });
  }

  async createOrganizationWithFirstAdmin(
    name: string,
    slug: string,
    creatorUserId: string,
  ): Promise<CreatedOrganizationResult> {
    return this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name,
          slug,
          status: "ACTIVE",
          createdByUserId: creatorUserId,
        },
      });

      const adminRole = await tx.role.findUniqueOrThrow({
        where: { code: "INSTITUTION_ADMIN" },
      });

      const membership = await tx.membership.create({
        data: {
          organizationId: organization.id,
          userId: creatorUserId,
          status: "ACTIVE",
          roles: {
            create: {
              roleId: adminRole.id,
            },
          },
        },
        include: {
          roles: {
            include: {
              role: true,
            },
          },
        },
      });

      return {
        organization,
        membership,
      };
    });
  }
}

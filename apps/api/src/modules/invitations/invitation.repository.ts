import { Injectable } from "@nestjs/common";
import {
  Invitation,
  InvitationRole,
  InvitationStatus,
  Organization,
  Role,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

export type FullInvitation = Invitation & {
  organization: Organization;
  roles: Array<InvitationRole & { role: Role }>;
};

export interface CreateInvitationData {
  organizationId: string;
  email: string;
  normalizedEmail: string;
  tokenHash: string;
  expiresAt: Date;
  invitedByUserId: string;
  roleIds: string[];
}

@Injectable()
export class InvitationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createInvitation(data: CreateInvitationData): Promise<FullInvitation> {
    return this.prisma.invitation.create({
      data: {
        organizationId: data.organizationId,
        email: data.email,
        normalizedEmail: data.normalizedEmail,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
        invitedByUserId: data.invitedByUserId,
        status: InvitationStatus.PENDING,
        roles: {
          create: data.roleIds.map((roleId) => ({
            roleId,
          })),
        },
      },
      include: {
        organization: true,
        roles: {
          include: { role: true },
        },
      },
    });
  }

  async findByTokenHash(tokenHash: string): Promise<FullInvitation | null> {
    return this.prisma.invitation.findUnique({
      where: { tokenHash },
      include: {
        organization: true,
        roles: {
          include: { role: true },
        },
      },
    });
  }

  async findById(id: string): Promise<FullInvitation | null> {
    return this.prisma.invitation.findUnique({
      where: { id },
      include: {
        organization: true,
        roles: {
          include: { role: true },
        },
      },
    });
  }

  async updateStatus(
    id: string,
    status: InvitationStatus,
    extra?: {
      acceptedByUserId?: string;
      acceptedAt?: Date;
      revokedAt?: Date;
      expiresAt?: Date;
    },
  ): Promise<Invitation> {
    return this.prisma.invitation.update({
      where: { id },
      data: {
        status,
        ...extra,
      },
    });
  }

  async listPendingByOrganization(
    organizationId: string,
  ): Promise<FullInvitation[]> {
    return this.prisma.invitation.findMany({
      where: {
        organizationId,
        status: InvitationStatus.PENDING,
      },
      include: {
        organization: true,
        roles: {
          include: { role: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }
}

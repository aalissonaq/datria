import { Injectable } from "@nestjs/common";
import { Membership, Organization, Role, Session, User } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

export interface CreateSessionParams {
  userId: string;
  refreshTokenHash: string;
  tokenFamilyId: string;
  currentJti: string;
  previousJti?: string | null;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
  ipHash?: string | null;
  userAgentHash?: string | null;
}

export type MembershipWithDetails = Membership & {
  organization: Organization;
  roles: Array<{ role: Role }>;
};

@Injectable()
export class SessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(data: CreateSessionParams): Promise<Session> {
    return this.prisma.session.create({
      data: {
        userId: data.userId,
        refreshTokenHash: data.refreshTokenHash,
        tokenFamilyId: data.tokenFamilyId,
        currentJti: data.currentJti,
        previousJti: data.previousJti ?? null,
        idleExpiresAt: data.idleExpiresAt,
        absoluteExpiresAt: data.absoluteExpiresAt,
        ipHash: data.ipHash ?? null,
        userAgentHash: data.userAgentHash ?? null,
      },
    });
  }

  async findById(id: string): Promise<(Session & { user: User }) | null> {
    return this.prisma.session.findUnique({
      where: { id },
      include: { user: true },
    });
  }

  async findByRefreshTokenHash(
    refreshTokenHash: string,
  ): Promise<(Session & { user: User }) | null> {
    return this.prisma.session.findFirst({
      where: { refreshTokenHash },
      include: { user: true },
    });
  }

  async rotateRefreshToken(
    sessionId: string,
    newRefreshTokenHash: string,
    newJti: string,
    previousJti: string,
    newIdleExpiresAt: Date,
  ): Promise<Session> {
    return this.prisma.session.update({
      where: { id: sessionId },
      data: {
        refreshTokenHash: newRefreshTokenHash,
        currentJti: newJti,
        previousJti,
        idleExpiresAt: newIdleExpiresAt,
        lastUsedAt: new Date(),
      },
    });
  }

  async touchSession(sessionId: string, newIdleExpiresAt: Date): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        idleExpiresAt: newIdleExpiresAt,
        lastUsedAt: new Date(),
      },
    });
  }

  async revokeSession(
    sessionId: string,
    reason = "USER_LOGOUT",
  ): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        revokedAt: new Date(),
        revokeReason: reason,
      },
    });
  }

  async revokeFamily(
    tokenFamilyId: string,
    reason = "REUSE_DETECTED",
  ): Promise<void> {
    await this.prisma.session.updateMany({
      where: {
        tokenFamilyId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokeReason: reason,
      },
    });
  }

  async revokeAllUserSessions(
    userId: string,
    reason = "SECURITY_RESET",
  ): Promise<void> {
    await this.prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokeReason: reason,
      },
    });
  }

  async findUserMemberships(userId: string): Promise<MembershipWithDetails[]> {
    return this.prisma.membership.findMany({
      where: {
        userId,
        status: "ACTIVE",
        organization: { status: "ACTIVE" },
      },
      include: {
        organization: true,
        roles: {
          include: {
            role: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }
}

import { Injectable } from "@nestjs/common";
import { AuditEvent, AuditOutcome, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

export interface CreateAuditEventData {
  actorUserId?: string | null;
  organizationId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  outcome: AuditOutcome;
  correlationId: string;
  metadata?: Record<string, unknown> | null;
  occurredAt?: Date;
  expiresAt: Date;
}

@Injectable()
export class AuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Appends an audit event immutably.
   * Note: This repository intentionally exposes NO update or delete methods
   * to preserve audit trail integrity.
   */
  async append(data: CreateAuditEventData): Promise<AuditEvent> {
    return this.prisma.auditEvent.create({
      data: {
        actorUserId: data.actorUserId ?? null,
        organizationId: data.organizationId ?? null,
        action: data.action,
        targetType: data.targetType,
        targetId: data.targetId ?? null,
        outcome: data.outcome,
        correlationId: data.correlationId,
        metadata: data.metadata
          ? (data.metadata as Prisma.InputJsonValue)
          : Prisma.DbNull,
        occurredAt: data.occurredAt ?? new Date(),
        expiresAt: data.expiresAt,
      },
    });
  }

  async findByOrganization(
    organizationId: string,
    limit = 50,
  ): Promise<AuditEvent[]> {
    return this.prisma.auditEvent.findMany({
      where: { organizationId },
      orderBy: { occurredAt: "desc" },
      take: limit,
    });
  }

  async findByActor(actorUserId: string, limit = 50): Promise<AuditEvent[]> {
    return this.prisma.auditEvent.findMany({
      where: { actorUserId },
      orderBy: { occurredAt: "desc" },
      take: limit,
    });
  }
}

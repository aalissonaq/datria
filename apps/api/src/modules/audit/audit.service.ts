import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuditEvent, AuditOutcome } from "@prisma/client";
import { AuditRepository } from "./audit.repository";
import { EnvironmentVariables } from "../../config/env.validation";

export interface LogAuditOptions {
  actorUserId?: string | null;
  organizationId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  outcome: AuditOutcome;
  correlationId: string;
  metadata?: Record<string, unknown> | null;
}

// Allowlist for audit event metadata keys. Secrets and sensitive personal details are forbidden.
export const ALLOWLISTED_METADATA_KEYS = new Set([
  "reason",
  "roles",
  "status",
  "targetEmail",
  "ipHash",
  "userAgentHash",
  "termsVersion",
  "slug",
  "membershipId",
  "organizationName",
  "errorCode",
  "scope",
]);

export const FORBIDDEN_KEY_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /jwt/i,
  /cookie/i,
  /credential/i,
  /auth/i,
];

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private readonly retentionDays: number;

  constructor(
    private readonly auditRepository: AuditRepository,
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {
    this.retentionDays =
      this.configService.get("AUDIT_RETENTION_DAYS", { infer: true }) ?? 180;
  }

  sanitizeMetadata(
    metadata?: Record<string, unknown> | null,
  ): Record<string, unknown> | null {
    if (!metadata || typeof metadata !== "object") {
      return null;
    }

    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(metadata)) {
      // Check forbidden patterns first
      const isForbidden = FORBIDDEN_KEY_PATTERNS.some((pattern) =>
        pattern.test(key),
      );
      if (isForbidden) {
        continue;
      }

      // Check allowlist
      if (ALLOWLISTED_METADATA_KEYS.has(key)) {
        sanitized[key] = value;
      }
    }

    return Object.keys(sanitized).length > 0 ? sanitized : null;
  }

  calculateExpirationDate(fromDate = new Date()): Date {
    const expiresAt = new Date(fromDate);
    expiresAt.setDate(expiresAt.getDate() + this.retentionDays);
    return expiresAt;
  }

  async logEvent(options: LogAuditOptions): Promise<AuditEvent | null> {
    try {
      const sanitizedMetadata = this.sanitizeMetadata(options.metadata);
      const now = new Date();
      const expiresAt = this.calculateExpirationDate(now);

      return await this.auditRepository.append({
        actorUserId: options.actorUserId ?? null,
        organizationId: options.organizationId ?? null,
        action: options.action,
        targetType: options.targetType,
        targetId: options.targetId ?? null,
        outcome: options.outcome,
        correlationId: options.correlationId,
        metadata: sanitizedMetadata,
        occurredAt: now,
        expiresAt,
      });
    } catch (error) {
      this.logger.error(
        `Failed to persist audit event [action: ${options.action}, correlationId: ${options.correlationId}]: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }
}

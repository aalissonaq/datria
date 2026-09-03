import { Injectable } from "@nestjs/common";
import { AuditOutcome } from "@prisma/client";
import {
  ConflictException,
  ValidationErrorException,
} from "../../common/exceptions/domain.exception";
import { AuditService } from "../audit/audit.service";
import {
  CreatedOrganizationResult,
  OrganizationRepository,
} from "./organization.repository";

export interface CreateOrganizationDto {
  name: string;
  slug: string;
}

@Injectable()
export class OrganizationService {
  constructor(
    private readonly organizationRepository: OrganizationRepository,
    private readonly auditService: AuditService,
  ) {}

  normalizeSlug(slug: string): string {
    return slug
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  async createOrganization(
    dto: CreateOrganizationDto,
    creatorUserId: string,
    correlationId: string,
  ): Promise<CreatedOrganizationResult> {
    if (
      !dto.name ||
      dto.name.trim().length < 2 ||
      dto.name.trim().length > 160
    ) {
      throw new ValidationErrorException(
        "Organization name must be between 2 and 160 characters",
      );
    }

    const normalizedSlug = this.normalizeSlug(dto.slug || "");

    if (normalizedSlug.length < 3 || normalizedSlug.length > 80) {
      throw new ValidationErrorException(
        "Organization slug must be between 3 and 80 alphanumeric characters and hyphens",
      );
    }

    // Check slug uniqueness
    const existingOrg =
      await this.organizationRepository.findBySlug(normalizedSlug);

    if (existingOrg) {
      throw new ConflictException(
        "An organization with this slug already exists",
        "ORGANIZATION_SLUG_CONFLICT",
      );
    }

    const result =
      await this.organizationRepository.createOrganizationWithFirstAdmin(
        dto.name.trim(),
        normalizedSlug,
        creatorUserId,
      );

    await this.auditService.logEvent({
      actorUserId: creatorUserId,
      organizationId: result.organization.id,
      action: "ORGANIZATION_CREATED",
      targetType: "Organization",
      targetId: result.organization.id,
      outcome: AuditOutcome.SUCCESS,
      correlationId,
      metadata: {
        organizationName: result.organization.name,
        slug: result.organization.slug,
      },
    });

    return result;
  }
}

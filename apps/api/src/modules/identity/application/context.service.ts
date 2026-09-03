import { Injectable } from "@nestjs/common";
import { TenantContext } from "../../authorization/tenant-context.interface";
import { SessionRepository } from "../../sessions/session.repository";

export interface AvailableOrganizationDto {
  id: string;
  name: string;
  slug: string;
  status: string;
  membershipId: string;
  roles: string[];
}

export interface ContextResponseDto {
  activeContext: TenantContext;
  availableOrganizations: AvailableOrganizationDto[];
}

@Injectable()
export class ContextService {
  constructor(private readonly sessionRepository: SessionRepository) {}

  async getContext(
    userId: string,
    activeContext?: TenantContext,
  ): Promise<ContextResponseDto> {
    const memberships =
      await this.sessionRepository.findUserMemberships(userId);

    const availableOrganizations: AvailableOrganizationDto[] = memberships.map(
      (m) => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        status: m.organization.status,
        membershipId: m.id,
        roles: m.roles.map((r) => r.role.code),
      }),
    );

    const context: TenantContext = activeContext || {
      type: "PERSONAL",
      userId,
    };

    return {
      activeContext: context,
      availableOrganizations,
    };
  }
}

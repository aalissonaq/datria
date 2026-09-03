import { Injectable } from "@nestjs/common";
import { ForbiddenException } from "../../common/exceptions/domain.exception";
import { OrganizationContext, TenantContext } from "./tenant-context.interface";

export const INSTITUTION_ROLES = [
  "INSTITUTION_ADMIN",
  "TEACHER",
  "REVIEWER",
  "PARTICIPANT",
] as const;

export const PLATFORM_ROLES = ["SAAS_ADMIN"] as const;

@Injectable()
export class PolicyService {
  /**
   * Asserts context is an active organization context.
   */
  assertOrganizationContext(
    context?: TenantContext,
  ): asserts context is OrganizationContext {
    if (!context || context.type !== "ORGANIZATION") {
      throw new ForbiddenException(
        "This operation requires an active organization context",
      );
    }
  }

  /**
   * Checks whether the context possesses the INSTITUTION_ADMIN role.
   */
  canManageMembers(context?: TenantContext): boolean {
    if (!context || context.type !== "ORGANIZATION") {
      return false;
    }
    return context.roles.includes("INSTITUTION_ADMIN");
  }

  assertCanManageMembers(context?: TenantContext): void {
    this.assertOrganizationContext(context);
    if (!this.canManageMembers(context)) {
      throw new ForbiddenException(
        "Institutional administrator privileges required",
      );
    }
  }

  /**
   * Validates invitation assignment.
   * Under no circumstances can institutional workflows grant SAAS_ADMIN.
   */
  canInvite(
    context: TenantContext | undefined,
    rolesToAssign: string[],
  ): boolean {
    if (!this.canManageMembers(context)) {
      return false;
    }

    if (!rolesToAssign || rolesToAssign.length === 0) {
      return false;
    }

    // Prohibit granting platform roles through institutional workflows (FR-037)
    const attemptsPlatformRole = rolesToAssign.some((r) => r === "SAAS_ADMIN");
    if (attemptsPlatformRole) {
      return false;
    }

    // Ensure all requested roles belong to approved institutional roles
    const allValid = rolesToAssign.every((r) =>
      (INSTITUTION_ROLES as readonly string[]).includes(r),
    );
    return allValid;
  }

  assertCanInvite(
    context: TenantContext | undefined,
    rolesToAssign: string[],
  ): void {
    this.assertCanManageMembers(context);

    const attemptsPlatformRole = rolesToAssign.some((r) => r === "SAAS_ADMIN");
    if (attemptsPlatformRole) {
      throw new ForbiddenException(
        "SaaS administrator role cannot be granted through institutional workflows",
      );
    }

    if (!this.canInvite(context, rolesToAssign)) {
      throw new ForbiddenException("Invalid role assignment request");
    }
  }

  /**
   * Verifies that the active context matches the target organization ID.
   */
  canAccessTenant(
    context: TenantContext | undefined,
    targetOrganizationId: string,
  ): boolean {
    if (!context || context.type !== "ORGANIZATION") {
      return false;
    }
    return context.organizationId === targetOrganizationId;
  }
}

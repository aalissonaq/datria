import { PolicyService } from "./policy.service";
import { ForbiddenException } from "../../common/exceptions/domain.exception";
import {
  OrganizationContext,
  PersonalContext,
} from "./tenant-context.interface";

describe("PolicyService", () => {
  let service: PolicyService;

  beforeEach(() => {
    service = new PolicyService();
  });

  const personalContext: PersonalContext = {
    type: "PERSONAL",
    userId: "user-1",
  };

  const adminContext: OrganizationContext = {
    type: "ORGANIZATION",
    userId: "user-1",
    organizationId: "org-1",
    organizationName: "Org 1",
    organizationSlug: "org-1",
    membershipId: "mem-1",
    roles: ["INSTITUTION_ADMIN"],
  };

  const teacherContext: OrganizationContext = {
    type: "ORGANIZATION",
    userId: "user-2",
    organizationId: "org-1",
    organizationName: "Org 1",
    organizationSlug: "org-1",
    membershipId: "mem-2",
    roles: ["TEACHER"],
  };

  it("canManageMembers returns true only for INSTITUTION_ADMIN in an organization", () => {
    expect(service.canManageMembers(adminContext)).toBe(true);
    expect(service.canManageMembers(teacherContext)).toBe(false);
    expect(service.canManageMembers(personalContext)).toBe(false);
  });

  it("canInvite rejects attempts to assign SAAS_ADMIN (FR-037)", () => {
    expect(service.canInvite(adminContext, ["TEACHER", "REVIEWER"])).toBe(true);

    expect(service.canInvite(adminContext, ["SAAS_ADMIN"])).toBe(false);

    expect(service.canInvite(adminContext, ["TEACHER", "SAAS_ADMIN"])).toBe(
      false,
    );

    expect(() => service.assertCanInvite(adminContext, ["SAAS_ADMIN"])).toThrow(
      ForbiddenException,
    );
  });

  it("assertOrganizationContext throws ForbiddenException for personal context", () => {
    expect(() => service.assertOrganizationContext(personalContext)).toThrow(
      ForbiddenException,
    );
    expect(() => service.assertOrganizationContext(adminContext)).not.toThrow();
  });

  it("canAccessTenant verifies that context belongs to the target organization", () => {
    expect(service.canAccessTenant(adminContext, "org-1")).toBe(true);
    expect(service.canAccessTenant(adminContext, "org-2")).toBe(false);
    expect(service.canAccessTenant(personalContext, "org-1")).toBe(false);
  });
});

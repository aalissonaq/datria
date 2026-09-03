import { MembershipManagementService } from "../../../src/modules/memberships/membership-management.service";
import { MembershipRepository } from "../../../src/modules/memberships/membership.repository";
import {
  LastAdminException,
  ValidationErrorException,
} from "../../../src/common/exceptions/domain.exception";
import { PrismaService } from "../../../src/prisma/prisma.service";
import { AuditService } from "../../../src/modules/audit/audit.service";

describe("Membership Rules & Last-Admin Protection (Unit)", () => {
  let service: MembershipManagementService;
  let mockMembershipRepo: {
    findMembership: jest.Mock;
    countActiveAdmins: jest.Mock;
    findOrganizationMembers: jest.Mock;
  };
  let mockPrisma: any;
  let mockAudit: {
    logEvent: jest.Mock;
  };

  beforeEach(() => {
    mockMembershipRepo = {
      findMembership: jest.fn(),
      countActiveAdmins: jest.fn(),
      findOrganizationMembers: jest.fn(),
    };

    mockPrisma = {
      $transaction: jest.fn((callback) => callback(mockPrisma)),
      membership: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      membershipRole: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      role: {
        findMany: jest.fn().mockResolvedValue([
          { id: "r-admin", code: "INSTITUTION_ADMIN" },
          { id: "r-teacher", code: "TEACHER" },
          { id: "r-reviewer", code: "REVIEWER" },
          { id: "r-participant", code: "PARTICIPANT" },
        ]),
      },
    };

    mockAudit = {
      logEvent: jest.fn().mockResolvedValue(undefined),
    };

    service = new MembershipManagementService(
      mockMembershipRepo as unknown as MembershipRepository,
      mockPrisma as unknown as PrismaService,
      mockAudit as unknown as AuditService,
    );
  });

  describe("Last-Admin Protection", () => {
    it("blocks removing the last active INSTITUTION_ADMIN (throws LastAdminException)", async () => {
      mockPrisma.membership.findFirst.mockResolvedValue({
        id: "m-sole-admin",
        organizationId: "org-1",
        userId: "user-sole-admin",
        status: "ACTIVE",
        roles: [{ role: { code: "INSTITUTION_ADMIN" } }],
      });

      mockMembershipRepo.countActiveAdmins.mockResolvedValue(1);

      await expect(
        service.updateMemberStatus(
          "org-1",
          "m-sole-admin",
          "SUSPENDED",
          "actor-admin",
          "corr-1",
        ),
      ).rejects.toThrow(LastAdminException);
    });

    it("allows suspending an admin when another active admin exists", async () => {
      mockPrisma.membership.findFirst.mockResolvedValue({
        id: "m-admin-1",
        organizationId: "org-1",
        userId: "user-admin-1",
        status: "ACTIVE",
        roles: [{ role: { code: "INSTITUTION_ADMIN" } }],
      });

      mockMembershipRepo.countActiveAdmins.mockResolvedValue(2);
      mockPrisma.membership.update.mockResolvedValue({
        id: "m-admin-1",
        status: "SUSPENDED",
      });

      const result = await service.updateMemberStatus(
        "org-1",
        "m-admin-1",
        "SUSPENDED",
        "actor-admin",
        "corr-1",
      );

      expect(result.status).toBe("SUSPENDED");
    });
  });

  describe("Institutional Role Validation", () => {
    it("rejects SAAS_ADMIN as an institutional role", async () => {
      await expect(
        service.updateMemberRoles(
          "org-1",
          "m-1",
          ["SAAS_ADMIN" as any],
          "actor-admin",
          "corr-1",
        ),
      ).rejects.toThrow(ValidationErrorException);
    });
  });
});

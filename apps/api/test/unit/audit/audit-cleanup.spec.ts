import { AuditCleanupJob } from "../../../src/modules/audit/audit-cleanup.job";
import { PrismaService } from "../../../src/prisma/prisma.service";

describe("AuditCleanupJob (Unit)", () => {
  let job: AuditCleanupJob;
  let mockPrisma: {
    auditEvent: {
      deleteMany: jest.Mock;
    };
  };

  beforeEach(() => {
    mockPrisma = {
      auditEvent: {
        deleteMany: jest.fn(),
      },
    };

    job = new AuditCleanupJob(mockPrisma as unknown as PrismaService);
  });

  it("deletes expired audit events based on expiresAt cutoff", async () => {
    mockPrisma.auditEvent.deleteMany.mockResolvedValue({ count: 42 });

    const result = await job.cleanupExpiredEvents();

    expect(result.deletedCount).toBe(42);
    expect(mockPrisma.auditEvent.deleteMany).toHaveBeenCalledWith({
      where: {
        expiresAt: {
          lte: expect.any(Date),
        },
      },
    });
  });
});

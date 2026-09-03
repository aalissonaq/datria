import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../src/prisma/prisma.service";

describe("MySQL readiness integration", () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    prisma = new PrismaService(
      new ConfigService({ DATABASE_URL: process.env.DATABASE_URL }),
    );
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("executes the bounded readiness query against the configured MySQL server", async () => {
    await expect(prisma.ping()).resolves.toBe(true);
  });
});

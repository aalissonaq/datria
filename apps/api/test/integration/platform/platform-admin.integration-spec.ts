import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../../../src/app.module";
import { PrismaService } from "../../../src/prisma/prisma.service";
import { Argon2PasswordHasher } from "../../../src/modules/identity/infrastructure/argon2-password-hasher";
import { UserStatus } from "@prisma/client";
import { provisionSaasAdmin } from "../../../src/modules/platform/scripts/provision-saas-admin";

describe("Platform Administration (Integration - MySQL)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let hasher: Argon2PasswordHasher;

  let saasAdminId: string;
  let testOrgId: string;
  let saasCookies: string[];
  let saasCsrfToken: string;

  const adminEmail = `saas.admin.${Date.now()}@example.com`;
  const password = "Password#2026";

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix("api/v1");
    prisma = app.get(PrismaService);
    hasher = app.get(Argon2PasswordHasher);
    await app.init();

    const passwordHash = await hasher.hash(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        displayName: "SaaS Root Admin",
        email: adminEmail,
        normalizedEmail: adminEmail.toLowerCase(),
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        passwordCredential: { create: { passwordHash } },
      },
    });
    saasAdminId = user.id;

    // Use CLI provisioning logic to assign SAAS_ADMIN role
    await provisionSaasAdmin(adminEmail, prisma);

    // Create a target organization for status modification
    const org = await prisma.organization.create({
      data: {
        name: "Organizacao Alvo",
        slug: `org-alvo-${Date.now()}`,
        status: "ACTIVE",
        createdByUserId: saasAdminId,
      },
    });
    testOrgId = org.id;

    // Login SaaS Admin
    const csrfRes = await request(app.getHttpServer()).get("/api/v1/auth/csrf");
    saasCsrfToken = csrfRes.body.csrfToken;
    const csrfCookie = csrfRes.headers["set-cookie"];

    const loginRes = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .set("Cookie", csrfCookie)
      .set("X-CSRF-Token", saasCsrfToken)
      .send({ email: adminEmail, password });

    const rawCookies = loginRes.headers["set-cookie"];
    const parsedCookies = Array.isArray(rawCookies) ? rawCookies : [rawCookies];
    saasCookies = [
      ...parsedCookies.map((c) => c.split(";")[0]),
      csrfCookie[0].split(";")[0],
    ];
  });

  afterAll(async () => {
    if (testOrgId) {
      await prisma.organization
        .delete({ where: { id: testOrgId } })
        .catch(() => null);
    }
    if (saasAdminId) {
      await prisma.user
        .delete({ where: { id: saasAdminId } })
        .catch(() => null);
    }
    await app.close();
  });

  it("lists all organizations on the platform via GET /platform/organizations", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/platform/organizations")
      .set("Cookie", saasCookies);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.organizations)).toBe(true);
    const found = res.body.organizations.find((o: any) => o.id === testOrgId);
    expect(found).toBeDefined();
    expect(found.status).toBe("ACTIVE");
  });

  it("updates organization status with audited reason via PATCH /platform/organizations/:id/status", async () => {
    const reason =
      "Inadimplência de contrato de prestação de serviços educacionais";
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/platform/organizations/${testOrgId}/status`)
      .set("Cookie", saasCookies)
      .set("X-CSRF-Token", saasCsrfToken)
      .send({
        status: "SUSPENDED",
        reason,
      });

    expect(res.status).toBe(200);
    expect(res.body.organization.status).toBe("SUSPENDED");

    // Verify DB update
    const updated = await prisma.organization.findUnique({
      where: { id: testOrgId },
    });
    expect(updated?.status).toBe("SUSPENDED");

    // Verify audit event logged with reason
    const auditEvent = await prisma.auditEvent.findFirst({
      where: {
        action: "PLATFORM_ORGANIZATION_STATUS_UPDATED",
        targetId: testOrgId,
      },
      orderBy: { occurredAt: "desc" },
    });

    expect(auditEvent).toBeDefined();
    expect((auditEvent?.metadata as any)?.reason).toBe(reason);
  });
});

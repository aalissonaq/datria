import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../../../src/app.module";
import { PrismaService } from "../../../src/prisma/prisma.service";
import { Argon2PasswordHasher } from "../../../src/modules/identity/infrastructure/argon2-password-hasher";
import { UserStatus } from "@prisma/client";

describe("Last Admin Protection Constraint (Integration - MySQL)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let hasher: Argon2PasswordHasher;

  let adminAId: string;
  let adminBId: string;
  let orgId: string;
  let membershipAId: string;
  let membershipBId: string;

  let adminACookies: string[];
  let adminACsrfToken: string;

  const emailA = `admin.a.${Date.now()}@example.com`;
  const emailB = `admin.b.${Date.now()}@example.com`;
  const password = "Password!2026";

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

    // Create Admin A
    const adminA = await prisma.user.create({
      data: {
        displayName: "Admin Sole",
        email: emailA,
        normalizedEmail: emailA.toLowerCase(),
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        passwordCredential: { create: { passwordHash } },
      },
    });
    adminAId = adminA.id;

    // Create Admin B
    const adminB = await prisma.user.create({
      data: {
        displayName: "Admin Second",
        email: emailB,
        normalizedEmail: emailB.toLowerCase(),
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        passwordCredential: { create: { passwordHash } },
      },
    });
    adminBId = adminB.id;

    const adminRole = await prisma.role.findUniqueOrThrow({
      where: { code: "INSTITUTION_ADMIN" },
    });

    // Create Org with Admin A as initial sole admin
    const org = await prisma.organization.create({
      data: {
        name: "Protecao Ultimo Admin",
        slug: `last-admin-org-${Date.now()}`,
        status: "ACTIVE",
        createdByUserId: adminAId,
        memberships: {
          create: {
            userId: adminAId,
            status: "ACTIVE",
            roles: {
              create: { roleId: adminRole.id },
            },
          },
        },
      },
      include: {
        memberships: true,
      },
    });
    orgId = org.id;
    membershipAId = org.memberships[0].id;

    // Authenticate Admin A
    const csrfRes = await request(app.getHttpServer()).get("/api/v1/auth/csrf");
    adminACsrfToken = csrfRes.body.csrfToken;
    const csrfCookie = csrfRes.headers["set-cookie"];

    const loginRes = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .set("Cookie", csrfCookie)
      .set("X-CSRF-Token", adminACsrfToken)
      .send({ email: emailA, password });

    const rawCookies = loginRes.headers["set-cookie"];
    const loginCookies = Array.isArray(rawCookies) ? rawCookies : [rawCookies];
    adminACookies = [
      ...loginCookies.map((c) => c.split(";")[0]),
      csrfCookie[0].split(";")[0],
    ];
  });

  afterAll(async () => {
    if (orgId) {
      await prisma.organization
        .delete({ where: { id: orgId } })
        .catch(() => null);
    }
    if (adminAId) {
      await prisma.user.delete({ where: { id: adminAId } }).catch(() => null);
    }
    if (adminBId) {
      await prisma.user.delete({ where: { id: adminBId } }).catch(() => null);
    }
    await app.close();
  });

  it("prevents suspending the sole active administrator with 409 LAST_ADMIN_PROTECTED", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${orgId}/members/${membershipAId}/status`)
      .set("Cookie", adminACookies)
      .set("X-CSRF-Token", adminACsrfToken)
      .set("X-Organization-Id", orgId)
      .send({ status: "SUSPENDED" });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("LAST_ADMIN_PROTECTED");
  });

  it("allows suspending an admin when a second active admin is present", async () => {
    const adminRole = await prisma.role.findUniqueOrThrow({
      where: { code: "INSTITUTION_ADMIN" },
    });

    // Add Admin B
    const membershipB = await prisma.membership.create({
      data: {
        organizationId: orgId,
        userId: adminBId,
        status: "ACTIVE",
        roles: {
          create: { roleId: adminRole.id },
        },
      },
    });
    membershipBId = membershipB.id;

    // Now suspend Admin A
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${orgId}/members/${membershipAId}/status`)
      .set("Cookie", adminACookies)
      .set("X-CSRF-Token", adminACsrfToken)
      .set("X-Organization-Id", orgId)
      .send({ status: "SUSPENDED" });

    expect(res.status).toBe(200);
    expect(res.body.membership.status).toBe("SUSPENDED");
  });
});

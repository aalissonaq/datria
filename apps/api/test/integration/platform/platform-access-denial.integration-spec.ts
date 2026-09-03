import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../../../src/app.module";
import { PrismaService } from "../../../src/prisma/prisma.service";
import { Argon2PasswordHasher } from "../../../src/modules/identity/infrastructure/argon2-password-hasher";
import { UserStatus } from "@prisma/client";

describe("Platform Access Denial to Non-SaaS Users (Integration - MySQL)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let hasher: Argon2PasswordHasher;

  let instAdminUserId: string;
  let regularUserId: string;
  let orgId: string;

  let instAdminCookies: string[];
  let regularCookies: string[];

  const instAdminEmail = `inst.admin.${Date.now()}@example.com`;
  const regularEmail = `regular.user.${Date.now()}@example.com`;
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

    // Create Institutional Admin user
    const instAdmin = await prisma.user.create({
      data: {
        displayName: "Institutional Admin Only",
        email: instAdminEmail,
        normalizedEmail: instAdminEmail.toLowerCase(),
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        passwordCredential: { create: { passwordHash } },
      },
    });
    instAdminUserId = instAdmin.id;

    // Create Regular user
    const regular = await prisma.user.create({
      data: {
        displayName: "Regular User",
        email: regularEmail,
        normalizedEmail: regularEmail.toLowerCase(),
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        passwordCredential: { create: { passwordHash } },
      },
    });
    regularUserId = regular.id;

    // Create Org with Institutional Admin
    const adminRole = await prisma.role.findUniqueOrThrow({
      where: { code: "INSTITUTION_ADMIN" },
    });

    const org = await prisma.organization.create({
      data: {
        name: "Campus Datria",
        slug: `campus-${Date.now()}`,
        status: "ACTIVE",
        createdByUserId: instAdminUserId,
        memberships: {
          create: {
            userId: instAdminUserId,
            status: "ACTIVE",
            roles: {
              create: { roleId: adminRole.id },
            },
          },
        },
      },
    });
    orgId = org.id;

    // Login Inst Admin
    const csrfRes1 = await request(app.getHttpServer()).get(
      "/api/v1/auth/csrf",
    );
    const csrfToken1 = csrfRes1.body.csrfToken;
    const csrfCookie1 = csrfRes1.headers["set-cookie"];

    const loginRes1 = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .set("Cookie", csrfCookie1)
      .set("X-CSRF-Token", csrfToken1)
      .send({ email: instAdminEmail, password });

    const rawCookies1 = loginRes1.headers["set-cookie"];
    const parsedCookies1 = Array.isArray(rawCookies1)
      ? rawCookies1
      : [rawCookies1];
    instAdminCookies = [
      ...parsedCookies1.map((c) => c.split(";")[0]),
      csrfCookie1[0].split(";")[0],
    ];

    // Login Regular User
    const csrfRes2 = await request(app.getHttpServer()).get(
      "/api/v1/auth/csrf",
    );
    const csrfToken2 = csrfRes2.body.csrfToken;
    const csrfCookie2 = csrfRes2.headers["set-cookie"];

    const loginRes2 = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .set("Cookie", csrfCookie2)
      .set("X-CSRF-Token", csrfToken2)
      .send({ email: regularEmail, password });

    const rawCookies2 = loginRes2.headers["set-cookie"];
    const parsedCookies2 = Array.isArray(rawCookies2)
      ? rawCookies2
      : [rawCookies2];
    regularCookies = [
      ...parsedCookies2.map((c) => c.split(";")[0]),
      csrfCookie2[0].split(";")[0],
    ];
  });

  afterAll(async () => {
    if (orgId) {
      await prisma.organization
        .delete({ where: { id: orgId } })
        .catch(() => null);
    }
    if (instAdminUserId) {
      await prisma.user
        .delete({ where: { id: instAdminUserId } })
        .catch(() => null);
    }
    if (regularUserId) {
      await prisma.user
        .delete({ where: { id: regularUserId } })
        .catch(() => null);
    }
    await app.close();
  });

  it("denies unauthenticated access to platform endpoints with 401", async () => {
    const res = await request(app.getHttpServer()).get(
      "/api/v1/platform/organizations",
    );
    expect(res.status).toBe(401);
  });

  it("denies regular users access to platform endpoints with 403", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/platform/organizations")
      .set("Cookie", regularCookies);

    expect(res.status).toBe(403);
  });

  it("denies institutional administrators access to platform endpoints with 403", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/platform/organizations")
      .set("Cookie", instAdminCookies);

    expect(res.status).toBe(403);
  });
});

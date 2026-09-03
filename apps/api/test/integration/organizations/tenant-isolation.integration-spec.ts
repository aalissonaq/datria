import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../../../src/app.module";
import { PrismaService } from "../../../src/prisma/prisma.service";
import { Argon2PasswordHasher } from "../../../src/modules/identity/infrastructure/argon2-password-hasher";
import { UserStatus } from "@prisma/client";

describe("Tenant Isolation & Context Listing (Integration - MySQL)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let hasher: Argon2PasswordHasher;

  let userAId: string;
  let userBId: string;
  let orgAId: string;

  let authCookiesUserB: string[];
  let csrfTokenUserB: string;

  const emailA = `user.a.${Date.now()}@example.com`;
  const emailB = `user.b.${Date.now()}@example.com`;
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

    // Create User A
    const userA = await prisma.user.create({
      data: {
        displayName: "User A",
        email: emailA,
        normalizedEmail: emailA.toLowerCase(),
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        passwordCredential: { create: { passwordHash } },
      },
    });
    userAId = userA.id;

    // Create User B
    const userB = await prisma.user.create({
      data: {
        displayName: "User B",
        email: emailB,
        normalizedEmail: emailB.toLowerCase(),
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        passwordCredential: { create: { passwordHash } },
      },
    });
    userBId = userB.id;

    // Create Org A owned by User A
    const adminRole = await prisma.role.findUniqueOrThrow({
      where: { code: "INSTITUTION_ADMIN" },
    });

    const orgA = await prisma.organization.create({
      data: {
        name: "Org Alpha Security",
        slug: `org-alpha-${Date.now()}`,
        status: "ACTIVE",
        createdByUserId: userAId,
        memberships: {
          create: {
            userId: userAId,
            status: "ACTIVE",
            roles: {
              create: { roleId: adminRole.id },
            },
          },
        },
      },
    });
    orgAId = orgA.id;

    // Authenticate User B
    const csrfRes = await request(app.getHttpServer()).get("/api/v1/auth/csrf");
    csrfTokenUserB = csrfRes.body.csrfToken;
    const csrfCookie = csrfRes.headers["set-cookie"];

    const loginRes = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .set("Cookie", csrfCookie)
      .set("X-CSRF-Token", csrfTokenUserB)
      .send({ email: emailB, password });

    const rawCookies = loginRes.headers["set-cookie"];
    const loginCookies = Array.isArray(rawCookies) ? rawCookies : [rawCookies];
    authCookiesUserB = [
      ...loginCookies.map((c) => c.split(";")[0]),
      csrfCookie[0].split(";")[0],
    ];
  });

  afterAll(async () => {
    if (orgAId) {
      await prisma.organization
        .delete({ where: { id: orgAId } })
        .catch(() => null);
    }
    if (userAId) {
      await prisma.user.delete({ where: { id: userAId } }).catch(() => null);
    }
    if (userBId) {
      await prisma.user.delete({ where: { id: userBId } }).catch(() => null);
    }
    await app.close();
  });

  it("lists personal context and available institutional contexts via /me/contexts", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/me/contexts")
      .set("Cookie", authCookiesUserB);

    expect(res.status).toBe(200);
    expect(res.body.activeContext.type).toBe("PERSONAL");
    expect(res.body.activeContext.userId).toBe(userBId);
    expect(res.body.availableOrganizations).toBeInstanceOf(Array);
  });

  it("denies User B access to Org A with neutral 404 (FR-016 cross-tenant isolation)", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/me/contexts")
      .set("Cookie", authCookiesUserB)
      .set("X-Organization-Id", orgAId);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });
});

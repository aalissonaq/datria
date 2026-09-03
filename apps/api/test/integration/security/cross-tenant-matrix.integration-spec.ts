import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../../../src/app.module";
import { PrismaService } from "../../../src/prisma/prisma.service";
import { Argon2PasswordHasher } from "../../../src/modules/identity/infrastructure/argon2-password-hasher";
import { UserStatus } from "@prisma/client";

describe("Cross-Tenant Security Matrix (Integration - MySQL)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let hasher: Argon2PasswordHasher;

  let userAId: string;
  let userBId: string;
  let userCId: string;

  let orgAId: string;
  let orgBId: string;
  let membershipAId: string;
  let membershipBId: string;

  let cookiesA: string[];
  let cookiesB: string[];
  let cookiesC: string[];

  let csrfTokenA: string;
  let csrfTokenB: string;
  let csrfTokenC: string;

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

    // Create User A
    const userA = await prisma.user.create({
      data: {
        displayName: "User A (Org Alpha)",
        email: `matrix.a.${Date.now()}@example.com`,
        normalizedEmail: `matrix.a.${Date.now()}@example.com`.toLowerCase(),
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        passwordCredential: { create: { passwordHash } },
      },
    });
    userAId = userA.id;

    // Create User B
    const userB = await prisma.user.create({
      data: {
        displayName: "User B (Org Beta)",
        email: `matrix.b.${Date.now()}@example.com`,
        normalizedEmail: `matrix.b.${Date.now()}@example.com`.toLowerCase(),
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        passwordCredential: { create: { passwordHash } },
      },
    });
    userBId = userB.id;

    // Create User C (Personal only)
    const userC = await prisma.user.create({
      data: {
        displayName: "User C (Personal Only)",
        email: `matrix.c.${Date.now()}@example.com`,
        normalizedEmail: `matrix.c.${Date.now()}@example.com`.toLowerCase(),
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        passwordCredential: { create: { passwordHash } },
      },
    });
    userCId = userC.id;

    const adminRole = await prisma.role.findUniqueOrThrow({
      where: { code: "INSTITUTION_ADMIN" },
    });

    // Create Org A
    const orgA = await prisma.organization.create({
      data: {
        name: "Matriz Alpha",
        slug: `matriz-alpha-${Date.now()}`,
        status: "ACTIVE",
        createdByUserId: userAId,
        memberships: {
          create: {
            userId: userAId,
            status: "ACTIVE",
            roles: { create: { roleId: adminRole.id } },
          },
        },
      },
      include: { memberships: true },
    });
    orgAId = orgA.id;
    membershipAId = orgA.memberships[0].id;

    // Create Org B
    const orgB = await prisma.organization.create({
      data: {
        name: "Matriz Beta",
        slug: `matriz-beta-${Date.now()}`,
        status: "ACTIVE",
        createdByUserId: userBId,
        memberships: {
          create: {
            userId: userBId,
            status: "ACTIVE",
            roles: { create: { roleId: adminRole.id } },
          },
        },
      },
      include: { memberships: true },
    });
    orgBId = orgB.id;
    membershipBId = orgB.memberships[0].id;

    // Helper to login
    const loginUser = async (email: string) => {
      const csrfRes = await request(app.getHttpServer()).get(
        "/api/v1/auth/csrf",
      );
      const token = csrfRes.body.csrfToken;
      const csrfCookie = csrfRes.headers["set-cookie"];

      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .set("Cookie", csrfCookie)
        .set("X-CSRF-Token", token)
        .send({ email, password });

      if (res.status !== 200) {
        throw new Error(
          `Login failed for ${email} with status ${res.status}: ${JSON.stringify(res.body)}`,
        );
      }

      const raw = res.headers["set-cookie"] || [];
      const arr = Array.isArray(raw) ? raw : [raw];
      const cookies = [
        ...arr.map((c: string) => c.split(";")[0]),
        csrfCookie[0].split(";")[0],
      ];
      return { cookies, token };
    };

    const sessionA = await loginUser(userA.email);
    cookiesA = sessionA.cookies;
    csrfTokenA = sessionA.token;

    const sessionB = await loginUser(userB.email);
    cookiesB = sessionB.cookies;
    csrfTokenB = sessionB.token;

    const sessionC = await loginUser(userC.email);
    cookiesC = sessionC.cookies;
    csrfTokenC = sessionC.token;
  });

  afterAll(async () => {
    if (orgAId)
      await prisma.organization
        .delete({ where: { id: orgAId } })
        .catch(() => null);
    if (orgBId)
      await prisma.organization
        .delete({ where: { id: orgBId } })
        .catch(() => null);
    if (userAId)
      await prisma.user.delete({ where: { id: userAId } }).catch(() => null);
    if (userBId)
      await prisma.user.delete({ where: { id: userBId } }).catch(() => null);
    if (userCId)
      await prisma.user.delete({ where: { id: userCId } }).catch(() => null);
    await app.close();
  });

  it("denies User A access to Org B members with 403 or neutral 404", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgBId}/members`)
      .set("Cookie", cookiesA)
      .set("X-Organization-Id", orgBId);

    expect([403, 404]).toContain(res.status);
  });

  it("denies User A from inviting members to Org B", async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgBId}/invitations`)
      .set("Cookie", cookiesA)
      .set("X-CSRF-Token", csrfTokenA)
      .set("X-Organization-Id", orgBId)
      .send({
        email: "trespasser@example.com",
        roles: ["TEACHER"],
      });

    expect([403, 404]).toContain(res.status);
  });

  it("denies User B access to Org A members with 403 or neutral 404", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgAId}/members`)
      .set("Cookie", cookiesB)
      .set("X-Organization-Id", orgAId);

    expect([403, 404]).toContain(res.status);
  });

  it("denies User C (Personal context) access to Org A and Org B endpoints", async () => {
    const resA = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgAId}/members`)
      .set("Cookie", cookiesC)
      .set("X-Organization-Id", orgAId);
    expect([403, 404]).toContain(resA.status);

    const resB = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgBId}/members`)
      .set("Cookie", cookiesC)
      .set("X-Organization-Id", orgBId);
    expect([403, 404]).toContain(resB.status);
  });

  it("denies both User A and User B from platform administration endpoints", async () => {
    const resA = await request(app.getHttpServer())
      .get("/api/v1/platform/organizations")
      .set("Cookie", cookiesA);
    expect(resA.status).toBe(403);

    const resB = await request(app.getHttpServer())
      .get("/api/v1/platform/organizations")
      .set("Cookie", cookiesB);
    expect(resB.status).toBe(403);
  });
});

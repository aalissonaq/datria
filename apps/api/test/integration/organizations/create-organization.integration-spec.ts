import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../../../src/app.module";
import { PrismaService } from "../../../src/prisma/prisma.service";
import { Argon2PasswordHasher } from "../../../src/modules/identity/infrastructure/argon2-password-hasher";
import { UserStatus } from "@prisma/client";

describe("Create Organization & First Admin Assignment (Integration - MySQL)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let hasher: Argon2PasswordHasher;

  let testUserId: string;
  let authCookies: string[];
  let csrfToken: string;

  const testEmail = `org.creator.${Date.now()}@example.com`;
  const testPassword = "Password!2026";

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

    // Create user
    const passwordHash = await hasher.hash(testPassword);
    const user = await prisma.user.create({
      data: {
        displayName: "Org Creator",
        email: testEmail,
        normalizedEmail: testEmail.toLowerCase(),
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        passwordCredential: { create: { passwordHash } },
      },
    });
    testUserId = user.id;

    // Get CSRF
    const csrfRes = await request(app.getHttpServer()).get("/api/v1/auth/csrf");
    csrfToken = csrfRes.body.csrfToken;
    const csrfCookie = csrfRes.headers["set-cookie"];

    // Login
    const loginRes = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .set("Cookie", csrfCookie)
      .set("X-CSRF-Token", csrfToken)
      .send({ email: testEmail, password: testPassword });

    const rawCookies = loginRes.headers["set-cookie"];
    const loginCookies = Array.isArray(rawCookies) ? rawCookies : [rawCookies];
    authCookies = [
      ...loginCookies.map((c) => c.split(";")[0]),
      csrfCookie[0].split(";")[0],
    ];
  });

  afterAll(async () => {
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => null);
    }
    await app.close();
  });

  it("atomically creates organization and assigns creator as first INSTITUTION_ADMIN", async () => {
    const orgSlug = `org-${Date.now()}`;
    const orgName = "Instituto de Tecnologia Datria";

    const res = await request(app.getHttpServer())
      .post("/api/v1/organizations")
      .set("Cookie", authCookies)
      .set("X-CSRF-Token", csrfToken)
      .send({
        name: orgName,
        slug: orgSlug,
      });

    expect(res.status).toBe(201);
    expect(res.body.organization.id).toBeDefined();
    expect(res.body.organization.slug).toBe(orgSlug);
    expect(res.body.organization.name).toBe(orgName);

    // Verify creator was assigned INSTITUTION_ADMIN role atomically
    const membership = await prisma.membership.findFirst({
      where: {
        userId: testUserId,
        organizationId: res.body.organization.id,
      },
      include: {
        roles: {
          include: { role: true },
        },
      },
    });

    expect(membership).toBeDefined();
    expect(membership?.status).toBe("ACTIVE");
    const roleCodes = membership?.roles.map((r) => r.role.code);
    expect(roleCodes).toContain("INSTITUTION_ADMIN");
  });

  it("rejects creation with duplicate slug (409 Conflict)", async () => {
    const duplicateSlug = `conflict-slug-${Date.now()}`;

    // First creation
    await request(app.getHttpServer())
      .post("/api/v1/organizations")
      .set("Cookie", authCookies)
      .set("X-CSRF-Token", csrfToken)
      .send({ name: "Org Alpha", slug: duplicateSlug });

    // Second creation with same slug
    const secondRes = await request(app.getHttpServer())
      .post("/api/v1/organizations")
      .set("Cookie", authCookies)
      .set("X-CSRF-Token", csrfToken)
      .send({ name: "Org Beta", slug: duplicateSlug });

    expect(secondRes.status).toBe(409);
    expect(secondRes.body.code).toBe("ORGANIZATION_SLUG_CONFLICT");
  });
});

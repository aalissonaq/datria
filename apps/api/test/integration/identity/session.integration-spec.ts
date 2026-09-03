import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../../../src/app.module";
import { PrismaService } from "../../../src/prisma/prisma.service";
import { Argon2PasswordHasher } from "../../../src/modules/identity/infrastructure/argon2-password-hasher";
import { UserStatus } from "@prisma/client";

describe("Session & Context Management (Integration - MySQL)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let hasher: Argon2PasswordHasher;

  let testUserId: string;
  const testEmail = `session.user.${Date.now()}@example.com`;
  const testPassword = "ValidPassword!2026";

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

    // Create an active, verified test user directly in MySQL
    const passwordHash = await hasher.hash(testPassword);
    const user = await prisma.user.create({
      data: {
        displayName: "Session Test User",
        email: testEmail,
        normalizedEmail: testEmail.toLowerCase(),
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        passwordCredential: {
          create: {
            passwordHash,
          },
        },
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => null);
    }
    await app.close();
  });

  it("authenticates user, maintains session via cookies, rotates refresh token, and logs out", async () => {
    // 1. Get CSRF Token
    const csrfRes = await request(app.getHttpServer()).get("/api/v1/auth/csrf");
    expect(csrfRes.status).toBe(200);
    const csrfToken = csrfRes.body.csrfToken;
    const csrfCookie = csrfRes.headers["set-cookie"];

    // 2. Login
    const loginRes = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .set("Cookie", csrfCookie)
      .set("X-CSRF-Token", csrfToken)
      .send({
        email: testEmail,
        password: testPassword,
      });

    expect(loginRes.status).toBe(200);
    const rawCookies = loginRes.headers["set-cookie"];
    const loginCookies = Array.isArray(rawCookies) ? rawCookies : [rawCookies];

    const accessCookie = loginCookies.find((c) =>
      c.startsWith("datria_access="),
    );
    const refreshCookie = loginCookies.find((c) =>
      c.startsWith("datria_refresh="),
    );

    expect(accessCookie).toBeDefined();
    expect(accessCookie).toContain("HttpOnly");
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toContain("HttpOnly");

    // Combine cookies
    const authCookies = [
      accessCookie!.split(";")[0],
      refreshCookie!.split(";")[0],
      csrfCookie[0].split(";")[0],
    ];

    // 3. Get /auth/me
    const meRes = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Cookie", authCookies);

    expect(meRes.status).toBe(200);
    expect(meRes.body.id).toBe(testUserId);
    expect(meRes.body.email).toBe(testEmail);

    // 4. Get /auth/context -> default PERSONAL context
    const contextRes = await request(app.getHttpServer())
      .get("/api/v1/auth/context")
      .set("Cookie", authCookies);

    expect(contextRes.status).toBe(200);
    expect(contextRes.body.activeContext.type).toBe("PERSONAL");
    expect(contextRes.body.activeContext.userId).toBe(testUserId);

    // 5. Refresh token rotation
    const refreshRes = await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .set("Cookie", authCookies)
      .set("X-CSRF-Token", csrfToken);

    expect(refreshRes.status).toBe(200);
    const rawRefreshed = refreshRes.headers["set-cookie"];
    const refreshedCookies = Array.isArray(rawRefreshed)
      ? rawRefreshed
      : [rawRefreshed];
    const newRefreshCookie = refreshedCookies.find((c) =>
      c.startsWith("datria_refresh="),
    );
    expect(newRefreshCookie).toBeDefined();

    // 6. Replay attack: submitting old refresh token must be rejected and revoke sessions
    const replayRes = await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .set("Cookie", authCookies) // contains old refresh token
      .set("X-CSRF-Token", csrfToken);

    expect(replayRes.status).toBe(401);

    // Verify all sessions revoked in MySQL
    const activeSessions = await prisma.session.findMany({
      where: { userId: testUserId, revokedAt: null },
    });
    expect(activeSessions).toHaveLength(0);
  });
});

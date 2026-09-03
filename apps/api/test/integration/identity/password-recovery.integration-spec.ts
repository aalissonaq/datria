import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../../../src/app.module";
import { PrismaService } from "../../../src/prisma/prisma.service";
import { Argon2PasswordHasher } from "../../../src/modules/identity/infrastructure/argon2-password-hasher";
import { UserStatus } from "@prisma/client";

describe("Password Recovery & Invalidation Lifecycle (Integration - MySQL)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let hasher: Argon2PasswordHasher;

  let testUserId: string;
  const testEmail = `recovery.user.${Date.now()}@example.com`;
  const initialPassword = "InitialPassword!2026";
  const newPassword = "UpdatedSecurePassword!2026";

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

    // Create ACTIVE user with initial password
    const passwordHash = await hasher.hash(initialPassword);
    const user = await prisma.user.create({
      data: {
        displayName: "Recovery User",
        email: testEmail,
        normalizedEmail: testEmail.toLowerCase(),
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        passwordCredential: { create: { passwordHash } },
      },
    });
    testUserId = user.id;

    // Create an initial active session for this user to verify it gets revoked upon password reset
    await prisma.session.create({
      data: {
        userId: testUserId,
        refreshTokenHash: "dummy-refresh-token-hash-recovery",
        tokenFamilyId: "dummy-family-recovery",
        currentJti: "dummy-jti-recovery",
        idleExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
        absoluteExpiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
      },
    });
  });

  afterAll(async () => {
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => null);
    }
    await app.close();
  });

  it("requests reset, updates password, revokes existing sessions, and prevents reuse", async () => {
    // 1. Get CSRF token
    const csrfRes = await request(app.getHttpServer()).get("/api/v1/auth/csrf");
    const csrfToken = csrfRes.body.csrfToken;
    const csrfCookie = csrfRes.headers["set-cookie"];

    // 2. Request forgot-password
    const forgotRes = await request(app.getHttpServer())
      .post("/api/v1/auth/forgot-password")
      .set("Cookie", csrfCookie)
      .set("X-CSRF-Token", csrfToken)
      .send({ email: testEmail });

    expect(forgotRes.status).toBe(202);

    // 3. Find generated reset token row in MySQL
    const tokenRecord = await prisma.passwordResetToken.findFirst({
      where: { userId: testUserId, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });
    expect(tokenRecord).toBeDefined();

    // 4. Reset password
    const resetRes = await request(app.getHttpServer())
      .post("/api/v1/auth/reset-password")
      .set("Cookie", csrfCookie)
      .set("X-CSRF-Token", csrfToken)
      .send({
        tokenHash: tokenRecord!.tokenHash,
        newPassword,
      });

    expect(resetRes.status).toBe(200);

    // 5. Verify token consumed
    const updatedToken = await prisma.passwordResetToken.findUnique({
      where: { id: tokenRecord!.id },
    });
    expect(updatedToken?.consumedAt).not.toBeNull();

    // 6. Verify previous session was revoked
    const activeSessions = await prisma.session.findMany({
      where: { userId: testUserId, revokedAt: null },
    });
    expect(activeSessions).toHaveLength(0);

    // 7. Old password must be rejected
    const oldLoginRes = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .set("Cookie", csrfCookie)
      .set("X-CSRF-Token", csrfToken)
      .send({ email: testEmail, password: initialPassword });
    expect(oldLoginRes.status).toBe(401);

    // 8. New password must authenticate
    const newLoginRes = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .set("Cookie", csrfCookie)
      .set("X-CSRF-Token", csrfToken)
      .send({ email: testEmail, password: newPassword });
    expect(newLoginRes.status).toBe(200);

    // 9. Reusing consumed token must fail
    const reuseRes = await request(app.getHttpServer())
      .post("/api/v1/auth/reset-password")
      .set("Cookie", csrfCookie)
      .set("X-CSRF-Token", csrfToken)
      .send({
        tokenHash: tokenRecord!.tokenHash,
        newPassword: "AnotherPassword!2026",
      });
    expect(reuseRes.status).toBe(400);
  });
});

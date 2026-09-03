import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../../../src/app.module";
import { PrismaService } from "../../../src/prisma/prisma.service";
import { Argon2PasswordHasher } from "../../../src/modules/identity/infrastructure/argon2-password-hasher";
import { UserStatus } from "@prisma/client";

describe("Auth Abuse & Anti-Enumeration (Integration - MySQL)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let hasher: Argon2PasswordHasher;

  let activeUserId: string;
  let pendingUserId: string;

  const activeEmail = `active.user.${Date.now()}@example.com`;
  const pendingEmail = `pending.user.${Date.now()}@example.com`;
  const validPassword = "SecurePassword!2026";

  beforeAll(async () => {
    process.env.TEST_RATE_LIMIT = "1";

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix("api/v1");
    prisma = app.get(PrismaService);
    hasher = app.get(Argon2PasswordHasher);
    await app.init();

    const passwordHash = await hasher.hash(validPassword);

    // Create ACTIVE user
    const activeUser = await prisma.user.create({
      data: {
        displayName: "Active User",
        email: activeEmail,
        normalizedEmail: activeEmail.toLowerCase(),
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        passwordCredential: { create: { passwordHash } },
      },
    });
    activeUserId = activeUser.id;

    // Create PENDING user
    const pendingUser = await prisma.user.create({
      data: {
        displayName: "Pending User",
        email: pendingEmail,
        normalizedEmail: pendingEmail.toLowerCase(),
        status: UserStatus.PENDING_VERIFICATION,
        passwordCredential: { create: { passwordHash } },
      },
    });
    pendingUserId = pendingUser.id;
  });

  afterAll(async () => {
    delete process.env.TEST_RATE_LIMIT;
    if (activeUserId) {
      await prisma.user
        .delete({ where: { id: activeUserId } })
        .catch(() => null);
    }
    if (pendingUserId) {
      await prisma.user
        .delete({ where: { id: pendingUserId } })
        .catch(() => null);
    }
    await app.close();
  });

  it("returns identical neutral 401 response for non-existent, wrong-password, and unverified accounts (FR-007)", async () => {
    // 1. Get CSRF Token
    const csrfRes = await request(app.getHttpServer()).get("/api/v1/auth/csrf");
    const csrfToken = csrfRes.body.csrfToken;
    const csrfCookie = csrfRes.headers["set-cookie"];

    // A. Non-existent account
    const nonExistentRes = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .set("Cookie", csrfCookie)
      .set("X-CSRF-Token", csrfToken)
      .send({
        email: "nonexistent.random@example.com",
        password: "Password123!",
      });

    // B. Existing active account with wrong password
    const wrongPasswordRes = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .set("Cookie", csrfCookie)
      .set("X-CSRF-Token", csrfToken)
      .send({ email: activeEmail, password: "WrongPassword!123" });

    // C. Existing unverified account
    const unverifiedRes = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .set("Cookie", csrfCookie)
      .set("X-CSRF-Token", csrfToken)
      .send({ email: pendingEmail, password: validPassword });

    // All three must produce identical neutral 401 responses
    expect(nonExistentRes.status).toBe(401);
    expect(wrongPasswordRes.status).toBe(401);
    expect(unverifiedRes.status).toBe(401);

    expect(nonExistentRes.body.code).toBe("INVALID_CREDENTIALS");
    expect(wrongPasswordRes.body.code).toBe("INVALID_CREDENTIALS");
    expect(unverifiedRes.body.code).toBe("INVALID_CREDENTIALS");

    expect(nonExistentRes.body.message).toBe("Invalid email or password");
    expect(wrongPasswordRes.body.message).toBe("Invalid email or password");
    expect(unverifiedRes.body.message).toBe("Invalid email or password");
  });

  it("enforces rate limiting (429) after repeated login attempts", async () => {
    const csrfRes = await request(app.getHttpServer()).get("/api/v1/auth/csrf");
    const csrfToken = csrfRes.body.csrfToken;
    const csrfCookie = csrfRes.headers["set-cookie"];

    // Make attempts up to the limit (5 per window)
    for (let i = 0; i < 3; i++) {
      await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .set("Cookie", csrfCookie)
        .set("X-CSRF-Token", csrfToken)
        .send({ email: "brute@example.com", password: "WrongPassword!1" });
    }

    // Now exceeds limit (since earlier tests also counted toward the 5 attempts from this IP)
    const blockedRes = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .set("Cookie", csrfCookie)
      .set("X-CSRF-Token", csrfToken)
      .send({ email: "brute@example.com", password: "WrongPassword!1" });

    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body.code).toBe("RATE_LIMITED");
  });
});

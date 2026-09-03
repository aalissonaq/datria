import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../../../src/app.module";
import { PrismaService } from "../../../src/prisma/prisma.service";
import {
  MAIL_PORT,
  MailPort,
} from "../../../src/modules/mail/mail-port.interface";

describe("Registration and Verification (Integration - MySQL)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let capturedEmails: Array<{ to: string; subject: string; html: string }> = [];

  const mockMailAdapter: MailPort = {
    sendMail: jest.fn().mockImplementation(async (options) => {
      capturedEmails.push(options);
    }),
  };

  beforeAll(async () => {
    capturedEmails = [];

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MAIL_PORT)
      .useValue(mockMailAdapter)
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix("api/v1");
    prisma = app.get(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    capturedEmails = [];
  });

  it("completes registration, verification, and establishes active user in personal context", async () => {
    const testEmail = `test.user.${Date.now()}@example.com`;
    const testPassword = "SecurePassword!2026";

    // 1. Get CSRF Token
    const csrfRes = await request(app.getHttpServer()).get("/api/v1/auth/csrf");
    expect(csrfRes.status).toBe(200);
    const csrfToken = csrfRes.body.csrfToken;
    const csrfCookie = csrfRes.headers["set-cookie"];

    // 2. Register new account
    const registerRes = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .set("Cookie", csrfCookie)
      .set("X-CSRF-Token", csrfToken)
      .send({
        displayName: "Integration User",
        email: testEmail,
        password: testPassword,
        termsVersion: "v1.0",
      });

    expect(registerRes.status).toBe(202);
    expect(registerRes.body.message).toContain(
      "verification link has been sent",
    );

    // 3. Verify in real MySQL database that user exists and is PENDING_VERIFICATION
    const userInDb = await prisma.user.findUnique({
      where: { normalizedEmail: testEmail.toLowerCase() },
      include: {
        passwordCredential: true,
        consentRecords: true,
        emailVerificationTokens: true,
        memberships: true,
        platformRoles: true,
      },
    });

    expect(userInDb).toBeDefined();
    expect(userInDb!.status).toBe("PENDING_VERIFICATION");
    expect(userInDb!.emailVerifiedAt).toBeNull();
    expect(userInDb!.passwordCredential).toBeDefined();
    expect(userInDb!.passwordCredential!.passwordHash).toMatch(
      /^\$argon2id\$v=19\$/,
    );
    expect(userInDb!.consentRecords).toHaveLength(1);
    expect(userInDb!.emailVerificationTokens).toHaveLength(1);
    expect(userInDb!.memberships).toHaveLength(0); // Zero institutional roles
    expect(userInDb!.platformRoles).toHaveLength(0); // Zero platform roles

    // 4. Verify email was dispatched
    expect(capturedEmails.length).toBeGreaterThan(0);
    const lastEmail = capturedEmails.find((e) => e.to === testEmail);
    expect(lastEmail).toBeDefined();
    expect(lastEmail!.html).toContain("token=");

    // Extract raw token from email html
    const tokenMatch = /token=([a-f0-9]+)/i.exec(lastEmail!.html);
    expect(tokenMatch).toBeDefined();
    const rawToken = tokenMatch![1];

    // 5. Verify email with raw token
    const verifyRes = await request(app.getHttpServer())
      .post("/api/v1/auth/verify-email")
      .set("Cookie", csrfCookie)
      .set("X-CSRF-Token", csrfToken)
      .send({ token: rawToken });

    expect(verifyRes.status).toBe(204);

    // 6. Verify user status is now ACTIVE in real MySQL
    const verifiedUser = await prisma.user.findUnique({
      where: { id: userInDb!.id },
      include: { emailVerificationTokens: true },
    });

    expect(verifiedUser!.status).toBe("ACTIVE");
    expect(verifiedUser!.emailVerifiedAt).toBeInstanceOf(Date);
    expect(verifiedUser!.emailVerificationTokens[0].consumedAt).toBeInstanceOf(
      Date,
    );

    // 7. Token reuse should fail with 400
    const reuseRes = await request(app.getHttpServer())
      .post("/api/v1/auth/verify-email")
      .set("Cookie", csrfCookie)
      .set("X-CSRF-Token", csrfToken)
      .send({ token: rawToken });

    expect(reuseRes.status).toBe(400);

    // 8. Cleanup test user
    await prisma.user.delete({ where: { id: userInDb!.id } });
  });
});

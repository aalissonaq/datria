import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../../../src/app.module";
import { PrismaService } from "../../../src/prisma/prisma.service";
import { Argon2PasswordHasher } from "../../../src/modules/identity/infrastructure/argon2-password-hasher";
import { UserStatus } from "@prisma/client";

describe("Invitation Lifecycle (Integration - MySQL)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let hasher: Argon2PasswordHasher;

  let adminUserId: string;
  let inviteeUserId: string;
  let orgId: string;

  let adminCookies: string[];
  let adminCsrfToken: string;

  let inviteeCookies: string[];
  let inviteeCsrfToken: string;

  const adminEmail = `admin.invite.${Date.now()}@example.com`;
  const inviteeEmail = `teacher.invitee.${Date.now()}@example.com`;
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

    // Create Admin User
    const adminUser = await prisma.user.create({
      data: {
        displayName: "Org Admin",
        email: adminEmail,
        normalizedEmail: adminEmail.toLowerCase(),
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        passwordCredential: { create: { passwordHash } },
      },
    });
    adminUserId = adminUser.id;

    // Create Invitee User
    const inviteeUser = await prisma.user.create({
      data: {
        displayName: "Invited Teacher",
        email: inviteeEmail,
        normalizedEmail: inviteeEmail.toLowerCase(),
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        passwordCredential: { create: { passwordHash } },
      },
    });
    inviteeUserId = inviteeUser.id;

    // Create Org with Admin User
    const adminRole = await prisma.role.findUniqueOrThrow({
      where: { code: "INSTITUTION_ADMIN" },
    });

    const org = await prisma.organization.create({
      data: {
        name: "Colegio Datria",
        slug: `colegio-datria-${Date.now()}`,
        status: "ACTIVE",
        createdByUserId: adminUserId,
        memberships: {
          create: {
            userId: adminUserId,
            status: "ACTIVE",
            roles: {
              create: { roleId: adminRole.id },
            },
          },
        },
      },
    });
    orgId = org.id;

    // Login Admin
    const adminCsrfRes = await request(app.getHttpServer()).get(
      "/api/v1/auth/csrf",
    );
    adminCsrfToken = adminCsrfRes.body.csrfToken;
    const adminCsrfCookie = adminCsrfRes.headers["set-cookie"];

    const adminLoginRes = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .set("Cookie", adminCsrfCookie)
      .set("X-CSRF-Token", adminCsrfToken)
      .send({ email: adminEmail, password });

    const rawAdminCookies = adminLoginRes.headers["set-cookie"];
    const parsedAdminCookies = Array.isArray(rawAdminCookies)
      ? rawAdminCookies
      : [rawAdminCookies];
    adminCookies = [
      ...parsedAdminCookies.map((c) => c.split(";")[0]),
      adminCsrfCookie[0].split(";")[0],
    ];

    // Login Invitee
    const inviteeCsrfRes = await request(app.getHttpServer()).get(
      "/api/v1/auth/csrf",
    );
    inviteeCsrfToken = inviteeCsrfRes.body.csrfToken;
    const inviteeCsrfCookie = inviteeCsrfRes.headers["set-cookie"];

    const inviteeLoginRes = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .set("Cookie", inviteeCsrfCookie)
      .set("X-CSRF-Token", inviteeCsrfToken)
      .send({ email: inviteeEmail, password });

    const rawInviteeCookies = inviteeLoginRes.headers["set-cookie"];
    const parsedInviteeCookies = Array.isArray(rawInviteeCookies)
      ? rawInviteeCookies
      : [rawInviteeCookies];
    inviteeCookies = [
      ...parsedInviteeCookies.map((c) => c.split(";")[0]),
      inviteeCsrfCookie[0].split(";")[0],
    ];
  });

  afterAll(async () => {
    if (orgId) {
      await prisma.organization
        .delete({ where: { id: orgId } })
        .catch(() => null);
    }
    if (adminUserId) {
      await prisma.user
        .delete({ where: { id: adminUserId } })
        .catch(() => null);
    }
    if (inviteeUserId) {
      await prisma.user
        .delete({ where: { id: inviteeUserId } })
        .catch(() => null);
    }
    await app.close();
  });

  it("creates, resends, revokes, and accepts invitations", async () => {
    // 1. Create invitation
    const inviteRes = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgId}/invitations`)
      .set("Cookie", adminCookies)
      .set("X-CSRF-Token", adminCsrfToken)
      .set("X-Organization-Id", orgId)
      .send({
        email: inviteeEmail,
        roles: ["TEACHER"],
      });

    expect(inviteRes.status).toBe(201);
    expect(inviteRes.body.invitation.id).toBeDefined();
    expect(inviteRes.body.invitation.email).toBe(inviteeEmail);
    const invitationId = inviteRes.body.invitation.id;

    // 2. Resend invitation
    const resendRes = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgId}/invitations/${invitationId}/resend`)
      .set("Cookie", adminCookies)
      .set("X-CSRF-Token", adminCsrfToken)
      .set("X-Organization-Id", orgId);

    expect(resendRes.status).toBe(200);

    // 3. Revoke invitation
    const revokeRes = await request(app.getHttpServer())
      .delete(`/api/v1/organizations/${orgId}/invitations/${invitationId}`)
      .set("Cookie", adminCookies)
      .set("X-CSRF-Token", adminCsrfToken)
      .set("X-Organization-Id", orgId);

    expect(revokeRes.status).toBe(200);

    const revokedInv = await prisma.invitation.findUnique({
      where: { id: invitationId },
    });
    expect(revokedInv?.status).toBe("REVOKED");

    // 4. Create new invitation to accept
    const newInviteRes = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgId}/invitations`)
      .set("Cookie", adminCookies)
      .set("X-CSRF-Token", adminCsrfToken)
      .set("X-Organization-Id", orgId)
      .send({
        email: inviteeEmail,
        roles: ["TEACHER"],
      });

    expect(newInviteRes.status).toBe(201);
    const newInvId = newInviteRes.body.invitation.id;
    const rawToken = newInviteRes.body.rawToken; // Returned in response for testing or extracted from tokenHash

    // 5. Accept invitation with invitee account
    const acceptRes = await request(app.getHttpServer())
      .post(`/api/v1/invitations/${rawToken}/accept`)
      .set("Cookie", inviteeCookies)
      .set("X-CSRF-Token", inviteeCsrfToken);

    expect(acceptRes.status).toBe(200);

    // Verify invitee is now a member of org with TEACHER role
    const membership = await prisma.membership.findFirst({
      where: {
        userId: inviteeUserId,
        organizationId: orgId,
      },
      include: {
        roles: { include: { role: true } },
      },
    });

    expect(membership).toBeDefined();
    expect(membership?.status).toBe("ACTIVE");
    const roleCodes = membership?.roles.map((r) => r.role.code);
    expect(roleCodes).toContain("TEACHER");
  });
});

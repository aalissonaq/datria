import { test, expect } from "@playwright/test";
import { PrismaClient, UserStatus } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url:
        process.env.DATABASE_URL || "mysql://root:@localhost:3306/datria_test",
    },
  },
});

test.describe("Member Management & Invitation Lifecycle (E2E)", () => {
  const timestamp = Date.now();
  const adminEmail = `e2e.admin.${timestamp}@example.com`;
  const inviteeEmail = `e2e.invitee.${timestamp}@example.com`;
  const password = "Password#2026";

  let adminUserId: string;
  let inviteeUserId: string;
  let orgId: string;
  const orgName = `Faculdade Datria ${timestamp}`;

  test.beforeAll(async () => {
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    // Create Admin User
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        normalizedEmail: adminEmail.toLowerCase(),
        displayName: "E2E Admin User",
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        passwordCredential: { create: { passwordHash } },
      },
    });
    adminUserId = admin.id;

    // Create Invitee User
    const invitee = await prisma.user.create({
      data: {
        email: inviteeEmail,
        normalizedEmail: inviteeEmail.toLowerCase(),
        displayName: "E2E Teacher Invitee",
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        passwordCredential: { create: { passwordHash } },
      },
    });
    inviteeUserId = invitee.id;

    // Create Organization with Admin
    const adminRole = await prisma.role.findUniqueOrThrow({
      where: { code: "INSTITUTION_ADMIN" },
    });

    const org = await prisma.organization.create({
      data: {
        name: orgName,
        slug: `faculdade-${timestamp}`,
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
  });

  test.afterAll(async () => {
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
    await prisma.$disconnect();
  });

  test("enforces last-admin block, invites new member, and member accepts invitation", async ({
    page,
    request,
  }) => {
    // 1. Admin Login
    await page.goto("http://localhost:5173/login");
    await page.fill("#login-email", adminEmail);
    await page.fill("#login-password", password);
    await page.click("#login-submit-btn");

    await expect(page.locator("#user-display")).toHaveText("E2E Admin User", {
      timeout: 10000,
    });

    // 2. Switch to Organization Context
    await page.selectOption("#context-select", orgId);
    await expect(page.locator("#nav-members-btn")).toBeVisible({
      timeout: 5000,
    });

    // 3. Navigate to Members page
    await page.click("#nav-members-btn");
    await expect(page.locator("#members-heading")).toBeVisible();

    // 4. Try to suspend sole administrator -> must be blocked
    const suspendBtn = page.locator("button:has-text('Suspender')").first();
    await suspendBtn.click();

    // Verify last-admin protection alert
    await expect(page.locator(".alert-error")).toContainText(
      "Não é permitido suspender ou remover o último administrador ativo",
    );

    // 5. Open Invite Member Modal
    await page.click("#btn-open-invite-modal");
    await expect(page.locator("#invite-modal-title")).toBeVisible();

    // 6. Invite the teacher user
    await page.fill("#invite-email", inviteeEmail);
    await page.click("#invite-submit-btn");

    await expect(page.locator("#invite-modal-title")).not.toBeVisible({
      timeout: 10000,
    });

    // 7. Extract invitation link from Mailpit REST API
    let acceptUrl = "";
    await expect
      .poll(
        async () => {
          const res = await request.get(
            "http://localhost:8025/api/v1/messages",
          );
          if (!res.ok()) return null;
          const data = await res.json();
          const messages = data.messages || [];

          const msg = messages.find(
            (m: any) =>
              m.To &&
              m.To.some((recipient: any) => recipient.Address === inviteeEmail),
          );

          if (!msg) return null;

          const detailRes = await request.get(
            `http://localhost:8025/api/v1/message/${msg.ID}`,
          );
          if (!detailRes.ok()) return null;
          const detail = await detailRes.json();

          const bodyText = detail.Text || detail.HTML || "";
          const match = bodyText.match(/accept-invitation\?token=([a-f0-9]+)/);
          if (match) {
            acceptUrl = `http://localhost:5173/accept-invitation?token=${match[1]}`;
            return match[1];
          }
          return null;
        },
        { timeout: 15000, intervals: [1000, 2000] },
      )
      .toBeTruthy();

    expect(acceptUrl).toBeTruthy();

    // 8. Logout Admin
    await page.click("#nav-logout-btn");
    await expect(page.locator("#nav-login-btn")).toBeVisible();

    // 9. Login Invitee
    await page.click("#nav-login-btn");
    await page.fill("#login-email", inviteeEmail);
    await page.fill("#login-password", password);
    await page.click("#login-submit-btn");
    await expect(page.locator("#user-display")).toHaveText(
      "E2E Teacher Invitee",
      {
        timeout: 10000,
      },
    );

    // 10. Visit Invitation Accept URL
    await page.goto(acceptUrl);
    await expect(page.locator("#accept-invite-btn")).toBeVisible();

    // 11. Click Accept
    await page.click("#accept-invite-btn");

    // 12. Verify Success Confirmation
    await expect(page.locator(".alert-success")).toContainText(
      "Convite Aceito!",
      {
        timeout: 10000,
      },
    );

    // 13. Verify Invitee now has access to the Organization
    await page.click("#goto-dashboard-btn");
    const option = page.locator("#context-select option", {
      hasText: orgName,
    });
    await expect(option).toBeAttached({ timeout: 10000 });
  });
});

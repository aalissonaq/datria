import { test, expect } from "@playwright/test";
import { PrismaClient, UserStatus } from "@prisma/client";
import * as argon2 from "argon2";
import { provisionSaasAdmin } from "../../apps/api/src/modules/platform/scripts/provision-saas-admin";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url:
        process.env.DATABASE_URL || "mysql://root:@localhost:3306/datria_test",
    },
  },
});

test.describe("Platform Administration & Separation of Powers (E2E)", () => {
  const timestamp = Date.now();
  const saasAdminEmail = `e2e.saas.admin.${timestamp}@example.com`;
  const regularEmail = `e2e.regular.user.${timestamp}@example.com`;
  const password = "Password#2026";

  let saasAdminUserId: string;
  let regularUserId: string;
  let targetOrgId: string;
  const targetOrgName = `Org Sob Auditoria ${timestamp}`;

  test.beforeAll(async () => {
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    // Create SaaS Admin user
    const saasUser = await prisma.user.create({
      data: {
        email: saasAdminEmail,
        normalizedEmail: saasAdminEmail.toLowerCase(),
        displayName: "E2E SaaS Administrator",
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        passwordCredential: { create: { passwordHash } },
      },
    });
    saasAdminUserId = saasUser.id;

    // Provision SAAS_ADMIN platform role
    await provisionSaasAdmin(saasAdminEmail, prisma);

    // Create Regular user
    const regularUser = await prisma.user.create({
      data: {
        email: regularEmail,
        normalizedEmail: regularEmail.toLowerCase(),
        displayName: "E2E Regular Platform User",
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        passwordCredential: { create: { passwordHash } },
      },
    });
    regularUserId = regularUser.id;

    // Create Target Organization
    const targetOrg = await prisma.organization.create({
      data: {
        name: targetOrgName,
        slug: `org-auditoria-${timestamp}`,
        status: "ACTIVE",
        createdByUserId: saasAdminUserId,
      },
    });
    targetOrgId = targetOrg.id;
  });

  test.afterAll(async () => {
    if (targetOrgId) {
      await prisma.organization
        .delete({ where: { id: targetOrgId } })
        .catch(() => null);
    }
    if (saasAdminUserId) {
      await prisma.user
        .delete({ where: { id: saasAdminUserId } })
        .catch(() => null);
    }
    if (regularUserId) {
      await prisma.user
        .delete({ where: { id: regularUserId } })
        .catch(() => null);
    }
    await prisma.$disconnect();
  });

  test("rejects unauthorized access by regular user, allows SaaS admin to view orgs and suspend with reason", async ({
    page,
  }) => {
    // 1. Login Regular User
    await page.goto("http://localhost:5173/login");
    await page.fill("#login-email", regularEmail);
    await page.fill("#login-password", password);
    await page.click("#login-submit-btn");
    await expect(page.locator("#user-display")).toHaveText(
      "E2E Regular Platform User",
      {
        timeout: 10000,
      },
    );

    // 2. Regular user attempts to access /platform/organizations
    await page.goto("http://localhost:5173/platform/organizations");

    // Must be denied with clear 403 error message
    await expect(page.locator(".alert-error")).toContainText(
      "Acesso Negado: Esta área é restrita a Administradores da Plataforma",
      { timeout: 10000 },
    );

    // 3. Logout regular user
    await page.click("#nav-logout-btn");
    await expect(page.locator("#nav-login-btn")).toBeVisible();

    // 4. Login SaaS Admin
    await page.click("#nav-login-btn");
    await page.fill("#login-email", saasAdminEmail);
    await page.fill("#login-password", password);
    await page.click("#login-submit-btn");
    await expect(page.locator("#user-display")).toHaveText(
      "E2E SaaS Administrator",
      {
        timeout: 10000,
      },
    );

    // 5. Navigate to /platform/organizations as SaaS Admin
    await page.goto("http://localhost:5173/platform/organizations");
    await expect(page.locator("#platform-orgs-heading")).toBeVisible();

    // 6. Locate target organization in table
    const targetRow = page.locator("tr", { hasText: targetOrgName });
    await expect(targetRow).toBeVisible({ timeout: 10000 });

    // 7. Click Suspender
    const toggleBtn = targetRow.locator("button:has-text('Suspender')");
    await toggleBtn.click();

    // 8. Modal appears
    await expect(page.locator("#status-modal-title")).toBeVisible();

    // 9. Enter audited reason
    const auditedReason =
      "Suspensão operacional por não conformidade contratual";
    await page.fill("#suspend-reason-input", auditedReason);

    // 10. Confirm suspension
    await page.click("#confirm-suspend-btn");

    // 11. Modal closes, success alert visible
    await expect(page.locator("#status-modal-title")).not.toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator(".alert-success")).toContainText(
      "atualizada com sucesso para SUSPENDED",
    );

    // 12. Row status now shows SUSPENDED
    await expect(targetRow).toContainText("SUSPENDED");

    // 13. Verify audit record in database with the exact reason
    const auditRecord = await prisma.auditEvent.findFirst({
      where: {
        action: "PLATFORM_ORGANIZATION_STATUS_UPDATED",
        targetId: targetOrgId,
      },
      orderBy: { occurredAt: "desc" },
    });

    expect(auditRecord).toBeDefined();
    expect((auditRecord?.metadata as any)?.reason).toBe(auditedReason);
  });
});

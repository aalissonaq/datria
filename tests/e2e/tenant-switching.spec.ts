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

test.describe("Tenant Context & Organization Management (E2E)", () => {
  const timestamp = Date.now();
  const testEmail = `e2e.tenant.${timestamp}@example.com`;
  const testPassword = "Password#2026";
  const displayName = "Tenancy Admin User";
  let testUserId: string;
  let createdOrgId: string | null = null;

  test.beforeAll(async () => {
    const passwordHash = await argon2.hash(testPassword, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    const user = await prisma.user.create({
      data: {
        email: testEmail,
        normalizedEmail: testEmail.toLowerCase(),
        displayName,
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

  test.afterAll(async () => {
    if (createdOrgId) {
      await prisma.organization
        .delete({ where: { id: createdOrgId } })
        .catch(() => null);
    }
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => null);
    }
    await prisma.$disconnect();
  });

  test("creates organization via modal, switches context, and validates tenant boundary", async ({
    page,
    request,
  }) => {
    // 1. Visit Login page and authenticate
    await page.goto("http://localhost:5173/login");
    await page.fill("#login-email", testEmail);
    await page.fill("#login-password", testPassword);
    await page.click("#login-submit-btn");

    // 2. Verify landing with Personal Context
    await expect(page.locator("#user-display")).toHaveText(displayName, {
      timeout: 10000,
    });
    await expect(page.locator("#context-select")).toBeVisible();
    await expect(page.locator("#context-select")).toHaveValue("");

    // 3. Open Create Organization Modal
    await page.click("#btn-open-create-org");
    await expect(page.locator("#create-org-title")).toBeVisible();

    // 4. Fill form
    const orgName = `Instituto Alfa ${timestamp}`;
    const orgSlug = `alfa-${timestamp}`;

    await page.fill("#create-org-name", orgName);
    await page.fill("#create-org-slug", orgSlug);

    // 5. Submit modal
    await page.click("#create-org-submit-btn");

    // 6. Verify modal closed and new organization context is active
    await expect(page.locator("#create-org-title")).not.toBeVisible({
      timeout: 10000,
    });

    // Option should now contain orgName and be selected
    const selectedOption = page.locator("#context-select option:checked");
    await expect(selectedOption).toContainText(orgName);
    await expect(selectedOption).toContainText("INSTITUTION_ADMIN");

    // Save orgId for cleanup
    const selectedOrgId = await page.locator("#context-select").inputValue();
    expect(selectedOrgId).toBeTruthy();
    createdOrgId = selectedOrgId;

    // 7. Switch back to Personal Context
    await page.selectOption("#context-select", "");
    await expect(page.locator("#context-select")).toHaveValue("");

    // 8. Direct API verification of cross-tenant boundary denial (FR-016)
    // A query targeting a non-existent or inaccessible organization must return 404 neutral
    const foreignOrgId = "00000000-0000-0000-0000-000000000000";
    const foreignContextRes = await page.evaluate(async (foreignId) => {
      const res = await fetch("http://localhost:3000/api/v1/me/contexts", {
        headers: {
          "X-Organization-Id": foreignId,
        },
        credentials: "include",
      });
      return { status: res.status, data: await res.json().catch(() => null) };
    }, foreignOrgId);

    expect(foreignContextRes.status).toBe(404);
  });
});

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

test.describe("Password Recovery Journey (E2E)", () => {
  const testEmail = `e2e.recovery.${Date.now()}@example.com`;
  const initialPassword = "InitialPassword!2026";
  const newPassword = "BrandNewPassword!2026";
  const displayName = "E2E Recovery User";
  let testUserId: string;

  test.beforeAll(async () => {
    const passwordHash = await argon2.hash(initialPassword, {
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
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => null);
    }
    await prisma.$disconnect();
  });

  test("requests reset link, extracts token from Mailpit, sets new password and logs in", async ({
    page,
    request,
  }) => {
    // 1. Visit Forgot Password page
    await page.goto("http://localhost:5173/forgot-password");
    await expect(page.locator(".auth-title")).toHaveText("Recuperar Senha");

    // 2. Submit email
    await page.fill("#forgot-email", testEmail);
    await page.click("#forgot-submit-btn");

    // 3. Verify confirmation notice
    await expect(page.locator(".alert-success")).toBeVisible({
      timeout: 10000,
    });

    // 4. Fetch email from Mailpit REST API
    let resetUrl = "";
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
              m.To.some((recipient: any) => recipient.Address === testEmail),
          );

          if (!msg) return null;

          const detailRes = await request.get(
            `http://localhost:8025/api/v1/message/${msg.ID}`,
          );
          if (!detailRes.ok()) return null;
          const detail = await detailRes.json();

          const bodyText = detail.Text || detail.HTML || "";
          const match = bodyText.match(/reset-password\?token=([a-f0-9]+)/);
          if (match) {
            resetUrl = `http://localhost:5173/reset-password?token=${match[1]}`;
            return match[1];
          }
          return null;
        },
        { timeout: 15000, intervals: [1000, 2000] },
      )
      .toBeTruthy();

    expect(resetUrl).toBeTruthy();

    // 5. Navigate to Reset Password link
    await page.goto(resetUrl);
    await expect(page.locator(".auth-title")).toHaveText("Nova Senha");

    // 6. Enter new password
    await page.fill("#reset-new-password", newPassword);
    await page.fill("#reset-confirm-password", newPassword);

    // 7. Click submit
    await page.click("#reset-submit-btn");

    // 8. Verify success alert
    await expect(page.locator(".alert-success")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator("#goto-login-btn")).toBeVisible();

    // 9. Click goto login
    await page.click("#goto-login-btn");
    await expect(page.locator(".auth-title")).toHaveText("Entrar na Datria");

    // 10. Login with new password
    await page.fill("#login-email", testEmail);
    await page.fill("#login-password", newPassword);
    await page.click("#login-submit-btn");

    // 11. Verify successful authentication
    await expect(page.locator("#user-display")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("#user-display")).toHaveText(displayName);
  });
});

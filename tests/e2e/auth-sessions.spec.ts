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

test.describe("Authentication, Session & Logout (E2E)", () => {
  const testEmail = `e2e.login.${Date.now()}@example.com`;
  const testPassword = "ValidPassword!2026";
  const displayName = "E2E Authenticated User";
  let testUserId: string;

  test.beforeAll(async () => {
    // Hash password with RFC 9106 recommended / SEC-EXC-001 parameters
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
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => null);
    }
    await prisma.$disconnect();
  });

  test("completes login, establishes session, verifies identity, and logs out", async ({
    page,
  }) => {
    // 1. Visit Login page
    await page.goto("http://localhost:5173/login");
    await expect(page.locator(".auth-title")).toHaveText("Entrar na Datria");

    // 2. Fill in credentials
    await page.fill("#login-email", testEmail);
    await page.fill("#login-password", testPassword);

    // 3. Click Entrar
    await page.click("#login-submit-btn");

    // 4. Verify landing on home with authenticated user display
    await expect(page.locator("#user-display")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("#user-display")).toHaveText(displayName);
    await expect(page.locator("#nav-logout-btn")).toBeVisible();

    // 5. Click Logout
    await page.click("#nav-logout-btn");

    // 6. Verify unauthenticated state restored
    await expect(page.locator("#nav-login-btn")).toBeVisible();
    await expect(page.locator("#user-display")).not.toBeVisible();
  });
});

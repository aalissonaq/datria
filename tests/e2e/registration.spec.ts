import { test, expect } from "@playwright/test";

test.describe("User Registration & Email Verification (E2E)", () => {
  test("completes registration, fetches verification link from Mailpit, and activates account", async ({
    page,
    request,
  }) => {
    const timestamp = Date.now();
    const testEmail = `e2e.user.${timestamp}@datria.test`;
    const testPassword = "StrongPassword#2026";
    const testName = `E2E User ${timestamp}`;

    // 1. Navigate to Registration page
    await page.goto("/register");
    await expect(
      page.getByRole("heading", { name: "Criar Conta na Datria" }),
    ).toBeVisible();

    // 2. Fill form
    await page.locator("#displayName").fill(testName);
    await page.locator("#email").fill(testEmail);
    await page.locator("#password").fill(testPassword);
    await page.locator("#termsAccepted").check();

    // 3. Submit
    const submitBtn = page.locator("#register-submit-btn");
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // 4. Verify confirmation banner appears
    await expect(
      page.getByRole("heading", { name: "Verifique seu e-mail" }),
    ).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(testEmail)).toBeVisible();

    // 5. Query Mailpit API for the dispatched message
    let rawToken: string | null = null;
    // Retry finding message in Mailpit up to 10 times
    for (let attempt = 0; attempt < 10; attempt++) {
      const mailpitRes = await request.get(
        "http://localhost:8025/api/v1/messages",
      );
      if (mailpitRes.ok()) {
        const data = await mailpitRes.json();
        const messages = data.messages || [];
        const targetMsg = messages.find(
          (m: { To: Array<{ Address: string }> }) =>
            m.To && m.To.some((t) => t.Address === testEmail),
        );

        if (targetMsg) {
          const detailRes = await request.get(
            `http://localhost:8025/api/v1/message/${targetMsg.ID}`,
          );
          if (detailRes.ok()) {
            const detail = await detailRes.json();
            const htmlContent = detail.HTML || detail.Text || "";
            const match = /token=([a-f0-9]+)/i.exec(htmlContent);
            if (match) {
              rawToken = match[1];
              break;
            }
          }
        }
      }
      await page.waitForTimeout(1000);
    }

    expect(rawToken).not.toBeNull();

    // 6. Navigate to verification URL with the token
    await page.goto(`/verify-email?token=${rawToken}`);

    // 7. Verify success state
    await expect(page.getByText("Conta Ativada com Sucesso!")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator("#goto-login-btn")).toBeVisible();
  });
});

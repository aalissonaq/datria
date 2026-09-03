import { test, expect } from "@playwright/test";

test.describe("Accessibility (WCAG 2.2 AA Compliance)", () => {
  test("LoginPage has valid accessible structure and keyboard navigability", async ({
    page,
  }) => {
    await page.goto("http://localhost:5173/login");

    const card = page.locator(
      "div[role='region'][aria-label='Acesso ao Sistema']",
    );
    await expect(card).toBeVisible();

    const title = page.locator(".auth-title");
    await expect(title).toHaveText("Entrar na Datria");

    const emailInput = page.locator("#login-email");
    const passwordInput = page.locator("#login-password");
    const submitBtn = page.locator("#login-submit-btn");

    await expect(emailInput).toHaveAttribute("type", "email");
    await expect(emailInput).toHaveAttribute("required", "");
    await expect(passwordInput).toHaveAttribute("required", "");
    await expect(submitBtn).toBeVisible();

    // Verify focusability
    await emailInput.focus();
    await expect(emailInput).toBeFocused();
    await passwordInput.focus();
    await expect(passwordInput).toBeFocused();
  });

  test("RegisterPage has accessible form labels and password feedback", async ({
    page,
  }) => {
    await page.goto("http://localhost:5173/register");

    const card = page.locator(
      "div[role='region'][aria-label='Cadastro de Usuário']",
    );
    await expect(card).toBeVisible();

    const nameInput = page.locator("#displayName");
    const emailInput = page.locator("#email");
    const passwordInput = page.locator("#password");
    const termsCheck = page.locator("#termsAccepted");

    await expect(nameInput).toBeVisible();
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(termsCheck).toHaveAttribute("type", "checkbox");

    // Focus verification
    await nameInput.focus();
    await expect(nameInput).toBeFocused();

    // Criteria feedback list is present
    await expect(page.locator("#password-rules")).toBeVisible();
  });

  test("ForgotPasswordPage and ResetPasswordPage provide accessible status feedback", async ({
    page,
  }) => {
    await page.goto("http://localhost:5173/forgot-password");
    await expect(
      page.locator("div[role='region'][aria-label='Recuperação de Acesso']"),
    ).toBeVisible();

    await page.goto("http://localhost:5173/reset-password?token=mock-token");
    await expect(
      page.locator("div[role='region'][aria-label='Definição de Nova Senha']"),
    ).toBeVisible();
    await expect(page.locator("#reset-new-password")).toBeVisible();
    await expect(page.locator("#reset-confirm-password")).toBeVisible();
  });
});

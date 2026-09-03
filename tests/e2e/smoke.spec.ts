import { test, expect } from "@playwright/test";

test.describe("Foundation Smoke Tests", () => {
  test("temporary web page loads with Datria codename notice and baseline status", async ({
    page,
  }) => {
    await page.goto("/");

    // Verify Title and Heading
    await expect(page).toHaveTitle(/Datria/);
    const heading = page.getByRole("heading", { name: "Datria" });
    await expect(heading).toBeVisible();

    // Verify Codename notice (FR-009)
    const codenameBadge = page.getByText("Codename", { exact: false });
    await expect(codenameBadge).toBeVisible();

    // Verify Baseline loaded indicator (FR-009)
    const baselineStatus = page.getByText("Baseline loaded successfully");
    await expect(baselineStatus).toBeVisible();
  });

  test("API liveness endpoint responds with ok status", async ({ request }) => {
    const response = await request.get(
      "http://localhost:3000/api/v1/health/live",
    );
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.status).toBe("ok");
    expect(data.service).toBe("datria-api");
    expect(data.timestamp).toBeDefined();
  });
});

import { expect, test } from "@playwright/test";

test("navigates through every public feature page", async ({ page }) => {
  await page.goto("/");

  for (const path of ["/tiers", "/schedule", "/results"]) {
    await page.locator(`a[href="${path}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.locator("main h1")).toBeVisible();
  }
});

test("redirects a signed-out profile visit to login", async ({ page }) => {
  await page.goto("/profile");

  await expect(page).toHaveURL(/\/login\?returnTo=%2Fprofile$/);
  await expect(page.locator("form").first()).toBeVisible();
});

test("keeps mobile pages inside the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  for (const path of ["/", "/tiers", "/schedule", "/results", "/login"]) {
    await page.goto(path);
    await expect(page.locator("body")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${path} has horizontal overflow`).toBeLessThanOrEqual(1);
  }
});

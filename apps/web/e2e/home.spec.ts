import { expect, test } from "@playwright/test";

test("the home page lists the official kits", async ({ page }) => {
  await page.goto("/");
  const kitLinks = page.locator('a[href^="/kits/"]');
  await expect(kitLinks.first()).toBeVisible();
  expect(await kitLinks.count()).toBeGreaterThanOrEqual(10);
});

test("search filters the kit list", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Search kits" }).fill("fastapi");
  await expect(page.locator('a[href="/kits/api-fastapi"]').first()).toBeVisible();
  await expect(page.locator('a[href="/kits/landing-next"]')).toHaveCount(0);
});

test("an unknown page answers 404 with the ASCII page", async ({ page }) => {
  const response = await page.goto("/this-page-does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("img", { name: "404" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "This page doesn't exist" })).toBeVisible();
});

test("a search in the URL is restored, and typing writes it back", async ({ page }) => {
  await page.goto("/?q=fastapi#leaderboard");
  await expect(page.getByRole("textbox", { name: "Search kits" })).toHaveValue("fastapi");
  await expect(page.locator('a[href="/kits/api-fastapi"]').first()).toBeVisible();

  await page.getByRole("textbox", { name: "Search kits" }).fill("hono");
  await expect(page).toHaveURL(/\?q=hono/);
});

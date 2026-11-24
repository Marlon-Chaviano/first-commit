import { expect, test } from "@playwright/test";

test("both creators keep the GitHub import destination through login", async ({ page }) => {
  await page.goto("/#leaderboard");
  await page.locator('a[href="/kits/new"]').filter({ hasText: "Create a kit" }).click();
  await expect(page.getByRole("heading", { name: "Create a kit from GitHub" })).toBeVisible();
  await expect(page.locator('a').filter({ hasText: "Log in to choose a repository" })).toHaveAttribute("href", "/login?next=%2Fkits%2Fnew");

  await page.goto("/brands/new");
  await page.locator('a').filter({ hasText: "From GitHub" }).click();
  await expect(page.getByRole("heading", { name: "Create a brand from GitHub" })).toBeVisible();
  await expect(page.locator('a').filter({ hasText: "Log in to choose a repository" })).toHaveAttribute("href", "/login?next=%2Fbrands%2Fnew%3Fsource%3Dgithub");
  await page.getByRole("button", { name: "Start from scratch" }).click();
  await expect(page.getByLabel("Brand name", { exact: true })).toBeVisible();
});

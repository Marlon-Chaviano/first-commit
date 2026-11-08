import { expect, type Page, test } from "@playwright/test";

/** The install command shown next to the configurator. */
const command = (page: Page) => page.locator("code", { hasText: "create-first-commit@latest" }).first();

test("changing an option changes the install command", async ({ page }) => {
  await page.goto("/kits/landing-next");
  await expect(command(page)).toContainText("landing-next");
  await expect(command(page)).not.toContainText("--components");

  await page.getByRole("button", { name: "Mantine", exact: true }).first().click();
  await expect(command(page)).toContainText("--components mantine");
});

test("a choice whose framework requirement isn't met is disabled until it is", async ({ page }) => {
  await page.goto("/kits/mobile-expo");
  const reusables = page.getByRole("button", { name: "React Native Reusables", exact: true }).first();
  await expect(reusables).toBeDisabled();

  await page.getByRole("button", { name: "NativeWind (Tailwind)", exact: true }).first().click();
  await expect(reusables).toBeEnabled();
  await expect(command(page)).toContainText("--styling nativewind");
});

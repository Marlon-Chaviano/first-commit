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

test("security packs preserve valid selections when toggled", async ({ page }) => {
  await page.goto("/kits/web-next");
  const base = page.getByRole("switch", { name: "Include Security pack", exact: true });
  const ai = page.getByRole("switch", { name: "Include AI security pack", exact: true });
  await expect(base).toBeChecked();
  await expect(ai).not.toBeChecked();

  await base.uncheck();
  await expect(command(page)).toContainText("--security none");
  await ai.check();
  await expect(base).toBeChecked();
  await expect(ai).toBeChecked();
  await expect(command(page)).toContainText("--security security-ai-pack,security-pack");

  await base.uncheck();
  await expect(ai).not.toBeChecked();
  await expect(command(page)).toContainText("--security none");
});

test("individual security skills can be excluded from the install command", async ({ page }) => {
  await page.goto("/kits/web-next");
  const review = page.getByRole("checkbox", { name: /^code-review-security\b/ });
  await expect(review).toBeChecked();
  await review.uncheck();
  await expect(command(page)).toContainText("--no-skill OWASP/secure-agent-playbook@code-review-security");
  await review.check();
  await expect(command(page)).not.toContainText("--no-skill");
});

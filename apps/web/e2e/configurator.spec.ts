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

for (const kit of ["web-next", "mcp-server-ts", "mobile-expo"]) {
  test(`${kit} has one general security pack with 12 skills`, async ({ page }) => {
    await page.goto(`/kits/${kit}`);
    const security = page.getByRole("switch", { name: "Include Security pack", exact: true });
    await expect(page.getByRole("switch", { name: /security pack/i })).toHaveCount(1);
    await expect(security).toBeChecked();
    const pack = page.locator("div[data-on]").filter({ has: security });
    await expect(pack.getByText("12/12 skills", { exact: true })).toBeVisible();
    for (const skill of ["code-review-security", "web-security-review", "api-security-review", "mobile-code-review", "iac-security-review"]) {
      await expect(page.getByRole("checkbox", { name: new RegExp(`^${skill}\\b`) })).toBeChecked();
    }
    await security.uncheck();
    await expect(command(page)).toContainText("--security none");
    await security.check();
    await expect(command(page)).not.toContainText("--security");
  });
}

test("individual security skills can be excluded from the install command", async ({ page }) => {
  await page.goto("/kits/web-next");
  const review = page.getByRole("checkbox", { name: /^code-review-security\b/ });
  await expect(review).toBeChecked();
  await review.uncheck();
  await expect(command(page)).toContainText("--no-skill OWASP/secure-agent-playbook@code-review-security");
  await review.check();
  await expect(command(page)).not.toContainText("--no-skill");
});

test("Nuxt offers framework-specific deployment choices with icons", async ({ page }) => {
  const duplicateKeys: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("same key")) duplicateKeys.push(message.text());
  });
  await page.goto("/kits/web-nuxt");
  for (const name of ["Vercel", "Netlify", "Docker", "Railway"]) {
    const choice = page.getByRole("button", { name, exact: true });
    await expect(choice).toBeVisible();
    await expect(choice.locator("svg")).toBeVisible();
  }
  await page.getByRole("button", { name: "Docker", exact: true }).click();
  await expect(command(page)).toContainText("--deploy docker-nuxt");
  await expect(page.getByRole("button", { name: "Netlify", exact: true })).not.toHaveAttribute("data-state", "on");
  expect(duplicateKeys).toEqual([]);
});

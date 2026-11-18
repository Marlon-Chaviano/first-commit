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
    await page.getByRole("button", { name: "Show Security pack skills", exact: true }).click();
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
  await page.getByRole("button", { name: "Show Security pack skills", exact: true }).click();
  const review = page.getByRole("checkbox", { name: /^code-review-security\b/ });
  await expect(review).toBeChecked();
  await review.uncheck();
  await expect(command(page)).toContainText("--no-skill OWASP/secure-agent-playbook@code-review-security");
  await page.getByRole("button", { name: "Hide Security pack skills", exact: true }).click();
  await expect(page.getByText("11/12 skills", { exact: true })).toBeVisible();
  await expect(command(page)).toContainText("--no-skill OWASP/secure-agent-playbook@code-review-security");
  await page.getByRole("button", { name: "Show Security pack skills", exact: true }).click();
  await expect(review).not.toBeChecked();
  await review.check();
  await expect(command(page)).not.toContainText("--no-skill");
});

test("skill packs start compact and expand independently without changing selections", async ({ page }) => {
  await page.goto("/kits/web-next");
  const initialCommand = await command(page).innerText();
  for (const title of ["Design pack", "Security pack", "Pack first-commit"]) {
    const show = page.getByRole("button", { name: `Show ${title} skills`, exact: true });
    const include = page.getByRole("switch", { name: `Include ${title}`, exact: true });
    const pack = page.locator("div[data-on]").filter({ has: include });
    await expect(show).toHaveAttribute("aria-expanded", "false");
    await expect(include).toBeChecked();
    await expect(pack.getByRole("checkbox")).toHaveCount(0);
    await show.focus();
    await page.keyboard.press("Enter");
    const hide = page.getByRole("button", { name: `Hide ${title} skills`, exact: true });
    await expect(hide).toHaveAttribute("aria-expanded", "true");
    await expect(pack.getByRole("checkbox").first()).toBeVisible();
    await expect(command(page)).toHaveText(initialCommand);
    await hide.click();
    await expect(show).toHaveAttribute("aria-expanded", "false");
    await expect(command(page)).toHaveText(initialCommand);
  }
});

test("a disabled pack can be inspected without enabling it", async ({ page }) => {
  await page.goto("/kits/web-next");
  const include = page.getByRole("switch", { name: "Include Security pack", exact: true });
  await include.uncheck();
  await page.getByRole("button", { name: "Show Security pack skills", exact: true }).click();
  const review = page.getByRole("checkbox", { name: /^code-review-security\b/ });
  await expect(review).toBeVisible();
  await expect(review).toBeDisabled();
  await expect(command(page)).toContainText("--security none");
  await include.check();
  await expect(review).toBeEnabled();
  await expect(command(page)).not.toContainText("--security none");
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

test("a monorepo configures libraries independently for web, API and docs", async ({ page }) => {
  await page.goto("/kits/monorepo");
  await expect(command(page)).toContainText("monorepo");
  await page.getByRole("button", { name: "Web · nextjs", exact: true }).click();
  await page.getByRole("button", { name: "Mantine", exact: true }).click();
  await expect(command(page)).toContainText("--web.nextjs.components mantine");
  await page.getByRole("button", { name: "Backend with Django", exact: true }).click();
  await expect(command(page)).toContainText("--api django");
  await page.getByRole("button", { name: "Api · django", exact: true }).click();
  await expect(page.getByText("Libraries and tools installed in apps/api.", { exact: true })).toBeVisible();
  await expect(command(page)).toContainText("--web.nextjs.components mantine");
  await page.getByRole("button", { name: /Docs with Starlight/, exact: false }).click();
  await expect(command(page)).toContainText("--docs starlight");
  await page.getByRole("button", { name: "Show install steps", exact: true }).click();
  await expect(page.getByText("Create workspace", { exact: true })).toBeVisible();
  await expect(page.getByText("Loading install steps…", { exact: true })).not.toBeVisible();
});

test("T3 hosting follows the selected composition", async ({ page }) => {
  await page.goto("/kits/monorepo-t3-turbo");
  await page.getByRole("button", { name: "Independent services", exact: true }).click();
  await page.getByRole("button", { name: "Web · nextjs", exact: true }).click();
  const docker = page.getByRole("button", { name: "docker", exact: true });
  await expect(docker).toHaveCount(0);
  await page.getByRole("button", { name: "Backend with Django", exact: true }).click();
  await docker.click();
  await expect(command(page)).toContainText("--web.nextjs.deploy docker");
  await page.getByRole("button", { name: "No api", exact: true }).click();
  await expect(docker).toHaveCount(0);
  await expect(command(page)).not.toContainText("--web.nextjs.deploy");
});

import { expect, test } from "@playwright/test";

test("guests can inspect a public template and choose an identifier before login", async ({ page }) => {
  await page.goto("/brands");
  await page.getByRole("searchbox", { name: "Search brands" }).fill("Nike");
  await page.getByRole("link", { name: "View Nike template" }).click();
  await expect(page).toHaveURL(/\/brand-templates\/nike$/);
  await expect(page.getByRole("heading", { name: "Color palette" })).toBeVisible();
  await page.getByText("Fork to my brands", { exact: true }).click();
  await page.getByLabel("Identifier for your copy").fill("training");
  const privacy = page.getByRole("checkbox", { name: "Hacer privada" });
  await expect(privacy).not.toBeChecked();
  await privacy.check();
  await page.getByRole("button", { name: "Log in to create copy" }).click();
  await expect(page).toHaveURL(/\/login\?/);
  const next = new URL(page.url()).searchParams.get("next")!;
  expect(next).toBe("/brands/new?template=nike&name=training&private=1");
  await page.goto(next);
  await expect(privacy).toBeChecked();
});

test("the login return path restores a guest draft in the same tab", async ({ page }) => {
  await page.goto("/brands/new");
  await page.getByRole("button", { name: /Start from scratch/ }).click();
  await page.getByLabel("Brand name", { exact: true }).fill("Night Studio");
  await page.getByLabel("Identifier", { exact: true }).fill("night-studio");
  await page.getByRole("checkbox", { name: "Hacer privada" }).check();
  await page.getByLabel("Voice and tone").fill("Direct and conversational");
  await page.getByRole("button", { name: "Log in to create profile" }).click();
  await expect(page).toHaveURL(/\/login\?/);
  const next = new URL(page.url()).searchParams.get("next")!;
  expect(next).toMatch(/^\/brands\/new\?draft=[\da-f-]{36}$/);
  await page.goto(next);
  await expect(page.getByLabel("Brand name", { exact: true })).toHaveValue("Night Studio");
  await expect(page.getByRole("checkbox", { name: "Hacer privada" })).toBeChecked();
  await expect(page.getByLabel("Voice and tone")).toHaveValue("Direct and conversational");
});

test("each click loads just one page of 20 brands, with search across all pages", async ({ page }) => {
  const requestedPages: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/api/v1/brand-templates") requestedPages.push(url.searchParams.get("page") ?? "");
  });
  await page.goto("/brands");
  const catalog = page.locator("#templates");
  const cards = catalog.getByRole("link");
  const more = catalog.getByRole("button", { name: /^Show \d+ more/ });
  await expect(cards).toHaveCount(20);
  const first = await cards.first().getAttribute("href");
  await expect(catalog.getByText(/^Showing \d+ of \d+/)).toHaveCount(0);
  const total = 20 + Number((await more.innerText()).match(/(\d+) remaining/)?.[1]);
  expect(total).toBeGreaterThanOrEqual(180);
  await more.scrollIntoViewIfNeeded();
  await expect(more).toHaveText(`Show 20 more(${total - 20} remaining)`);
  for (let count = 20; count < total; count += 20) {
    const response = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/v1/brand-templates");
    await more.scrollIntoViewIfNeeded();
    // After the first click, keeping the button in view must not request page three.
    if (count === 40) {
      await page.evaluate(() => new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }));
      await expect(more).toBeEnabled();
      expect(requestedPages).toEqual(["2"]);
    }
    await expect(cards).toHaveCount(count);
    await more.click();
    const received = await response;
    expect(new URL(received.url()).searchParams.get("page")).toBe(String(count / 20 + 1));
    expect((await received.json()).items).toHaveLength(Math.min(20, total - count));
    await expect(cards).toHaveCount(Math.min(count + 20, total));
  }
  expect(await cards.first().getAttribute("href")).toBe(first);
  expect(await cards.evaluateAll((links) => new Set(links.map((l) => l.getAttribute("href"))).size)).toBe(total);
  await expect(more).toHaveCount(0);
  const search = catalog.getByRole("searchbox");
  await search.fill("FedEx");
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toHaveAccessibleName("View FedEx template");
  await catalog.getByRole("button", { name: "Clear search" }).click();
  await expect(cards).toHaveCount(20);
});

test("search and pagination show placeholders only while their request is pending", async ({ page }) => {
  await page.goto("/brands");
  const catalog = page.locator("#templates");
  const grid = catalog.getByRole("list").first();
  const cards = catalog.getByRole("link");
  const placeholders = grid.locator(':scope > li[aria-hidden="true"]');
  for (const loadMore of [true, false]) {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    await page.route("**/api/v1/brand-templates?*", async (route) => {
      await gate;
      await route.continue();
    }, { times: 1 });
    try {
      if (loadMore) await catalog.getByRole("button", { name: /^Show 20 more/ }).click();
      else await catalog.getByRole("searchbox").fill("FedEx");
      await expect(grid).toHaveAttribute("aria-busy", "true");
      await expect(placeholders).toHaveCount(20);
      await expect(cards).toHaveCount(loadMore ? 20 : 0);
    } finally {
      release();
    }
    await expect(cards).toHaveCount(loadMore ? 40 : 1);
    await expect(placeholders).toHaveCount(0);
    await expect(grid).toHaveAttribute("aria-busy", "false");
  }
});

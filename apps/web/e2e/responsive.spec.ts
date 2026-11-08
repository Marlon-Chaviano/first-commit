import { expect, test } from "@playwright/test";

/** Runs on a phone viewport (the "mobile" project): no page may scroll sideways. */
for (const path of ["/", "/kits/landing-next", "/docs", "/changelog", "/this-page-does-not-exist"]) {
  test(`${path} fits a phone screen`, async ({ page }) => {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

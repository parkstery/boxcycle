import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const WONJU_REGION = {
  name: "단구동",
  lngLat: [127.9386, 37.3215],
  zoom: 13,
  source: "search",
  at: "2026-10-07T00:00:00.000Z",
};

test("before-first-visit-card-800x360", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 800, height: 360 });
  await page.addInitScript((region) => {
    localStorage.setItem("rtw.localFirst.region", JSON.stringify(region));
  }, WONJU_REGION);
  await page.goto("/");
  const intro = page.getByRole("region", { name: "앱 소개" });
  if (await intro.isVisible().catch(() => false)) {
    await page.getByRole("button", { name: "게스트로 시작" }).click();
  }
  const location = page.getByRole("dialog", { name: "어디에서 시작할까요?" });
  if (await location.isVisible().catch(() => false)) {
    const rome = location.getByRole("button", { name: "기본 위치" });
    if (await rome.isVisible().catch(() => false)) {
      await rome.click();
      await expect(location).toBeHidden({ timeout: 15_000 });
    }
  }
  await page.getByRole("button", { name: "사용자 정보" }).waitFor({ state: "visible", timeout: 60_000 });
  const card = page.locator(".local-first__card");
  await expect(card).toBeVisible({ timeout: 60_000 });
  await page.screenshot({
    path: path.join(__dirname, "before-first-visit-card-800x360.png"),
    fullPage: false,
  });
});

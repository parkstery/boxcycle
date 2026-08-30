import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LIVE = process.env.ROUTE_TOKEN_UI_LIVE === "1";
const OUT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../scripts/route-token/.out",
);
fs.mkdirSync(OUT_DIR, { recursive: true });

const directionsV5Hits: string[] = [];

async function enterAsGuest(page: import("@playwright/test").Page) {
  await page.goto("/");
  const gate = page.getByRole("dialog", { name: "시작" });
  await expect(gate).toBeVisible();
  await gate.getByRole("button", { name: "시작", exact: true }).click();
  await expect(gate).toBeHidden();
}

async function waitForRouteTokenOnboarding(page: import("@playwright/test").Page) {
  await page.waitForResponse(
    (r) => r.url().includes("ensureRouteTokenOnboardingHttp") && r.ok(),
    { timeout: 60_000 },
  );
  // Firestore balance 구독 반영 여유 — popup profile UI 는 end 설정 시점 스냅샷만 갱신한다.
  await page.waitForTimeout(1000);
}

async function dismissMapPopup(page: import("@playwright/test").Page) {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
}

async function clickMap(page: import("@playwright/test").Page, offsetX: number, offsetY: number) {
  const canvas = page.locator("canvas.mapboxgl-canvas").first();
  await expect(canvas).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(1500);
  const box = await canvas.boundingBox();
  if (!box) throw new Error("map canvas bounding box missing");
  await page.mouse.click(box.x + offsetX, box.y + offsetY);
  await page.waitForTimeout(400);
}

async function planOneRoute(page: import("@playwright/test").Page, offset: number) {
  await dismissMapPopup(page);
  const panelClear = page.getByRole("button", { name: "경로 전체 삭제" }).first();
  if (await panelClear.isVisible().catch(() => false)) {
    await panelClear.click();
    await page.waitForTimeout(300);
  }

  await clickMap(page, 180 + offset, 180);
  await page.getByRole("button", { name: "Set start" }).click({ timeout: 30_000 });
  await clickMap(page, 260 + offset, 240);
  await page.getByRole("button", { name: "Set end" }).click();
  const cycling = page.getByRole("button", { name: "자전거 경로" });
  await expect(cycling).toBeEnabled({ timeout: 30_000 });
  await cycling.click();
  await expect(page.getByText(/km/).first()).toBeVisible({ timeout: 45_000 });
  await dismissMapPopup(page);
  const clear = page.getByRole("button", { name: "경로 전체 삭제" }).first();
  if (await clear.isVisible().catch(() => false)) {
    await clear.click();
    await page.waitForTimeout(300);
  }
}

test.describe("Route Token UI smoke", () => {
  test.skip(!LIVE, "ROUTE_TOKEN_UI_LIVE=1 + Emulator 필요");

  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    directionsV5Hits.length = 0;
    page.on("request", (req) => {
      if (req.url().includes("/directions/v5/")) directionsV5Hits.push(req.url());
    });
  });

  test("Guest 3회 경로 성공 → 4번째 Token 부족, Directions 직접 호출 0", async ({ page }) => {
    await enterAsGuest(page);
    await waitForRouteTokenOnboarding(page);

    for (let i = 0; i < 3; i += 1) {
      await planOneRoute(page, i * 12);
    }

    await page.screenshot({
      path: path.join(OUT_DIR, "ui-smoke-after-3-routes.png"),
      fullPage: true,
    });

    await dismissMapPopup(page);
    await clickMap(page, 300, 200);
    await page.getByRole("button", { name: "Set start" }).click({ timeout: 30_000 });
    await clickMap(page, 360, 260);
    await page.getByRole("button", { name: "Set end" }).click();

    await expect(page.getByText("경로 토큰 부족")).toBeVisible({ timeout: 10_000 });
    await page.screenshot({
      path: path.join(OUT_DIR, "ui-smoke-token-exhausted.png"),
      fullPage: true,
    });

    expect(directionsV5Hits, `Mapbox Directions 직접 호출: ${directionsV5Hits.join(", ")}`).toEqual(
      [],
    );
  });
});

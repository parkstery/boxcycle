/**
 * 3B UI 증거 — 자동 찾기 펼침·거리 원·컴팩트 popup 캡처.
 * 실행: apps/web 에서 `node scripts/distance-auto-route/capture-ui-circle-screenshots.mjs`
 * 전제: `npm run dev` 가 5173 에 떠 있음.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, ".out", "screenshots");
const BASE_URL = process.env.DISTANCE_AUTO_ROUTE_UI_BASE_URL ?? "http://127.0.0.1:5173";

const VIEWPORTS = [
  { label: "1920x1080", width: 1920, height: 1080 },
  { label: "1366x768", width: 1366, height: 768 },
];

async function enterAsGuest(page) {
  await page.goto(BASE_URL);
  const gate = page.getByRole("dialog", { name: "시작" });
  await gate.waitFor({ state: "visible", timeout: 60_000 });
  const onboardingPromise = page
    .waitForResponse((r) => r.url().includes("ensureRouteTokenOnboardingHttp") && r.ok(), {
      timeout: 60_000,
    })
    .catch(() => null);
  await gate.getByRole("button", { name: "시작", exact: true }).click();
  await gate.waitFor({ state: "hidden", timeout: 30_000 });
  await onboardingPromise;
  await page.waitForTimeout(1500);
}

async function clickMap(page, offsetX, offsetY) {
  const canvas = page.locator("canvas.mapboxgl-canvas").first();
  await canvas.waitFor({ state: "visible", timeout: 60_000 });
  await page.waitForTimeout(800);
  const box = await canvas.boundingBox();
  if (!box) throw new Error("map canvas bounding box missing");
  await page.mouse.click(box.x + offsetX, box.y + offsetY);
  await page.waitForTimeout(500);
}

async function openAutoRouteExpanded(page) {
  await clickMap(page, 420, 320);
  const popup = page.locator(".map-view__pick-popup").last();
  await popup.waitFor({ state: "visible", timeout: 30_000 });
  await popup.getByRole("button", { name: "Set start" }).evaluate((node) => {
    node.click();
  });
  await page.waitForTimeout(600);
  await popup.getByTestId("route-token-holding").waitFor({ state: "visible", timeout: 30_000 });
  const autoBtn = popup.getByRole("button", { name: "목표 거리로 End 자동 찾기" });
  await autoBtn.waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForFunction(
    (btn) => !(btn instanceof HTMLButtonElement) || !btn.disabled,
    await autoBtn.elementHandle(),
    { timeout: 30_000 },
  );
  await autoBtn.click();
  await popup.locator(".map-view__pick-auto-route-form").waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForTimeout(1500);
  return popup;
}

async function captureViewport(viewport) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
  });
  const page = await context.newPage();
  try {
    await enterAsGuest(page);
    const popup = await openAutoRouteExpanded(page);

    const profileButtons = popup.locator(".map-view__pick-btn--profile");
    const profileCount = await profileButtons.count();
    if (profileCount !== 3) {
      throw new Error(`이동수단 버튼 ${profileCount}개 — 3개여야 합니다`);
    }
    if ((await popup.locator(".map-view__pick-auto-route-options").count()) < 1) {
      throw new Error("거리 preset 행이 없습니다");
    }

    const shot10Path = path.join(OUT_DIR, `3b-r2-red-circle-10km-${viewport.label}.png`);
    await page.screenshot({ path: shot10Path, fullPage: false });
    console.log(`[screenshot] ${shot10Path}`);

    await popup.getByRole("button", { name: "3 km", exact: true }).click();
    await page.waitForTimeout(1200);
    const shot3Path = path.join(OUT_DIR, `3b-r2-red-circle-3km-${viewport.label}.png`);
    await page.screenshot({ path: shot3Path, fullPage: false });
    console.log(`[screenshot] ${shot3Path}`);
  } finally {
    await context.close();
    await browser.close();
  }
}

for (const viewport of VIEWPORTS) {
  await captureViewport(viewport);
}

console.log("[screenshot] done");

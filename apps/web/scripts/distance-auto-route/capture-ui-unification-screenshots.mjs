/**
 * 3D-1 UI 증거 — 단일 설정 popup·거리 slider·방향 클릭·탐색·성공 캡처.
 * 실행: apps/web 에서 `node scripts/distance-auto-route/capture-ui-unification-screenshots.mjs`
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
  { label: "1920x1080", width: 1920, height: 1080, mapClick: { start: [420, 320], direction: [1200, 420] } },
  { label: "1366x768", width: 1366, height: 768, mapClick: { start: [360, 260], direction: [980, 340] } },
  { label: "914x412", width: 914, height: 412, mapClick: { start: [240, 180], direction: [720, 220] } },
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
  await page.waitForTimeout(600);
}

async function openStartPopup(page, mapClick) {
  await clickMap(page, mapClick.start[0], mapClick.start[1]);
  const popup = page.locator(".map-view__pick-popup").last();
  await popup.waitFor({ state: "visible", timeout: 30_000 });
  await popup.getByRole("button", { name: "Set start" }).evaluate((node) => {
    node.click();
  });
  await page.waitForTimeout(600);
  await popup.getByTestId("route-token-holding").waitFor({ state: "visible", timeout: 30_000 });
  await popup.locator(".map-view__pick-distance-row").waitFor({ state: "visible", timeout: 10_000 });
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
    const popup = await openStartPopup(page, viewport.mapClick);

    const shot1Path = path.join(OUT_DIR, `3d1-start-popup-${viewport.label}.png`);
    await page.screenshot({ path: shot1Path, fullPage: false });
    console.log(`[screenshot] ${shot1Path}`);

    const numberInput = popup.locator(".map-view__pick-distance-number");
    await numberInput.click();
    await numberInput.fill("55");
    await numberInput.dispatchEvent("change");
    await page.waitForTimeout(1500);
    await popup
      .getByText("지도에서 원하는 방향을 클릭하세요")
      .waitFor({ state: "visible", timeout: 10_000 });

    const shot2Path = path.join(OUT_DIR, `3d1-direction-55km-${viewport.label}.png`);
    await page.screenshot({ path: shot2Path, fullPage: false });
    console.log(`[screenshot] ${shot2Path}`);

    const autoRoutePromise = page
      .waitForResponse(
        (r) =>
          r.request().method() === "POST" &&
          r.url().includes("getDistanceAutoRoute") &&
          r.status() === 200,
        { timeout: 120_000 },
      )
      .catch(() => null);

    await clickMap(page, viewport.mapClick.direction[0], viewport.mapClick.direction[1]);

    await popup
      .locator(
        ".map-view__pick-auto-route-status--searching, .map-view__pick-auto-route-status--found, .map-view__pick-auto-route-status--failed",
      )
      .first()
      .waitFor({ state: "visible", timeout: 30_000 });

    const shot3Path = path.join(OUT_DIR, `3d1-searching-${viewport.label}.png`);
    await page.screenshot({ path: shot3Path, fullPage: false });
    console.log(`[screenshot] ${shot3Path}`);

    await autoRoutePromise;
    await popup
      .locator(".map-view__pick-auto-route-status--found, .map-view__pick-auto-route-status--failed")
      .first()
      .waitFor({ state: "visible", timeout: 120_000 });
    await page.waitForTimeout(800);

    const shot4Path = path.join(OUT_DIR, `3d1-route-found-${viewport.label}.png`);
    await page.screenshot({ path: shot4Path, fullPage: false });
    console.log(`[screenshot] ${shot4Path}`);

    await popup.waitFor({ state: "visible", timeout: 10_000 });
    const holdingText = await popup.getByTestId("route-token-holding").textContent();
    if (holdingText && !holdingText.includes("잔여 토큰")) {
      throw new Error(`unexpected token holding text: ${holdingText}`);
    }
  } finally {
    await context.close();
    await browser.close();
  }
}

for (const viewport of VIEWPORTS) {
  await captureViewport(viewport);
}

console.log("[screenshot] done");

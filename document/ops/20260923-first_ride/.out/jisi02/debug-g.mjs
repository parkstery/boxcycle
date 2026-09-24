import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = __dirname;
const BASE = "http://127.0.0.1:5000";
const SEOUL = { name: "마포구", lng: 126.9016, lat: 37.5563 };

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name) });
  console.log("shot", name);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 740, height: 300 }, locale: "ko-KR" });
  const page = await context.newPage();
  page.on("console", (msg) => console.log("[console]", msg.type(), msg.text()));

  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
  const gate = page.getByRole("dialog", { name: "시작" });
  await gate.waitFor({ state: "visible", timeout: 60000 });
  await gate.getByRole("button", { name: "시작", exact: true }).click();
  await gate.waitFor({ state: "hidden", timeout: 60000 });
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(1000);

  await page.evaluate(({ lng, lat }) => {
    const m = window.__RTW_MAP__;
    if (m) m.jumpTo({ center: [lng, lat], zoom: 15 });
  }, { lng: SEOUL.lng, lat: SEOUL.lat });
  await page.waitForTimeout(1000);

  await shot(page, "dbg-0-before-click.png");

  const map = page.locator("canvas.mapboxgl-canvas");
  await map.waitFor({ state: "visible", timeout: 20000 });
  const box = await map.boundingBox();
  console.log("box", box);

  const pt = await page.evaluate(({ lng, lat }) => {
    const m = window.__RTW_MAP__;
    const p = m.project([lng, lat]);
    return { x: p.x, y: p.y };
  }, { lng: SEOUL.lng, lat: SEOUL.lat });
  console.log("pt", pt);

  await page.mouse.click(box.x + pt.x, box.y + pt.y);
  await page.waitForTimeout(1000);
  await shot(page, "dbg-1-after-click.png");

  const startBtn = page.locator(".map-view__pick-btn--start");
  await startBtn.click();
  await page.waitForTimeout(500);
  await shot(page, "dbg-2-after-start.png");

  const checkbox = page.locator(".map-view__pick-distance-mode-checkbox");
  const checkboxVisible = await checkbox.isVisible({ timeout: 4000 }).catch(() => false);
  console.log("checkboxVisible", checkboxVisible);
  if (checkboxVisible) {
    await checkbox.check({ force: true });
    await page.waitForTimeout(300);
    // 1km 칩 — 원이 화면 안에 들어오게(5km 는 zoom15 프레임 밖으로 나가 안 보였다)
    const chip1 = page.locator(".map-view__pick-distance-chip", { hasText: "1" }).first();
    if (await chip1.isVisible({ timeout: 1500 }).catch(() => false)) {
      await chip1.click();
      await page.waitForTimeout(400);
    }
    await shot(page, "dbg-3-checkbox-on.png");

    // 팝업이 우하단을 덮으므로 좌상단 픽셀을 직접 클릭한다(경위도 오프셋 대신 확실히 빈 지도 영역).
    await page.mouse.click(box.x + 90, box.y + 40);
    await page.waitForTimeout(1000);
    await shot(page, "dbg-3b-after-second-click.png");
    await page.waitForTimeout(7000);
    await shot(page, "dbg-4-after-direction-click.png");

    const outDir1 = path.resolve(__dirname);
    const outDir2 = path.resolve(__dirname, "../../../../../apps/web/.out/first-ride-jisi02");
    fs.mkdirSync(outDir2, { recursive: true });
    fs.copyFileSync(path.join(outDir1, "dbg-4-after-direction-click.png"), path.join(outDir1, "08-legacy-direction-route.png"));
    fs.copyFileSync(path.join(outDir1, "dbg-4-after-direction-click.png"), path.join(outDir2, "08-legacy-direction-route.png"));
    console.log("SAVED 08-legacy-direction-route.png");
  }

  await context.close();
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

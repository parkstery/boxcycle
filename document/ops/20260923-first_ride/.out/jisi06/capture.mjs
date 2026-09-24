/**
 * 지시06 캡처 — A1 S0 주동작 / A2 권한계수 / A-3 거부·타임아웃 / B1~B3 속도.
 * 인터셉트 없이 실 UI. B는 입문 경로로 짧게 Go 후 센서 시트.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../../../..");
const OUT = path.join(ROOT, "document/ops/20260923-first_ride/.out/jisi06");
const BASE = process.env.RTW_BASE_URL || "http://127.0.0.1:5000";
fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name) {
  const buf = await page.screenshot({ type: "png" });
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log("shot", name, buf.length);
}

async function enterGuest(page) {
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.evaluate(() => {
    try {
      localStorage.removeItem("rtw.localFirst.region");
    } catch {}
  });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
  const gate = page.getByRole("dialog", { name: "시작" });
  await gate.waitFor({ state: "visible", timeout: 90000 });
  await gate.getByRole("button", { name: "시작", exact: true }).click();
  await gate.waitFor({ state: "hidden", timeout: 90000 });
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(600);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 740, height: 300 },
    locale: "ko-KR",
  });
  const page = await context.newPage();

  // —— A1 S0: 현재 위치 주황·먼저 ——
  await enterGuest(page);
  await page.locator(".local-first__card").waitFor({ state: "visible", timeout: 45000 });
  await page.waitForTimeout(800);
  await shot(page, "01-s0-default-current.png");
  const s0 = await page.evaluate(() => {
    const card = document.querySelector(".local-first__card");
    const btns = [...card.querySelectorAll(".local-first__actions button")].map((b) => ({
      text: b.textContent.trim(),
      primary: b.classList.contains("local-first__btn--primary"),
    }));
    const zoom = window.__RTW_MAP__?.getZoom?.() ?? null;
    const probe = window.__rtwGeoCallCount;
    return { btns, zoom, probe };
  });
  console.log("A1", JSON.stringify(s0));

  // —— A2 권한 계수: 로드 후 0 ——
  const count0 = await page.evaluate(() => window.__rtwGeoCallCount ?? null);
  await page.getByRole("button", { name: "현재 위치" }).click();
  await page.waitForTimeout(1500);
  const count1 = await page.evaluate(() => window.__rtwGeoCallCount ?? null);
  const permReport = { loadCount: count0, afterClickCount: count1 };
  fs.writeFileSync(path.join(OUT, "02-permission-count.json"), JSON.stringify(permReport, null, 2));
  console.log("A2", JSON.stringify(permReport));
  await shot(page, "02-permission-count.png");

  // —— A-3 권한 거부 → S2 ——
  await page.evaluate(() => {
    try {
      localStorage.removeItem("rtw.localFirst.region");
    } catch {}
  });
  // mock getCurrentPosition to deny
  await page.addInitScript(() => {
    const geo = navigator.geolocation;
    const fake = {
      getCurrentPosition(success, error) {
        window.__RTW_LOCAL_FIRST_GEO_COUNT__ = (window.__RTW_LOCAL_FIRST_GEO_COUNT__ || 0) + 1;
        setTimeout(() => {
          error?.({ code: 1, PERMISSION_DENIED: 1, TIMEOUT: 3, POSITION_UNAVAILABLE: 2, message: "denied" });
        }, 50);
      },
      watchPosition() {
        return 0;
      },
      clearWatch() {},
    };
    Object.defineProperty(navigator, "geolocation", { configurable: true, get: () => fake });
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  const gate2 = page.getByRole("dialog", { name: "시작" });
  if (await gate2.isVisible({ timeout: 5000 }).catch(() => false)) {
    await gate2.getByRole("button", { name: "시작", exact: true }).click();
    await gate2.waitFor({ state: "hidden", timeout: 60000 });
  }
  await page.keyboard.press("Escape").catch(() => {});
  await page.locator(".local-first__card").waitFor({ state: "visible", timeout: 30000 });
  await page.getByRole("button", { name: "현재 위치" }).click();
  await page.waitForTimeout(800);
  await shot(page, "06-permission-denied-s2.png");
  const s2text = await page.locator(".local-first__card").innerText();
  console.log("A3-deny", JSON.stringify(s2text.slice(0, 120)));

  // —— A-3 타임아웃 → 대기 유지(실패 단정 없음) ——
  await page.addInitScript(() => {
    const fake = {
      getCurrentPosition(success, error) {
        window.__RTW_LOCAL_FIRST_GEO_COUNT__ = (window.__RTW_LOCAL_FIRST_GEO_COUNT__ || 0) + 1;
        setTimeout(() => {
          error?.({ code: 3, PERMISSION_DENIED: 1, TIMEOUT: 3, POSITION_UNAVAILABLE: 2, message: "timeout" });
        }, 80);
      },
      watchPosition() {
        return 0;
      },
      clearWatch() {},
    };
    Object.defineProperty(navigator, "geolocation", { configurable: true, get: () => fake });
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  const gate3 = page.getByRole("dialog", { name: "시작" });
  if (await gate3.isVisible({ timeout: 5000 }).catch(() => false)) {
    await gate3.getByRole("button", { name: "시작", exact: true }).click();
    await gate3.waitFor({ state: "hidden", timeout: 60000 });
  }
  await page.keyboard.press("Escape").catch(() => {});
  await page.locator(".local-first__card").waitFor({ state: "visible", timeout: 30000 });
  await page.getByRole("button", { name: "현재 위치" }).click();
  await page.waitForTimeout(600);
  await shot(page, "07-timeout-still-locating.png");
  const locText = await page.locator(".local-first__card").innerText();
  console.log("A3-timeout", JSON.stringify(locText.slice(0, 160)));

  // —— B: 입문 경로 → Go → 센서 시트 속도 ——
  // 새 컨텍스트(geo mock 제거)
  await browser.close();
  const browser2 = await chromium.launch({ headless: true });
  const ctx2 = await browser2.newContext({ viewport: { width: 740, height: 400 }, locale: "ko-KR" });
  const p2 = await ctx2.newPage();
  await p2.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 90000 });
  await p2.evaluate(() => {
    try {
      localStorage.removeItem("rtw.localFirst.region");
    } catch {}
  });
  await p2.reload({ waitUntil: "domcontentloaded" });
  const g = p2.getByRole("dialog", { name: "시작" });
  await g.waitFor({ state: "visible", timeout: 90000 });
  await g.getByRole("button", { name: "시작", exact: true }).click();
  await g.waitFor({ state: "hidden", timeout: 90000 });
  await p2.keyboard.press("Escape").catch(() => {});
  await p2.locator(".local-first__card").waitFor({ state: "visible", timeout: 45000 });
  await p2.getByRole("button", { name: "또는 입문 경로로 시작" }).click();
  await p2.waitForTimeout(2500);
  // 센서 칩 → 센서 없음 → 시트 닫기 → Go
  const sensorChip = p2.getByRole("button", { name: /SENSOR|센서/i }).first();
  await sensorChip.click({ timeout: 10000 });
  await p2.waitForTimeout(500);
  const noSensor = p2.getByRole("button", { name: "센서 없음" });
  await noSensor.click({ timeout: 10000 });
  await p2.waitForTimeout(400);
  await p2.getByRole("button", { name: "센서 설정 닫기" }).click().catch(async () => {
    await p2.locator(".cadence-sheet__scrim").click({ force: true });
  });
  await p2.waitForTimeout(500);
  await p2.getByRole("button", { name: "주행 시작" }).click({ timeout: 15000 });
  await p2.waitForTimeout(2500);
  // 주행 중 센서 시트
  await sensorChip.click({ timeout: 10000 });
  await p2.waitForTimeout(800);
  await shot(p2, "03-riding-speed-control.png");
  const hasSpeed = await p2.locator(".cadence-sheet__speed").isVisible().catch(() => false);
  console.log("B1 hasSpeed", hasSpeed);

  const plus = p2.locator(".ride-speed-step").filter({ hasText: "+" });
  if (await plus.isVisible().catch(() => false)) {
    for (let i = 0; i < 10; i++) await plus.click();
  }
  await p2.waitForTimeout(2000);
  await shot(p2, "04-speed-changed.png");
  const metrics = await p2.evaluate(() => {
    const text = document.body.innerText;
    return {
      kmh: text.match(/(\d+(?:\.\d+)?)\s*km\/h/gi)?.slice(0, 6) ?? null,
      dist: text.match(/거리[^\d]*(\d+(?:\.\d+)?)/)?.[1] ?? null,
    };
  });
  console.log("B2", metrics);

  await p2.evaluate(() => {
    window.__rtwSetRideInputMode?.("cadence");
  });
  await p2.waitForTimeout(400);
  await shot(p2, "05-sensor-connected-hidden.png");
  const speedVisibleWhenCadence = await p2.locator(".cadence-sheet__speed").isVisible().catch(() => false);
  console.log("B3 speedVisible", speedVisibleWhenCadence);

  fs.writeFileSync(
    path.join(OUT, "capture-meta.json"),
    JSON.stringify({ s0, permReport, hasSpeed, metrics, speedVisibleWhenCadence, at: new Date().toISOString() }, null, 2),
  );
  await browser2.close();
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});

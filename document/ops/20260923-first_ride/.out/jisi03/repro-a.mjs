/**
 * 지시03 A — 「현재 위치」 허용 후 카메라 미이동 재현.
 * 실기 없이 재현: geolocation 허용 + 좌표 세팅 + getCurrentPosition/역지오코딩 지연을 흉내 낸다.
 * 산출: document/ops/20260923-first_ride/.out/jisi03/ (ASCII 미러: apps/web/.out/first-ride-jisi03/)
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../../../..");
const OUT_ASCII = path.join(ROOT, "apps/web/.out/first-ride-jisi03");
const OUT_OPS = path.join(ROOT, "document/ops/20260923-first_ride/.out/jisi03");
const BASE = process.env.RTW_BASE_URL || "http://127.0.0.1:5000";
const REGION_KEY = "rtw.localFirst.region";
const MAPO = { lng: 126.9016, lat: 37.5563 };

fs.mkdirSync(OUT_ASCII, { recursive: true });
fs.mkdirSync(OUT_OPS, { recursive: true });

function saveBoth(name, buf) {
  fs.writeFileSync(path.join(OUT_ASCII, name), buf);
  fs.writeFileSync(path.join(OUT_OPS, name), buf);
}

async function shot(page, name) {
  const buf = await page.screenshot({ type: "png" });
  saveBoth(name, buf);
  console.log("shot", name);
}

async function enterGuest(page) {
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.evaluate((key) => {
    try {
      localStorage.removeItem(key);
    } catch {}
  }, REGION_KEY);
  const gate = page.getByRole("dialog", { name: "시작" });
  await gate.waitFor({ state: "visible", timeout: 60000 });
  await gate.getByRole("button", { name: "시작", exact: true }).click();
  await gate.waitFor({ state: "hidden", timeout: 60000 });
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(400);
  await page.keyboard.press("Escape").catch(() => {});
}

async function waitCard(page) {
  await page.locator(".local-first__card").waitFor({ state: "visible", timeout: 45000 });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    permissions: ["geolocation"],
    geolocation: { latitude: MAPO.lat, longitude: MAPO.lng },
    viewport: { width: 740, height: 340 },
    reducedMotion: process.env.RTW_REDUCED_MOTION === "1" ? "reduce" : "no-preference",
  });
  const page = await context.newPage();
  // 권한 프롬프트 체감 지연(수 초)을 흉내: getCurrentPosition 자체를 2.5s 지연시킨다.
  // 실제 모바일 네이티브 권한 다이얼로그는 페이지를 hidden 상태로 만들 수 있다 — 함께 흉내낸다.
  await page.addInitScript(() => {
    const orig = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
    navigator.geolocation.getCurrentPosition = (success, error, options) => {
      Object.defineProperty(document, "visibilityState", { get: () => "hidden", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
      setTimeout(() => {
        Object.defineProperty(document, "visibilityState", { get: () => "visible", configurable: true });
        document.dispatchEvent(new Event("visibilitychange"));
        orig(success, error, options);
      }, 2500);
    };
  });
  page.on("console", (msg) => {
    const t = msg.text();
    if (t.startsWith("[C")) console.log("PAGE:", t);
  });

  // 역지오코딩 응답을 1.5초 지연시켜 비동기 간격을 벌린다 (C1~C5 계측 목적)
  await page.route("**/geocoding/v5/mapbox.places/**", async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        features: [{ text: "마포구", place_name: "마포구, 서울특별시, 대한민국" }],
      }),
    });
  });

  await enterGuest(page);
  await waitCard(page);
  await shot(page, "00-before-click.png");

  const t0 = Date.now();
  await page.getByRole("button", { name: "현재 위치" }).click();
  console.log("clicked current-location at", t0);

  // 허용 직후(수정 전이면 여기서 지도가 그대로일 것) — 재현 증거 캡처
  await page.waitForTimeout(1200);
  await shot(page, "01-repro-before.png");

  // getCurrentPosition(2.5s) + 역지오코딩(1.5s) 완료를 기다린 뒤 카드 S1 반영 확인
  await page.waitForTimeout(3500);
  const t1 = Date.now();
  console.log("post-confirm elapsed ms", t1 - t0);
  await shot(page, "02-fixed-after-grant.png");

  const cardText = await page.locator(".local-first__card").innerText().catch(() => "");
  console.log("CARD_TEXT:", JSON.stringify(cardText));

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

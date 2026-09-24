/**
 * 지시03 B 캡처 — 폐합 실패 → 편도 대안(F) · 「다른 경로」 두 번(G) · 진짜 실패(H).
 * 서버(closeLoop 편도 폴백)는 이 라운드에서 배포하지 않는다(커밋·배포 금지) — 그래서 지시02와
 * 같은 방식으로 `npm run dev`(운영 백엔드) 위에서 `getDistanceAutoRoute` 네트워크 응답만
 * Playwright route 로 가로챈다. 카드·지도·Go 게이트는 전부 실제 제품 코드가 렌더링한다.
 *
 * ⚠【지시04 정정, 2026-09-24 부기】 `onewayBody()`/`loopBody()` 가 만드는 geometry 는
 * **이 파일이 직접 손으로 지어낸 synthetic 직선/삼각형 좌표**다(진짜 Mapbox 응답이 아니다).
 * `onewayBody(3, 72)` 처럼 시작점([126.9016,37.5563], 마포구 월드컵로)에서 bearing 만큼 오프셋한
 * 2~3점 직선을 만든다 — Chief 가 실기에서 봤다고 전해진 "한강을 직선으로 가로지르는 경로"가
 * 바로 이 함수의 산출물이었던 것으로 확인됐다(제품 결함 아님, 지시04수행결과 참고).
 * **이 스크립트의 스크린샷(06~08)을 "실제 도로 기하" 증거로 다시 쓰지 마라.** 경로 기하가
 * 보이는 캡처는 반드시 실 운영 백엔드(Mapbox 실호출)로 다시 찍는다.
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
const SEOUL = { name: "마포구", lng: 126.9016, lat: 37.5563 };

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
  await page.evaluate(() => {
    try {
      localStorage.removeItem("rtw.localFirst.region");
    } catch {}
  });
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
async function pickRegion(page) {
  await page.getByRole("button", { name: "지역 선택" }).click();
  await page.waitForTimeout(500);
  const input = page.locator("#menu-place-search-input");
  await input.fill("마포구");
  await page.waitForTimeout(900);
  const first = page.locator(".menu-place-search__item").first();
  await first.waitFor({ state: "visible", timeout: 20000 });
  await first.click();
  await page.locator(".local-first__card").waitFor({ state: "visible", timeout: 20000 });
  await page.waitForTimeout(1200);
}
function legRadiusMeters(targetMeters) {
  const halfAngleRad = (140 / 2) * (Math.PI / 180);
  return targetMeters / (2 * (1 + Math.sin(halfAngleRad)));
}
function offsetLngLat([lng, lat], bearingDeg, meters) {
  const rad = (bearingDeg * Math.PI) / 180;
  const dLat = (meters * Math.cos(rad)) / 111320;
  const dLng = (meters * Math.sin(rad)) / (111320 * Math.cos((lat * Math.PI) / 180));
  return [lng + dLng, lat + dLat];
}
/** 편도(오프셋 D 방향으로 곧게) geometry — closed:false 응답용. */
function onewayBody(targetKm, bearingDeg) {
  const targetM = targetKm * 1000;
  const start = [SEOUL.lng, SEOUL.lat];
  const end = offsetLngLat(start, bearingDeg, targetM);
  const mid = offsetLngLat(start, bearingDeg, targetM / 2);
  return {
    status: "found",
    geometry: { type: "LineString", coordinates: [start, mid, end] },
    distance: targetM * 1.05,
    duration: (targetM * 1.05) / 5,
    end,
    targetDistanceMeters: targetM,
    summary: `순환 경로를 찾지 못해 편도 경로를 만들었어요 — 목표 ${targetKm.toFixed(1)} km · 연장 ${(targetM * 1.05 / 1000).toFixed(2)} km / 예상 10:00`,
    routeTokenBalance: 7,
    algorithmVersion: "4A-ready-loop",
    closeLoop: true,
    closed: false,
    startBearingSampleDeg: bearingDeg,
  };
}
function loopBody(targetKm, bearingDeg) {
  const targetM = targetKm * 1000;
  const r = legRadiusMeters(targetM);
  const start = [SEOUL.lng, SEOUL.lat];
  const w1 = offsetLngLat(start, bearingDeg, r);
  const w2 = offsetLngLat(start, (bearingDeg + 140) % 360, r);
  const coords = [start, w1, w2, start];
  return {
    status: "found",
    geometry: { type: "LineString", coordinates: coords },
    distance: targetM * 1.02,
    duration: (targetM * 1.02) / 5,
    end: start,
    targetDistanceMeters: targetM,
    summary: `목표 ${targetKm.toFixed(1)} km 순환 · 연장 ${(targetM * 1.02 / 1000).toFixed(2)} km / 예상 10:00`,
    routeTokenBalance: 7,
    algorithmVersion: "4A-ready-loop",
    closeLoop: true,
    closed: true,
    selfOverlapRatio: 0.04,
    startBearingSampleDeg: bearingDeg,
    startSnapMeters: 12,
  };
}
const FAIL_BODY = {
  status: "failed",
  message: "이 지역에서는 순환 경로를 찾지 못했습니다.",
  routeTokenBalance: 7,
};

async function freshS1(page) {
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    try {
      localStorage.removeItem("rtw.localFirst.region");
    } catch {}
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  const g = page.getByRole("dialog", { name: "시작" });
  if (await g.isVisible({ timeout: 3000 }).catch(() => false)) {
    await g.getByRole("button", { name: "시작", exact: true }).click();
    await g.waitFor({ state: "hidden", timeout: 30000 });
  }
  await page.keyboard.press("Escape").catch(() => {});
  await waitCard(page);
  await pickRegion(page);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 740, height: 300 }, locale: "ko-KR" });
  const page = await context.newPage();

  let mode = { type: "oneway", km: 3, bearing: 72 };
  let requestLog = [];
  await page.route("**/getDistanceAutoRoute", async (route, request) => {
    let body = null;
    try {
      body = JSON.parse(request.postData() ?? "{}");
    } catch {}
    requestLog.push(body?.data ?? null);
    let result;
    if (mode.type === "oneway") result = onewayBody(mode.km, mode.bearing);
    else if (mode.type === "loop") result = loopBody(mode.km, mode.bearing);
    else result = FAIL_BODY;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ result }) });
  });

  // ===== F — 폐합 실패 → 편도 대안 =====
  await enterGuest(page);
  await waitCard(page);
  await pickRegion(page);
  mode = { type: "oneway", km: 3, bearing: 72 };
  await page.getByRole("button", { name: "Ready Ride 시작" }).click();
  await page.waitForTimeout(1200);
  await shot(page, "06-loop-fallback-oneway.png");
  const cardTextF = await page.locator(".local-first__card").innerText().catch(() => "");
  console.log("F CARD_TEXT:", JSON.stringify(cardTextF));

  // ===== G — [다른 경로] 두 번, 서로 다른 경로 =====
  mode = { type: "oneway", km: 3, bearing: 144 };
  await page.getByRole("button", { name: "다른 경로" }).click();
  await page.waitForTimeout(1000);
  await shot(page, "07-other-route-1.png");
  const req1 = requestLog[requestLog.length - 1];

  mode = { type: "oneway", km: 3, bearing: 216 };
  await page.getByRole("button", { name: "다른 경로" }).click();
  await page.waitForTimeout(1000);
  await shot(page, "08-other-route-2.png");
  const req2 = requestLog[requestLog.length - 1];
  console.log("G excludeStartBearingDeg 1st->2nd request:", req1?.excludeStartBearingDeg, "->", req2?.excludeStartBearingDeg);

  // ===== H — 편도조차 불가한 좌표 → 진짜 실패 문구만 =====
  await freshS1(page);
  mode = { type: "fail" };
  await page.getByRole("button", { name: "Ready Ride 시작" }).click();
  await page.waitForTimeout(1200);
  await shot(page, "09-true-failure.png");
  const cardTextH = await page.locator(".local-first__card").innerText().catch(() => "");
  console.log("H CARD_TEXT:", JSON.stringify(cardTextH));

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

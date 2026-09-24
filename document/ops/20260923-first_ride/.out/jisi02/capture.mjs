/**
 * 지시02 Ready Ride 캡처.
 * 산출: document/ops/20260923-first_ride/.out/jisi02/ (한글 경로 미러: apps/web/.out/first-ride-jisi02/)
 *
 * 서버(closeLoop) 코드는 이 라운드에서 배포하지 않는다(커밋·배포 금지) — 그래서
 * `npm run dev`(운영 백엔드)로 뜬 **실제 제품 화면**은 그대로 쓰되, `getDistanceAutoRoute`
 * 네트워크 응답만 Playwright route 로 가로채 결정론적으로 채운다. 화면·CSS·상태기계는 전부 진짜다.
 * 기존 방향-클릭 자동 Route(G)는 가로채지 않고 실제 운영 백엔드로 그대로 호출한다(회귀 증명).
 *
 * ⚠【지시04 정정, 2026-09-24 부기】 이 스크립트가 만드는 route geometry(폐합·편도 좌표)는
 * **전부 이 스크립트가 손으로 지어낸 synthetic 값**이다 — 실 Mapbox Directions 응답이 아니다.
 * Chief 가 실기에서 본 "한강을 직선으로 가로지르는 경로"는 이 스크립트(와 jisi03/capture-b.mjs)의
 * synthetic geometry 캡처를 공유받은 것으로 확인됐다(제품 결함이 아니었다 — 지시04수행결과 참고).
 * **이 스크립트의 스크린샷을 "실제 도로 기하가 맞다"는 증거로 다시 쓰지 마라.** 경로 기하 검증은
 * 반드시 실 운영 백엔드(Mapbox 실호출)로 다시 찍는다.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../../../..");
const OUT_ASCII = path.join(ROOT, "apps/web/.out/first-ride-jisi02");
const OUT_OPS = path.join(ROOT, "document/ops/20260923-first_ride/.out/jisi02");
const BASE = process.env.RTW_BASE_URL || "http://127.0.0.1:5000";
const REGION_KEY = "rtw.localFirst.region";
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

/** readyLoopLegRadiusMeters(D) — 서버와 같은 식(θ=140°, 직선거리 기준 둘레=D). */
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

function buildLoopGeometry(center, targetMeters, startBearingDeg = 20) {
  const r = legRadiusMeters(targetMeters);
  const w1 = offsetLngLat(center, startBearingDeg, r);
  const w2 = offsetLngLat(center, (startBearingDeg + 140) % 360, r);
  return [center, w1, w2, center];
}

function successBody(targetKm, startBearingDeg) {
  const targetM = targetKm * 1000;
  const coords = buildLoopGeometry([SEOUL.lng, SEOUL.lat], targetM, startBearingDeg);
  return {
    status: "found",
    geometry: { type: "LineString", coordinates: coords },
    distance: targetM * 1.02,
    duration: (targetM * 1.02) / 5,
    end: coords[0],
    targetDistanceMeters: targetM,
    summary: `목표 ${targetKm.toFixed(1)} km 순환 · 연장 ${(targetM * 1.02 / 1000).toFixed(2)} km / 예상 10:00`,
    routeTokenBalance: 7,
    algorithmVersion: "4A-ready-loop",
    closeLoop: true,
    selfOverlapRatio: 0.04,
    startBearingSampleDeg: startBearingDeg,
    startSnapMeters: 12,
  };
}

const FAIL_BODY = {
  status: "failed",
  message: "이 지역에서는 순환 경로를 찾지 못했습니다.",
  routeTokenBalance: 7,
};

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 740, height: 300 },
    locale: "ko-KR",
  });
  const page = await context.newPage();

  let mode = { type: "success", km: 3, bearing: 20 };
  let requestLog = [];

  await page.route("**/getDistanceAutoRoute", async (route, request) => {
    let body = null;
    try {
      body = JSON.parse(request.postData() ?? "{}");
    } catch {}
    requestLog.push(body?.data ?? null);
    if (mode.type === "delay") {
      await new Promise((r) => setTimeout(r, mode.delayMs ?? 12000));
    }
    const result = mode.type === "fail" ? FAIL_BODY : successBody(mode.km, mode.bearing);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ result }),
    });
  });

  await enterGuest(page);
  await waitCard(page);
  await pickRegion(page);

  // A — S1 + Ready Ride 시작 버튼 + 거리 선택(3km 기본)
  await shot(page, "01-S1-with-start-button.png");

  // E — 생성 중 표시(느린 응답으로 몇 초간 유지)
  mode = { type: "delay", delayMs: 12000, km: 3, bearing: 20 };
  const genPromise = page.getByRole("button", { name: "Ready Ride 시작" }).click();
  await page.waitForTimeout(1500);
  await shot(page, "06-generating.png");
  await genPromise;
  await page.waitForTimeout(11500);

  // B — 3km 폐합 결과
  await page.waitForTimeout(500);
  await shot(page, "02-ready-ride-3km.png");

  // H — Go 게이트에 얹힘
  const goBtn = page.getByRole("button", { name: "주행 시작" });
  const goVisible = await goBtn.isVisible({ timeout: 8000 }).catch(() => false);
  await shot(page, "09-go-gate.png");

  // D — 폐합 지점 확대(출발=도착, 다른 길로 되돌아옴을 눈으로)
  await page.evaluate(
    ({ lng, lat }) => {
      const map = window.__RTW_MAP__;
      if (map) map.jumpTo({ center: [lng, lat], zoom: 17.5 });
    },
    { lng: SEOUL.lng, lat: SEOUL.lat },
  );
  await page.waitForTimeout(1000);
  await shot(page, "05-loop-overlap-zoom.png");

  // 성공 후에는 Route 가 생겨 카드가 Go 게이트에 자리를 내준다(§3.3) — 각 거리마다
  // 새로 새로고침해 S1로 되돌아간 뒤 해당 칩을 고른다.
  async function freshS1() {
    await page.reload({ waitUntil: "domcontentloaded" });
    const g = page.getByRole("dialog", { name: "시작" });
    if (await g.isVisible({ timeout: 3000 }).catch(() => false)) {
      await g.getByRole("button", { name: "시작", exact: true }).click();
      await g.waitFor({ state: "hidden", timeout: 30000 });
    }
    await page.keyboard.press("Escape").catch(() => {});
    await waitCard(page);
    await page.waitForTimeout(800);
  }

  // C-1 — 2km
  await freshS1();
  mode = { type: "success", km: 2, bearing: 60 };
  await page.getByRole("button", { name: "2 km" }).click();
  await page.getByRole("button", { name: "Ready Ride 시작" }).click();
  await page.waitForTimeout(1200);
  await shot(page, "03-ready-ride-2km.png");

  // C-2 — 10km
  await freshS1();
  mode = { type: "success", km: 10, bearing: 200 };
  await page.getByRole("button", { name: "10 km" }).click();
  await page.getByRole("button", { name: "Ready Ride 시작" }).click();
  await page.waitForTimeout(1200);
  await shot(page, "04-ready-ride-10km.png");

  // F — 폐합 실패(도로 없는 지역 좌표) → 실패 문구, 편도로 낙하하지 않음
  await freshS1();
  mode = { type: "fail" };
  await page.getByRole("button", { name: "Ready Ride 시작" }).click();
  await page.waitForTimeout(1200);
  await shot(page, "07-failure-fallback.png");

  await page.unroute("**/getDistanceAutoRoute");

  // G — 기존 방향 클릭 자동 Route(실제 운영 백엔드, 가로채지 않음) 회귀
  let gCaptured = false;
  try {
    await page.reload({ waitUntil: "domcontentloaded" });
    const gate3 = page.getByRole("dialog", { name: "시작" });
    if (await gate3.isVisible({ timeout: 3000 }).catch(() => false)) {
      await gate3.getByRole("button", { name: "시작", exact: true }).click();
      await gate3.waitFor({ state: "hidden", timeout: 30000 });
    }
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(500);

    // 리로드 후 카메라가 이전 지역/기본값으로 남아 있을 수 있어 명시적으로 점프한다
    // (그렇지 않으면 project() 좌표가 캔버스 밖으로 나가 클릭이 지도 밖을 때린다).
    await page.evaluate(
      ({ lng, lat }) => {
        const m = window.__RTW_MAP__;
        if (m) m.jumpTo({ center: [lng, lat], zoom: 15 });
      },
      { lng: SEOUL.lng, lat: SEOUL.lat },
    );
    await page.waitForTimeout(1000);

    const map = page.locator("canvas.mapboxgl-canvas");
    await map.waitFor({ state: "visible", timeout: 20000 });
    const box = await map.boundingBox();

    async function clickLngLat(lng, lat) {
      const pt = await page.evaluate(
        ({ lng, lat }) => {
          const m = window.__RTW_MAP__;
          const p = m.project([lng, lat]);
          return { x: p.x, y: p.y };
        },
        { lng, lat },
      );
      await page.mouse.click(box.x + pt.x, box.y + pt.y);
    }

    await clickLngLat(SEOUL.lng, SEOUL.lat);
    await page.waitForTimeout(600);
    const startBtnMap = page.locator(".map-view__pick-btn--start");
    if (await startBtnMap.isVisible({ timeout: 3000 }).catch(() => false)) {
      await startBtnMap.click();
      await page.waitForTimeout(400);
      const checkbox = page.locator(".map-view__pick-distance-mode-checkbox");
      if (await checkbox.isVisible({ timeout: 3000 }).catch(() => false)) {
        await checkbox.check({ force: true });
        await page.waitForTimeout(400);
        await clickLngLat(SEOUL.lng + 0.02, SEOUL.lat + 0.01);
        await page.waitForTimeout(6000);
        await shot(page, "08-legacy-direction-route.png");
        gCaptured = true;
      }
    }
  } catch (e) {
    console.log("G capture live-flow error", String(e));
  }

  fs.writeFileSync(
    path.join(OUT_OPS, "capture-report.json"),
    JSON.stringify({ gCaptured, requestLog }, null, 2),
  );
  fs.writeFileSync(
    path.join(OUT_ASCII, "capture-report.json"),
    JSON.stringify({ gCaptured, requestLog }, null, 2),
  );

  console.log("goVisible(H)", goVisible);
  console.log("gCaptured", gCaptured);

  await context.close();
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

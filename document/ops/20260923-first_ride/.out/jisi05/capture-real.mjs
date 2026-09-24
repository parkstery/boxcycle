/**
 * 지시05 §7 — Ready Ride 단순 경로 캡처 A~D.
 * 배포 금지 → Functions 에뮬레이터(실 Mapbox `.secret.local`) + Vite :5002.
 * Playwright 로 geometry 를 지어내지 않는다(인터셉트 없음).
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../../../..");
const OUT = path.join(ROOT, "document/ops/20260923-first_ride/.out/jisi05");
const BASE = process.env.RTW_BASE_URL || "http://127.0.0.1:5002";
const FS = "http://127.0.0.1:8080/v1/projects/boxcycle-dc2df/databases/(default)/documents";

fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name) {
  const buf = await page.screenshot({ type: "png" });
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log("shot", name, buf.length);
}

async function seedTokens(uid) {
  const url =
    `${FS}/users/${uid}?updateMask.fieldPaths=routeTokenBalance&updateMask.fieldPaths=routeTokenOnboardingGranted`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: {
        routeTokenBalance: { integerValue: "20" },
        routeTokenOnboardingGranted: { booleanValue: true },
      },
    }),
  });
  console.log("seedTokens", uid, res.status);
}

function uidFromJwt(authHeader) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const payload = authHeader.slice(7).split(".")[1];
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return json.user_id || json.sub || null;
  } catch {
    return null;
  }
}

async function enterGuest(page) {
  let capturedUid = null;
  page.on("request", (req) => {
    if (!req.url().includes("ensureRouteTokenOnboardingHttp") && !req.url().includes("getDistanceAutoRoute")) return;
    const uid = uidFromJwt(req.headers()["authorization"]);
    if (uid) capturedUid = uid;
  });

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
  await page.waitForTimeout(800);
  await page.keyboard.press("Escape").catch(() => {});

  for (let i = 0; i < 40 && !capturedUid; i++) await page.waitForTimeout(250);
  if (!capturedUid) throw new Error("no auth uid after guest start");
  page._rtwUid = capturedUid;
  await seedTokens(capturedUid);
  await page.waitForTimeout(1200);
  return capturedUid;
}

async function waitCard(page) {
  await page.locator(".local-first__card").waitFor({ state: "visible", timeout: 60000 });
}

async function pickRegion(page, query) {
  await page.getByRole("button", { name: "지역 선택" }).click();
  await page.waitForTimeout(400);
  const input = page.locator("#menu-place-search-input");
  await input.fill(query);
  await page.waitForTimeout(1000);
  const first = page.locator(".menu-place-search__item").first();
  await first.waitFor({ state: "visible", timeout: 30000 });
  await first.click();
  await page.locator(".local-first__card").waitFor({ state: "visible", timeout: 30000 });
  await page.waitForTimeout(1500);
}

async function waitRouteOrFail(page, ms = 60000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const info = await page.evaluate(() => {
      const map = window.__RTW_MAP__;
      let coords = 0;
      try {
        const style = map?.getStyle?.();
        for (const [id, src] of Object.entries(style?.sources || {})) {
          if (src.type !== "geojson") continue;
          const data = map.getSource(id)?._data;
          const c =
            data?.features?.[0]?.geometry?.coordinates ||
            data?.geometry?.coordinates ||
            (Array.isArray(data?.coordinates) ? data.coordinates : null);
          if (Array.isArray(c) && c.length > coords) coords = c.length;
        }
      } catch {}
      const card = document.querySelector(".local-first__card")?.innerText || "";
      return { coords, card };
    });
    if (info.coords > 8) return `route:${info.coords}`;
    if (/Route Token 이 부족|찾지 못|실패/.test(info.card) && !/생성 중|찾는 중|준비/.test(info.card)) {
      return "fail:" + info.card.replace(/\s+/g, " ").slice(0, 120);
    }
    await page.waitForTimeout(500);
  }
  return "timeout";
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 740, height: 400 },
    locale: "ko-KR",
    geolocation: { longitude: 127.0339, latitude: 37.5088 },
    permissions: ["geolocation"],
  });
  const page = await context.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("BROWSER_ERR", msg.text().slice(0, 180));
  });
  page.on("response", (res) => {
    if (res.url().includes("getDistanceAutoRoute") || res.url().includes("ensureRouteToken")) {
      console.log("HTTP", res.status(), res.url().split("/").pop());
    }
  });

  const uid = await enterGuest(page);
  await waitCard(page);
  await pickRegion(page, "논현동");

  // 재시드(지역 선택 중 새 쓰기로 잔액이 덮일 수 있음)
  if (uid) await seedTokens(uid);
  await page.waitForTimeout(800);

  const startBtn = page.getByRole("button", { name: "Ready Ride 시작" });
  await startBtn.click();
  const aStatus = await waitRouteOrFail(page, 90000);
  console.log("A status", aStatus);
  await page.waitForTimeout(1000);
  await shot(page, "01-ready-ride-3km.png");
  console.log("A CARD", JSON.stringify(await page.locator(".local-first__card").innerText().catch(() => "")));

  // B
  const another = page.getByRole("button", { name: "다른 경로" });
  if (await another.isVisible().catch(() => false)) {
    if (uid) await seedTokens(uid);
    await another.click();
    const bStatus = await waitRouteOrFail(page, 90000);
    console.log("B status", bStatus);
    await page.waitForTimeout(1000);
    await shot(page, "02-other-route.png");
  } else {
    console.log("B SKIP — 다른 경로 버튼 없음 (A 실패)");
    await shot(page, "02-other-route.png");
  }

  // C
  const goVisible =
    (await page.getByRole("button", { name: /^Go$/i }).isVisible().catch(() => false)) ||
    (await page.locator("button:has-text(\"출발\")").first().isVisible().catch(() => false)) ||
    (await page.locator("[data-testid=\"route-dock-go\"]").isVisible().catch(() => false));
  console.log("C goVisible", goVisible);
  await shot(page, "03-go-gate.png");

  // D — 클릭 기반 거리 자동 Route 회귀 (지시02 G 와 동일 흐름, 에뮬레이터 실 Mapbox)
  await page.evaluate(() => {
    try {
      localStorage.removeItem("rtw.localFirst.region");
    } catch {}
  });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
  const gate = page.getByRole("dialog", { name: "시작" });
  if (await gate.isVisible({ timeout: 5000 }).catch(() => false)) {
    await gate.getByRole("button", { name: "시작", exact: true }).click();
    await gate.waitFor({ state: "hidden", timeout: 60000 });
  }
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(800);

  // 인천 논현동 (지명검색이 가리키는 좌표) — jumpTo 후 project 클릭
  const NH = { lng: 126.7225, lat: 37.4019 };
  await page.evaluate(({ lng, lat }) => {
    const m = window.__RTW_MAP__;
    if (m) m.jumpTo({ center: [lng, lat], zoom: 15 });
  }, NH);
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

  let dOk = false;
  await clickLngLat(NH.lng, NH.lat);
  await page.waitForTimeout(600);
  const startBtnMap = page.locator(".map-view__pick-btn--start");
  if (await startBtnMap.isVisible({ timeout: 4000 }).catch(() => false)) {
    await startBtnMap.click();
    await page.waitForTimeout(400);
    const checkbox = page.locator(".map-view__pick-distance-mode-checkbox");
    if (await checkbox.isVisible({ timeout: 4000 }).catch(() => false)) {
      await checkbox.check({ force: true });
      await page.waitForTimeout(400);
      await clickLngLat(NH.lng + 0.02, NH.lat + 0.01);
      const dStatus = await waitRouteOrFail(page, 60000);
      console.log("D status", dStatus);
      dOk = String(dStatus).startsWith("route:");
    }
  }
  await shot(page, "04-legacy-click.png");
  const dInfo = await page.evaluate(() => {
    const map = window.__RTW_MAP__;
    let routePts = 0;
    try {
      const style = map?.getStyle?.();
      for (const [id] of Object.entries(style?.sources || {})) {
        const data = map.getSource(id)?._data;
        const c = data?.features?.[0]?.geometry?.coordinates || data?.geometry?.coordinates;
        if (Array.isArray(c) && c.length > routePts) routePts = c.length;
      }
    } catch {}
    return { routePts, center: map?.getCenter?.() };
  });
  console.log("D info", JSON.stringify({ ...dInfo, dOk }));

  await browser.close();
  fs.writeFileSync(
    path.join(OUT, "capture-meta.json"),
    JSON.stringify({ aStatus, dInfo: { ...dInfo, dOk }, base: BASE, at: new Date().toISOString() }, null, 2),
  );
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});

/**
 * 지시01 Local First Recognition 캡처.
 * 산출: document/ops/20260923-first_ride/.out/jisi01/ (한글 경로 미러: apps/web/.out/first-ride-jisi01/)
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../../..");
const OUT_ASCII = path.join(ROOT, "apps/web/.out/first-ride-jisi01");
const OUT_OPS = path.join(ROOT, "document/ops/20260923-first_ride/.out/jisi01");
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
    try {
      window.__rtwGeoReset?.();
    } catch {}
  }, REGION_KEY);
  const gate = page.getByRole("dialog", { name: "시작" });
  await gate.waitFor({ state: "visible", timeout: 60000 });
  await gate.getByRole("button", { name: "시작", exact: true }).click();
  await gate.waitFor({ state: "hidden", timeout: 60000 });
  // 시트·메뉴가 끼면 카드 게이트가 막힌다 — 닫기
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(400);
  await page.keyboard.press("Escape").catch(() => {});
}

async function waitCard(page) {
  await page.locator(".local-first__card").waitFor({ state: "visible", timeout: 45000 });
}

function measureOverlap(a, b) {
  if (!a || !b) return null;
  const xOverlap = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const yOverlap = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  if (xOverlap > 0 && yOverlap > 0) return -Math.min(xOverlap, yOverlap);
  const dx = a.right < b.left ? b.left - a.right : a.left > b.right ? a.left - b.right : 0;
  const dy = a.bottom < b.top ? b.top - a.bottom : a.top > b.bottom ? a.top - b.bottom : 0;
  if (dx === 0) return dy;
  if (dy === 0) return dx;
  return Math.hypot(dx, dy);
}

async function measureCard(page) {
  return page.evaluate(() => {
    const card = document.querySelector(".local-first__card");
    const dock = document.querySelector(".route-dock-anchor, .map-bottom-left-stack");
    const minimap = document.querySelector(".route-minimap");
    const hud = document.querySelector(".map-hud__tl, .map-hud");
    if (!card) return null;
    const r = card.getBoundingClientRect();
    const box = (el) => {
      if (!el) return null;
      const x = el.getBoundingClientRect();
      return { top: x.top, left: x.left, right: x.right, bottom: x.bottom, w: x.width, h: x.height };
    };
    const dockR = box(dock);
    const miniR = box(minimap);
    const hudR = box(hud);
    const gap = (a, b) => {
      if (!a || !b) return null;
      const xOverlap = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const yOverlap = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.bottom));
      // fix typo below in node — recompute simply
      return null;
    };
    void gap;
    const minGap = (other) => {
      if (!other) return null;
      const xOverlap = Math.max(0, Math.min(r.right, other.right) - Math.max(r.left, other.left));
      const yOverlap = Math.max(0, Math.min(r.bottom, other.bottom) - Math.max(r.top, other.top));
      if (xOverlap > 0 && yOverlap > 0) return -Math.min(xOverlap, yOverlap);
      const dx = r.right < other.left ? other.left - r.right : r.left > other.right ? r.left - other.right : 0;
      const dy = r.bottom < other.top ? other.top - r.bottom : r.top > other.bottom ? r.top - other.bottom : 0;
      if (dx === 0) return Math.round(dy);
      if (dy === 0) return Math.round(dx);
      return Math.round(Math.min(dx || 1e9, dy || 1e9));
    };
    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      card: {
        top: +r.top.toFixed(1),
        left: +r.left.toFixed(1),
        w: +r.width.toFixed(1),
        h: +r.height.toFixed(1),
        pctH: +((r.height / window.innerHeight) * 100).toFixed(1),
      },
      gapDock: minGap(dockR),
      gapMinimap: minGap(miniR),
      gapHud: minGap(hudR),
      geoCalls: window.__rtwGeoCallCount ?? null,
    };
  });
}

async function jumpZoom(page, zoom) {
  await page.evaluate(
    ({ lng, lat, zoom: z }) => {
      const map = window.__RTW_MAP__;
      if (map) {
        map.jumpTo({ center: [lng, lat], zoom: z });
      }
    },
    { lng: SEOUL.lng, lat: SEOUL.lat, zoom },
  );
  await page.waitForTimeout(1200);
}

const report = {
  base: BASE,
  geo: {},
  localStorage: {},
  measure: {},
  zoomPick: { value: 13, reason: "" },
};

async function main() {
  const browser = await chromium.launch({ headless: true });

  // --- A/B S0 + geo gate proof + region search + S1 + zoom ---
  {
    const context = await browser.newContext({
      viewport: { width: 900, height: 400 },
      locale: "ko-KR",
      geolocation: { longitude: SEOUL.lng, latitude: SEOUL.lat },
      permissions: ["geolocation"],
    });
    const page = await context.newPage();
    await enterGuest(page);
    await waitCard(page);
    await page.waitForTimeout(1500);

    const geo0 = await page.evaluate(() => window.__rtwGeoCallCount ?? -1);
    report.geo.loadToS0 = geo0;
    report.measure["900x400"] = await measureCard(page);
    await shot(page, "01-S0-900x400.png");

    await page.setViewportSize({ width: 740, height: 300 });
    await page.waitForTimeout(400);
    report.measure["740x300"] = await measureCard(page);
    await shot(page, "02-S0-740x300.png");
    await shot(page, "11-legibility-740x300.png");

    // 지역 선택만 — geo 여전히 0
    await page.getByRole("button", { name: "지역 선택" }).click();
    await page.waitForTimeout(600);
    const geoAfterSearchOpen = await page.evaluate(() => window.__rtwGeoCallCount ?? -1);
    report.geo.afterRegionSearchOnly = geoAfterSearchOpen;
    await shot(page, "03-region-search-open.png");

    const input = page.locator("#menu-place-search-input");
    await input.fill("마포구");
    await page.waitForTimeout(900);
    const first = page.locator(".menu-place-search__item").first();
    await first.waitFor({ state: "visible", timeout: 20000 });
    await first.click();
    await page.locator(".local-first__card").waitFor({ state: "visible", timeout: 20000 });
    await page.waitForTimeout(1800);
    await shot(page, "04-S1-after-pick-740x300.png");

    const stored = await page.evaluate((key) => {
      try {
        return localStorage.getItem(key);
      } catch (e) {
        return String(e);
      }
    }, REGION_KEY);
    report.localStorage.afterPick = stored;

    // zoom candidates — same city
    await jumpZoom(page, 12);
    await shot(page, "05-zoom12.png");
    await jumpZoom(page, 13);
    await shot(page, "06-zoom13.png");
    await jumpZoom(page, 14);
    await shot(page, "07-zoom14.png");
    report.zoomPick = {
      value: 13,
      reason:
        "740×300 에서 zoom 12 는 시 단위라 구·동 라벨이 희미하고, 14 는 도로명 위주. 13 에서 구·동 라벨이 가장 읽힘.",
    };

    // geo click counter — reset then one click (will succeed; we only need count)
    await page.evaluate(() => window.__rtwGeoReset?.());
    await page.getByRole("button", { name: "다시 고르기" }).click();
    await page.waitForTimeout(300);
    const beforeClick = await page.evaluate(() => window.__rtwGeoCallCount ?? -1);
    await page.getByRole("button", { name: "현재 위치" }).click();
    await page.waitForTimeout(2500);
    const afterClick = await page.evaluate(() => window.__rtwGeoCallCount ?? -1);
    report.geo.beforeCurrentClick = beforeClick;
    report.geo.afterCurrentClick = afterClick;

    // reload restore S1
    await page.reload({ waitUntil: "domcontentloaded" });
    const gate = page.getByRole("dialog", { name: "시작" });
    if (await gate.isVisible({ timeout: 3000 }).catch(() => false)) {
      // guest session may persist — if gate shows, start again
      await gate.getByRole("button", { name: "시작", exact: true }).click();
      await gate.waitFor({ state: "hidden", timeout: 30000 });
    }
    await waitCard(page);
    await page.waitForTimeout(1200);
    const s1Text = await page.locator(".local-first__title").innerText();
    report.localStorage.reloadS1Title = s1Text;
    report.localStorage.reloadIsS1 = s1Text.includes("Ready Ride");

    await context.close();
  }

  // --- E S2 denied ---
  {
    const context = await browser.newContext({
      viewport: { width: 740, height: 300 },
      locale: "ko-KR",
      // no geolocation permission
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      const deny = (success, error) => {
        if (typeof error === "function") {
          error({
            code: 1,
            message: "User denied Geolocation",
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          });
        }
      };
      // wrap after app probe: replace on next tick from page after load via evaluate below
      window.__rtwInstallDeny = () => {
        navigator.geolocation.getCurrentPosition = deny;
      };
    });
    await enterGuest(page);
    await waitCard(page);
    await page.evaluate(() => {
      window.__rtwInstallDeny?.();
      // re-wrap counter so deny still increments
      let n = window.__rtwGeoCallCount || 0;
      const deny = navigator.geolocation.getCurrentPosition;
      navigator.geolocation.getCurrentPosition = (s, e, o) => {
        n += 1;
        window.__rtwGeoCallCount = n;
        return deny(s, e, o);
      };
      window.__rtwGeoCallCount = n;
    });
    await page.getByRole("button", { name: "현재 위치" }).click();
    await page.waitForTimeout(800);
    await page.getByText("위치를 확인하지 못했습니다").waitFor({ timeout: 10000 });
    await shot(page, "08-S2-denied-740x300.png");
    await context.close();
  }

  // --- F NextRide regression harness (product CSS) ---
  {
    const harnessPath = path.join(OUT_ASCII, "nextride-harness.html");
    const cssRel = path
      .relative(OUT_ASCII, path.join(ROOT, "apps/web/src/components/ride/NextRideCard.css"))
      .replace(/\\/g, "/");
    fs.writeFileSync(
      harnessPath,
      `<!DOCTYPE html>
<html lang="ko"><head>
<meta charset="utf-8"/>
<title>NextRide regression</title>
<link rel="stylesheet" href="${cssRel}"/>
<style>
html{font-size:13.5px}
*{box-sizing:border-box}
body{margin:0;width:740px;height:300px;overflow:hidden;background:#1a2332;color:#f8fafc;font-family:system-ui,sans-serif}
.map{position:absolute;inset:0;background:linear-gradient(135deg,#7a9a6a,#2a4a30)}
:root{--rtw-accent:#e8a33d;--rtw-text:#f8fafc;--rtw-glass-border:rgba(248,250,252,.18);--rtw-glass-bg-strong:rgba(10,16,26,.64);--rtw-glass-blur:12px;--rtw-glass-shadow:4px 8px 28px rgba(2,8,20,.4);--rtw-radius:14px;--mapbox-logo-clearance:.35rem}
.note{position:absolute;left:8px;top:8px;font-size:11px;opacity:.7}
</style></head>
<body>
<div class="map"></div>
<p class="note">이전 주행 사용자 — NextRideCard (LocalFirst 게이트=!nextRideView 로 동시 표시 불가)</p>
<div class="next-ride-anchor" aria-label="다음 주행">
  <div class="next-ride__card hud-glass" role="group">
    <div class="next-ride__head"><h2 class="next-ride__title">다음 주행 이어가기</h2>
      <button type="button" class="next-ride__dismiss">✕</button></div>
    <p class="next-ride__line next-ride__line--muted">마지막 주행 2026. 9. 20. · 오늘 3.2 km</p>
    <p class="next-ride__line next-ride__line--strong">망원동</p>
    <div class="next-ride__actions">
      <button type="button" class="next-ride__btn next-ride__btn--primary">여기에서 계속</button>
      <button type="button" class="next-ride__btn next-ride__btn--ghost">지도에서 보기</button>
    </div>
  </div>
</div>
</body></html>`,
    );
    const context = await browser.newContext({ viewport: { width: 740, height: 300 } });
    const page = await context.newPage();
    await page.goto("file://" + harnessPath.replace(/\\/g, "/"));
    await shot(page, "09-nextride-regression.png");
    await context.close();
  }

  // --- G riding hidden ---
  try {
    const context = await browser.newContext({
      viewport: { width: 740, height: 300 },
      locale: "ko-KR",
    });
    const page = await context.newPage();
    await enterGuest(page);
    await waitCard(page);
    await page.locator(".local-first__btn--intro").click({ timeout: 15000 });
    const start = page.getByRole("button", { name: "주행 시작" });
    const sensor = page.getByRole("button", { name: /케이던스 센서/ });
    if (await sensor.isVisible({ timeout: 8000 }).catch(() => false)) {
      await sensor.click();
      const sheet = page.getByRole("dialog", { name: "케이던스 센서" });
      if (await sheet.isVisible({ timeout: 5000 }).catch(() => false)) {
        const none = sheet.getByRole("button", { name: "센서 없음" });
        if (await none.isVisible().catch(() => false)) await none.click();
        const close = sheet.getByRole("button", { name: "센서 설정 닫기" });
        if (await close.isVisible().catch(() => false)) await close.click();
      }
    }
    if (await start.isVisible({ timeout: 45000 }).catch(() => false)) {
      await start.click();
      await page.waitForTimeout(2500);
    } else {
      await page.waitForTimeout(4000);
    }
    report.ridingCardVisible = await page.locator(".local-first__card").isVisible().catch(() => false);
    await shot(page, "10-riding-hidden.png");
    await context.close();
  } catch (e) {
    report.ridingError = String(e?.message || e);
    console.warn("riding capture failed", e);
  }

  // --- localStorage blocked S0 ---
  {
    const context = await browser.newContext({ viewport: { width: 740, height: 300 } });
    await context.addInitScript(() => {
      const proto = Storage.prototype;
      proto.setItem = () => {
        throw new Error("blocked");
      };
      proto.getItem = () => {
        throw new Error("blocked");
      };
      proto.removeItem = () => {
        throw new Error("blocked");
      };
    });
    const page = await context.newPage();
    await enterGuest(page);
    await waitCard(page);
    const title = await page.locator(".local-first__title").innerText();
    report.localStorage.blockedRendersS0 = title.includes("어디에서 첫 라이딩");
    await context.close();
  }

  fs.writeFileSync(path.join(OUT_ASCII, "measure.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(OUT_OPS, "measure.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

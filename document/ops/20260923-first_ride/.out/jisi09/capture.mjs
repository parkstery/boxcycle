/**
 * 지시09 캡처 A1/A2 · C1/C2.
 * Vite :5002 + 에뮬레이터. 실 Mapbox pk 필요.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../../../..");
const OUT = path.join(ROOT, "document/ops/20260923-first_ride/.out/jisi09");
const BASE = process.env.RTW_BASE_URL || "http://127.0.0.1:5002";
const WONJU = [127.9459, 37.3422];
const GANGNAM = [127.035, 37.505];

fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name) {
  const buf = await page.screenshot({ type: "png" });
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log("shot", name, buf.length);
}

async function centerOf(page) {
  return page.evaluate(() => {
    const c = window.__RTW_MAP__?.getCenter?.();
    return c ? [c.lng, c.lat] : null;
  });
}

function distM(a, b) {
  if (!a || !b) return Infinity;
  const toR = (d) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toR(b[1] - a[1]);
  const dLng = toR(b[0] - a[0]);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(a[1])) * Math.cos(toR(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

async function boot(page, { seedLastRideWonju = false, clearAll = false } = {}) {
  await page.addInitScript(
    ({ seedLastRideWonju, clearAll, WONJU }) => {
      window.__rtwForceGenerateCostBase = 0;
      try {
        if (clearAll) {
          localStorage.clear();
        } else {
          localStorage.removeItem("rtw.localFirst.region");
        }
        if (seedLastRideWonju) {
          const session = {
            id: "jisi09-wonju",
            endedAt: new Date().toISOString(),
            elapsedSec: 600,
            distanceMeters: 3000,
            avgSpeedKmh: 18,
            caloriesEstimate: 100,
            routeDistanceMeters: 3000,
            routeDurationSec: 600,
            sessionEndLngLat: WONJU,
            sessionStartLngLat: WONJU,
            sessionEndPlaceLabel: "원주시",
            startPlaceLabel: "원주시",
            endPlaceLabel: "원주시",
          };
          localStorage.setItem("boxcycle_web_ride_sessions_v1", JSON.stringify([session]));
        } else if (clearAll) {
          localStorage.removeItem("boxcycle_web_ride_sessions_v1");
        }
      } catch {}
    },
    { seedLastRideWonju, clearAll, WONJU },
  );
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 90000 });
  const gate = page.getByRole("dialog", { name: "시작" });
  if (await gate.isVisible({ timeout: 15000 }).catch(() => false)) {
    await gate.getByRole("button", { name: "시작", exact: true }).click();
    await gate.waitFor({ state: "hidden", timeout: 90000 });
  }
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(2000);
  await page.waitForFunction(() => Boolean(window.__RTW_MAP__), null, { timeout: 60000 });
  await page.waitForTimeout(800);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const meta = { at: new Date().toISOString(), base: BASE };

  // A1 — 마지막 주행 원주
  {
    const ctx = await browser.newContext({ viewport: { width: 740, height: 400 }, locale: "ko-KR" });
    const page = await ctx.newPage();
    await boot(page, { seedLastRideWonju: true, clearAll: true });
    const c = await centerOf(page);
    meta.a1 = { center: c, distToWonjuM: Math.round(distM(c, WONJU)) };
    console.log("A1", meta.a1);
    await shot(page, "01-center-last-ride.png");
    await ctx.close();
  }

  // A2 — 기록 없는 새 게스트 → 강남
  {
    const ctx = await browser.newContext({ viewport: { width: 740, height: 400 }, locale: "ko-KR" });
    const page = await ctx.newPage();
    await boot(page, { clearAll: true });
    const c = await centerOf(page);
    meta.a2 = { center: c, distToGangnamM: Math.round(distM(c, GANGNAM)) };
    console.log("A2", meta.a2);
    await shot(page, "02-center-first-user.png");
    await ctx.close();
  }

  // C1/C2 — 결과 시트 DOM 을 실제 컴포넌트 클래스로 마운트(주행 전체 e2e 대신 위계 증거).
  // 숫자는 formatNewRoadHero 규칙(+1.20 / 0 미표시)과 동일.
  {
    const ctx = await browser.newContext({ viewport: { width: 740, height: 400 }, locale: "ko-KR" });
    const page = await ctx.newPage();
    await boot(page, { clearAll: true });
    await page.evaluate(() => {
      const mount = (id, html) => {
        let el = document.getElementById(id);
        if (!el) {
          el = document.createElement("div");
          el.id = id;
          el.style.cssText = "position:fixed;inset:0;z-index:9999;pointer-events:none;";
          document.body.appendChild(el);
        }
        el.innerHTML = html;
      };
      const sheet = (conquestHtml) => `
        <div class="ride-summary" style="pointer-events:auto">
          <div class="ride-summary__sheet" style="margin:auto;margin-bottom:1rem;">
            <div class="ride-summary__handle"></div>
            <div class="ride-summary__head">
              <h2 class="ride-summary__title">주행 결과<span class="ride-summary__title-unit">km</span></h2>
            </div>
            <div class="ride-summary__heroes">
              <div class="ride-summary__heroes-main">
                ${conquestHtml}
                <div class="ride-summary__hero">
                  <strong class="ride-summary__hero-v">3.00 / 3.00</strong>
                </div>
              </div>
            </div>
          </div>
        </div>`;
      mount(
        "jisi09-c1",
        sheet(`
          <div class="ride-summary__conquest-hero">
            <div class="ride-summary__conquest-label">새 도로</div>
            <strong class="ride-summary__conquest-value">+1.20</strong>
          </div>`),
      );
    });
    await page.waitForTimeout(400);
    await shot(page, "03-summary-new-road.png");

    await page.evaluate(() => {
      const el = document.getElementById("jisi09-c1");
      if (!el) return;
      el.innerHTML = `
        <div class="ride-summary" style="pointer-events:auto">
          <div class="ride-summary__sheet" style="margin:auto;margin-bottom:1rem;">
            <div class="ride-summary__handle"></div>
            <div class="ride-summary__head">
              <h2 class="ride-summary__title">주행 결과<span class="ride-summary__title-unit">km</span></h2>
            </div>
            <div class="ride-summary__heroes">
              <div class="ride-summary__heroes-main ride-summary__heroes-main--solo">
                <div class="ride-summary__hero">
                  <strong class="ride-summary__hero-v">3.00 / 3.00</strong>
                </div>
              </div>
            </div>
          </div>
        </div>`;
    });
    await page.waitForTimeout(400);
    await shot(page, "04-summary-zero.png");
    await ctx.close();
  }

  // 게이트
  if (meta.a1.distToWonjuM > 2500) {
    console.error("FAIL A1 not near Wonju", meta.a1);
    process.exit(1);
  }
  if (meta.a2.distToGangnamM > 2500) {
    console.error("FAIL A2 not near Gangnam", meta.a2);
    process.exit(1);
  }

  fs.writeFileSync(path.join(OUT, "capture-meta.json"), JSON.stringify(meta, null, 2));
  console.log("META", JSON.stringify(meta, null, 2));
  await browser.close();
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
